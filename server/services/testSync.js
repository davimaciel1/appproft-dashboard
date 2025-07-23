require('dotenv').config({ path: '../.env' });
const pool = require('../db/pool');
const SyncService = require('./syncService');
const secureLogger = require('../utils/secureLogger');

async function testSync() {
  console.log('🚀 Starting test sync...\n');
  
  try {
    // Get credentials from database
    const result = await pool.query(
      `SELECT * FROM marketplace_credentials WHERE user_id = $1`,
      [1] // Using user ID 1 for test
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No credentials found for user ID 1');
      console.log('Please login and configure your marketplace credentials first.\n');
      return;
    }
    
    const syncService = new SyncService();
    
    for (const creds of result.rows) {
      console.log(`\n📦 Syncing ${creds.marketplace}...`);
      
      const credentials = {
        clientId: creds.client_id,
        clientSecret: creds.client_secret,
        refreshToken: creds.refresh_token,
        sellerId: creds.seller_id,
        marketplaceId: creds.marketplace_id
      };
      
      try {
        let result;
        if (creds.marketplace === 'amazon') {
          result = await syncService.syncAmazonOrders(creds.user_id, credentials);
        } else if (creds.marketplace === 'mercadolivre') {
          result = await syncService.syncMercadoLivreOrders(creds.user_id, credentials);
        }
        
        console.log(`✅ ${creds.marketplace} sync completed:`, result);
      } catch (error) {
        console.error(`❌ ${creds.marketplace} sync failed:`, error.message);
      }
    }
    
    // Check synced data
    console.log('\n📊 Checking synced data...\n');
    
    const ordersCount = await pool.query('SELECT COUNT(*) FROM orders WHERE tenant_id = $1', [1]);
    const productsCount = await pool.query('SELECT COUNT(*) FROM products WHERE tenant_id = $1', [1]);
    const salesSummary = await pool.query(
      `SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        SUM(oi.quantity) as total_units,
        SUM(oi.price * oi.quantity) as total_revenue
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.tenant_id = $1`,
      [1]
    );
    
    console.log('📈 Sync Results:');
    console.log(`- Total Orders: ${ordersCount.rows[0].count}`);
    console.log(`- Total Products: ${productsCount.rows[0].count}`);
    console.log(`- Total Units Sold: ${salesSummary.rows[0].total_units || 0}`);
    console.log(`- Total Revenue: R$ ${(salesSummary.rows[0].total_revenue || 0).toFixed(2)}`);
    
    // Update product images
    console.log('\n🖼️ Updating product images...');
    await syncService.syncProductImages(1);
    
    console.log('\n✅ Test sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Test sync failed:', error);
  } finally {
    await pool.end();
  }
}

// Run test
testSync();