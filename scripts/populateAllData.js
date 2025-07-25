#!/usr/bin/env node

/**
 * Script de População Automática Completa
 * Integra todos os coletores de dados em uma única rotina
 */

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const PersistentSyncManager = require('../server/services/persistentSyncManager');

class CompleteDataPopulator {
  constructor() {
    this.syncManager = new PersistentSyncManager();
    this.tenantId = process.env.TENANT_ID || 'default';
    this.results = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      details: {}
    };
  }

  async start() {
    console.log('🚀 INICIANDO POPULAÇÃO COMPLETA DO BANCO DE DADOS');
    console.log('='.repeat(60));
    console.log(`Tenant ID: ${this.tenantId}`);
    console.log(`Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

    try {
      // 1. Verificar conexão com banco
      await this.verifyDatabaseConnection();
      
      // 2. Enfileirar todas as tarefas de sincronização
      await this.enqueueAllSyncTasks();
      
      // 3. Aguardar execução das tarefas críticas
      await this.waitForCriticalTasks();
      
      // 4. Verificar resultados
      await this.verifyResults();
      
      // 5. Relatório final
      await this.generateFinalReport();
      
    } catch (error) {
      console.error('❌ Erro crítico:', error.message);
      process.exit(1);
    }
  }

  async verifyDatabaseConnection() {
    console.log('1️⃣ Verificando conexão com PostgreSQL...');
    
    try {
      const result = await executeSQL('SELECT NOW() as current_time, COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = \'public\'');
      const info = result.rows[0];
      
      console.log(`✅ Conexão OK - ${info.total_tables} tabelas disponíveis`);
      console.log(`   Horário do servidor: ${new Date(info.current_time).toLocaleString('pt-BR')}\n`);
    } catch (error) {
      throw new Error(`Falha na conexão com PostgreSQL: ${error.message}`);
    }
  }

  async enqueueAllSyncTasks() {
    console.log('2️⃣ Enfileirando todas as tarefas de sincronização...\n');
    
    const tasks = [
      // === ALTA PRIORIDADE ===
      {
        name: 'Sync Amazon SP-API (Otimizado)',
        action: () => this.syncManager.enqueueTask('optimized_sync', '/v1/marketplace-participations', { tenantId: this.tenantId }, 1)
      },
      {
        name: 'Sync Buy Box Monitoring',
        action: () => this.syncManager.enqueueTask('batch_pricing', '/products/pricing/v0/competitivePricing', { tenantId: this.tenantId }, 2)
      },
      {
        name: 'Verificar Hijackers',
        action: () => this.syncManager.enqueueHijackerCheck(2)
      },
      
      // === PRIORIDADE MÉDIA ===
      {
        name: 'Data Kiosk - Métricas Completas',
        action: () => this.syncManager.enqueueDataKioskSync('full', { tenantId: this.tenantId, daysBack: 30, priority: 3 })
      },
      {
        name: 'Advertising API - Campanhas',
        action: () => this.syncManager.enqueueAdvertisingSync(null, 'campaigns')
      },
      {
        name: 'Advertising API - Relatórios',
        action: () => this.syncManager.enqueueAdvertisingSync(null, 'reports')
      },
      
      // === BAIXA PRIORIDADE ===
      {
        name: 'Notificações Automáticas',
        action: () => this.syncManager.enqueueTask('check_notifications', '/notifications/check', { tenantId: this.tenantId }, 5)
      },
      {
        name: 'Data Kiosk - Produtos',
        action: () => this.syncManager.enqueueDataKioskSync('products', { tenantId: this.tenantId, daysBack: 7, priority: 5 })
      }
    ];

    this.results.totalTasks = tasks.length;

    for (const task of tasks) {
      try {
        console.log(`📋 Enfileirando: ${task.name}`);
        const taskId = await task.action();
        this.results.details[task.name] = { 
          status: 'enqueued', 
          taskId,
          enqueuedAt: new Date().toISOString()
        };
        console.log(`   ✅ Task ID: ${taskId}`);
      } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
        this.results.details[task.name] = { 
          status: 'failed', 
          error: error.message 
        };
        this.results.failedTasks++;
      }
    }

    console.log(`\n📊 Resumo do enfileiramento:`);
    console.log(`   Total de tarefas: ${this.results.totalTasks}`);
    console.log(`   Enfileiradas: ${this.results.totalTasks - this.results.failedTasks}`);
    console.log(`   Falharam: ${this.results.failedTasks}\n`);
  }

  async waitForCriticalTasks() {
    console.log('3️⃣ Aguardando execução das tarefas críticas...\n');
    
    const criticalTasks = ['Sync Amazon SP-API (Otimizado)', 'Sync Buy Box Monitoring'];
    const maxWaitTime = 10 * 60 * 1000; // 10 minutos
    const startTime = Date.now();
    
    while ((Date.now() - startTime) < maxWaitTime) {
      const queueStatus = await this.checkQueueStatus();
      
      console.log(`⏳ Status da fila: ${queueStatus.pending} pendentes, ${queueStatus.processing} processando, ${queueStatus.completed} completadas`);
      
      // Verificar se tarefas críticas foram completadas
      let allCriticalCompleted = true;
      for (const taskName of criticalTasks) {
        const taskDetails = this.results.details[taskName];
        if (taskDetails && taskDetails.taskId) {
          const taskStatus = await this.getTaskStatus(taskDetails.taskId);
          if (taskStatus !== 'completed') {
            allCriticalCompleted = false;
          } else {
            console.log(`✅ Tarefa crítica completada: ${taskName}`);
          }
        }
      }
      
      if (allCriticalCompleted) {
        console.log('🎉 Todas as tarefas críticas foram completadas!\n');
        break;
      }
      
      // Aguardar 30 segundos antes de verificar novamente
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }

  async checkQueueStatus() {
    const result = await executeSQL(`
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_queue
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY status
    `);
    
    const status = { pending: 0, processing: 0, completed: 0, failed: 0 };
    
    for (const row of result.rows) {
      status[row.status] = parseInt(row.count);
    }
    
    return status;
  }

  async getTaskStatus(taskId) {
    const result = await executeSQL('SELECT status FROM sync_queue WHERE id = $1', [taskId]);
    return result.rows[0]?.status || 'unknown';
  }

  async verifyResults() {
    console.log('4️⃣ Verificando dados popolados no banco...\n');
    
    const verifications = [
      {
        name: 'Produtos Amazon',
        query: 'SELECT COUNT(*) as count FROM products WHERE marketplace = \'amazon\' OR asin IS NOT NULL'
      },
      {
        name: 'Métricas de Tráfego',
        query: 'SELECT COUNT(*) as count, MAX(date) as latest_date FROM traffic_metrics'
      },
      {
        name: 'Métricas Diárias',
        query: 'SELECT COUNT(*) as count, MAX(date) as latest_date FROM daily_metrics'
      },
      {
        name: 'Buy Box Winners',
        query: 'SELECT COUNT(*) as count, COUNT(CASE WHEN is_winner = true THEN 1 END) as our_wins FROM buy_box_winners'
      },
      {
        name: 'Alertas de Hijacker',
        query: 'SELECT COUNT(*) as count, COUNT(CASE WHEN is_active = true THEN 1 END) as active_alerts FROM hijacker_alerts'
      },
      {
        name: 'Campanhas Advertising',
        query: 'SELECT COUNT(*) as count FROM advertising_campaigns WHERE created_at > NOW() - INTERVAL \'1 day\''
      },
      {
        name: 'Notificações',
        query: 'SELECT COUNT(*) as count, COUNT(CASE WHEN read = false THEN 1 END) as unread FROM notifications WHERE created_at > NOW() - INTERVAL \'1 day\''
      }
    ];

    for (const verification of verifications) {
      try {
        const result = await executeSQL(verification.query);
        const data = result.rows[0];
        
        console.log(`📊 ${verification.name}:`);
        if (data.count !== undefined) {
          console.log(`   Total de registros: ${data.count}`);
        }
        if (data.latest_date) {
          console.log(`   Data mais recente: ${new Date(data.latest_date).toLocaleDateString('pt-BR')}`);
        }
        if (data.our_wins !== undefined) {
          console.log(`   Nossos Buy Box: ${data.our_wins}`);
        }
        if (data.active_alerts !== undefined) {
          console.log(`   Alertas ativos: ${data.active_alerts}`);
        }
        if (data.unread !== undefined) {
          console.log(`   Não lidas: ${data.unread}`);
        }
        console.log('');
        
      } catch (error) {
        console.log(`❌ ${verification.name}: Erro - ${error.message}\n`);
      }
    }
  }

  async generateFinalReport() {
    console.log('5️⃣ Relatório Final\n');
    console.log('='.repeat(60));
    
    // Status geral
    const queueStatus = await this.checkQueueStatus();
    
    console.log('📈 RESUMO DA POPULAÇÃO DE DADOS:');
    console.log('');
    console.log('🔄 Status da Fila de Sincronização:');
    console.log(`   ✅ Completadas: ${queueStatus.completed}`);
    console.log(`   ⏳ Processando: ${queueStatus.processing}`);
    console.log(`   📋 Pendentes: ${queueStatus.pending}`);
    console.log(`   ❌ Falharam: ${queueStatus.failed}`);
    console.log('');
    
    // Próximos passos
    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('');
    console.log('1. Monitorar execução das tarefas:');
    console.log('   node scripts/checkQueueStatus.js');
    console.log('');
    console.log('2. Testar Data Kiosk:');
    console.log('   node scripts/testDataKiosk.js');
    console.log('');
    console.log('3. Verificar sistema completo:');
    console.log('   node scripts/testCompleteSystem.js');
    console.log('');
    console.log('4. Acessar dashboard:');
    console.log('   https://appproft.com/database');
    console.log('');
    
    // URLs importantes
    console.log('🌐 URLs IMPORTANTES:');
    console.log('   Database Viewer: https://appproft.com/database');
    console.log('   API Metrics: https://appproft.com/api/dashboard-local/metrics');
    console.log('   Buy Box Status: https://appproft.com/api/dashboard-local/buy-box-status');
    console.log('');
    
    console.log('✨ População automática concluída!');
    console.log(`   Iniciada em: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`   Tenant ID: ${this.tenantId}`);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const populator = new CompleteDataPopulator();
  populator.start().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = CompleteDataPopulator;