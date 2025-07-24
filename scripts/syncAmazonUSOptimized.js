const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

class AmazonUSOptimizedSync {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: 'ATVPDKIKX0DER', // US Marketplace
      region: 'us-east-1'
    };
    
    this.baseUrl = 'https://sellingpartnerapi-na.amazon.com';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }
    
    console.log('🔑 Renewing Amazon access token...');
    
    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Token expires in 1 hour, renew 5 minutes before
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
      
      console.log('✅ Token renewed, valid until:', this.tokenExpiry.toLocaleTimeString());
      return this.accessToken;
    } catch (error) {
      console.error('❌ Error getting token:', error.response?.data || error.message);
      throw error;
    }
  }

  async continueSyncFromLastOrder() {
    console.log('🚀 Continuing Amazon US sync...\n');
    
    try {
      // Get last synced order date
      const lastOrder = await this.pool.query(`
        SELECT MAX(order_date) as last_date 
        FROM orders 
        WHERE marketplace = 'amazon'
      `);
      
      const lastSyncDate = lastOrder.rows[0].last_date 
        ? new Date(lastOrder.rows[0].last_date)
        : new Date(new Date().setFullYear(new Date().getFullYear() - 2));
      
      console.log(`📅 Resuming from: ${lastSyncDate.toLocaleDateString()}\n`);
      
      const endDate = new Date();
      const periods = [];
      let currentStart = new Date(lastSyncDate);
      currentStart.setDate(currentStart.getDate() + 1); // Start from next day
      
      while (currentStart < endDate) {
        const currentEnd = new Date(currentStart);
        currentEnd.setMonth(currentEnd.getMonth() + 1); // 1 month periods
        
        if (currentEnd > endDate) {
          currentEnd.setTime(endDate.getTime());
        }
        
        periods.push({
          start: new Date(currentStart),
          end: new Date(currentEnd)
        });
        
        currentStart.setTime(currentEnd.getTime());
        currentStart.setDate(currentStart.getDate() + 1);
      }
      
      console.log(`📅 Syncing ${periods.length} periods...\n`);
      
      let totalOrders = 0;
      let totalItems = 0;
      const productCache = new Map();
      
      // Load existing products into cache
      const existingProducts = await this.pool.query(`
        SELECT id, marketplace_product_id 
        FROM products 
        WHERE marketplace = 'amazon'
      `);
      
      existingProducts.rows.forEach(p => {
        productCache.set(p.marketplace_product_id, p.id);
      });
      
      console.log(`📦 ${productCache.size} products already in database\n`);
      
      // Process each period
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        console.log(`\n🗓️ Period ${i + 1}/${periods.length}: ${period.start.toLocaleDateString()} to ${period.end.toLocaleDateString()}`);
        
        const orders = await this.fetchOrdersList(period.start, period.end);
        
        if (orders.length === 0) {
          console.log('  ℹ️ No orders in this period');
          continue;
        }
        
        // Process orders in batches
        for (let j = 0; j < orders.length; j += 10) {
          const batch = orders.slice(j, j + 10);
          
          await Promise.all(batch.map(async (order) => {
            const orderId = await this.saveOrder(order);
            
            if (orderId) {
              const items = await this.fetchOrderItems(order.AmazonOrderId);
              
              for (const item of items) {
                if (!item.ASIN) continue;
                
                let productId = productCache.get(item.ASIN);
                
                if (!productId) {
                  const productInfo = await this.fetchProductInfo(item.ASIN);
                  if (productInfo) {
                    productInfo.sku = item.SellerSKU || item.ASIN;
                    productInfo.price = parseFloat(item.ItemPrice?.Amount || 0) / (item.QuantityOrdered || 1);
                    productInfo.cost = productInfo.price * 0.6;
                    
                    productId = await this.saveProduct(productInfo);
                    if (productId) {
                      productCache.set(item.ASIN, productId);
                      console.log(`  ✅ New product: ${productInfo.title.substring(0, 40)}...`);
                    }
                  }
                }
                
                if (productId) {
                  await this.saveOrderItem(orderId, productId, item);
                  totalItems++;
                }
              }
              
              totalOrders++;
            }
          }));
          
          if ((j + 10) % 50 === 0) {
            console.log(`  📊 Processed ${j + 10} orders...`);
          }
        }
      }
      
      console.log(`\n✅ Sync completed!`);
      console.log(`   - New orders: ${totalOrders}`);
      console.log(`   - New items: ${totalItems}`);
      console.log(`   - Total products: ${productCache.size}`);
      
      await this.showSummary();
      
    } catch (error) {
      console.error('\n❌ Sync error:', error.message);
    } finally {
      await this.pool.end();
    }
  }

  async fetchOrdersList(startDate, endDate) {
    const accessToken = await this.getAccessToken();
    const orders = [];
    let nextToken = null;
    
    do {
      try {
        const params = new URLSearchParams({
          MarketplaceIds: this.credentials.marketplaceId,
          CreatedAfter: startDate.toISOString(),
          CreatedBefore: endDate.toISOString(),
          OrderStatuses: 'Shipped,Unshipped,PartiallyShipped',
          MaxResultsPerPage: '100'
        });
        
        if (nextToken) {
          params.append('NextToken', nextToken);
        }
        
        const response = await axios.get(`${this.baseUrl}/orders/v0/orders`, {
          params,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'User-Agent': 'AppProft/1.0'
          }
        });
        
        if (response.data?.payload?.Orders) {
          orders.push(...response.data.payload.Orders);
        }
        
        nextToken = response.data?.payload?.NextToken;
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`  ❌ Error:`, error.response?.status || error.message);
        break;
      }
    } while (nextToken);
    
    console.log(`  ✓ ${orders.length} orders found`);
    return orders;
  }

  async fetchOrderItems(orderId) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`${this.baseUrl}/orders/v0/orders/${orderId}/orderItems`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken
        }
      });
      
      return response.data?.payload?.OrderItems || [];
    } catch (error) {
      return [];
    }
  }

  async fetchProductInfo(asin) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`${this.baseUrl}/catalog/2022-04-01/items/${asin}`, {
        params: {
          marketplaceIds: this.credentials.marketplaceId,
          includedData: 'images,summaries'
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken
        }
      });
      
      if (response.data) {
        const images = response.data.images?.[0]?.images || [];
        const mainImage = images.find(img => img.variant === 'MAIN')?.link || images[0]?.link;
        
        return {
          asin,
          title: response.data.summaries?.[0]?.itemName || `Product ${asin}`,
          imageUrl: mainImage || `https://images-na.ssl-images-amazon.com/images/P/${asin}.jpg`
        };
      }
    } catch (error) {
      return {
        asin,
        title: `Amazon Product ${asin}`,
        imageUrl: `https://images-na.ssl-images-amazon.com/images/P/${asin}.jpg`
      };
    }
  }

  async saveProduct(productData, userId = 1) {
    try {
      const result = await this.pool.query(`
        INSERT INTO products (
          user_id, tenant_id, marketplace, marketplace_product_id,
          sku, asin, name, price, cost, image_url, inventory, country_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (marketplace, marketplace_product_id) 
        DO UPDATE SET 
          name = COALESCE(products.name, EXCLUDED.name),
          price = COALESCE(EXCLUDED.price, products.price),
          image_url = COALESCE(EXCLUDED.image_url, products.image_url)
        RETURNING id
      `, [
        userId, userId, 'amazon', productData.asin,
        productData.sku || productData.asin, productData.asin,
        productData.title, productData.price || 0,
        productData.cost || 0, productData.imageUrl, 0, 'US'
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Product save error:', error.message);
      return null;
    }
  }

  async saveOrder(orderData, userId = 1) {
    try {
      const result = await this.pool.query(`
        INSERT INTO orders (
          user_id, tenant_id, marketplace, marketplace_order_id,
          status, total, order_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, marketplace, marketplace_order_id) DO NOTHING
        RETURNING id
      `, [
        userId, userId, 'amazon', orderData.AmazonOrderId,
        orderData.OrderStatus?.toLowerCase() || 'pending',
        parseFloat(orderData.OrderTotal?.Amount || 0),
        new Date(orderData.PurchaseDate)
      ]);
      
      return result.rows[0]?.id;
    } catch (error) {
      return null;
    }
  }

  async saveOrderItem(orderId, productId, itemData) {
    try {
      const unitPrice = parseFloat(itemData.ItemPrice?.Amount || 0) / (itemData.QuantityOrdered || 1);
      
      await this.pool.query(`
        INSERT INTO order_items (
          order_id, product_id, quantity, unit_price, cost
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        orderId, productId,
        parseInt(itemData.QuantityOrdered || 1),
        unitPrice, unitPrice * 0.6
      ]);
    } catch (error) {
      // Silent fail
    }
  }

  async showSummary() {
    console.log('\n📊 Final summary:');
    
    const summary = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as products,
        COUNT(DISTINCT o.id) as orders,
        COALESCE(SUM(oi.quantity), 0) as units,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
        MIN(o.order_date) as first_order,
        MAX(o.order_date) as last_order
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.marketplace = 'amazon'
    `);
    
    const result = summary.rows[0];
    console.table({
      'Total Products': result.products || 0,
      'Total Orders': result.orders || 0,
      'Units Sold': result.units || 0,
      'Revenue': `$${parseFloat(result.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      'First Order': result.first_order ? new Date(result.first_order).toLocaleDateString() : 'N/A',
      'Last Order': result.last_order ? new Date(result.last_order).toLocaleDateString() : 'N/A'
    });
  }
}

const sync = new AmazonUSOptimizedSync();
sync.continueSyncFromLastOrder();