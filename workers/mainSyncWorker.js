const pool = require('../server/db/pool');
const secureLogger = require('../server/utils/secureLogger');
const AmazonProductSync = require('../server/services/amazon/productSync');
const AmazonOrderSync = require('../server/services/amazon/orderSync');
const MLProductSync = require('../server/services/mercadolivre/productSync');
const MLOrderSync = require('../server/services/mercadolivre/orderSync');

// Este worker DEVE rodar continuamente para buscar dados das APIs
// Similar ao Sidekiq do Rails que o Shopkeeper usa
class MainSyncWorker {
  constructor() {
    this.isRunning = false;
    this.syncInterval = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('🔄 Worker já está rodando');
      return;
    }

    this.isRunning = true;
    console.log('🚀 MainSyncWorker iniciado - modo 24/7 ativo');

    try {
      // 1. Verificar se é primeira sincronização
      const tenants = await this.getAllTenants();
      
      for (const tenant of tenants) {
        const isFirst = await this.isFirstSync(tenant.tenant_id);
        
        if (isFirst) {
          console.log(`🔄 PRIMEIRA SINCRONIZAÇÃO para tenant ${tenant.tenant_id}`);
          await this.initialSync(tenant.tenant_id);
        }
      }
      
      // 2. Iniciar sincronização contínua (a cada minuto)
      this.syncInterval = setInterval(() => {
        this.continuousSync().catch(error => {
          secureLogger.error('Erro no sync contínuo', { error: error.message });
        });
      }, 60000); // 60 segundos

      console.log('✅ Worker configurado para sync a cada 60 segundos');
      
    } catch (error) {
      secureLogger.error('Erro ao iniciar MainSyncWorker', { error: error.message });
      this.isRunning = false;
    }
  }

  async stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 MainSyncWorker parado');
  }

  async getAllTenants() {
    const result = await pool.query(`
      SELECT DISTINCT user_id as tenant_id 
      FROM marketplace_credentials 
      WHERE refresh_token IS NOT NULL
    `);
    return result.rows;
  }

  async isFirstSync(tenantId) {
    const result = await pool.query(
      'SELECT is_first_sync($1) as is_first',
      [tenantId]
    );
    return result.rows[0].is_first;
  }

  async initialSync(tenantId) {
    // Buscar últimos 30 dias de dados
    console.log(`🚀 SINCRONIZAÇÃO INICIAL para ${tenantId} - Buscando 30 dias de dados...`);
    
    const startTime = Date.now();
    let totalRecords = 0;

    try {
      // Amazon
      const amazonResults = await Promise.allSettled([
        this.syncAmazonProducts(tenantId),
        this.syncAmazonOrders(tenantId, 30),
        this.syncAmazonInventory(tenantId)
      ]);

      // Mercado Livre  
      const mlResults = await Promise.allSettled([
        this.syncMLProducts(tenantId),
        this.syncMLOrders(tenantId, 30)
      ]);

      // Contar registros sincronizados
      [...amazonResults, ...mlResults].forEach(result => {
        if (result.status === 'fulfilled' && result.value?.recordsSynced) {
          totalRecords += result.value.recordsSynced;
        }
      });

      // Atualizar materialized view
      await pool.query('SELECT refresh_product_sales_summary()');

      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Sincronização inicial completa em ${duration}s - ${totalRecords} registros`);

      // Log de sucesso
      await pool.query(`
        INSERT INTO sync_logs (tenant_id, marketplace, sync_type, status, records_synced, completed_at)
        VALUES ($1, 'all', 'initial', 'completed', $2, NOW())
      `, [tenantId, totalRecords]);

    } catch (error) {
      secureLogger.error('Erro na sincronização inicial', { 
        tenantId, 
        error: error.message 
      });

      // Log de erro
      await pool.query(`
        INSERT INTO sync_logs (tenant_id, marketplace, sync_type, status, error_message, completed_at)
        VALUES ($1, 'all', 'initial', 'failed', $2, NOW())
      `, [tenantId, error.message]);
    }
  }

  async continuousSync() {
    const tenants = await this.getAllTenants();
    
    for (const tenant of tenants) {
      try {
        // Buscar apenas dados novos/atualizados (últimos 60 minutos)
        const results = await Promise.allSettled([
          this.syncAmazonOrders(tenant.tenant_id, 0.04), // 60 minutos = 0.04 dias
          this.syncMLOrders(tenant.tenant_id, 0.04)
        ]);

        // Se houve novos pedidos, atualizar view
        const hasNewData = results.some(r => 
          r.status === 'fulfilled' && r.value?.recordsSynced > 0
        );

        if (hasNewData) {
          await pool.query('SELECT refresh_product_sales_summary()');
          console.log(`🔄 Dados atualizados para tenant ${tenant.tenant_id}`);

          // Emitir evento WebSocket se disponível
          if (global.io) {
            global.io.to(tenant.tenant_id).emit('data-updated', {
              timestamp: new Date(),
              message: 'Novos dados sincronizados'
            });
          }
        }

      } catch (error) {
        secureLogger.error('Erro no sync contínuo do tenant', { 
          tenantId: tenant.tenant_id,
          error: error.message 
        });
      }
    }
  }

  async syncAmazonProducts(tenantId) {
    const amazonSync = new AmazonProductSync(tenantId);
    return await amazonSync.syncProducts();
  }

  async syncAmazonOrders(tenantId, days) {
    const amazonSync = new AmazonOrderSync(tenantId);
    return await amazonSync.syncOrders(days);
  }

  async syncAmazonInventory(tenantId) {
    const amazonSync = new AmazonProductSync(tenantId);
    return await amazonSync.syncInventory();
  }

  async syncMLProducts(tenantId) {
    const mlSync = new MLProductSync(tenantId);
    return await mlSync.syncProducts();
  }

  async syncMLOrders(tenantId, days) {
    const mlSync = new MLOrderSync(tenantId);
    return await mlSync.syncOrders(days);
  }

  // Método para forçar sincronização manual
  async triggerSync(tenantId = null) {
    console.log('🔄 Sincronização manual disparada');
    
    if (tenantId) {
      await this.initialSync(tenantId);
    } else {
      const tenants = await this.getAllTenants();
      for (const tenant of tenants) {
        await this.initialSync(tenant.tenant_id);
      }
    }
  }

  // Método para verificar status
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: !!this.syncInterval,
      uptime: this.isRunning ? process.uptime() : 0
    };
  }
}

// Singleton instance
const syncWorker = new MainSyncWorker();

// Lidar com sinais do sistema
process.on('SIGINT', async () => {
  console.log('\n🛑 Recebido SIGINT, parando worker...');
  await syncWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recebido SIGTERM, parando worker...');
  await syncWorker.stop();
  process.exit(0);
});

// Auto-start se executado diretamente
if (require.main === module) {
  console.log('🚀 Iniciando MainSyncWorker em modo standalone...');
  syncWorker.start().catch(error => {
    console.error('❌ Erro ao iniciar worker:', error);
    process.exit(1);
  });
}

module.exports = syncWorker;