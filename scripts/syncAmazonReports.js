const { Pool } = require('pg');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class AmazonReportsSync {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC',
      region: process.env.AMAZON_REGION || 'us-east-1'
    };
    
    this.endpoints = {
      'us-east-1': 'https://sellingpartnerapi-na.amazon.com',
      'eu-west-1': 'https://sellingpartnerapi-eu.amazon.com',
      'us-west-2': 'https://sellingpartnerapi-fe.amazon.com'
    };
    
    this.baseUrl = this.endpoints[this.credentials.region] || this.endpoints['us-east-1'];
  }

  async getAccessToken() {
    console.log('🔑 Obtendo access token da Amazon...');
    
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

      console.log('✅ Token obtido com sucesso!');
      return response.data.access_token;
    } catch (error) {
      console.error('❌ Erro ao obter token:', error.response?.data || error.message);
      throw error;
    }
  }

  // Criar assinatura AWS4 para requisições
  createAWS4Signature(method, uri, queryParams, headers, payload = '') {
    const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = datetime.substr(0, 8);
    
    // Implementação simplificada - em produção use aws4 package
    return {
      'Authorization': `AWS4-HMAC-SHA256 Credential=${process.env.SP_API_AWS_ACCESS_KEY}/${date}/${this.credentials.region}/execute-api/aws4_request`,
      'x-amz-date': datetime
    };
  }

  // Buscar lista de pedidos usando Orders API v0
  async fetchOrdersList(startDate, endDate) {
    const accessToken = await this.getAccessToken();
    const orders = [];
    let nextToken = null;
    let page = 1;
    
    console.log(`\n📦 Buscando pedidos de ${startDate.toLocaleDateString('pt-BR')} até ${endDate.toLocaleDateString('pt-BR')}...`);
    
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
        
        console.log(`  📄 Buscando página ${page}...`);
        
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
          console.log(`    ✓ ${response.data.payload.Orders.length} pedidos encontrados`);
        }
        
        nextToken = response.data?.payload?.NextToken;
        page++;
        
        // Rate limit: 10 requests per second for Orders API
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`  ❌ Erro ao buscar pedidos:`, error.response?.data || error.message);
        
        // Se for erro 403, tentar endpoint alternativo
        if (error.response?.status === 403) {
          console.log('  🔄 Tentando endpoint alternativo...');
          return await this.fetchOrdersAlternative(startDate, endDate);
        }
        break;
      }
    } while (nextToken && page <= 50); // Limite de 50 páginas por segurança
    
    console.log(`✅ Total de pedidos encontrados: ${orders.length}`);
    return orders;
  }

  // Método alternativo: buscar pedidos via Reports API
  async fetchOrdersAlternative(startDate, endDate) {
    const accessToken = await this.getAccessToken();
    
    console.log('\n📊 Usando Reports API para buscar pedidos...');
    
    try {
      // 1. Criar solicitação de relatório
      const reportResponse = await axios.post(`${this.baseUrl}/reports/2021-06-30/reports`, {
        reportType: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
        dataStartTime: startDate.toISOString(),
        dataEndTime: endDate.toISOString(),
        marketplaceIds: [this.credentials.marketplaceId]
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      const reportId = reportResponse.data.reportId;
      console.log(`  📝 Relatório solicitado: ${reportId}`);
      
      // 2. Aguardar processamento do relatório
      let reportStatus = 'IN_QUEUE';
      let attempts = 0;
      
      while (reportStatus === 'IN_QUEUE' || reportStatus === 'IN_PROGRESS') {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Aguardar 5 segundos
        
        const statusResponse = await axios.get(`${this.baseUrl}/reports/2021-06-30/reports/${reportId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken
          }
        });
        
        reportStatus = statusResponse.data.processingStatus;
        console.log(`  ⏳ Status: ${reportStatus}`);
        
        if (++attempts > 60) { // Timeout após 5 minutos
          throw new Error('Timeout ao aguardar relatório');
        }
      }
      
      if (reportStatus === 'DONE') {
        // 3. Baixar documento do relatório
        const documentResponse = await axios.get(`${this.baseUrl}/reports/2021-06-30/documents/${reportResponse.data.reportDocumentId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken
          }
        });
        
        // 4. Baixar conteúdo do relatório
        const reportContent = await axios.get(documentResponse.data.url);
        
        // 5. Processar CSV do relatório
        return this.parseOrdersCSV(reportContent.data);
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar relatório:', error.message);
      return [];
    }
  }

  // Buscar detalhes dos itens de um pedido
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
      console.error(`  ❌ Erro ao buscar itens do pedido ${orderId}:`, error.response?.status);
      return [];
    }
  }

  // Buscar informações do produto incluindo imagem
  async fetchProductInfo(asin) {
    const accessToken = await this.getAccessToken();
    
    try {
      // Primeiro tentar Catalog Items API v2022-04-01
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
          title: response.data.summaries?.[0]?.itemName || response.data.attributes?.item_name?.[0]?.value || `Produto ${asin}`,
          imageUrl: mainImage,
          brand: response.data.attributes?.brand?.[0]?.value || 'Amazon'
        };
      }
    } catch (error) {
      // Se falhar, tentar buscar via link público
      console.log(`  ⚠️  Usando dados alternativos para ${asin}`);
      return {
        asin,
        title: `Produto Amazon ${asin}`,
        imageUrl: `https://images-na.ssl-images-amazon.com/images/P/${asin}.jpg`,
        brand: 'Amazon'
      };
    }
  }

  // Salvar produto no banco
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
          name = COALESCE(products.name, EXCLUDED.name),
          price = COALESCE(EXCLUDED.price, products.price),
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
        productData.cost || 0,
        productData.imageUrl,
        0
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
        ON CONFLICT (marketplace, order_id) DO UPDATE
        SET status = EXCLUDED.status,
            total_amount = EXCLUDED.total_amount
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
      const unitPrice = parseFloat(itemData.ItemPrice?.Amount || 0) / (itemData.QuantityOrdered || 1);
      const unitCost = unitPrice * 0.6; // Estimativa de 40% de margem
      
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
        unitPrice,
        unitCost
      ]);
    } catch (error) {
      console.error('❌ Erro ao salvar item do pedido:', error.message);
    }
  }

  // Sincronizar dados dos últimos 2 anos
  async syncTwoYearsData() {
    console.log('🚀 Iniciando sincronização de vendas Amazon (últimos 2 anos)...\n');
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      
      // Dividir em períodos menores (3 meses por vez)
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
      
      console.log(`📅 Sincronizando ${periods.length} períodos de 3 meses cada...\n`);
      
      let totalOrders = 0;
      let totalItems = 0;
      const productCache = new Map();
      
      // Processar cada período
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        console.log(`\n🗓️  Período ${i + 1}/${periods.length}: ${period.start.toLocaleDateString('pt-BR')} a ${period.end.toLocaleDateString('pt-BR')}`);
        
        const orders = await this.fetchOrdersList(period.start, period.end);
        
        if (orders.length === 0) continue;
        
        // Processar pedidos
        for (const order of orders) {
          const orderId = await this.saveOrder(order);
          
          if (!orderId) continue;
          
          // Buscar itens do pedido
          const items = await this.fetchOrderItems(order.AmazonOrderId);
          
          for (const item of items) {
            const asin = item.ASIN;
            
            if (!asin) continue;
            
            // Verificar cache ou buscar produto
            let productId = productCache.get(asin);
            
            if (!productId) {
              // Buscar informações do produto
              const productInfo = await this.fetchProductInfo(asin);
              
              if (productInfo) {
                productInfo.sku = item.SellerSKU || asin;
                productInfo.price = parseFloat(item.ItemPrice?.Amount || 0) / (item.QuantityOrdered || 1);
                productInfo.cost = productInfo.price * 0.6;
                
                productId = await this.saveProduct(productInfo);
                if (productId) {
                  productCache.set(asin, productId);
                  console.log(`  ✅ Novo produto: ${productInfo.title.substring(0, 50)}...`);
                }
              }
            }
            
            // Salvar item do pedido
            if (productId) {
              await this.saveOrderItem(orderId, productId, item);
              totalItems++;
            }
          }
          
          totalOrders++;
          
          if (totalOrders % 10 === 0) {
            console.log(`  📊 ${totalOrders} pedidos processados...`);
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`\n✅ Sincronização concluída!`);
      console.log(`   - Pedidos processados: ${totalOrders}`);
      console.log(`   - Itens processados: ${totalItems}`);
      console.log(`   - Produtos únicos: ${productCache.size}`);
      
      // Mostrar resumo
      await this.showSummary();
      
    } catch (error) {
      console.error('\n❌ Erro na sincronização:', error.message);
      console.error('Detalhes:', error.response?.data || error);
    } finally {
      await this.pool.end();
    }
  }

  // Mostrar resumo dos dados
  async showSummary() {
    console.log('\n📊 Resumo dos dados no banco:');
    
    const summary = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_produtos,
        COUNT(DISTINCT o.id) as total_pedidos,
        COALESCE(SUM(oi.quantity), 0) as total_unidades,
        COALESCE(SUM(oi.quantity * oi.price), 0) as revenue_total,
        MIN(o.order_date) as primeira_venda,
        MAX(o.order_date) as ultima_venda
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.marketplace = 'amazon'
    `);
    
    const result = summary.rows[0];
    console.table({
      'Total de Produtos': result.total_produtos || 0,
      'Total de Pedidos': result.total_pedidos || 0,
      'Unidades Vendidas': result.total_unidades || 0,
      'Revenue Total': `R$ ${parseFloat(result.revenue_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      'Primeira Venda': result.primeira_venda ? new Date(result.primeira_venda).toLocaleDateString('pt-BR') : 'N/A',
      'Última Venda': result.ultima_venda ? new Date(result.ultima_venda).toLocaleDateString('pt-BR') : 'N/A'
    });
  }
}

// Executar sincronização
console.log('🔧 Verificando credenciais...');
console.log('Cliente ID:', process.env.AMAZON_CLIENT_ID ? '✅ Configurado' : '❌ Faltando');
console.log('Cliente Secret:', process.env.AMAZON_CLIENT_SECRET ? '✅ Configurado' : '❌ Faltando');
console.log('Refresh Token:', process.env.AMAZON_REFRESH_TOKEN ? '✅ Configurado' : '❌ Faltando');
console.log('Seller ID:', process.env.AMAZON_SELLER_ID ? '✅ Configurado' : '❌ Faltando');
console.log('Marketplace ID:', process.env.SP_API_MARKETPLACE_ID || 'Usando padrão: A2Q3Y263D00KWC');

const sync = new AmazonReportsSync();
sync.syncTwoYearsData();