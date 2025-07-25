/**
 * Sistema de Sincronização Persistente
 * Reinicia automaticamente de onde parou, sem intervenção do usuário
 */

require('dotenv').config();
const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');
const { getRateLimiter } = require('./rateLimiter');
const secureLogger = require('../utils/secureLogger');
const OptimizedDataCollector = require('./optimizedDataCollector');
const { getAdvertisingDataCollector } = require('./advertisingDataCollector');
const { getNotificationSystem } = require('./notificationSystem');
const hijackerAlertService = require('./hijackerAlertService');
const dataKioskClient = require('./dataKiosk/dataKioskClient');
const DataKioskQueries = require('./dataKiosk/dataKioskQueries');
const DataKioskProcessor = require('./dataKiosk/dataKioskProcessor');

class PersistentSyncManager {
  constructor() {
    this.isRunning = false;
    this.currentTask = null;
    this.retryDelays = [1000, 2000, 5000, 10000, 30000]; // 1s, 2s, 5s, 10s, 30s
    this.maxRetries = 5;
    
    // Instância singleton do RateLimiter
    this.rateLimiter = getRateLimiter();
    
    // Integrar o OptimizedDataCollector com todas as estratégias de otimização
    this.optimizedCollector = new OptimizedDataCollector();
    
    // Integrar Advertising Data Collector
    this.advertisingCollector = getAdvertisingDataCollector();
    
    // Integrar Sistema de Notificações
    this.notificationSystem = getNotificationSystem();
    
    // Integrar Sistema de Alertas de Hijacker
    this.hijackerAlertService = hijackerAlertService;
    
    // Tabela para persistir estado das sincronizações
    this.initializeTables();
  }

  async initializeTables() {
    try {
      await executeSQL(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id SERIAL PRIMARY KEY,
          task_type VARCHAR(50) NOT NULL,
          endpoint VARCHAR(200) NOT NULL,
          payload JSONB,
          priority INTEGER DEFAULT 5,
          status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'retry'
          attempt_count INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 5,
          next_retry_at TIMESTAMPTZ,
          last_error TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ,
          tenant_id VARCHAR(50) DEFAULT 'default'
        );

        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, priority, next_retry_at);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(task_type, status);

        CREATE TABLE IF NOT EXISTS sync_state (
          id VARCHAR(100) PRIMARY KEY,
          state_data JSONB NOT NULL,
          last_checkpoint TIMESTAMPTZ DEFAULT NOW(),
          tenant_id VARCHAR(50) DEFAULT 'default'
        );
      `);
      
      secureLogger.info('Tabelas de sincronização persistente inicializadas');
    } catch (error) {
      secureLogger.error('Erro ao inicializar tabelas:', error);
    }
  }

  // Adicionar tarefa à fila
  async enqueueTask(taskType, endpoint, payload = {}, priority = 5) {
    try {
      const result = await executeSQL(`
        INSERT INTO sync_queue (task_type, endpoint, payload, priority)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [taskType, endpoint, JSON.stringify(payload), priority]);

      secureLogger.info(`Tarefa enfileirada: ${taskType}`, { 
        taskId: result.rows[0].id,
        endpoint 
      });
      
      return result.rows[0].id;
    } catch (error) {
      secureLogger.error('Erro ao enfileirar tarefa:', error);
      throw error;
    }
  }

  // Salvar estado da sincronização
  async saveState(stateId, stateData) {
    try {
      await executeSQL(`
        INSERT INTO sync_state (id, state_data)
        VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET
          state_data = $2,
          last_checkpoint = NOW()
      `, [stateId, JSON.stringify(stateData)]);
    } catch (error) {
      secureLogger.error('Erro ao salvar estado:', error);
    }
  }

  // Carregar estado da sincronização
  async loadState(stateId) {
    try {
      const result = await executeSQL(`
        SELECT state_data FROM sync_state WHERE id = $1
      `, [stateId]);
      
      if (result.rows.length > 0) {
        return result.rows[0].state_data;
      }
      return null;
    } catch (error) {
      secureLogger.error('Erro ao carregar estado:', error);
      return null;
    }
  }

  // Obter próxima tarefa da fila
  async getNextTask() {
    try {
      const result = await executeSQL(`
        SELECT id, task_type, endpoint, payload, attempt_count, max_attempts
        FROM sync_queue
        WHERE status IN ('pending', 'retry')
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      if (result.rows.length > 0) {
        const task = result.rows[0];
        
        // Marcar como processando
        await executeSQL(`
          UPDATE sync_queue 
          SET status = 'processing', updated_at = NOW()
          WHERE id = $1
        `, [task.id]);

        return task;
      }
      
      return null;
    } catch (error) {
      secureLogger.error('Erro ao obter próxima tarefa:', error);
      return null;
    }
  }

  // Marcar tarefa como concluída
  async completeTask(taskId, result = null) {
    try {
      await executeSQL(`
        UPDATE sync_queue 
        SET status = 'completed', 
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [taskId]);
      
      secureLogger.info(`Tarefa concluída: ${taskId}`);
    } catch (error) {
      secureLogger.error('Erro ao marcar tarefa como concluída:', error);
    }
  }

  // Marcar tarefa para retry
  async retryTask(taskId, error) {
    try {
      const task = await executeSQL(`
        SELECT attempt_count, max_attempts FROM sync_queue WHERE id = $1
      `, [taskId]);

      if (task.rows.length === 0) return;

      const { attempt_count, max_attempts } = task.rows[0];
      const nextAttempt = attempt_count + 1;

      if (nextAttempt >= max_attempts) {
        // Máximo de tentativas atingido
        await executeSQL(`
          UPDATE sync_queue 
          SET status = 'failed',
              last_error = $2,
              updated_at = NOW()
          WHERE id = $1
        `, [taskId, error.message]);
        
        secureLogger.error(`Tarefa falhou permanentemente: ${taskId}`, { error: error.message });
      } else {
        // Calcular próximo retry com backoff exponencial
        const delayMs = this.retryDelays[Math.min(nextAttempt - 1, this.retryDelays.length - 1)];
        const nextRetryAt = new Date(Date.now() + delayMs);

        await executeSQL(`
          UPDATE sync_queue 
          SET status = 'retry',
              attempt_count = $2,
              next_retry_at = $3,
              last_error = $4,
              updated_at = NOW()
          WHERE id = $1
        `, [taskId, nextAttempt, nextRetryAt, error.message]);
        
        secureLogger.info(`Tarefa agendada para retry: ${taskId}`, { 
          attempt: nextAttempt,
          nextRetry: nextRetryAt,
          error: error.message
        });
      }
    } catch (err) {
      secureLogger.error('Erro ao agendar retry:', err);
    }
  }

  // Executar uma tarefa
  async executeTask(task) {
    const { id, task_type, endpoint, payload } = task;
    
    try {
      secureLogger.info(`Executando tarefa: ${task_type}`, { taskId: id, endpoint });

      // Aguardar rate limit
      await this.rateLimiter.waitForToken('sp-api', endpoint);

      let result;
      switch (task_type) {
        case 'fetch_orders':
          result = await this.fetchOrders(payload);
          break;
        case 'fetch_inventory':
          result = await this.fetchInventory(payload);
          break;
        case 'fetch_pricing':
          result = await this.fetchPricing(payload);
          break;
        case 'fetch_catalog':
          result = await this.fetchCatalog(payload);
          break;
        case 'optimized_sync':
          // NOVA TAREFA: Sincronização otimizada completa
          result = await this.optimizedCollector.optimizedSync(payload.tenantId || 'default');
          break;
        case 'reports_sync':
          // NOVA TAREFA: Sincronização via Reports API (estratégia principal)
          result = await this.optimizedCollector.syncViaReports(payload.tenantId || 'default');
          break;
        case 'priority_sync':
          // NOVA TAREFA: Sincronização por prioridade (best sellers primeiro)
          result = await this.optimizedCollector.syncByPriority(payload.tenantId || 'default');
          break;
        case 'batch_pricing':
          // NOVA TAREFA: Pricing em lote (20 ASINs por vez)
          result = await this.optimizedCollector.getBatchPricing(payload.asins || []);
          break;
        case 'advertising_sync':
          // NOVA TAREFA: Sincronização completa de dados de advertising
          result = await this.advertisingCollector.collectAllAdvertisingData(payload.profileId);
          break;
        case 'advertising_campaigns':
          // NOVA TAREFA: Coletar apenas campanhas
          result = await this.advertisingCollector.collectCampaigns(payload.profileId);
          break;
        case 'advertising_reports':
          // NOVA TAREFA: Coletar relatórios de performance
          result = await this.advertisingCollector.collectCampaignReport(payload.profileId, payload.startDate, payload.endDate);
          break;
        case 'check_notifications':
          // NOVA TAREFA: Verificar e processar notificações automáticas
          result = await this.processAutomaticNotifications();
          break;
        case 'send_notification':
          // NOVA TAREFA: Enviar notificação específica
          result = await this.notificationSystem.notify(payload.type, payload.data, payload.options);
          break;
        case 'check_hijackers':
          // NOVA TAREFA: Verificar e alertar sobre hijackers
          result = await this.hijackerAlertService.checkForNewHijackers();
          break;
        case 'data_kiosk_sync':
          // NOVA TAREFA: Sincronização completa Data Kiosk
          result = await this.syncDataKioskMetrics(payload.tenantId || 'default', payload.daysBack || 7);
          break;
        case 'data_kiosk_daily':
          // NOVA TAREFA: Métricas diárias Data Kiosk
          result = await this.syncDataKioskDaily(payload.tenantId || 'default', payload.date);
          break;
        case 'data_kiosk_products':
          // NOVA TAREFA: Métricas por produto Data Kiosk
          result = await this.syncDataKioskProducts(payload.tenantId || 'default', payload.daysBack || 7);
          break;
        default:
          throw new Error(`Tipo de tarefa desconhecido: ${task_type}`);
      }

      await this.completeTask(id, result);
      return result;

    } catch (error) {
      secureLogger.error(`Erro na tarefa ${id}:`, error);
      
      // Se for erro 429 (rate limit), agendar retry mais longo
      if (error.status === 429) {
        await this.retryTask(id, error);
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
        // Erro de rede - retry
        await this.retryTask(id, error);
      } else {
        // Outros erros - falhar permanentemente ou retry baseado no tipo
        await this.retryTask(id, error);
      }
      
      throw error;
    }
  }

  // Loop principal de processamento
  async startProcessing() {
    if (this.isRunning) {
      secureLogger.warn('Processamento já está em execução');
      return;
    }

    this.isRunning = true;
    secureLogger.info('Iniciando processamento persistente de sincronização');

    while (this.isRunning) {
      try {
        const task = await this.getNextTask();
        
        if (task) {
          this.currentTask = task;
          await this.executeTask(task);
          this.currentTask = null;
        } else {
          // Não há tarefas, aguardar um pouco
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

      } catch (error) {
        secureLogger.error('Erro no loop principal:', error);
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  // Parar processamento
  async stopProcessing() {
    secureLogger.info('Parando processamento...');
    this.isRunning = false;
    
    // Aguardar tarefa atual terminar
    if (this.currentTask) {
      secureLogger.info('Aguardando tarefa atual terminar...');
      while (this.currentTask) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    secureLogger.info('Processamento parado');
  }

  // Enfileirar sincronização completa OTIMIZADA
  async enqueueBulkSync() {
    secureLogger.info('🚀 Enfileirando sincronização OTIMIZADA com todas as estratégias');
    
    const tasks = [
      // ⭐ PRIORIDADE MÁXIMA: Sincronização otimizada completa
      { 
        type: 'optimized_sync', 
        endpoint: '/optimized', 
        priority: 1,
        payload: { tenantId: 'default' }
      },
      
      // 📊 ALTA PRIORIDADE: Reports API (dados em massa)
      { 
        type: 'reports_sync', 
        endpoint: '/reports/2021-06-30/reports', 
        priority: 2,
        payload: { tenantId: 'default' }
      },
      
      // 🎯 MÉDIA PRIORIDADE: Sincronização por prioridade (best sellers)
      { 
        type: 'priority_sync', 
        endpoint: '/priority', 
        priority: 3,
        payload: { tenantId: 'default' }
      },
      
      // 📈 ADVERTISING: Sincronização de dados de advertising
      { 
        type: 'advertising_sync', 
        endpoint: '/v2/profiles', 
        priority: 4,
        payload: { tenantId: 'default' }
      },
      
      // 🔔 NOTIFICAÇÕES: Verificar alertas automáticos
      { 
        type: 'check_notifications', 
        endpoint: '/notifications/check', 
        priority: 5,
        payload: { tenantId: 'default' }
      },
      
      // 🚨 HIJACKER ALERTS: Verificar e alertar sobre hijackers
      { 
        type: 'check_hijackers', 
        endpoint: '/hijackers/check', 
        priority: 4,
        payload: { tenantId: 'default' }
      }
      
      // NOTA: Tarefas individuais (fetch_orders, etc.) mantidas para compatibilidade
      // mas a sincronização otimizada deve ser usada preferencialmente
    ];

    const taskIds = [];
    for (const task of tasks) {
      const taskId = await this.enqueueTask(
        task.type, 
        task.endpoint, 
        task.payload || {}, 
        task.priority
      );
      taskIds.push(taskId);
    }

    secureLogger.info('✅ Sincronização OTIMIZADA enfileirada', { 
      taskIds,
      strategies: [
        'Reports API (bulk data)',
        'Cache inteligente', 
        'Batch requests',
        'Priority-based sync',
        'Advertising data collection',
        'Automatic notifications',
        'Hijacker monitoring and alerts'
      ]
    });
    return taskIds;
  }
  
  // Método adicional para sincronização de produtos específicos em lote
  async enqueueBatchPricing(asins) {
    if (!asins || asins.length === 0) {
      secureLogger.warn('Nenhum ASIN fornecido para batch pricing');
      return [];
    }
    
    const taskId = await this.enqueueTask(
      'batch_pricing',
      '/batches/products/pricing/v0/itemOffers',
      { asins },
      2 // Alta prioridade
    );
    
    secureLogger.info(`Batch pricing enfileirado para ${asins.length} ASINs`, { taskId });
    return [taskId];
  }

  // Obter estatísticas da fila
  async getQueueStats() {
    try {
      const result = await executeSQL(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(attempt_count) as avg_attempts
        FROM sync_queue
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY status
      `);

      const stats = {};
      result.rows.forEach(row => {
        stats[row.status] = {
          count: parseInt(row.count),
          avgAttempts: parseFloat(row.avg_attempts) || 0
        };
      });

      return stats;
    } catch (error) {
      secureLogger.error('Erro ao obter estatísticas:', error);
      return {};
    }
  }

  // Limpar tarefas antigas (manutenção)
  async cleanupOldTasks(daysOld = 7) {
    try {
      const result = await executeSQL(`
        DELETE FROM sync_queue
        WHERE status IN ('completed', 'failed')
          AND updated_at < NOW() - INTERVAL '${daysOld} days'
      `);

      secureLogger.info(`Limpeza concluída: ${result.rowCount} tarefas antigas removidas`);
      return result.rowCount;
    } catch (error) {
      secureLogger.error('Erro na limpeza:', error);
      return 0;
    }
  }

  // Implementações específicas de cada tipo de fetch
  // NOTA: Estes métodos são mantidos para compatibilidade, mas o sistema otimizado
  // deve usar os métodos do OptimizedDataCollector preferencialmente
  
  async fetchOrders(payload) {
    secureLogger.info('⚠️ Usando método legado fetchOrders. Considere usar optimized_sync.');
    
    try {
      // Integrar com DataCollector existente ou implementar lógica básica
      const { getDataCollector } = require('./dataCollector');
      const dataCollector = getDataCollector();
      const results = { orders: { success: 0, errors: 0 } };
      
      await dataCollector.collectOrders(payload.tenantId || 'default', results.orders);
      return { success: true, message: 'Orders fetched', data: results };
      
    } catch (error) {
      secureLogger.error('Erro no fetchOrders legado:', error);
      return { success: false, message: 'Orders fetch failed', error: error.message };
    }
  }

  async fetchInventory(payload) {
    secureLogger.info('⚠️ Usando método legado fetchInventory. Considere usar optimized_sync.');
    
    try {
      const { getDataCollector } = require('./dataCollector');
      const dataCollector = getDataCollector();
      const results = { inventory: { success: 0, errors: 0 } };
      
      await dataCollector.collectInventory(payload.tenantId || 'default', results.inventory);
      return { success: true, message: 'Inventory fetched', data: results };
      
    } catch (error) {
      secureLogger.error('Erro no fetchInventory legado:', error);
      return { success: false, message: 'Inventory fetch failed', error: error.message };
    }
  }

  async fetchPricing(payload) {
    secureLogger.info('⚠️ Usando método legado fetchPricing. Considere usar batch_pricing.');
    
    try {
      const { getDataCollector } = require('./dataCollector');
      const dataCollector = getDataCollector();
      const results = { pricing: { success: 0, errors: 0 }, competitors: { success: 0, errors: 0 } };
      
      await dataCollector.collectPricingAndCompetitors(
        payload.tenantId || 'default', 
        results.pricing, 
        results.competitors
      );
      return { success: true, message: 'Pricing fetched', data: results };
      
    } catch (error) {
      secureLogger.error('Erro no fetchPricing legado:', error);
      return { success: false, message: 'Pricing fetch failed', error: error.message };
    }
  }

  async fetchCatalog(payload) {
    secureLogger.info('⚠️ Usando método legado fetchCatalog. Considere usar optimized_sync.');
    
    try {
      const { getDataCollector } = require('./dataCollector');
      const dataCollector = getDataCollector();
      const results = { catalog: { success: 0, errors: 0 } };
      
      await dataCollector.collectCatalogInfo(payload.tenantId || 'default', results.catalog);
      return { success: true, message: 'Catalog fetched', data: results };
      
    } catch (error) {
      secureLogger.error('Erro no fetchCatalog legado:', error);
      return { success: false, message: 'Catalog fetch failed', error: error.message };
    }
  }
  
  // Novos métodos para estatísticas e monitoramento das otimizações
  async getOptimizationStats() {
    try {
      const result = await executeSQL(`
        SELECT 
          task_type,
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          AVG(attempt_count) as avg_attempts,
          AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
        FROM sync_queue
        WHERE task_type IN ('optimized_sync', 'reports_sync', 'priority_sync', 'batch_pricing')
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY task_type
        ORDER BY total_tasks DESC
      `);

      const stats = {};
      result.rows.forEach(row => {
        stats[row.task_type] = {
          total: parseInt(row.total_tasks),
          completed: parseInt(row.completed),
          failed: parseInt(row.failed),
          successRate: row.total_tasks > 0 ? (row.completed / row.total_tasks * 100).toFixed(1) + '%' : '0%',
          avgAttempts: parseFloat(row.avg_attempts) || 0,
          avgDurationSeconds: parseFloat(row.avg_duration_seconds) || 0
        };
      });

      return stats;
    } catch (error) {
      secureLogger.error('Erro ao obter estatísticas de otimização:', error);
      return {};
    }
  }
  
  // Método para processar notificações automáticas
  async processAutomaticNotifications() {
    secureLogger.info('🔔 Processando notificações automáticas...');
    
    const results = {
      inventoryAlerts: 0,
      buyBoxChanges: 0,
      scheduledNotifications: 0
    };
    
    try {
      // Verificar alertas de estoque
      await this.notificationSystem.checkInventoryAlerts();
      results.inventoryAlerts++;
      
      // Verificar mudanças de Buy Box
      await this.notificationSystem.checkBuyBoxChanges();
      results.buyBoxChanges++;
      
      // Processar notificações agendadas
      await this.notificationSystem.processScheduledNotifications();
      results.scheduledNotifications++;
      
      secureLogger.info('✅ Notificações automáticas processadas', results);
      return results;
      
    } catch (error) {
      secureLogger.error('Erro ao processar notificações automáticas:', error);
      
      // Notificar erro do sistema
      await this.notificationSystem.notify('system_error', {
        error_message: error.message,
        component: 'automatic_notifications'
      });
      
      throw error;
    }
  }
  
  // Método para agendar notificação customizada
  async scheduleNotification(type, data, options = {}) {
    return await this.enqueueTask('send_notification', '/notifications/send', {
      type,
      data,
      options
    }, options.priority || 3);
  }
  
  // Método para coletar advertising data específica
  async enqueueAdvertisingSync(profileId = null, type = 'full') {
    const tasks = {
      'full': 'advertising_sync',
      'campaigns': 'advertising_campaigns', 
      'reports': 'advertising_reports'
    };
    
    const taskType = tasks[type] || 'advertising_sync';
    
    return await this.enqueueTask(taskType, '/v2/profiles', {
      profileId,
      tenantId: 'default'
    }, 4); // Prioridade média
  }
  
  // Método para verificar hijackers manualmente
  async enqueueHijackerCheck(priority = 2) {
    secureLogger.info('🚨 Enfileirando verificação de hijackers');
    
    return await this.enqueueTask('check_hijackers', '/hijackers/check', {
      tenantId: 'default',
      manual: true
    }, priority);
  }

  // ========== MÉTODOS DATA KIOSK ==========
  
  /**
   * Sincronização completa Data Kiosk
   */
  async syncDataKioskMetrics(tenantId = 'default', daysBack = 7) {
    secureLogger.info('📊 Iniciando sincronização Data Kiosk', { tenantId, daysBack });
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - daysBack);
      
      const endDateStr = endDate.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      const marketplaceId = process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC';
      
      const results = {
        dailyMetrics: 0,
        productMetrics: 0,
        totalProcessed: 0
      };
      
      // 1. Sincronizar métricas diárias
      secureLogger.info('📅 Coletando métricas diárias', { startDate: startDateStr, endDate: endDateStr });
      
      const dailyQuery = DataKioskQueries.getDailyMetricsQuery(startDateStr, endDateStr, marketplaceId);
      const dailyResult = await dataKioskClient.executeQuery(dailyQuery, tenantId);
      
      if (dailyResult.status === 'SUCCESS' && dailyResult.data) {
        const processed = await DataKioskProcessor.processDailyMetrics(dailyResult.data, tenantId);
        results.dailyMetrics = processed.processed;
        results.totalProcessed += processed.processed;
        secureLogger.info('✅ Métricas diárias processadas', { count: processed.processed });
      }
      
      // 2. Sincronizar métricas por ASIN
      secureLogger.info('🏷️ Coletando métricas por produto');
      
      const asinQuery = DataKioskQueries.getAsinMetricsQuery(startDateStr, endDateStr, marketplaceId);
      const asinResult = await dataKioskClient.executeQuery(asinQuery, tenantId);
      
      if (asinResult.status === 'SUCCESS' && asinResult.data) {
        const processed = await DataKioskProcessor.processAsinMetrics(asinResult.data, tenantId);
        results.productMetrics = processed.processed;
        results.totalProcessed += processed.processed;
        secureLogger.info('✅ Métricas por produto processadas', { count: processed.processed });
      }
      
      secureLogger.info('🎉 Sincronização Data Kiosk concluída', results);
      return results;
      
    } catch (error) {
      secureLogger.error('❌ Erro na sincronização Data Kiosk:', error);
      throw error;
    }
  }
  
  /**
   * Sincronização de métricas diárias específicas
   */
  async syncDataKioskDaily(tenantId = 'default', date = null) {
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    const marketplaceId = process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC';
    
    secureLogger.info('📅 Sincronizando métricas diárias específicas', { date: dateStr, tenantId });
    
    try {
      const query = DataKioskQueries.getDailyMetricsQuery(dateStr, dateStr, marketplaceId);
      const result = await dataKioskClient.executeQuery(query, tenantId);
      
      if (result.status === 'SUCCESS' && result.data) {
        return await DataKioskProcessor.processDailyMetrics(result.data, tenantId);
      }
      
      return { success: false, message: 'Nenhum dado retornado' };
      
    } catch (error) {
      secureLogger.error('❌ Erro na sincronização diária:', error);
      throw error;
    }
  }
  
  /**
   * Sincronização de métricas por produto
   */
  async syncDataKioskProducts(tenantId = 'default', daysBack = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);
    
    const endDateStr = endDate.toISOString().split('T')[0];
    const startDateStr = startDate.toISOString().split('T')[0];
    const marketplaceId = process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC';
    
    secureLogger.info('🏷️ Sincronizando métricas por produto', { startDate: startDateStr, endDate: endDateStr, tenantId });
    
    try {
      const query = DataKioskQueries.getAsinMetricsQuery(startDateStr, endDateStr, marketplaceId);
      const result = await dataKioskClient.executeQuery(query, tenantId);
      
      if (result.status === 'SUCCESS' && result.data) {
        return await DataKioskProcessor.processAsinMetrics(result.data, tenantId);
      }
      
      return { success: false, message: 'Nenhum dado retornado' };
      
    } catch (error) {
      secureLogger.error('❌ Erro na sincronização por produto:', error);
      throw error;
    }
  }
  
  /**
   * Enfileirar sincronização Data Kiosk
   */
  async enqueueDataKioskSync(type = 'full', options = {}) {
    const { tenantId = 'default', daysBack = 7, priority = 4, date = null } = options;
    
    const taskTypes = {
      'full': 'data_kiosk_sync',
      'daily': 'data_kiosk_daily',
      'products': 'data_kiosk_products'
    };
    
    const taskType = taskTypes[type] || 'data_kiosk_sync';
    
    secureLogger.info(`📊 Enfileirando sincronização Data Kiosk: ${type}`, { tenantId, daysBack });
    
    return await this.enqueueTask(taskType, '/dataKiosk/2023-11-15/queries', {
      tenantId,
      daysBack,
      date
    }, priority);
  }
}

module.exports = PersistentSyncManager;