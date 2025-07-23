const SellingPartnerAPI = require('amazon-sp-api');
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

    try {
      this.sellingPartner = new SellingPartnerAPI({
        region: 'na',
        refresh_token: creds.refreshToken,
        credentials: {
          SELLING_PARTNER_APP_CLIENT_ID: creds.clientId,
          SELLING_PARTNER_APP_CLIENT_SECRET: creds.clientSecret,
          AWS_ACCESS_KEY_ID: creds.awsAccessKey || process.env.AWS_SELLING_PARTNER_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: creds.awsSecretKey || process.env.AWS_SELLING_PARTNER_SECRET_ACCESS_KEY
        }
      });
    } catch (error) {
      secureLogger.error('Erro ao inicializar Amazon SP-API', { error: error.message });
      throw error;
    }
  }

  async getOrders(startDate = null) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const params = {
        MarketplaceIds: [this.marketplaceId],
        CreatedAfter: startDate || yesterday.toISOString(),
        MaxResultsPerPage: 100
      };

      secureLogger.info('Buscando pedidos Amazon', { 
        marketplace: this.marketplaceId,
        createdAfter: params.CreatedAfter 
      });

      const ordersResponse = await this.sellingPartner.callAPI({
        operation: 'getOrders',
        endpoint: 'orders',
        query: params
      });

      const orders = ordersResponse.Orders || [];
      
      secureLogger.info('Pedidos Amazon recuperados', { 
        count: orders.length 
      });

      return orders;
    } catch (error) {
      secureLogger.error('Erro ao buscar pedidos Amazon', { 
        error: error.message,
        code: error.code 
      });
      return [];
    }
  }

  async getOrderItems(orderId) {
    try {
      const response = await this.sellingPartner.callAPI({
        operation: 'getOrderItems',
        endpoint: 'orders',
        path: `/${orderId}/orderItems`
      });

      return response.OrderItems || [];
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
      // Primeiro busca o inventário FBA
      const inventoryResponse = await this.sellingPartner.callAPI({
        operation: 'getInventorySummaries',
        endpoint: 'fbaInventory',
        query: {
          MarketplaceIds: [this.marketplaceId],
          details: true
        }
      });

      const inventory = inventoryResponse.InventorySummaries || [];
      const products = [];

      // Para cada item do inventário, busca detalhes do produto
      for (const item of inventory.slice(0, 10)) { // Limita a 10 para não sobrecarregar
        try {
          const catalogResponse = await this.sellingPartner.callAPI({
            operation: 'getCatalogItem',
            endpoint: 'catalogItems',
            path: `/${item.asin}`,
            query: {
              MarketplaceIds: [this.marketplaceId]
            }
          });

          if (catalogResponse) {
            products.push({
              ASIN: item.asin,
              SellerSKU: item.sellerSku,
              ProductName: catalogResponse.AttributeSets?.[0]?.Title || 'Produto Amazon',
              Price: catalogResponse.AttributeSets?.[0]?.ListPrice?.Amount || 0,
              SmallImage: catalogResponse.AttributeSets?.[0]?.SmallImage,
              InStockSupplyQuantity: item.totalQuantity || 0,
              QuantitySold: 0, // Seria necessário calcular baseado em pedidos
              Revenue: 0 // Seria necessário calcular baseado em pedidos
            });
          }
        } catch (error) {
          secureLogger.error('Erro ao buscar detalhes do produto', { 
            asin: item.asin,
            error: error.message 
          });
        }
      }

      secureLogger.info('Produtos Amazon recuperados', { 
        count: products.length 
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
      // Tenta uma operação simples para verificar as credenciais
      const response = await this.sellingPartner.callAPI({
        operation: 'getMarketplaceParticipations',
        endpoint: 'sellers'
      });
      
      return {
        success: true,
        marketplaces: response.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AmazonService;