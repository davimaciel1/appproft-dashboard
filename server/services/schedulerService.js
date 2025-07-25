const cron = require('node-cron');
// Usar versão simplificada que não requer AWS Role
const buyBoxService = require('./amazon/buyBoxServiceSimple');
const pool = require('../db/pool');
const secureLogger = require('../utils/secureLogger');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Inicia todos os jobs agendados
   */
  async start() {
    secureLogger.info('🚀 Iniciando serviço de agendamento automático');
    
    // Buy Box Sync - A cada 15 minutos
    this.scheduleBuyBoxSync();
    
    // Limpeza de logs antigos - Diariamente às 3h
    this.scheduleLogCleanup();
    
    // Verificação de saúde - A cada 5 minutos
    this.scheduleHealthCheck();
    
    // Executar sincronização inicial após 30 segundos
    setTimeout(() => {
      this.runBuyBoxSync();
    }, 30000);
    
    secureLogger.info('✅ Serviço de agendamento iniciado com sucesso');
  }

  /**
   * Para todos os jobs agendados
   */
  stop() {
    secureLogger.info('🛑 Parando serviço de agendamento');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      secureLogger.info(`Job ${name} parado`);
    });
    
    this.jobs.clear();
  }

  /**
   * Agenda sincronização de Buy Box
   */
  scheduleBuyBoxSync() {
    // A cada 15 minutos
    const job = cron.schedule('*/15 * * * *', async () => {
      await this.runBuyBoxSync();
    });
    
    this.jobs.set('buybox-sync', job);
    secureLogger.info('📅 Buy Box sync agendado para cada 15 minutos');
  }

  /**
   * Executa sincronização de Buy Box
   */
  async runBuyBoxSync() {
    if (this.isRunning) {
      secureLogger.info('⚠️  Sincronização já em andamento, pulando...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      secureLogger.info('🔄 Iniciando sincronização automática de Buy Box');
      
      // Verificar se temos credenciais configuradas
      if (!process.env.AMAZON_REFRESH_TOKEN || !process.env.AMAZON_CLIENT_ID) {
        secureLogger.warn('⚠️  Credenciais da Amazon não configuradas, pulando sincronização');
        return;
      }
      
      // Executar sincronização
      const result = await buyBoxService.syncAllBuyBoxData();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      secureLogger.info('✅ Sincronização de Buy Box concluída', {
        duration: `${duration}s`,
        total: result.total,
        success: result.success,
        errors: result.errors
      });
      
      // Registrar no banco
      await pool.query(`
        INSERT INTO sync_logs (
          marketplace,
          sync_type,
          records_synced,
          status,
          details,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        'amazon',
        'buy_box_auto',
        result.success,
        result.errors === 0 ? 'success' : 'partial',
        JSON.stringify({
          ...result,
          duration: duration,
          automatic: true
        })
      ]);
      
      // Notificar via websocket se disponível
      if (global.io) {
        global.io.emit('buybox-sync-complete', {
          timestamp: new Date().toISOString(),
          result
        });
      }
      
    } catch (error) {
      secureLogger.error('❌ Erro durante sincronização automática', {
        error: error.message
      });
      
      // Registrar erro no banco
      try {
        await pool.query(`
          INSERT INTO sync_logs (
            marketplace,
            sync_type,
            records_synced,
            status,
            details,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          'amazon',
          'buy_box_auto',
          0,
          'error',
          JSON.stringify({
            error: error.message,
            automatic: true
          })
        ]);
      } catch (logError) {
        secureLogger.error('Erro ao registrar log de erro', { error: logError.message });
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Agenda limpeza de logs antigos
   */
  scheduleLogCleanup() {
    // Todos os dias às 3h da manhã
    const job = cron.schedule('0 3 * * *', async () => {
      try {
        secureLogger.info('🧹 Iniciando limpeza de logs antigos');
        
        // Remover logs de sync com mais de 30 dias
        const result = await pool.query(`
          DELETE FROM sync_logs 
          WHERE created_at < NOW() - INTERVAL '30 days'
        `);
        
        secureLogger.info(`✅ ${result.rowCount} logs antigos removidos`);
        
        // Remover dados de competitor tracking com mais de 90 dias
        const competitorResult = await pool.query(`
          DELETE FROM competitor_tracking_advanced 
          WHERE timestamp < NOW() - INTERVAL '90 days'
        `);
        
        secureLogger.info(`✅ ${competitorResult.rowCount} registros antigos de competidores removidos`);
        
      } catch (error) {
        secureLogger.error('Erro na limpeza de logs', { error: error.message });
      }
    });
    
    this.jobs.set('log-cleanup', job);
    secureLogger.info('📅 Limpeza de logs agendada para 3h diariamente');
  }

  /**
   * Agenda verificação de saúde
   */
  scheduleHealthCheck() {
    // A cada 5 minutos
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        // Verificar conexão com banco
        await pool.query('SELECT 1');
        
        // Verificar última sincronização
        const lastSync = await pool.query(`
          SELECT MAX(created_at) as last_sync 
          FROM sync_logs 
          WHERE marketplace = 'amazon' 
          AND status IN ('success', 'partial')
        `);
        
        const lastSyncTime = lastSync.rows[0]?.last_sync;
        if (lastSyncTime) {
          const hoursSinceSync = (Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60 * 60);
          
          // Alertar se não há sincronização há mais de 1 hora
          if (hoursSinceSync > 1) {
            secureLogger.warn(`⚠️  Última sincronização foi há ${hoursSinceSync.toFixed(1)} horas`);
          }
        }
      } catch (error) {
        secureLogger.error('Erro na verificação de saúde', { error: error.message });
      }
    });
    
    this.jobs.set('health-check', job);
  }

  /**
   * Retorna status dos jobs
   */
  getStatus() {
    const status = {};
    
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running !== undefined ? job.running : true
      };
    });
    
    return {
      isRunning: this.isRunning,
      jobs: status
    };
  }
}

// Singleton
const schedulerService = new SchedulerService();

module.exports = schedulerService;