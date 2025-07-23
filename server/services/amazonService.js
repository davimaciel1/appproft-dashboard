const SellingPartnerAPI = require('amazon-sp-api');

class AmazonService {
  constructor() {
    this.sellingPartner = new SellingPartnerAPI({
      region: 'na',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: process.env.AMAZON_SP_API_CLIENT_ID,
        SELLING_PARTNER_APP_CLIENT_SECRET: process.env.AMAZON_SP_API_CLIENT_SECRET
        // AWS IAM não é mais necessário desde outubro 2023
        // Apenas LWA (Login with Amazon) é usado agora
      }
    });
  }

  async getOrders(startDate = null) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const params = {
        MarketplaceIds: [process.env.SP_API_MARKETPLACE_ID],
        CreatedAfter: startDate || yesterday.toISOString(),
        MaxResultsPerPage: 100
      };

      const ordersResponse = await this.sellingPartner.callAPI({
        operation: 'getOrders',
        endpoint: 'orders',
        query: params
      });

      return ordersResponse.Orders || [];
    } catch (error) {
      console.error('Erro ao buscar pedidos Amazon:', error);
      throw error;
    }
  }

  async getProductsCatalog() {
    try {
      // Primeiro busca o inventário
      const inventoryResponse = await this.sellingPartner.callAPI({
        operation: 'getInventorySummaries',
        endpoint: 'fbaInventory',
        query: {
          MarketplaceIds: [process.env.SP_API_MARKETPLACE_ID],
          details: true
        }
      });

      const products = [];
      
      if (inventoryResponse && inventoryResponse.inventorySummaries) {
        // Para cada item no inventário, busca detalhes do catálogo
        for (const item of inventoryResponse.inventorySummaries.slice(0, 20)) {
          try {
            const catalogItem = await this.sellingPartner.callAPI({
              operation: 'getCatalogItem',
              endpoint: 'catalogItems',
              path: {
                asin: item.asin
              },
              query: {
                MarketplaceIds: [process.env.SP_API_MARKETPLACE_ID],
                includedData: ['images', 'productTypes', 'salesRanks', 'summaries', 'variations']
              }
            });

            if (catalogItem) {
              products.push({
                asin: item.asin,
                sku: item.sellerSku,
                name: catalogItem.summaries?.[0]?.itemName || item.productName || 'Produto sem nome',
                image: catalogItem.images?.[0]?.images?.[0]?.link || null,
                inventory: item.totalQuantity || 0,
                price: catalogItem.summaries?.[0]?.price?.value || 0,
                marketplace: 'amazon'
              });
            }
          } catch (itemError) {
            console.error(`Erro ao buscar detalhes do produto ${item.asin}:`, itemError);
          }
        }
      }

      return products;
    } catch (error) {
      console.error('Erro ao buscar catálogo Amazon:', error);
      throw error;
    }
  }

  async getMetrics() {
    try {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Busca pedidos de hoje
      const todayOrders = await this.getOrders(today.toISOString().split('T')[0] + 'T00:00:00Z');
      
      // Busca pedidos de ontem
      const yesterdayOrders = await this.getOrders(
        yesterday.toISOString().split('T')[0] + 'T00:00:00Z'
      );

      // Calcula métricas
      let todaysSales = 0;
      let unitsSold = 0;

      todayOrders.forEach(order => {
        if (order.OrderTotal) {
          todaysSales += parseFloat(order.OrderTotal.Amount || 0);
        }
        if (order.NumberOfItemsShipped) {
          unitsSold += parseInt(order.NumberOfItemsShipped);
        }
      });

      let yesterdaysSales = 0;
      yesterdayOrders.forEach(order => {
        if (order.OrderTotal) {
          yesterdaysSales += parseFloat(order.OrderTotal.Amount || 0);
        }
      });

      const growth = yesterdaysSales > 0 
        ? ((todaysSales - yesterdaysSales) / yesterdaysSales * 100).toFixed(1)
        : 0;

      return {
        todaysSales,
        ordersCount: todayOrders.length,
        unitsSold,
        growth,
        currency: todayOrders[0]?.OrderTotal?.CurrencyCode || 'BRL'
      };
    } catch (error) {
      console.error('Erro ao calcular métricas Amazon:', error);
      throw error;
    }
  }
}

module.exports = new AmazonService();