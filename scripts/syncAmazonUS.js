const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

class AmazonUSSync {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: 'ATVPDKIKX0DER', // US Marketplace ID
      region: 'us-east-1'
    };
    
    this.baseUrl = 'https://sellingpartnerapi-na.amazon.com';
  }

  async getAccessToken() {
    console.log('🔑 Getting Amazon access token...');
    
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

      console.log('✅ Token obtained successfully!');
      return response.data.access_token;
    } catch (error) {
      console.error('❌ Error getting token:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchOrdersList(startDate, endDate) {
    const accessToken = await this.getAccessToken();
    const orders = [];
    let nextToken = null;
    let page = 1;
    
    console.log(`\n📦 Fetching US orders from ${startDate.toLocaleDateString('en-US')} to ${endDate.toLocaleDateString('en-US')}...`);
    
    do {
      try {
        const params = new URLSearchParams({
          MarketplaceIds: this.credentials.marketplaceId,
          CreatedAfter: startDate.toISOString(),
          CreatedBefore: endDate.toISOString(),
          OrderStatuses: 'Shipped,Pending,Canceled,InvoiceUnconfirmed,Unfulfillable,PendingAvailability,Unshipped,PartiallyShipped',
          MaxResultsPerPage: '100'
        });
        
        if (nextToken) {
          params.append('NextToken', nextToken);
        }
        
        console.log(`  📄 Fetching page ${page}...`);
        
        const response = await axios.get(`${this.baseUrl}/orders/v0/orders`, {
          params,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'x-amz-date': new Date().toISOString(),
            'User-Agent': 'AppProft/1.0 (Language=JavaScript; Platform=Node.js)'
          }
        });
        
        if (response.data?.payload?.Orders) {
          orders.push(...response.data.payload.Orders);
          console.log(`    ✓ ${response.data.payload.Orders.length} orders found`);
        }
        
        nextToken = response.data?.payload?.NextToken;
        page++;
        
        // Rate limit: 10 requests per second for Orders API
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`  ❌ Error fetching orders:`, error.response?.data || error.message);
        break;
      }
    } while (nextToken && page <= 50);
    
    console.log(`✅ Total orders found: ${orders.length}`);
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
      console.error(`  ❌ Error fetching items for order ${orderId}:`, error.response?.status);
      return [];
    }
  }

  async fetchProductInfo(asin) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`${this.baseUrl}/catalog/2022-04-01/items/${asin}`, {
        params: {
          marketplaceIds: this.credentials.marketplaceId,
          includedData: 'attributes,images,summaries'
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
          title: response.data.summaries?.[0]?.itemName || response.data.attributes?.item_name?.[0]?.value || `Product ${asin}`,
          imageUrl: mainImage,
          brand: response.data.attributes?.brand?.[0]?.value || 'Amazon'
        };
      }
    } catch (error) {
      console.log(`  ⚠️  Using alternative data for ${asin}`);
      return {
        asin,
        title: `Amazon Product ${asin}`,
        imageUrl: `https://images-na.ssl-images-amazon.com/images/P/${asin}.jpg`,
        brand: 'Amazon'
      };
    }
  }

  async saveProduct(productData, userId = 1) {
    try {
      const result = await this.pool.query(`
        INSERT INTO products (
          user_id,
          tenant_id,
          marketplace,
          marketplace_product_id,
          sku,
          asin,
          name,
          price,
          cost,
          image_url,
          inventory,
          country_code,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (marketplace, marketplace_product_id) 
        DO UPDATE SET 
          name = COALESCE(products.name, EXCLUDED.name),
          price = COALESCE(EXCLUDED.price, products.price),
          image_url = COALESCE(EXCLUDED.image_url, products.image_url),
          updated_at = NOW()
        RETURNING id
      `, [
        userId,
        userId,
        'amazon',
        productData.asin,
        productData.sku || productData.asin,
        productData.asin,
        productData.title,
        productData.price || 0,
        productData.cost || 0,
        productData.imageUrl,
        0,
        'US'
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error saving product:', error.message);
      return null;
    }
  }

  async saveOrder(orderData, userId = 1) {
    try {
      const result = await this.pool.query(`
        INSERT INTO orders (
          user_id,
          tenant_id,
          marketplace,
          marketplace_order_id,
          status,
          total,
          order_date,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (user_id, marketplace, marketplace_order_id) DO UPDATE
        SET status = EXCLUDED.status,
            total = EXCLUDED.total
        RETURNING id
      `, [
        userId,
        userId,
        'amazon',
        orderData.AmazonOrderId,
        orderData.OrderStatus?.toLowerCase() || 'pending',
        parseFloat(orderData.OrderTotal?.Amount || 0),
        new Date(orderData.PurchaseDate)
      ]);
      
      return result.rows[0]?.id;
    } catch (error) {
      console.error('❌ Error saving order:', error.message);
      return null;
    }
  }

  async saveOrderItem(orderId, productId, itemData) {
    try {
      const unitPrice = parseFloat(itemData.ItemPrice?.Amount || 0) / (itemData.QuantityOrdered || 1);
      const unitCost = unitPrice * 0.6;
      
      await this.pool.query(`
        INSERT INTO order_items (
          order_id,
          product_id,
          quantity,
          unit_price,
          cost
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        orderId,
        productId,
        parseInt(itemData.QuantityOrdered || 1),
        unitPrice,
        unitCost
      ]);
    } catch (error) {
      console.error('❌ Error saving order item:', error.message);
    }
  }

  async syncTwoYearsData() {
    console.log('🚀 Starting Amazon US sales sync (last 2 years)...\n');
    console.log('🇺🇸 Using US Marketplace: ATVPDKIKX0DER\n');
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      
      // Split into 3-month periods
      const periods = [];
      let currentStart = new Date(startDate);
      
      while (currentStart < endDate) {
        const currentEnd = new Date(currentStart);
        currentEnd.setMonth(currentEnd.getMonth() + 3);
        
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
      
      console.log(`📅 Syncing ${periods.length} periods of 3 months each...\n`);
      
      let totalOrders = 0;
      let totalItems = 0;
      const productCache = new Map();
      
      // Process each period
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        console.log(`\n🗓️  Period ${i + 1}/${periods.length}: ${period.start.toLocaleDateString('en-US')} to ${period.end.toLocaleDateString('en-US')}`);
        
        const orders = await this.fetchOrdersList(period.start, period.end);
        
        if (orders.length === 0) {
          console.log('  ℹ️  No orders found in this period');
          continue;
        }
        
        // Process orders
        for (const order of orders) {
          const orderId = await this.saveOrder(order);
          
          if (!orderId) continue;
          
          // Fetch order items
          const items = await this.fetchOrderItems(order.AmazonOrderId);
          
          for (const item of items) {
            const asin = item.ASIN;
            
            if (!asin) continue;
            
            // Check cache or fetch product
            let productId = productCache.get(asin);
            
            if (!productId) {
              // Fetch product info
              const productInfo = await this.fetchProductInfo(asin);
              
              if (productInfo) {
                productInfo.sku = item.SellerSKU || asin;
                productInfo.price = parseFloat(item.ItemPrice?.Amount || 0) / (item.QuantityOrdered || 1);
                productInfo.cost = productInfo.price * 0.6;
                
                productId = await this.saveProduct(productInfo);
                if (productId) {
                  productCache.set(asin, productId);
                  console.log(`  ✅ New product: ${productInfo.title.substring(0, 50)}...`);
                }
              }
            }
            
            // Save order item
            if (productId) {
              await this.saveOrderItem(orderId, productId, item);
              totalItems++;
            }
          }
          
          totalOrders++;
          
          if (totalOrders % 10 === 0) {
            console.log(`  📊 ${totalOrders} orders processed...`);
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`\n✅ Sync completed!`);
      console.log(`   - Orders processed: ${totalOrders}`);
      console.log(`   - Items processed: ${totalItems}`);
      console.log(`   - Unique products: ${productCache.size}`);
      
      // Show summary
      await this.showSummary();
      
    } catch (error) {
      console.error('\n❌ Sync error:', error.message);
      console.error('Details:', error.response?.data || error);
    } finally {
      await this.pool.end();
    }
  }

  async showSummary() {
    console.log('\n📊 Database summary:');
    
    const summary = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.quantity), 0) as total_units,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue_total,
        MIN(o.order_date) as first_sale,
        MAX(o.order_date) as last_sale
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.marketplace = 'amazon'
    `);
    
    const result = summary.rows[0];
    console.table({
      'Total Products': result.total_products || 0,
      'Total Orders': result.total_orders || 0,
      'Units Sold': result.total_units || 0,
      'Revenue Total': `$${parseFloat(result.revenue_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      'First Sale': result.first_sale ? new Date(result.first_sale).toLocaleDateString('en-US') : 'N/A',
      'Last Sale': result.last_sale ? new Date(result.last_sale).toLocaleDateString('en-US') : 'N/A'
    });
  }
}

// Check credentials
console.log('🔧 Checking credentials...');
console.log('Client ID:', process.env.AMAZON_CLIENT_ID ? '✅ Configured' : '❌ Missing');
console.log('Client Secret:', process.env.AMAZON_CLIENT_SECRET ? '✅ Configured' : '❌ Missing');
console.log('Refresh Token:', process.env.AMAZON_REFRESH_TOKEN ? '✅ Configured' : '❌ Missing');
console.log('Seller ID:', process.env.AMAZON_SELLER_ID ? '✅ Configured' : '❌ Missing');
console.log('Marketplace: 🇺🇸 ATVPDKIKX0DER (United States)');

const sync = new AmazonUSSync();
sync.syncTwoYearsData();