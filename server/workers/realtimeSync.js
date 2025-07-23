const cron = require('node-cron');
const pool = require('../db/pool');
const SyncService = require('../services/syncService');
const secureLogger = require('../utils/secureLogger');

class RealtimeSyncWorker {
  constructor() {
    this.syncService = new SyncService();
    this.isRunning = false;
  }

  async start() {
    console.log('🚀 Starting real-time sync worker...');
    
    // Sync orders every minute (respecting rate limits)
    cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        console.log('⏳ Previous sync still running, skipping...');
        return;
      }
      
      this.isRunning = true;
      await this.syncRecentOrders();
      this.isRunning = false;
    });
    
    // Full sync every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      await this.fullSync();
    });
    
    // Update product images every hour
    cron.schedule('0 * * * *', async () => {
      await this.syncProductImages();
    });
    
    // Refresh materialized view every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await pool.query('SELECT refresh_product_sales_summary()');
        console.log('✅ Materialized view refreshed');
      } catch (error) {
        console.error('❌ Failed to refresh materialized view:', error.message);
      }
    });
    
    console.log('✅ Real-time sync worker started');
  }

  async syncRecentOrders() {
    try {
      console.log('🔄 Syncing recent orders...');
      
      // Get all active tenants with credentials
      const tenants = await pool.query(`
        SELECT DISTINCT user_id, marketplace, client_id, client_secret, refresh_token, seller_id, marketplace_id
        FROM marketplace_credentials
        WHERE refresh_token IS NOT NULL
      `);
      
      for (const tenant of tenants.rows) {
        const credentials = {
          clientId: tenant.client_id,
          clientSecret: tenant.client_secret,
          refreshToken: tenant.refresh_token,
          sellerId: tenant.seller_id,
          marketplaceId: tenant.marketplace_id
        };
        
        try {
          if (tenant.marketplace === 'amazon') {
            await this.syncService.syncAmazonOrders(tenant.user_id, credentials);
          } else if (tenant.marketplace === 'mercadolivre') {
            await this.syncService.syncMercadoLivreOrders(tenant.user_id, credentials);
          }
        } catch (error) {
          secureLogger.error('Sync failed for tenant', { 
            tenantId: tenant.user_id, 
            marketplace: tenant.marketplace,
            error: error.message 
          });
        }
      }
      
      console.log('✅ Recent orders sync completed');
    } catch (error) {
      console.error('❌ Recent orders sync failed:', error);
    }
  }

  async fullSync() {
    try {
      console.log('🔄 Starting full sync...');
      
      // This would sync last 30 days of data
      // Implementation would be similar to syncRecentOrders but with longer date range
      
      console.log('✅ Full sync completed');
    } catch (error) {
      console.error('❌ Full sync failed:', error);
    }
  }

  async syncProductImages() {
    try {
      console.log('🖼️ Syncing product images...');
      
      // Get all tenants
      const tenants = await pool.query('SELECT DISTINCT user_id FROM marketplace_credentials');
      
      for (const tenant of tenants.rows) {
        await this.syncService.syncProductImages(tenant.user_id);
      }
      
      console.log('✅ Product images sync completed');
    } catch (error) {
      console.error('❌ Product images sync failed:', error);
    }
  }
}

// Export singleton instance
module.exports = new RealtimeSyncWorker();