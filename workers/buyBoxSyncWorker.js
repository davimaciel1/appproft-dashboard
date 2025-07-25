require('dotenv').config({ path: '../server/.env' });
const buyBoxService = require('../server/services/amazon/buyBoxService');
const pool = require('../server/db/pool');

class BuyBoxSyncWorker {
  constructor() {
    this.isRunning = false;
    this.syncInterval = 15 * 60 * 1000; // 15 minutos
  }

  async start() {
    console.log('🚀 Buy Box Sync Worker iniciado');
    console.log(`⏰ Sincronização automática a cada ${this.syncInterval / 60000} minutos`);
    
    // Executar sincronização inicial
    await this.performSync();
    
    // Agendar sincronizações periódicas
    setInterval(() => {
      this.performSync();
    }, this.syncInterval);
  }

  async performSync() {
    if (this.isRunning) {
      console.log('⚠️  Sincronização já em andamento, pulando...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🔄 [${new Date().toISOString()}] Iniciando sincronização de Buy Box...`);
      
      // Verificar conexão com o banco
      await pool.query('SELECT 1');
      
      // Executar sincronização
      const result = await buyBoxService.syncAllBuyBoxData();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Sincronização concluída em ${duration}s`);
      console.log(`   • Total de produtos: ${result.total}`);
      console.log(`   • Sucessos: ${result.success}`);
      console.log(`   • Erros: ${result.errors}`);
      
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
        'buy_box_worker',
        result.success,
        result.errors === 0 ? 'success' : 'partial',
        JSON.stringify({
          ...result,
          duration: duration
        })
      ]);
      
    } catch (error) {
      console.error('❌ Erro durante sincronização:', error.message);
      
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
          'buy_box_worker',
          0,
          'error',
          JSON.stringify({
            error: error.message,
            stack: error.stack
          })
        ]);
      } catch (logError) {
        console.error('Erro ao registrar log:', logError);
      }
    } finally {
      this.isRunning = false;
    }
  }

  async getStats() {
    try {
      const stats = await pool.query(`
        SELECT 
          COUNT(DISTINCT asin) as unique_asins,
          COUNT(*) as total_records,
          MIN(timestamp) as oldest_record,
          MAX(timestamp) as newest_record
        FROM competitor_tracking_advanced
      `);
      
      const recentSync = await pool.query(`
        SELECT * FROM sync_logs
        WHERE marketplace = 'amazon'
        AND sync_type IN ('buy_box', 'buy_box_worker')
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      console.log('\n📊 Estatísticas do Worker:');
      console.log(`   • ASINs únicos: ${stats.rows[0].unique_asins}`);
      console.log(`   • Total de registros: ${stats.rows[0].total_records}`);
      console.log(`   • Registro mais antigo: ${stats.rows[0].oldest_record || 'N/A'}`);
      console.log(`   • Registro mais recente: ${stats.rows[0].newest_record || 'N/A'}`);
      
      console.log('\n📋 Últimas sincronizações:');
      recentSync.rows.forEach(log => {
        console.log(`   • ${log.created_at.toISOString()} - ${log.status} (${log.records_synced} registros)`);
      });
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
    }
  }
}

// Verificar se o script está sendo executado diretamente
if (require.main === module) {
  const worker = new BuyBoxSyncWorker();
  
  // Capturar sinais de término
  process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando worker...');
    await worker.getStats();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando worker...');
    await worker.getStats();
    process.exit(0);
  });
  
  // Iniciar worker
  worker.start().catch(error => {
    console.error('Erro fatal ao iniciar worker:', error);
    process.exit(1);
  });
}

module.exports = BuyBoxSyncWorker;