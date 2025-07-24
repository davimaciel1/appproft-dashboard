const https = require('https');
const querystring = require('querystring');
const secureLogger = require('../utils/secureLogger');

class AmazonService {
  constructor(credentials = null) {
    // Se credenciais forem passadas, usa elas (multi-tenant)
    // Senão, usa as do ambiente (para testes)
    const creds = credentials || {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: process.env.SP_API_MARKETPLACE_ID
    };

    this.sellerId = creds.sellerId;
    this.marketplaceId = creds.marketplaceId || 'A2Q3Y263D00KWC'; // Brasil

    // Para usar a nova API da Amazon sem AWS keys
    this.credentials = creds;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    // Usar token em cache se ainda válido
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    return new Promise((resolve, reject) => {
      const postData = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret
      });

      const options = {
        hostname: 'api.amazon.com',
        port: 443,
        path: '/auth/o2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            this.accessToken = response.access_token;
            this.tokenExpiry = new Date(Date.now() + (response.expires_in * 1000) - 60000);
            resolve(response.access_token);
          } else {
            reject(new Error(`Token error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async callSPAPI(path, method = 'GET') {
    const accessToken = await this.getAccessToken();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'sellingpartnerapi-na.amazon.com',
        port: 443,
        path: path,
        method: method,
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`API error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async getOrders(startDate = null) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const createdAfter = startDate || yesterday.toISOString();
      const path = `/orders/v0/orders?MarketplaceIds=${this.marketplaceId}&CreatedAfter=${createdAfter}`;

      secureLogger.info('Buscando pedidos Amazon', { 
        marketplace: this.marketplaceId,
        createdAfter: createdAfter 
      });

      const response = await this.callSPAPI(path);
      const orders = response.payload?.Orders || [];
      
      secureLogger.info('Pedidos Amazon recuperados', { 
        count: orders.length 
      });

      return orders;
    } catch (error) {
      secureLogger.error('Erro ao buscar pedidos Amazon', { 
        error: error.message
      });
      return [];
    }
  }

  async getOrderItems(orderId) {
    try {
      const path = `/orders/v0/orders/${orderId}/orderItems`;
      const response = await this.callSPAPI(path);
      return response.payload?.OrderItems || [];
    } catch (error) {
      secureLogger.error('Erro ao buscar itens do pedido', { 
        orderId,
        error: error.message 
      });
      return [];
    }
  }

  async getProductsCatalog() {
    try {
      // Busca inventário FBA
      const inventoryPath = `/fba/inventory/v1/summaries?marketplaceIds=${this.marketplaceId}&details=true&granularityType=Marketplace&granularityId=${this.marketplaceId}`;
      const inventoryResponse = await this.callSPAPI(inventoryPath);
      const inventory = inventoryResponse.payload?.inventorySummaries || [];
      
      // Buscar vendas dos últimos 30 dias para calcular unidades vendidas
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const orders = await this.getOrders(thirtyDaysAgo.toISOString());
      
      // Calcular vendas por ASIN
      const salesByAsin = {};
      for (const order of orders) {
        if (order.OrderItems) {
          for (const item of order.OrderItems) {
            const asin = item.ASIN;
            if (!salesByAsin[asin]) {
              salesByAsin[asin] = {
                unitsSold: 0,
                revenue: 0
              };
            }
            salesByAsin[asin].unitsSold += item.QuantityOrdered || 0;
            salesByAsin[asin].revenue += parseFloat(item.ItemPrice?.Amount || 0) * (item.QuantityOrdered || 0);
          }
        }
      }
      
      // Processar produtos com dados completos
      const products = [];
      
      for (const item of inventory.slice(0, 50)) { // Aumentar para 50 produtos
        const asin = item.asin;
        const sales = salesByAsin[asin] || { unitsSold: 0, revenue: 0 };
        
        // Tentar buscar detalhes do catálogo para obter nome e imagem
        let productDetails = {
          title: `Produto Amazon ${asin}`,
          imageUrl: null
        };
        
        try {
          // Buscar detalhes do produto
          const catalogPath = `/catalog/2022-04-01/items/${asin}?marketplaceIds=${this.marketplaceId}&includedData=images,summaries`;
          const catalogResponse = await this.callSPAPI(catalogPath);
          
          if (catalogResponse.payload) {
            productDetails.title = catalogResponse.payload.summaries?.[0]?.itemName || productDetails.title;
            productDetails.imageUrl = catalogResponse.payload.images?.[0]?.images?.[0]?.link || null;
          }
        } catch (e) {
          // Se falhar, continuar com dados básicos
          secureLogger.info('Não foi possível buscar detalhes do produto', { asin });
        }
        
        products.push({
          ASIN: asin,
          SellerSKU: item.fnSku || item.sku,
          ProductName: productDetails.title,
          Price: 0,
          SmallImage: { URL: productDetails.imageUrl },
          ImageUrl: productDetails.imageUrl,
          InStockSupplyQuantity: item.totalQuantity || 0,
          QuantitySold: sales.unitsSold,
          Revenue: sales.revenue
        });
      }

      secureLogger.info('Produtos Amazon recuperados com detalhes', { 
        count: products.length,
        withSales: Object.keys(salesByAsin).length
      });

      return products;
    } catch (error) {
      secureLogger.error('Erro ao buscar catálogo Amazon', { 
        error: error.message 
      });
      return [];
    }
  }

  async getMetrics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const orders = await this.getOrders(today.toISOString());
      
      let todaysSales = 0;
      let unitsSold = 0;
      let newOrders = 0;
      
      for (const order of orders) {
        if (order.OrderTotal) {
          todaysSales += parseFloat(order.OrderTotal.Amount || 0);
        }
        unitsSold += order.NumberOfItemsShipped || 0;
        
        if (order.OrderStatus === 'Pending' || order.OrderStatus === 'Unshipped') {
          newOrders++;
        }
      }
      
      return {
        todaysSales,
        ordersCount: orders.length,
        unitsSold,
        netProfit: todaysSales * 0.33, // 33% margem estimada
        acos: 16.7, // Placeholder - necessário integração com Advertising API
        newOrders
      };
    } catch (error) {
      secureLogger.error('Erro ao calcular métricas Amazon', { 
        error: error.message 
      });
      throw error;
    }
  }

  async testConnection() {
    try {
      const path = '/sellers/v1/marketplaceParticipations';
      const response = await this.callSPAPI(path);
      
      return {
        success: true,
        marketplaces: response.payload?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sincronizar métricas usando Data Kiosk
   */
  async syncDataKioskMetrics(tenantId, daysBack = 30) {
    const dataKioskClient = require('./dataKiosk/dataKioskClient');
    const DataKioskQueries = require('./dataKiosk/dataKioskQueries');
    const DataKioskProcessor = require('./dataKiosk/dataKioskProcessor');
    
    console.log('📊 Iniciando sincronização Data Kiosk...');
    
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const marketplaceId = this.credentials.marketplaceId || 'A2Q3Y263D00KWC'; // Brasil

      // 1. Sincronizar métricas diárias
      console.log(`📅 Sincronizando métricas diárias: ${startDate} até ${endDate}`);
      
      const dailyQuery = DataKioskQueries.getDailyMetricsQuery(startDate, endDate, marketplaceId);
      const dailyResults = await dataKioskClient.executeQuery(dailyQuery, tenantId);
      
      if (dailyResults.status === 'SUCCESS') {
        await DataKioskProcessor.processDailyMetrics(dailyResults.data, tenantId);
      }

      // 2. Sincronizar métricas por ASIN
      console.log('📦 Sincronizando métricas por produto...');
      
      const asinQuery = DataKioskQueries.getAsinMetricsQuery(startDate, endDate, marketplaceId);
      const asinResults = await dataKioskClient.executeQuery(asinQuery, tenantId);
      
      if (asinResults.status === 'SUCCESS') {
        await DataKioskProcessor.processAsinMetrics(asinResults.data, tenantId);
      }

      console.log('✅ Sincronização Data Kiosk concluída');
      
      return {
        success: true,
        dailyMetrics: dailyResults.status === 'SUCCESS',
        asinMetrics: asinResults.status === 'SUCCESS'
      };
      
    } catch (error) {
      console.error('❌ Erro na sincronização Data Kiosk:', error);
      throw error;
    }
  }

  /**
   * Buscar métricas do dashboard usando Data Kiosk
   */
  async getDataKioskDashboardMetrics(tenantId) {
    const DataKioskProcessor = require('./dataKiosk/dataKioskProcessor');
    
    try {
      // Usar dados já processados no banco
      const metrics = await DataKioskProcessor.calculateDashboardMetrics(tenantId);
      return metrics;
      
    } catch (error) {
      console.error('❌ Erro ao buscar métricas do dashboard:', error);
      
      // Fallback para métricas vazias
      return {
        todaysSales: 0,
        ordersCount: 0,
        unitsSold: 0,
        avgUnitsPerOrder: '0',
        netProfit: 0,
        profitMargin: '0',
        acos: '0',
        yesterdayComparison: '0',
        buyBoxPercentage: '0',
        unitSessionPercentage: '0'
      };
    }
  }
}

module.exports = AmazonService;