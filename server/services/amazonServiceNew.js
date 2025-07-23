const { SellingPartnerApiAuth } = require('@sp-api-sdk/auth');
const { OrdersApiClient } = require('@sp-api-sdk/orders-api-v0');
const axios = require('axios');

class AmazonServiceNew {
  constructor() {
    // Nova autenticação LWA-only (sem AWS IAM)
    this.auth = new SellingPartnerApiAuth({
      clientId: process.env.AMAZON_SP_API_CLIENT_ID,
      clientSecret: process.env.AMAZON_SP_API_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN
    });
    
    // Cliente da API de pedidos
    this.ordersApi = new OrdersApiClient({
      auth: this.auth,
      region: 'na' // na, eu, fe (north america, europe, far east)
    });
  }

  async getOrders(startDate = null) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const createdAfter = startDate || yesterday.toISOString();
      const marketplaceIds = [process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER']; // US marketplace
      
      console.log('📦 Buscando pedidos da Amazon...');
      console.log('Data início:', createdAfter);
      console.log('Marketplace:', marketplaceIds[0]);
      
      const response = await this.ordersApi.getOrders({
        marketplaceIds,
        createdAfter,
        maxResultsPerPage: 100
      });

      console.log('✅ Resposta recebida da Amazon:', response.payload?.Orders?.length || 0, 'pedidos');
      return response.payload?.Orders || [];
      
    } catch (error) {
      console.error('❌ Erro ao buscar pedidos Amazon:', error.message);
      console.error('Detalhes:', error.response?.data || error.response || 'Sem detalhes');
      throw error;
    }
  }

  async getOrderItems(orderId) {
    try {
      const response = await this.ordersApi.getOrderItems({
        orderId
      });
      
      return response.payload?.OrderItems || [];
      
    } catch (error) {
      console.error(`❌ Erro ao buscar itens do pedido ${orderId}:`, error.message);
      return [];
    }
  }

  // Método alternativo usando requisições HTTP diretas
  async getOrdersViaHTTP(startDate = null) {
    try {
      // Obter access token
      const accessToken = await this.auth.getAccessToken();
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const createdAfter = startDate || yesterday.toISOString();
      
      const url = 'https://sellingpartnerapi-na.amazon.com/orders/v0/orders';
      const params = {
        MarketplaceIds: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
        CreatedAfter: createdAfter,
        MaxResultsPerPage: 100
      };
      
      console.log('🔄 Fazendo requisição HTTP direta para Amazon SP-API...');
      console.log('URL:', url);
      console.log('Params:', params);
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        },
        params
      });
      
      console.log('✅ Resposta HTTP recebida:', response.data?.payload?.Orders?.length || 0, 'pedidos');
      return response.data?.payload?.Orders || [];
      
    } catch (error) {
      console.error('❌ Erro na requisição HTTP:', error.message);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
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

      for (const order of todayOrders) {
        if (order.OrderTotal) {
          todaysSales += parseFloat(order.OrderTotal.Amount || 0);
        }
        if (order.NumberOfItemsShipped) {
          unitsSold += parseInt(order.NumberOfItemsShipped);
        }
      }

      let yesterdaysSales = 0;
      for (const order of yesterdayOrders) {
        if (order.OrderTotal) {
          yesterdaysSales += parseFloat(order.OrderTotal.Amount || 0);
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
        currency: todayOrders[0]?.OrderTotal?.CurrencyCode || 'USD'
      };
      
    } catch (error) {
      console.error('❌ Erro ao calcular métricas Amazon:', error);
      throw error;
    }
  }

  // Método para testar autenticação
  async testAuth() {
    try {
      console.log('🔑 Testando autenticação Amazon SP-API...');
      const accessToken = await this.auth.getAccessToken();
      console.log('✅ Access token obtido:', accessToken.substring(0, 20) + '...');
      return true;
    } catch (error) {
      console.error('❌ Erro na autenticação:', error.message);
      return false;
    }
  }
}

module.exports = new AmazonServiceNew();