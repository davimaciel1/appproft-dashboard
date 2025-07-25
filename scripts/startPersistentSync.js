// Script para iniciar o PersistentSyncManager

/**
 * Script para iniciar o PersistentSyncManager
 * Processa as tarefas da fila de sincronização
 */

require('dotenv').config();
const PersistentSyncManager = require('../server/services/persistentSyncManager');

class SyncStarter {
  constructor() {
    this.syncManager = new PersistentSyncManager();
  }

  async start() {
    console.log('🚀 INICIANDO PERSISTENT SYNC MANAGER');
    console.log('='.repeat(50));
    console.log(`Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

    try {
      // Verificar se há tarefas pendentes
      const stats = await this.syncManager.getQueueStats();
      
      console.log('📊 Status inicial da fila:');
      console.log(`   Pendentes: ${stats.pending?.count || 0}`);
      console.log(`   Processando: ${stats.processing?.count || 0}`);
      console.log(`   Completadas: ${stats.completed?.count || 0}`);
      console.log(`   Falharam: ${stats.failed?.count || 0}\n`);

      const pendingCount = stats.pending?.count || 0;
      
      if (pendingCount === 0) {
        console.log('📭 Nenhuma tarefa pendente na fila');
        console.log('💡 Execute: node scripts/populateAllData.js para adicionar tarefas\n');
      } else {
        console.log(`🔄 Iniciando processamento de ${pendingCount} tarefas pendentes...\n`);
      }

      // Iniciar o processamento
      console.log('⚡ PersistentSyncManager iniciado!');
      console.log('📝 Logs serão exibidos em tempo real...\n');
      console.log('⌨️ Pressione Ctrl+C para parar\n');

      await this.syncManager.startProcessing();

    } catch (error) {
      console.error('❌ Erro ao iniciar:', error.message);
      process.exit(1);
    }
  }

  // Graceful shutdown
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n📴 Recebido sinal ${signal}, parando graciosamente...`);
      
      try {
        await this.syncManager.stop();
        console.log('✅ PersistentSyncManager parado com sucesso');
        process.exit(0);
      } catch (error) {
        console.error('❌ Erro ao parar:', error.message);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const starter = new SyncStarter();
  starter.setupGracefulShutdown();
  starter.start().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = SyncStarter;