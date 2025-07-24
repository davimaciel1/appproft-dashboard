const { Pool } = require('pg');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class AmazonSyncService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC'
    };
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Obter access token usando refresh token
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('🔑 Renovando access token da Amazon...');
    
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
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000) - 60000);
      
      console.log('✅ Token renovado com sucesso!');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Erro ao renovar token:', error.response?.data || error.message);
      throw error;
    }
  }

  // Buscar pedidos dos últimos 2 anos
  async fetchOrders(startDate) {
    const accessToken = await this.getAccessToken();
    const orders = [];
    let nextToken = null;
    
    console.log(`📦 Buscando pedidos desde ${startDate}...`);
    
    do {
      try {
        const params = {
          MarketplaceIds: this.credentials.marketplaceId,
          CreatedAfter: startDate,
          MaxResultsPerPage: 100
        };
        
        if (nextToken) {
          params.NextToken = nextToken;
        }
        
        const response = await axios.get('https://sellingpartnerapi-na.amazon.com/orders/v0/orders', {
          params,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'x-amz-date': new Date().toISOString()
          }
        });
        
        if (response.data.payload?.Orders) {
          orders.push(...response.data.payload.Orders);
          console.log(`  📊 ${orders.length} pedidos carregados...`);
        }
        
        nextToken = response.data.payload?.NextToken;
        
        // Rate limit: 6 requests per second
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error('❌ Erro ao buscar pedidos:', error.response?.data || error.message);
        break;
      }
    } while (nextToken);
    
    console.log(`✅ Total de pedidos encontrados: ${orders.length}`);
    return orders;
  }

  // Buscar itens de um pedido
  async fetchOrderItems(orderId) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`https://sellingpartnerapi-na.amazon.com/orders/v0/orders/${orderId}/orderItems`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken
        }
      });
      
      return response.data.payload?.OrderItems || [];
    } catch (error) {
      console.error(`❌ Erro ao buscar itens do pedido ${orderId}:`, error.message);
      return [];
    }
  }

  // Buscar informações do produto incluindo imagem
  async fetchProductInfo(asin) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios.get(`https://sellingpartnerapi-na.amazon.com/catalog/v0/items/${asin}`, {
        params: {
          MarketplaceId: this.credentials.marketplaceId,
          includedData: 'images,attributes,summaries'
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken
        }
      });
      
      const item = response.data.payload;
      return {
        asin,
        title: item?.AttributeSets?.[0]?.Title || `Produto ${asin}`,
        imageUrl: item?.AttributeSets?.[0]?.SmallImage?.URL || 
                  item?.AttributeSets?.[0]?.Images?.[0]?.URL ||
                  item?.ImageSets?.[0]?.Images?.[0]?.URL ||
                  null,
        brand: item?.AttributeSets?.[0]?.Brand || 'Amazon',
        price: item?.AttributeSets?.[0]?.ListPrice?.Amount || 0
      };
    } catch (error) {
      console.error(`❌ Erro ao buscar info do produto ${asin}:`, error.message);
      return null;
    }
  }

  // Salvar ou atualizar produto no banco
  async saveProduct(productData, userId = 1) {
    try {
      const result = await this.pool.query(`
        INSERT INTO products (
          user_id, 
          marketplace, 
          marketplace_product_id,
          sku,
          name,
          price,
          cost,
          image_url,
          inventory,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (marketplace, marketplace_product_id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          image_url = COALESCE(EXCLUDED.image_url, products.image_url),
          updated_at = NOW()
        RETURNING id
      `, [
        userId,
        'amazon',
        productData.asin,
        productData.sku || productData.asin,
        productData.title,
        productData.price || 0,
        productData.cost || (productData.price * 0.6), // Estimativa de 40% de margem
        productData.imageUrl,
        productData.inventory || 0
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Erro ao salvar produto:', error.message);
      return null;
    }
  }

  // Salvar pedido no banco
  async saveOrder(orderData, userId = 1) {
    try {
      const result = await this.pool.query(`
        INSERT INTO orders (
          user_id,
          marketplace,
          order_id,
          status,
          total_amount,
          order_date,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (marketplace, order_id) DO NOTHING
        RETURNING id
      `, [
        userId,
        'amazon',
        orderData.AmazonOrderId,
        orderData.OrderStatus?.toLowerCase() || 'pending',
        parseFloat(orderData.OrderTotal?.Amount || 0),
        new Date(orderData.PurchaseDate)
      ]);
      
      return result.rows[0]?.id;
    } catch (error) {
      console.error('❌ Erro ao salvar pedido:', error.message);
      return null;
    }
  }

  // Salvar item do pedido
  async saveOrderItem(orderId, productId, itemData) {
    try {
      await this.pool.query(`
        INSERT INTO order_items (
          order_id,
          product_id,
          quantity,
          price,
          cost
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        orderId,
        productId,
        parseInt(itemData.QuantityOrdered || 1),
        parseFloat(itemData.ItemPrice?.Amount || 0) / (itemData.QuantityOrdered || 1),
        parseFloat(itemData.ItemPrice?.Amount || 0) * 0.6 / (itemData.QuantityOrdered || 1) // Estimativa
      ]);
    } catch (error) {
      console.error('❌ Erro ao salvar item do pedido:', error.message);
    }
  }

  // Sincronizar todos os dados
  async syncFullData() {
    console.log('🚀 Iniciando sincronização completa da Amazon (últimos 2 anos)...\n');
    
    try {
      // Data de 2 anos atrás
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const startDate = twoYearsAgo.toISOString();
      
      // 1. Buscar todos os pedidos
      const orders = await this.fetchOrders(startDate);
      
      if (orders.length === 0) {
        console.log('⚠️  Nenhum pedido encontrado!');
        return;
      }
      
      // 2. Processar cada pedido
      const productCache = new Map();
      let processedOrders = 0;
      let processedItems = 0;
      
      for (const order of orders) {
        const orderId = await this.saveOrder(order);
        
        if (!orderId) continue;
        
        // Buscar itens do pedido
        const items = await this.fetchOrderItems(order.AmazonOrderId);
        
        for (const item of items) {
          const asin = item.ASIN;
          
          // Verificar cache ou buscar produto
          let productId = productCache.get(asin);
          
          if (!productId) {
            // Buscar informações do produto
            const productInfo = await this.fetchProductInfo(asin);
            
            if (productInfo) {
              productInfo.sku = item.SellerSKU || asin;
              productInfo.cost = parseFloat(item.ItemPrice?.Amount || 0) * 0.6 / (item.QuantityOrdered || 1);
              
              productId = await this.saveProduct(productInfo);
              if (productId) {
                productCache.set(asin, productId);
              }
            }
          }
          
          // Salvar item do pedido
          if (productId) {
            await this.saveOrderItem(orderId, productId, item);
            processedItems++;
          }
        }
        
        processedOrders++;
        
        if (processedOrders % 10 === 0) {
          console.log(`  ✅ ${processedOrders} pedidos processados...`);
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`\n✅ Sincronização concluída!`);
      console.log(`   - Pedidos: ${processedOrders}`);
      console.log(`   - Itens: ${processedItems}`);
      console.log(`   - Produtos únicos: ${productCache.size}`);
      
      // 3. Atualizar estatísticas
      await this.updateStatistics();
      
    } catch (error) {
      console.error('❌ Erro na sincronização:', error.message);
    } finally {
      await this.pool.end();
    }
  }

  // Atualizar estatísticas e calcular métricas
  async updateStatistics() {
    console.log('\n📊 Atualizando estatísticas...');
    
    try {
      // Calcular totais por produto
      await this.pool.query(`
        UPDATE products p
        SET 
          inventory = COALESCE((
            SELECT SUM(oi.quantity) 
            FROM order_items oi 
            WHERE oi.product_id = p.id
          ), 0)
        WHERE marketplace = 'amazon'
      `);
      
      console.log('✅ Estatísticas atualizadas!');
    } catch (error) {
      console.error('❌ Erro ao atualizar estatísticas:', error.message);
    }
  }
}

// Executar sincronização
const sync = new AmazonSyncService();
sync.syncFullData();