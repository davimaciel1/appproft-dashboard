const pool = require('../db/pool');
const notificationSystem = require('./notificationSystem');

class HijackerAlertService {
  constructor() {
    this.checkInterval = 5 * 60 * 1000; // 5 minutos
    this.isRunning = false;
  }

  async checkForNewHijackers() {
    try {
      // Buscar alertas não enviados
      const result = await pool.query(`
        SELECT 
          ha.*,
          p.name as product_full_name,
          p.image_url
        FROM hijacker_alerts ha
        LEFT JOIN products p ON ha.product_asin = p.asin
        WHERE ha.is_active = true 
        AND ha.alert_sent = false
      `);

      if (result.rows.length > 0) {
        console.log(`🚨 ${result.rows.length} novos hijackers detectados!`);
        
        for (const alert of result.rows) {
          await this.sendHijackerAlert(alert);
        }
      }

      // Verificar alertas ativos há muito tempo
      await this.checkLongRunningHijackers();

    } catch (error) {
      console.error('Erro ao verificar hijackers:', error);
    }
  }

  async sendHijackerAlert(alert) {
    try {
      const message = this.formatAlertMessage(alert);
      
      // Enviar notificação multi-canal
      const notificationData = {
        type: 'hijacker_detected',
        priority: 'high',
        title: `🚨 HIJACKER ALERT: ${alert.product_asin}`,
        message: message.text,
        data: {
          product_asin: alert.product_asin,
          product_name: alert.product_full_name || alert.product_name,
          hijacker_name: alert.hijacker_name,
          hijacker_id: alert.hijacker_id,
          our_price: alert.our_price,
          hijacker_price: alert.hijacker_price,
          detected_at: alert.detected_at,
          price_difference: (alert.our_price - alert.hijacker_price).toFixed(2)
        }
      };

      // Enviar via todos os canais configurados
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackAlert(alert, message);
      }

      if (process.env.NOTIFICATION_EMAIL) {
        await this.sendEmailAlert(alert, message);
      }

      // Registrar no sistema de notificações
      if (notificationSystem && notificationSystem.notify) {
        await notificationSystem.notify('hijacker_detected', notificationData.data);
      }

      // Marcar como enviado
      await pool.query(`
        UPDATE hijacker_alerts 
        SET alert_sent = true 
        WHERE id = $1
      `, [alert.id]);

      console.log(`✅ Alerta enviado para ${alert.product_asin}`);

    } catch (error) {
      console.error('Erro ao enviar alerta:', error);
    }
  }

  formatAlertMessage(alert) {
    const priceDiff = (alert.our_price - alert.hijacker_price).toFixed(2);
    const isUndercutting = alert.hijacker_price < alert.our_price;
    
    const text = `
🚨 **HIJACKER DETECTADO**

**Produto**: ${alert.product_name || alert.product_asin}
**ASIN**: ${alert.product_asin}

**Hijacker**: ${alert.hijacker_name}
**ID**: ${alert.hijacker_id}

**Preços**:
• Seu preço: $${alert.our_price}
• Preço do Hijacker: $${alert.hijacker_price}
${isUndercutting ? `• UNDERCUTTING por: $${priceDiff} ⚠️` : ''}

**Detectado em**: ${new Date(alert.detected_at).toLocaleString('pt-BR')}

**Ação recomendada**: Verificar o listing e considerar ajuste de preço.
    `.trim();

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0;">🚨 HIJACKER ALERT</h1>
  </div>
  
  <div style="padding: 20px; background: #f8f9fa;">
    <h2 style="color: #333; margin-top: 0;">Produto Afetado</h2>
    <p><strong>${alert.product_name || alert.product_asin}</strong></p>
    <p>ASIN: ${alert.product_asin}</p>
    
    <h3 style="color: #dc3545;">Informações do Hijacker</h3>
    <ul>
      <li><strong>Nome:</strong> ${alert.hijacker_name}</li>
      <li><strong>ID:</strong> ${alert.hijacker_id}</li>
      <li><strong>Detectado:</strong> ${new Date(alert.detected_at).toLocaleString('pt-BR')}</li>
    </ul>
    
    <h3 style="color: #333;">Análise de Preços</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Seu Preço</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">$${alert.our_price}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Preço do Hijacker</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd; ${isUndercutting ? 'color: #dc3545;' : ''}">
          $${alert.hijacker_price}
        </td>
      </tr>
      ${isUndercutting ? `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Diferença</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd; color: #dc3545;">-$${priceDiff}</td>
      </tr>
      ` : ''}
    </table>
    
    <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 5px;">
      <strong>⚠️ Ação Recomendada:</strong> Verifique o listing na Amazon e considere ajustar seu preço para recuperar o Buy Box.
    </div>
  </div>
</div>
    `.trim();

    return { text, html };
  }

  async sendSlackAlert(alert, message) {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) return;

      const isUndercutting = alert.hijacker_price < alert.our_price;
      const color = isUndercutting ? '#dc3545' : '#ffc107';

      const slackMessage = {
        attachments: [{
          color: color,
          title: '🚨 HIJACKER DETECTADO',
          title_link: `https://www.amazon.com/dp/${alert.product_asin}`,
          fields: [
            {
              title: 'Produto',
              value: alert.product_name || alert.product_asin,
              short: false
            },
            {
              title: 'Hijacker',
              value: alert.hijacker_name,
              short: true
            },
            {
              title: 'ID',
              value: alert.hijacker_id,
              short: true
            },
            {
              title: 'Seu Preço',
              value: `$${alert.our_price}`,
              short: true
            },
            {
              title: 'Preço Hijacker',
              value: `$${alert.hijacker_price}`,
              short: true
            }
          ],
          footer: 'AppProft Hijacker Alert',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage)
      });

    } catch (error) {
      console.error('Erro ao enviar para Slack:', error);
    }
  }

  async sendEmailAlert(alert, message) {
    try {
      const email = process.env.NOTIFICATION_EMAIL;
      if (!email || !process.env.SENDGRID_API_KEY) return;

      // Implementar envio de email via SendGrid
      // Por enquanto, apenas log
      console.log(`📧 Email de alerta seria enviado para: ${email}`);

    } catch (error) {
      console.error('Erro ao enviar email:', error);
    }
  }

  async checkLongRunningHijackers() {
    try {
      // Verificar hijackers ativos há mais de 7 dias
      const result = await pool.query(`
        SELECT * FROM hijacker_alerts
        WHERE is_active = true
        AND detected_at < NOW() - INTERVAL '7 days'
        AND (last_reminder_sent IS NULL OR last_reminder_sent < NOW() - INTERVAL '24 hours')
      `);

      for (const alert of result.rows) {
        console.log(`⏰ Enviando lembrete para hijacker de longa duração: ${alert.product_asin}`);
        // Enviar lembrete
        await this.sendHijackerReminder(alert);
      }

    } catch (error) {
      console.error('Erro ao verificar hijackers de longa duração:', error);
    }
  }

  async sendHijackerReminder(alert) {
    // Implementar lógica de lembrete
    console.log(`📨 Lembrete: Hijacker ativo há ${Math.floor((Date.now() - alert.detected_at) / (1000 * 60 * 60 * 24))} dias no produto ${alert.product_asin}`);
  }

  // Iniciar monitoramento
  start() {
    if (this.isRunning) return;
    
    console.log('🚨 Iniciando monitoramento de Hijackers...');
    this.isRunning = true;
    
    // Verificar imediatamente
    this.checkForNewHijackers();
    
    // Configurar verificação periódica
    this.interval = setInterval(() => {
      this.checkForNewHijackers();
    }, this.checkInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.isRunning = false;
      console.log('🛑 Monitoramento de Hijackers parado');
    }
  }
}

module.exports = new HijackerAlertService();