const axios = require('axios');
const secureLogger = require('../utils/secureLogger');

class MercadoLivreService {
  constructor(credentials = null) {
    this.baseURL = 'https://api.mercadolibre.com';
    
    // Multi-tenant: usa credenciais passadas ou do ambiente
    const creds = credentials || {
      accessToken: process.env.ML_ACCESS_TOKEN,
      refreshToken: process.env.ML_REFRESH_TOKEN,
      clientId: process.env.ML_CLIENT_ID,
      clientSecret: process.env.ML_CLIENT_SECRET,
      sellerId: process.env.ML_SELLER_ID
    };
    
    this.accessToken = creds.accessToken;
    this.refreshToken = creds.refreshToken;
    this.clientId = creds.clientId;
    this.clientSecret = creds.clientSecret;
    this.sellerId = creds.sellerId;
  }

  async refreshToken() {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      });
      
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      secureLogger.info('Token ML renovado com sucesso');
      
      // TODO: Salvar novo token no banco via credentialsService
      return response.data;
    } catch (error) {
      secureLogger.error('Erro ao renovar token ML', { 
        error: error.message,
        status: error.response?.status 
      });
      throw error;
    }
  }

  async makeRequest(url, options = {}) {
    try {
      const response = await axios({
        ...options,
        url,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          ...options.headers
        }
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Token expirado, tentar renovar
        secureLogger.info('Token expirado, renovando...');
        await this.refreshToken();
        
        // Tentar novamente com novo token
        const response = await axios({
          ...options,
          url,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            ...options.headers
          }
        });
        return response.data;
      }
      throw error;
    }
  }

  async getOrders(startDate = null) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const params = new URLSearchParams({
        seller: this.sellerId,
        'order.date_created.from': startDate || yesterday.toISOString(),
        sort: 'date_desc'
      });

      secureLogger.info('Buscando pedidos Mercado Livre', { 
        sellerId: this.sellerId,
        dateFrom: startDate || yesterday.toISOString() 
      });

      const data = await this.makeRequest(
        `${this.baseURL}/orders/search?${params}`
      );

      const orders = data.results || [];
      
      // Buscar detalhes completos de cada pedido
      const detailedOrders = [];
      for (const order of orders.slice(0, 50)) { // Limita a 50 pedidos
        try {
          const orderDetails = await this.makeRequest(
            `${this.baseURL}/orders/${order.id}`
          );
          detailedOrders.push(orderDetails);
        } catch (error) {
          secureLogger.error('Erro ao buscar detalhes do pedido', { 
            orderId: order.id,
            error: error.message 
          });
        }
      }

      secureLogger.info('Pedidos ML recuperados', { 
        count: detailedOrders.length 
      });

      return detailedOrders;
    } catch (error) {
      secureLogger.error('Erro ao buscar pedidos ML', { 
        error: error.message,
        status: error.response?.status 
      });
      return [];
    }
  }

  async getActiveListings() {
    try {
      secureLogger.info('Buscando produtos ativos ML', { 
        sellerId: this.sellerId 
      });

      // Buscar lista de produtos ativos
      const itemsData = await this.makeRequest(
        `${this.baseURL}/users/${this.sellerId}/items/search?status=active`
      );

      const products = [];
      const itemIds = itemsData.results || [];
      
      // Buscar detalhes em lote (API permite até 20 items por vez)
      for (let i = 0; i < itemIds.length; i += 20) {
        const batch = itemIds.slice(i, i + 20);
        const ids = batch.join(',');
        
        try {
          const batchData = await this.makeRequest(
            `${this.baseURL}/items?ids=${ids}`
          );
          
          for (const item of batchData) {
            if (item.code === 200 && item.body) {
              const product = item.body;
              products.push({
                id: product.id,
                title: product.title,
                price: product.price,
                currency_id: product.currency_id,
                available_quantity: product.available_quantity,
                sold_quantity: product.sold_quantity,
                condition: product.condition,
                permalink: product.permalink,
                thumbnail: product.thumbnail,
                secure_thumbnail: product.secure_thumbnail,
                pictures: product.pictures,
                status: product.status,
                category_id: product.category_id,
                listing_type_id: product.listing_type_id,
                seller_custom_field: product.seller_custom_field
              });
            }
          }
        } catch (error) {
          secureLogger.error('Erro ao buscar detalhes de produtos em lote', { 
            error: error.message 
          });
        }
      }

      secureLogger.info('Produtos ML recuperados', { 
        count: products.length 
      });

      return products;
    } catch (error) {
      secureLogger.error('Erro ao buscar produtos ML', { 
        error: error.message,
        status: error.response?.status 
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
        const orderDate = new Date(order.date_created);
        if (orderDate >= today) {
          todaysSales += order.total_amount || 0;
          
          if (order.order_items) {
            for (const item of order.order_items) {
              unitsSold += item.quantity || 0;
            }
          }
          
          if (order.status === 'confirmed' || order.status === 'payment_required') {
            newOrders++;
          }
        }
      }
      
      return {
        todaysSales,
        ordersCount: orders.filter(o => new Date(o.date_created) >= today).length,
        unitsSold,
        netProfit: todaysSales * 0.33, // 33% margem estimada
        acos: 21.2, // Placeholder
        newOrders
      };
    } catch (error) {
      secureLogger.error('Erro ao calcular métricas ML', { 
        error: error.message 
      });
      throw error;
    }
  }

  async testConnection() {
    try {
      // Verifica se consegue acessar informações do usuário
      const response = await this.makeRequest(
        `${this.baseURL}/users/${this.sellerId}`
      );
      
      return {
        success: true,
        nickname: response.nickname,
        site_id: response.site_id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCategories() {
    try {
      const response = await this.makeRequest(
        `${this.baseURL}/sites/MLB/categories`
      );
      return response;
    } catch (error) {
      secureLogger.error('Erro ao buscar categorias', { 
        error: error.message 
      });
      return [];
    }
  }

  async getShippingOptions(itemId) {
    try {
      const response = await this.makeRequest(
        `${this.baseURL}/items/${itemId}/shipping_options`
      );
      return response;
    } catch (error) {
      secureLogger.error('Erro ao buscar opções de envio', { 
        itemId,
        error: error.message 
      });
      return null;
    }
  }
}

module.exports = MercadoLivreService;