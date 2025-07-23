const axios = require('axios');

class MercadoLivreService {
  constructor() {
    this.baseURL = 'https://api.mercadolibre.com';
    this.accessToken = process.env.ML_ACCESS_TOKEN;
    this.sellerId = process.env.ML_SELLER_ID;
  }

  async refreshToken() {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'refresh_token',
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        refresh_token: process.env.ML_REFRESH_TOKEN
      });
      
      this.accessToken = response.data.access_token;
      // Aqui você deveria salvar o novo token no banco ou arquivo
      console.log('Token ML renovado com sucesso');
      return response.data.access_token;
    } catch (error) {
      console.error('Erro ao renovar token ML:', error);
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
        order_date_created_from: startDate || yesterday.toISOString()
      });

      const data = await this.makeRequest(
        `${this.baseURL}/orders/search?${params}`
      );

      return data.results || [];
    } catch (error) {
      console.error('Erro ao buscar pedidos ML:', error);
      throw error;
    }
  }

  async getProducts() {
    try {
      // Buscar lista de produtos ativos
      const itemsData = await this.makeRequest(
        `${this.baseURL}/users/${this.sellerId}/items/search?status=active`
      );

      const products = [];
      
      // Buscar detalhes de cada produto (limitado a 20 para não demorar)
      for (const itemId of itemsData.results.slice(0, 20)) {
        try {
          const itemDetails = await this.makeRequest(
            `${this.baseURL}/items/${itemId}`
          );

          products.push({
            id: itemDetails.id,
            name: itemDetails.title,
            sku: itemDetails.seller_custom_field || itemDetails.id,
            price: itemDetails.price,
            image: itemDetails.pictures?.[0]?.url || itemDetails.thumbnail,
            inventory: itemDetails.available_quantity,
            marketplace: 'mercadolivre',
            permalink: itemDetails.permalink,
            category: itemDetails.category_id,
            condition: itemDetails.condition,
            listing_type: itemDetails.listing_type_id
          });
        } catch (itemError) {
          console.error(`Erro ao buscar detalhes do produto ${itemId}:`, itemError);
        }
      }

      return products;
    } catch (error) {
      console.error('Erro ao buscar produtos ML:', error);
      throw error;
    }
  }

  async getMetrics() {
    try {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Busca pedidos de hoje
      const todayOrders = await this.getOrders(
        today.toISOString().split('T')[0] + 'T00:00:00Z'
      );
      
      // Busca pedidos de ontem
      const yesterdayOrders = await this.getOrders(
        yesterday.toISOString().split('T')[0] + 'T00:00:00Z'
      );

      // Calcula métricas
      let todaysSales = 0;
      let unitsSold = 0;

      for (const orderId of todayOrders) {
        try {
          const orderDetails = await this.makeRequest(
            `${this.baseURL}/orders/${orderId}`
          );
          
          if (orderDetails.total_amount) {
            todaysSales += orderDetails.total_amount;
          }
          
          if (orderDetails.order_items) {
            orderDetails.order_items.forEach(item => {
              unitsSold += item.quantity;
            });
          }
        } catch (error) {
          console.error(`Erro ao buscar detalhes do pedido ${orderId}:`, error);
        }
      }

      let yesterdaysSales = 0;
      for (const orderId of yesterdayOrders.slice(0, 10)) {
        try {
          const orderDetails = await this.makeRequest(
            `${this.baseURL}/orders/${orderId}`
          );
          
          if (orderDetails.total_amount) {
            yesterdaysSales += orderDetails.total_amount;
          }
        } catch (error) {
          console.error(`Erro ao buscar detalhes do pedido ${orderId}:`, error);
        }
      }

      const growth = yesterdaysSales > 0 
        ? ((todaysSales - yesterdaysSales) / yesterdaysSales * 100).toFixed(1)
        : 0;

      return {
        todaysSales,
        ordersCount: todayOrders.length,
        unitsSold,
        growth,
        currency: 'BRL'
      };
    } catch (error) {
      console.error('Erro ao calcular métricas ML:', error);
      throw error;
    }
  }
}

module.exports = new MercadoLivreService();