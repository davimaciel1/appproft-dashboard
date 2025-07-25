/**
 * Sistema Completo de Notificações
 * Suporta email, Slack, webhook, e notificações in-app
 */

const { executeSQL } = require('../utils/executeSQL');
const secureLogger = require('../utils/secureLogger');

class NotificationSystem {
  constructor() {
    this.channels = {
      email: this.sendEmail.bind(this),
      slack: this.sendSlack.bind(this),
      webhook: this.sendWebhook.bind(this),
      inapp: this.saveInAppNotification.bind(this),
      sms: this.sendSMS.bind(this)
    };
    
    // Templates de notificação
    this.templates = {
      inventory_low: {
        title: '⚠️ Estoque Baixo',
        priority: 'high',
        channels: ['email', 'slack', 'inapp']
      },
      inventory_critical: {
        title: '🚨 Estoque Crítico',
        priority: 'critical',
        channels: ['email', 'slack', 'sms', 'inapp']
      },
      new_order: {
        title: '🎉 Novo Pedido',
        priority: 'medium',
        channels: ['slack', 'inapp']
      },
      buy_box_lost: {
        title: '📉 Buy Box Perdida',
        priority: 'high',
        channels: ['email', 'slack', 'inapp']
      },
      buy_box_won: {
        title: '🏆 Buy Box Conquistada',
        priority: 'medium',
        channels: ['slack', 'inapp']
      },
      competitor_price_change: {
        title: '💰 Mudança de Preço Concorrente',
        priority: 'medium',
        channels: ['inapp']
      },
      campaign_budget_depleted: {
        title: '💸 Orçamento de Campanha Esgotado',
        priority: 'high',
        channels: ['email', 'slack', 'inapp']
      },
      keyword_position_drop: {
        title: '📉 Queda na Posição de Keyword',
        priority: 'medium',
        channels: ['inapp']
      },
      sales_target_achieved: {
        title: '🎯 Meta de Vendas Atingida',
        priority: 'low',
        channels: ['slack', 'inapp']
      },
      system_error: {
        title: '🚨 Erro do Sistema',
        priority: 'critical',
        channels: ['email', 'slack']
      },
      sync_completed: {
        title: '✅ Sincronização Concluída',
        priority: 'low',
        channels: ['inapp']
      },
      sync_failed: {
        title: '❌ Falha na Sincronização',
        priority: 'high',
        channels: ['email', 'slack', 'inapp']
      }
    };
    
    this.initializeTables();
  }

  async initializeTables() {
    try {
      await executeSQL(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) DEFAULT 'default',
          notification_type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
          status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, read
          channels TEXT[] DEFAULT '{}', -- canais usados
          metadata JSONB DEFAULT '{}',
          scheduled_for TIMESTAMPTZ DEFAULT NOW(),
          sent_at TIMESTAMPTZ,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notifications(tenant_id, status);
        CREATE INDEX IF NOT EXISTS idx_notifications_type_priority ON notifications(notification_type, priority);
        CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for, status);

        CREATE TABLE IF NOT EXISTS notification_settings (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) DEFAULT 'default',
          user_id VARCHAR(50),
          notification_type VARCHAR(50) NOT NULL,
          channels TEXT[] NOT NULL,
          enabled BOOLEAN DEFAULT true,
          settings JSONB DEFAULT '{}', -- configurações específicas por canal
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(tenant_id, user_id, notification_type)
        );

        CREATE TABLE IF NOT EXISTS notification_channels (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) DEFAULT 'default',
          channel_type VARCHAR(20) NOT NULL, -- email, slack, webhook, sms
          channel_name VARCHAR(100) NOT NULL,
          configuration JSONB NOT NULL, -- configurações específicas do canal
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      secureLogger.info('Tabelas do sistema de notificações inicializadas');
    } catch (error) {
      secureLogger.error('Erro ao inicializar tabelas de notificações:', error);
    }
  }

  /**
   * Enviar notificação
   */
  async notify(type, data, options = {}) {
    try {
      const template = this.templates[type];
      if (!template) {
        throw new Error(`Template de notificação não encontrado: ${type}`);
      }

      const notification = {
        type,
        title: template.title,
        message: this.generateMessage(type, data),
        priority: options.priority || template.priority,
        channels: options.channels || template.channels,
        tenantId: options.tenantId || 'default',
        userId: options.userId,
        metadata: { ...data, ...options.metadata },
        scheduledFor: options.scheduledFor || new Date()
      };

      // Salvar notificação no banco
      const notificationId = await this.saveNotification(notification);
      
      // Verificar configurações do usuário
      const userChannels = await this.getUserNotificationSettings(
        notification.tenantId,
        notification.userId,
        type
      );
      
      const finalChannels = userChannels.length > 0 ? userChannels : notification.channels;
      
      // Enviar por todos os canais configurados
      const results = await this.sendToChannels(notificationId, notification, finalChannels);
      
      // Atualizar status
      const allSuccessful = results.every(r => r.success);
      await this.updateNotificationStatus(
        notificationId, 
        allSuccessful ? 'sent' : 'failed',
        results
      );
      
      secureLogger.info(`Notificação ${type} enviada`, {
        notificationId,
        channels: finalChannels,
        success: allSuccessful
      });
      
      return { notificationId, results, success: allSuccessful };
      
    } catch (error) {
      secureLogger.error(`Erro ao enviar notificação ${type}:`, error);
      throw error;
    }
  }

  generateMessage(type, data) {
    const messages = {
      inventory_low: `Produto ${data.product_name} (${data.asin}) está com estoque baixo: ${data.current_stock} unidades restantes. Days of supply: ${data.days_of_supply} dias.`,
      
      inventory_critical: `🚨 CRÍTICO: Produto ${data.product_name} (${data.asin}) com apenas ${data.current_stock} unidades em estoque! Provável ruptura em ${data.days_of_supply} dias.`,
      
      new_order: `Novo pedido recebido! Produto: ${data.product_name}, Quantidade: ${data.quantity}, Valor: R$ ${data.amount}`,
      
      buy_box_lost: `Você perdeu a Buy Box do produto ${data.product_name} (${data.asin}). Preço atual: R$ ${data.current_price}, Concorrente: R$ ${data.competitor_price}`,
      
      buy_box_won: `🏆 Parabéns! Você conquistou a Buy Box do produto ${data.product_name} (${data.asin}) com preço de R$ ${data.winning_price}`,
      
      competitor_price_change: `Concorrente mudou preço do produto ${data.product_name}: de R$ ${data.old_price} para R$ ${data.new_price} (${data.change_percentage}%)`,
      
      campaign_budget_depleted: `Orçamento da campanha "${data.campaign_name}" esgotado. Investido: R$ ${data.spent}, Vendas: R$ ${data.sales}, ACOS: ${data.acos}%`,
      
      keyword_position_drop: `Keyword "${data.keyword}" caiu da posição ${data.old_position} para ${data.new_position} na campanha "${data.campaign_name}"`,
      
      sales_target_achieved: `🎯 Meta de vendas atingida! Vendido: R$ ${data.current_sales} / Meta: R$ ${data.target_sales} (${data.achievement_percentage}%)`,
      
      system_error: `Erro no sistema: ${data.error_message}. Componente: ${data.component}`,
      
      sync_completed: `Sincronização concluída com sucesso. Processados: ${data.total_records} registros em ${data.duration}s`,
      
      sync_failed: `Falha na sincronização. Erro: ${data.error_message}. Tentativa: ${data.attempt}/${data.max_attempts}`
    };

    return messages[type] || `Notificação: ${JSON.stringify(data)}`;
  }

  async saveNotification(notification) {
    const result = await executeSQL(`
      INSERT INTO notifications (
        tenant_id, notification_type, title, message, priority, 
        channels, metadata, scheduled_for
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      notification.tenantId,
      notification.type,
      notification.title,
      notification.message,
      notification.priority,
      notification.channels,
      JSON.stringify(notification.metadata),
      notification.scheduledFor
    ]);

    return result.rows[0].id;
  }

  async updateNotificationStatus(notificationId, status, results = null) {
    await executeSQL(`
      UPDATE notifications 
      SET status = $2, sent_at = NOW(), metadata = metadata || $3
      WHERE id = $1
    `, [
      notificationId,
      status,
      JSON.stringify({ send_results: results })
    ]);
  }

  async getUserNotificationSettings(tenantId, userId, notificationType) {
    if (!userId) return [];
    
    const result = await executeSQL(`
      SELECT channels FROM notification_settings
      WHERE tenant_id = $1 AND user_id = $2 AND notification_type = $3 AND enabled = true
    `, [tenantId, userId, notificationType]);

    return result.rows.length > 0 ? result.rows[0].channels : [];
  }

  async sendToChannels(notificationId, notification, channels) {
    const results = [];
    
    for (const channel of channels) {
      try {
        const handler = this.channels[channel];
        if (!handler) {
          throw new Error(`Canal não suportado: ${channel}`);
        }
        
        const result = await handler(notification);
        results.push({ channel, success: true, result });
        
      } catch (error) {
        results.push({ channel, success: false, error: error.message });
        secureLogger.error(`Erro no canal ${channel}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Implementações dos canais de notificação
   */
  async sendEmail(notification) {
    // Implementar com SendGrid, SES, ou outro provedor
    const emailConfig = process.env.SENDGRID_API_KEY ? 'sendgrid' : 'smtp';
    
    if (emailConfig === 'sendgrid') {
      return await this.sendEmailWithSendGrid(notification);
    } else {
      // Implementação SMTP básica ou mock
      secureLogger.info('📧 Email enviado (mock)', {
        to: 'admin@appproft.com',
        subject: notification.title,
        message: notification.message
      });
      return { sent: true, provider: 'mock' };
    }
  }

  async sendEmailWithSendGrid(notification) {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY não configurado');
    }

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: process.env.NOTIFICATION_EMAIL || 'admin@appproft.com',
      from: process.env.EMAIL_FROM || 'noreply@appproft.com',
      subject: `AppProft: ${notification.title}`,
      text: notification.message,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #FF8C00;">${notification.title}</h2>
          <p>${notification.message}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            AppProft - Dashboard de Vendas Amazon e Mercado Livre<br>
            <a href="https://appproft.com">appproft.com</a>
          </p>
        </div>
      `
    };

    await sgMail.send(msg);
    return { sent: true, provider: 'sendgrid' };
  }

  async sendSlack(notification) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL não configurado');
    }

    const priorityColors = {
      low: '#36a64f',
      medium: '#ff9900',
      high: '#ff6600',
      critical: '#ff0000'
    };

    const payload = {
      text: notification.title,
      attachments: [{
        color: priorityColors[notification.priority] || '#36a64f',
        fields: [{
          title: notification.title,
          value: notification.message,
          short: false
        }],
        footer: 'AppProft Dashboard',
        footer_icon: 'https://appproft.com/favicon.ico',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }

    return { sent: true, provider: 'slack' };
  }

  async sendWebhook(notification) {
    const webhookUrl = process.env.CUSTOM_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('CUSTOM_WEBHOOK_URL não configurado');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'appproft',
        notification
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }

    return { sent: true, provider: 'webhook' };
  }

  async sendSMS(notification) {
    // Implementar com Twilio, AWS SNS, ou outro provedor
    secureLogger.info('📱 SMS enviado (mock)', {
      to: process.env.NOTIFICATION_PHONE || '+5511999999999',
      message: `${notification.title}: ${notification.message}`
    });
    return { sent: true, provider: 'mock' };
  }

  async saveInAppNotification(notification) {
    // Já salvo na tabela notifications, apenas marcar como in-app
    secureLogger.info('🔔 Notificação in-app salva', {
      type: notification.type,
      title: notification.title
    });
    return { saved: true, provider: 'inapp' };
  }

  /**
   * Métodos de configuração e consulta
   */
  async configureUserNotifications(tenantId, userId, notificationType, channels, settings = {}) {
    await executeSQL(`
      INSERT INTO notification_settings (tenant_id, user_id, notification_type, channels, settings)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, user_id, notification_type) 
      DO UPDATE SET 
        channels = EXCLUDED.channels,
        settings = EXCLUDED.settings,
        updated_at = NOW()
    `, [tenantId, userId, notificationType, channels, JSON.stringify(settings)]);
  }

  async getUnreadNotifications(tenantId, userId = null, limit = 50) {
    const query = userId ? 
      'SELECT * FROM notifications WHERE tenant_id = $1 AND (metadata->>\'userId\' = $2 OR metadata->>\'userId\' IS NULL) AND read_at IS NULL ORDER BY created_at DESC LIMIT $3' :
      'SELECT * FROM notifications WHERE tenant_id = $1 AND read_at IS NULL ORDER BY created_at DESC LIMIT $2';
    
    const params = userId ? [tenantId, userId, limit] : [tenantId, limit];
    const result = await executeSQL(query, params);
    
    return result.rows;
  }

  async markAsRead(notificationId, userId = null) {
    await executeSQL(`
      UPDATE notifications 
      SET read_at = NOW() 
      WHERE id = $1 AND (read_at IS NULL OR read_at < NOW())
    `, [notificationId]);
  }

  /**
   * Notificações automáticas baseadas em condições
   */
  async checkInventoryAlerts() {
    const result = await executeSQL(`
      SELECT i.*, p.name as product_name, p.asin
      FROM inventory_snapshots i
      JOIN products p ON i.asin = p.asin
      WHERE i.alert_status IN ('low', 'critical')
      AND i.snapshot_time > NOW() - INTERVAL '1 hour'
    `);

    for (const item of result.rows) {
      const notificationType = item.alert_status === 'critical' ? 'inventory_critical' : 'inventory_low';
      
      await this.notify(notificationType, {
        product_name: item.product_name,
        asin: item.asin,
        current_stock: item.fulfillable_quantity,
        days_of_supply: item.days_of_supply
      });
    }
  }

  async checkBuyBoxChanges() {
    const result = await executeSQL(`
      SELECT * FROM buy_box_history 
      WHERE created_at > NOW() - INTERVAL '15 minutes'
      AND change_type IN ('lost', 'won')
    `);

    for (const change of result.rows) {
      const notificationType = change.change_type === 'won' ? 'buy_box_won' : 'buy_box_lost';
      
      await this.notify(notificationType, {
        product_name: change.product_name,
        asin: change.asin,
        current_price: change.our_price,
        competitor_price: change.competitor_price,
        winning_price: change.change_type === 'won' ? change.our_price : null
      });
    }
  }

  /**
   * Worker para processar notificações agendadas
   */
  async processScheduledNotifications() {
    const result = await executeSQL(`
      SELECT * FROM notifications 
      WHERE status = 'pending' 
      AND scheduled_for <= NOW()
      ORDER BY priority DESC, scheduled_for ASC
      LIMIT 100
    `);

    secureLogger.info(`Processando ${result.rows.length} notificações agendadas`);

    for (const notification of result.rows) {
      try {
        await this.sendToChannels(
          notification.id,
          {
            type: notification.notification_type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            metadata: notification.metadata
          },
          notification.channels
        );

        await this.updateNotificationStatus(notification.id, 'sent');
      } catch (error) {
        await this.updateNotificationStatus(notification.id, 'failed', [{ error: error.message }]);
      }
    }
  }
}

// Singleton
let instance = null;

module.exports = {
  getNotificationSystem: () => {
    if (!instance) {
      instance = new NotificationSystem();
    }
    return instance;
  },
  NotificationSystem
};