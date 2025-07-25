/**
 * Worker de Sincronização Persistente
 * Sistema que reinicia automaticamente de onde parou
 */

require('dotenv').config();
const PersistentSyncManager = require('../server/services/persistentSyncManager');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const secureLogger = require('../server/utils/secureLogger');

class PersistentSyncWorker {
  constructor() {
    this.syncManager = new PersistentSyncManager();
    this.isRunning = false;
    this.healthCheckInterval = null;
    this.cleanupInterval = null;
    
    // Configurações
    this.config = {
      healthCheckIntervalMs: 30000,     // 30 segundos
      cleanupIntervalMs: 24 * 60 * 60 * 1000, // 24 horas
      restartOnCrashDelay: 5000,        // 5 segundos
      maxCrashRestarts: 10,             // Máximo de reinicializações por hora
      syncIntervalMs: 15 * 60 * 1000    // 15 minutos para sync completo
    };

    this.crashCount = 0;
    this.lastCrashTime = null;
    
    // Capturar sinais do sistema
    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    // Shutdown gracioso
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    
    // Capturar crashes para restart automático
    process.on('uncaughtException', (error) => {
      secureLogger.error('Exceção não capturada:', error);
      this.handleCrash(error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      secureLogger.error('Promise rejeitada não tratada:', { reason, promise });
      this.handleCrash(new Error(`Unhandled rejection: ${reason}`));
    });
  }

  async handleCrash(error) {
    const now = Date.now();
    
    // Reset contador se passou mais de 1 hora
    if (this.lastCrashTime && (now - this.lastCrashTime) > 60 * 60 * 1000) {
      this.crashCount = 0;
    }
    
    this.crashCount++;
    this.lastCrashTime = now;
    
    secureLogger.error(`Sistema crashou (${this.crashCount}/${this.config.maxCrashRestarts}):`, error);
    
    if (this.crashCount >= this.config.maxCrashRestarts) {
      secureLogger.error('Máximo de restarts atingido. Sistema será finalizado.');
      process.exit(1);
    }
    
    // Salvar estado de crash
    await this.saveSystemState({
      crashed: true,
      crashTime: now,
      crashError: error.message,
      crashCount: this.crashCount
    });
    
    // Restart automático após delay
    setTimeout(() => {
      secureLogger.info('Reiniciando sistema após crash...');
      this.start();
    }, this.config.restartOnCrashDelay);
  }

  async saveSystemState(state) {
    try {
      await this.syncManager.saveState('system_state', state);
    } catch (error) {
      console.error('Erro ao salvar estado do sistema:', error);
    }
  }

  async loadSystemState() {
    try {
      const state = await this.syncManager.loadState('system_state');
      return state || {};
    } catch (error) {
      secureLogger.error('Erro ao carregar estado do sistema:', error);
      return {};
    }
  }

  async start() {
    if (this.isRunning) {
      secureLogger.warn('Worker já está em execução');
      return;
    }

    secureLogger.info('🚀 Iniciando Persistent Sync Worker');
    
    try {
      // Carregar estado anterior
      const previousState = await this.loadSystemState();
      if (previousState.crashed) {
        secureLogger.info('Sistema recuperando de crash anterior', {
          crashTime: new Date(previousState.crashTime),
          crashError: previousState.crashError
        });
      }

      this.isRunning = true;
      
      // Inicializar componentes
      await this.initializeSystem();
      
      // Verificar tarefas pendentes e retomar de onde parou
      await this.resumePendingTasks();
      
      // Iniciar processamento principal
      this.syncManager.startProcessing();
      
      // Agendar sync periódico
      this.schedulePeriodicSync();
      
      // Configurar health checks
      this.setupHealthChecks();
      
      // Configurar limpeza automática
      this.setupAutomaticCleanup();
      
      // Salvar estado de inicialização bem-sucedida
      await this.saveSystemState({
        started: true,
        startTime: Date.now(),
        crashed: false
      });
      
      secureLogger.info('✅ Persistent Sync Worker iniciado com sucesso');
      
    } catch (error) {
      secureLogger.error('Erro ao iniciar worker:', error);
      await this.handleCrash(error);
    }
  }

  async initializeSystem() {
    secureLogger.info('Inicializando sistema...');
    
    // Verificar conexão com banco
    try {
      await executeSQL('SELECT 1');
      secureLogger.info('✅ Conexão com PostgreSQL OK');
    } catch (error) {
      throw new Error(`Falha na conexão com banco: ${error.message}`);
    }
    
    // Inicializar tabelas do sync manager
    await this.syncManager.initializeTables();
    
    secureLogger.info('✅ Sistema inicializado');
  }

  async resumePendingTasks() {
    secureLogger.info('Verificando tarefas pendentes...');
    
    try {
      const stats = await this.syncManager.getQueueStats();
      
      const pendingCount = (stats.pending?.count || 0) + (stats.retry?.count || 0);
      const failedCount = stats.failed?.count || 0;
      const processingCount = stats.processing?.count || 0;
      
      secureLogger.info('Estado da fila de sincronização:', {
        pending: pendingCount,
        failed: failedCount,
        processing: processingCount
      });
      
      // Resetar tarefas que estavam "processing" (provavelmente por crash)
      if (processingCount > 0) {
        await executeSQL(`
          UPDATE sync_queue 
          SET status = 'retry', 
              next_retry_at = NOW() + INTERVAL '30 seconds',
              updated_at = NOW()
          WHERE status = 'processing'
        `);
        
        secureLogger.info(`${processingCount} tarefas em processamento recolocadas na fila`);
      }
      
      // Se não há tarefas pendentes, criar sync inicial
      if (pendingCount === 0) {
        secureLogger.info('Nenhuma tarefa pendente. Criando sincronização inicial...');
        await this.syncManager.enqueueBulkSync();
      }
      
    } catch (error) {
      secureLogger.error('Erro ao verificar tarefas pendentes:', error);
    }
  }

  schedulePeriodicSync() {
    setInterval(async () => {
      try {
        secureLogger.info('Executando sincronização periódica...');
        await this.syncManager.enqueueBulkSync();
      } catch (error) {
        secureLogger.error('Erro na sincronização periódica:', error);
      }
    }, this.config.syncIntervalMs);
    
    secureLogger.info(`Sincronização periódica agendada a cada ${this.config.syncIntervalMs / 60000} minutos`);
  }

  setupHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        secureLogger.error('Erro no health check:', error);
      }
    }, this.config.healthCheckIntervalMs);
    
    secureLogger.info('Health checks configurados');
  }

  async performHealthCheck() {
    const stats = await this.syncManager.getQueueStats();
    const memoryUsage = process.memoryUsage();
    
    // Log estatísticas periodicamente
    secureLogger.info('Health Check:', {
      queueStats: stats,
      memoryMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      uptime: Math.round(process.uptime() / 60) + 'm'
    });
    
    // Verificar se há muitas tarefas falhando
    const failedCount = stats.failed?.count || 0;
    const totalCount = Object.values(stats).reduce((sum, stat) => sum + stat.count, 0);
    
    if (totalCount > 0 && (failedCount / totalCount) > 0.5) {
      secureLogger.warn('Alta taxa de falhas detectada', {
        failedCount,
        totalCount,
        failureRate: Math.round((failedCount / totalCount) * 100) + '%'
      });
    }
    
    // Verificar uso de memória
    if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      secureLogger.warn('Alto uso de memória detectado', {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
      });
    }
  }

  setupAutomaticCleanup() {
    this.cleanupInterval = setInterval(async () => {
      try {
        secureLogger.info('Executando limpeza automática...');
        const cleaned = await this.syncManager.cleanupOldTasks(7);
        secureLogger.info(`Limpeza concluída: ${cleaned} tarefas antigas removidas`);
      } catch (error) {
        secureLogger.error('Erro na limpeza automática:', error);
      }
    }, this.config.cleanupIntervalMs);
    
    secureLogger.info('Limpeza automática configurada (24h)');
  }

  async gracefulShutdown(signal) {
    secureLogger.info(`Recebido sinal ${signal}. Iniciando shutdown gracioso...`);
    
    this.isRunning = false;
    
    // Parar intervalos
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Parar processamento do sync manager
    await this.syncManager.stopProcessing();
    
    // Salvar estado de shutdown
    await this.saveSystemState({
      shutdown: true,
      shutdownTime: Date.now(),
      shutdownSignal: signal
    });
    
    secureLogger.info('✅ Shutdown gracioso concluído');
    process.exit(0);
  }

  // Método para adicionar tarefa específica (API externa)
  async addTask(taskType, endpoint, payload = {}, priority = 5) {
    return await this.syncManager.enqueueTask(taskType, endpoint, payload, priority);
  }

  // Método para obter estatísticas (API externa)
  async getStats() {
    return await this.syncManager.getQueueStats();
  }

  // Método para forçar limpeza (API externa)
  async forceCleanup(daysOld = 7) {
    return await this.syncManager.cleanupOldTasks(daysOld);
  }
}

// Se executado diretamente, iniciar o worker
if (require.main === module) {
  const worker = new PersistentSyncWorker();
  worker.start();
  
  // Manter processo vivo
  process.stdin.resume();
}

module.exports = PersistentSyncWorker;