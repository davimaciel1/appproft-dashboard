const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Amazon SP-API GraphQL Service
 * Implementa integração real com Seller Central Analytics API
 */
class AmazonGraphQLService {
  constructor() {
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC' // Brasil
    };

    // URLs da API
    this.authUrl = 'https://api.amazon.com/auth/o2/token';
    this.graphqlUrl = 'https://sellingpartnerapi-na.amazon.com/sales/graphql/v1';
    
    // Token management
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Rate limiting
    this.requestQueue = [];
    this.requestsPerSecond = 1; // Amazon GraphQL tem limite restrito
    this.lastRequestTime = 0;
  }

  /**
   * Obter access token válido (com refresh automático)
   */
  async getAccessToken() {
    // Verifica se o token ainda é válido
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('🔄 Renovando access token da Amazon...');

    try {
      const response = await axios.post(this.authUrl, 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Define expiração 5 minutos antes do real para segurança
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      
      console.log('✅ Token renovado com sucesso');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Erro ao renovar token:', error.response?.data || error.message);
      throw new Error('Falha na autenticação com Amazon');
    }
  }

  /**
   * Rate limiter para respeitar limites da API
   */
  async rateLimitedRequest(requestFn) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minTimeBetweenRequests = 1000 / this.requestsPerSecond;

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const delay = minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    
    // Implementar retry com backoff exponencial
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        return await requestFn();
      } catch (error) {
        if (error.response?.status === 429) { // Rate limit exceeded
          retries++;
          const backoffTime = Math.pow(2, retries) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Rate limit atingido. Aguardando ${backoffTime/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Rate limit excedido após múltiplas tentativas');
  }

  /**
   * Executar query GraphQL
   */
  async executeGraphQLQuery(query, variables = {}) {
    const accessToken = await this.getAccessToken();

    return this.rateLimitedRequest(async () => {
      const response = await axios.post(this.graphqlUrl, {
        query,
        variables
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.data.errors) {
        console.error('❌ Erros GraphQL:', response.data.errors);
        throw new Error('Erro na query GraphQL');
      }

      return response.data.data;
    });
  }

  /**
   * Query para buscar vendas e tráfego por data
   */
  buildSalesAndTrafficByDateQuery() {
    return `
      query SalesAndTrafficByDate(
        $startDate: Date!
        $endDate: Date!
        $aggregateBy: AggregateBy!
        $marketplaceIds: [MarketplaceId!]!
      ) {
        salesAndTrafficByDate(
          startDate: $startDate
          endDate: $endDate
          aggregateBy: $aggregateBy
          marketplaceIds: $marketplaceIds
        ) {
          traffic {
            date
            pageViews
            sessions
            averageOfferCount
            averageParentItems
            feedbackReceived
            negativeFeedbackReceived
            receivedNegativeFeedbackRate
            pageViewsPercentage
            sessionsPercentage
            browserPageViews
            browserPageViewsPercentage
            mobileAppPageViews
            mobileAppPageViewsPercentage
            buyBoxPercentage
            unitSessionPercentage
            sessionPercentage
            pageViewsPercentageB2B
            sessionsPercentageB2B
            browserPageViewsB2B
            browserPageViewsPercentageB2B
            mobileAppPageViewsB2B
            mobileAppPageViewsPercentageB2B
            buyBoxPercentageB2B
            unitSessionPercentageB2B
            sessionPercentageB2B
          }
          sales {
            date
            orderedProductSales {
              amount
              currencyCode
            }
            orderedProductSalesB2B {
              amount
              currencyCode
            }
            shippedProductSales {
              amount
              currencyCode
            }
            shippedProductSalesB2B {
              amount
              currencyCode
            }
            unitsOrdered
            unitsOrderedB2B
            totalOrderItems
            totalOrderItemsB2B
            averageSalesPerOrderItem {
              amount
              currencyCode
            }
            averageSalesPerOrderItemB2B {
              amount
              currencyCode
            }
            averageUnitsPerOrderItem
            averageUnitsPerOrderItemB2B
            averageSellingPrice {
              amount
              currencyCode
            }
            averageSellingPriceB2B {
              amount
              currencyCode
            }
            unitsRefunded
            refundRate
            claimsGranted
            claimsAmount {
              amount
              currencyCode
            }
            unitsShipped
            ordersShipped
          }
        }
      }
    `;
  }

  /**
   * Query para buscar vendas e tráfego por ASIN
   */
  buildSalesAndTrafficByAsinQuery() {
    return `
      query SalesAndTrafficByAsin(
        $startDate: Date!
        $endDate: Date!
        $aggregateBy: AggregateBy!
        $marketplaceIds: [MarketplaceId!]!
        $asinGranularity: AsinGranularity!
      ) {
        salesAndTrafficByAsin(
          startDate: $startDate
          endDate: $endDate
          aggregateBy: $aggregateBy
          marketplaceIds: $marketplaceIds
          asinGranularity: $asinGranularity
        ) {
          traffic {
            parentAsin
            childAsin
            sku
            pageViews
            sessions
            browserPageViews
            browserPageViewsPercentage
            mobileAppPageViews
            mobileAppPageViewsPercentage
            pageViewsPercentage
            sessionsPercentage
            buyBoxPercentage
            unitSessionPercentage
            pageViewsPercentageB2B
            sessionsPercentageB2B
            browserPageViewsB2B
            browserPageViewsPercentageB2B
            mobileAppPageViewsB2B
            mobileAppPageViewsPercentageB2B
            buyBoxPercentageB2B
            unitSessionPercentageB2B
          }
          sales {
            parentAsin
            childAsin
            sku
            orderedProductSales {
              amount
              currencyCode
            }
            orderedProductSalesB2B {
              amount
              currencyCode
            }
            unitsOrdered
            unitsOrderedB2B
            totalOrderItems
            totalOrderItemsB2B
            averageSellingPrice {
              amount
              currencyCode
            }
            averageSellingPriceB2B {
              amount
              currencyCode
            }
            unitsRefunded
            refundRate
            ordersShipped
          }
        }
      }
    `;
  }

  /**
   * Buscar métricas de vendas e tráfego por data
   */
  async getSalesAndTrafficByDate(startDate, endDate, granularity = 'DAY') {
    console.log(`📊 Buscando métricas por data: ${startDate} até ${endDate} (${granularity})`);

    const query = this.buildSalesAndTrafficByDateQuery();
    const variables = {
      startDate,
      endDate,
      aggregateBy: granularity, // DAY, WEEK, MONTH
      marketplaceIds: [this.credentials.marketplaceId]
    };

    try {
      const data = await this.executeGraphQLQuery(query, variables);
      
      // Combinar dados de vendas e tráfego
      const salesByDate = data.salesAndTrafficByDate.sales || [];
      const trafficByDate = data.salesAndTrafficByDate.traffic || [];
      
      // Criar mapa de datas para combinar dados
      const combinedData = new Map();
      
      salesByDate.forEach(sale => {
        combinedData.set(sale.date, { sales: sale });
      });
      
      trafficByDate.forEach(traffic => {
        const existing = combinedData.get(traffic.date) || {};
        combinedData.set(traffic.date, { ...existing, traffic });
      });
      
      // Converter para array ordenado
      const results = Array.from(combinedData.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      console.log(`✅ ${results.length} registros encontrados`);
      return results;
      
    } catch (error) {
      console.error('❌ Erro ao buscar métricas por data:', error.message);
      throw error;
    }
  }

  /**
   * Buscar métricas de vendas e tráfego por ASIN
   */
  async getSalesAndTrafficByAsin(startDate, endDate, asinGranularity = 'PARENT') {
    console.log(`📦 Buscando métricas por ASIN: ${startDate} até ${endDate} (${asinGranularity})`);

    const query = this.buildSalesAndTrafficByAsinQuery();
    const variables = {
      startDate,
      endDate,
      aggregateBy: 'CHILD', // Sempre por item individual
      marketplaceIds: [this.credentials.marketplaceId],
      asinGranularity // PARENT, CHILD, SKU
    };

    try {
      const data = await this.executeGraphQLQuery(query, variables);
      
      // Combinar dados de vendas e tráfego
      const salesByAsin = data.salesAndTrafficByAsin.sales || [];
      const trafficByAsin = data.salesAndTrafficByAsin.traffic || [];
      
      // Criar mapa de ASINs para combinar dados
      const combinedData = new Map();
      
      salesByAsin.forEach(sale => {
        const key = sale.childAsin || sale.parentAsin || sale.sku;
        combinedData.set(key, { sales: sale });
      });
      
      trafficByAsin.forEach(traffic => {
        const key = traffic.childAsin || traffic.parentAsin || traffic.sku;
        const existing = combinedData.get(key) || {};
        combinedData.set(key, { ...existing, traffic });
      });
      
      // Converter para array ordenado por vendas
      const results = Array.from(combinedData.entries())
        .map(([asin, data]) => ({ asin, ...data }))
        .sort((a, b) => {
          const salesA = a.sales?.orderedProductSales?.amount || 0;
          const salesB = b.sales?.orderedProductSales?.amount || 0;
          return salesB - salesA;
        });
      
      console.log(`✅ ${results.length} produtos encontrados`);
      return results;
      
    } catch (error) {
      console.error('❌ Erro ao buscar métricas por ASIN:', error.message);
      throw error;
    }
  }

  /**
   * Método auxiliar para testar conexão
   */
  async testConnection() {
    try {
      console.log('🧪 Testando conexão com Amazon SP-API GraphQL...');
      const token = await this.getAccessToken();
      console.log('✅ Autenticação bem-sucedida!');
      console.log(`Token válido até: ${this.tokenExpiry.toLocaleString('pt-BR')}`);
      return true;
    } catch (error) {
      console.error('❌ Falha na conexão:', error.message);
      return false;
    }
  }
}

module.exports = AmazonGraphQLService;