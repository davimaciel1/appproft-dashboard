const pool = require('../db/pool');
const AmazonService = require('./amazonService');
const MercadoLivreService = require('./mercadolivreService');
const secureLogger = require('../utils/secureLogger');

class SyncService {
  constructor() {
    this.rateLimits = {
      amazon: { 
        orders: { limit: 6, interval: 1000 }, // 6 per second
        inventory: { limit: 2, interval: 1000 }, // 2 per second
        catalog: { limit: 2, interval: 1000 } // 2 per second
      },
      mercadolivre: { 
        orders: { limit: 10, interval: 1000 }, // 10 per second
        products: { limit: 10, interval: 1000 } // 10 per second
      }
    };
    
    // Rate limiter state
    this.requestQueues = {
      amazon: { orders: [], inventory: [], catalog: [] },
      mercadolivre: { orders: [], products: [] }
    };
    
    this.lastRequestTime = {
      amazon: { orders: 0, inventory: 0, catalog: 0 },
      mercadolivre: { orders: 0, products: 0 }
    };
  }

  async rateLimitedRequest(fn, marketplace, endpoint) {
    const limit = this.rateLimits[marketplace][endpoint];
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime[marketplace][endpoint];
    
    // Calculate delay needed
    const minInterval = limit.interval / limit.limit;
    const delay = Math.max(0, minInterval - timeSinceLastRequest);
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime[marketplace][endpoint] = Date.now();
    return await fn();
  }

  async syncAmazonOrders(tenantId, credentials) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Log sync start
      const syncLogResult = await client.query(
        `INSERT INTO sync_logs (tenant_id, marketplace, sync_type, status) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [tenantId, 'amazon', 'orders', 'in_progress']
      );
      const syncLogId = syncLogResult.rows[0].id;
      
      const amazonService = new AmazonService(credentials);
      
      // Get orders from last hour (for real-time sync)
      const oneHourAgo = new Date(Date.now() - 3600000);
      
      // Rate limited request
      const orders = await this.rateLimitedRequest(async () => {
        return await amazonService.getOrders(oneHourAgo.toISOString());
      }, 'amazon', 'orders');
      
      let recordsSynced = 0;
      
      for (const order of orders) {
        // Check if order exists
        const orderExists = await client.query(
          'SELECT id FROM orders WHERE tenant_id = $1 AND marketplace = $2 AND order_id = $3',
          [tenantId, 'amazon', order.AmazonOrderId]
        );
        
        if (orderExists.rows.length === 0) {
          // Insert new order
          const orderResult = await client.query(
            `INSERT INTO orders (tenant_id, marketplace, order_id, order_date, status, total_amount, currency)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
              tenantId,
              'amazon',
              order.AmazonOrderId,
              new Date(order.PurchaseDate),
              order.OrderStatus,
              parseFloat(order.OrderTotal?.Amount || 0),
              order.OrderTotal?.CurrencyCode || 'USD'
            ]
          );
          
          const orderId = orderResult.rows[0].id;
          
          // Get order items with rate limiting
          const orderItems = await this.rateLimitedRequest(async () => {
            return await amazonService.getOrderItems(order.AmazonOrderId);
          }, 'amazon', 'orders');
          
          for (const item of orderItems) {
            // Find or create product
            let productId;
            const productExists = await client.query(
              'SELECT id FROM products WHERE tenant_id = $1 AND marketplace = $2 AND asin = $3',
              [tenantId, 'amazon', item.ASIN]
            );
            
            if (productExists.rows.length > 0) {
              productId = productExists.rows[0].id;
            } else {
              // Create product
              const productResult = await client.query(
                `INSERT INTO products (tenant_id, marketplace, country_code, asin, sku, name, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [
                  tenantId,
                  'amazon',
                  'US',
                  item.ASIN,
                  item.SellerSKU || item.ASIN,
                  item.Title || `Product ${item.ASIN}`,
                  null // Will be updated later
                ]
              );
              productId = productResult.rows[0].id;
            }
            
            // Insert order item
            await client.query(
              `INSERT INTO order_items (order_id, product_id, quantity, price, cost)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                orderId,
                productId,
                item.QuantityOrdered || 1,
                parseFloat(item.ItemPrice?.Amount || 0),
                parseFloat(item.ItemPrice?.Amount || 0) * 0.7 // Estimated 70% cost
              ]
            );
          }
          
          recordsSynced++;
          
          // Emit real-time event
          if (global.io) {
            global.io.emit('new-order', {
              marketplace: 'amazon',
              orderId: order.AmazonOrderId,
              amount: order.OrderTotal?.Amount,
              timestamp: new Date()
            });
          }
        }
      }
      
      // Update sync log
      await client.query(
        `UPDATE sync_logs SET status = $1, records_synced = $2, completed_at = $3 WHERE id = $4`,
        ['completed', recordsSynced, new Date(), syncLogId]
      );
      
      await client.query('COMMIT');
      
      // Refresh materialized view
      await pool.query('SELECT refresh_product_sales_summary()');
      
      secureLogger.info('Amazon sync completed', { tenantId, recordsSynced });
      
      return { success: true, recordsSynced };
      
    } catch (error) {
      await client.query('ROLLBACK');
      secureLogger.error('Amazon sync failed', { tenantId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async syncMercadoLivreOrders(tenantId, credentials) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Log sync start
      const syncLogResult = await client.query(
        `INSERT INTO sync_logs (tenant_id, marketplace, sync_type, status) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [tenantId, 'mercadolivre', 'orders', 'in_progress']
      );
      const syncLogId = syncLogResult.rows[0].id;
      
      const mlService = new MercadoLivreService(credentials);
      
      // Rate limited request
      const orders = await this.rateLimitedRequest(async () => {
        return await mlService.getOrders();
      }, 'mercadolivre', 'orders');
      
      let recordsSynced = 0;
      
      // Filter recent orders (last hour)
      const oneHourAgo = new Date(Date.now() - 3600000);
      const recentOrders = orders.filter(order => new Date(order.date_created) >= oneHourAgo);
      
      for (const order of recentOrders) {
        // Check if order exists
        const orderExists = await client.query(
          'SELECT id FROM orders WHERE tenant_id = $1 AND marketplace = $2 AND order_id = $3',
          [tenantId, 'mercadolivre', order.id.toString()]
        );
        
        if (orderExists.rows.length === 0) {
          // Insert new order
          const orderResult = await client.query(
            `INSERT INTO orders (tenant_id, marketplace, order_id, order_date, status, total_amount, currency)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
              tenantId,
              'mercadolivre',
              order.id.toString(),
              new Date(order.date_created),
              order.status,
              order.total_amount || 0,
              order.currency_id || 'BRL'
            ]
          );
          
          const orderId = orderResult.rows[0].id;
          
          for (const item of order.order_items || []) {
            // Find or create product
            let productId;
            const productExists = await client.query(
              'SELECT id FROM products WHERE tenant_id = $1 AND marketplace = $2 AND sku = $3',
              [tenantId, 'mercadolivre', item.item.id]
            );
            
            if (productExists.rows.length > 0) {
              productId = productExists.rows[0].id;
            } else {
              // Create product
              const productResult = await client.query(
                `INSERT INTO products (tenant_id, marketplace, country_code, sku, name, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [
                  tenantId,
                  'mercadolivre',
                  'BR',
                  item.item.id,
                  item.item.title,
                  item.item.thumbnail
                ]
              );
              productId = productResult.rows[0].id;
            }
            
            // Insert order item
            await client.query(
              `INSERT INTO order_items (order_id, product_id, quantity, price, cost)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                orderId,
                productId,
                item.quantity,
                item.unit_price,
                item.unit_price * 0.7 // Estimated 70% cost
              ]
            );
          }
          
          recordsSynced++;
          
          // Emit real-time event
          if (global.io) {
            global.io.emit('new-order', {
              marketplace: 'mercadolivre',
              orderId: order.id,
              amount: order.total_amount,
              timestamp: new Date()
            });
          }
        }
      }
      
      // Update sync log
      await client.query(
        `UPDATE sync_logs SET status = $1, records_synced = $2, completed_at = $3 WHERE id = $4`,
        ['completed', recordsSynced, new Date(), syncLogId]
      );
      
      await client.query('COMMIT');
      
      // Refresh materialized view
      await pool.query('SELECT refresh_product_sales_summary()');
      
      secureLogger.info('Mercado Livre sync completed', { tenantId, recordsSynced });
      
      return { success: true, recordsSynced };
      
    } catch (error) {
      await client.query('ROLLBACK');
      secureLogger.error('Mercado Livre sync failed', { tenantId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async syncProductImages(tenantId) {
    // This method updates product images that are missing
    const client = await pool.connect();
    
    try {
      // Get products without images
      const productsWithoutImages = await client.query(
        `SELECT id, marketplace, asin, sku FROM products 
         WHERE tenant_id = $1 AND image_url IS NULL 
         LIMIT 50`,
        [tenantId]
      );
      
      for (const product of productsWithoutImages.rows) {
        if (product.marketplace === 'amazon' && product.asin) {
          // Get Amazon credentials
          const credsResult = await client.query(
            'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
            [tenantId, 'amazon']
          );
          
          if (credsResult.rows.length > 0) {
            const credentials = {
              clientId: credsResult.rows[0].client_id,
              clientSecret: credsResult.rows[0].client_secret,
              refreshToken: credsResult.rows[0].refresh_token,
              sellerId: credsResult.rows[0].seller_id,
              marketplaceId: credsResult.rows[0].marketplace_id
            };
            
            const amazonService = new AmazonService(credentials);
            
            try {
              // Rate limited catalog request
              const catalogData = await this.rateLimitedRequest(async () => {
                const path = `/catalog/2022-04-01/items/${product.asin}?marketplaceIds=${credentials.marketplaceId}&includedData=images`;
                return await amazonService.callSPAPI(path);
              }, 'amazon', 'catalog');
              
              if (catalogData.payload?.images?.[0]?.images?.[0]?.link) {
                await client.query(
                  'UPDATE products SET image_url = $1 WHERE id = $2',
                  [catalogData.payload.images[0].images[0].link, product.id]
                );
              }
            } catch (e) {
              // Continue with next product
            }
          }
        }
      }
      
      secureLogger.info('Product images sync completed', { tenantId });
      
    } catch (error) {
      secureLogger.error('Product images sync failed', { tenantId, error: error.message });
    } finally {
      client.release();
    }
  }
}

module.exports = SyncService;