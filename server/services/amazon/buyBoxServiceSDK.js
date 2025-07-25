const { AuthApiClient } = require('@sp-api-sdk/auth');
const axios = require('axios');
const pool = require('../../db/pool');

class BuyBoxServiceSDK {
  constructor() {
    this.authClient = new AuthApiClient();
    this.accessToken = null;
    this.tokenExpiry = null;
    this.region = process.env.AMAZON_REGION || 'us-east-1';
    this.endpoint = this.getEndpoint();
  }

  getEndpoint() {
    const endpoints = {
      'us-east-1': 'https://sellingpartnerapi-na.amazon.com',
      'eu-west-1': 'https://sellingpartnerapi-eu.amazon.com',
      'us-west-2': 'https://sellingpartnerapi-fe.amazon.com'
    };
    return endpoints[this.region] || endpoints['us-east-1'];
  }

  async getAccessToken() {
    // Verificar se o token ainda é válido
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Renovar o token usando o refresh token
      const response = await this.authClient.exchangeLwaRefreshTokenForAccessToken({
        clientId: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
        clientSecret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
        refreshToken: process.env.AMAZON_REFRESH_TOKEN
      });

      this.accessToken = response.access_token;
      // Token expira em 1 hora, renovar 5 minutos antes
      this.tokenExpiry = new Date(Date.now() + (response.expires_in - 300) * 1000);
      
      console.log('✅ Token de acesso obtido com sucesso');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Erro ao obter token de acesso:', error.message);
      throw error;
    }
  }

  async callAPI(path, params = {}) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await axios({
        method: 'GET',
        url: `${this.endpoint}${path}`,
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        },
        params: params
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('API Error:', error.response.data);
      }
      throw error;
    }
  }

  async getBuyBoxDataForASIN(asin) {
    try {
      console.log(`🔍 Buscando Buy Box para ASIN: ${asin}`);
      
      // Buscar preços competitivos
      const competitivePricing = await this.callAPI('/products/pricing/v0/competitivePrice', {
        MarketplaceId: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
        Asins: asin,
        ItemType: 'Asin'
      });

      // Buscar ofertas
      const offers = await this.callAPI(`/products/pricing/v0/items/${asin}/offers`, {
        MarketplaceId: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
        ItemCondition: 'New',
        CustomerType: 'Consumer'
      });

      return {
        asin,
        competitivePricing: competitivePricing.payload?.[0],
        offers: offers.payload
      };
    } catch (error) {
      console.error(`Erro ao buscar Buy Box para ASIN ${asin}:`, error.message);
      return null;
    }
  }

  async saveBuyBoxData(buyBoxData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { asin, competitivePricing, offers } = buyBoxData;
      
      // Extrair informações do Buy Box
      const buyBoxPrice = competitivePricing?.Product?.CompetitivePricing?.CompetitivePrices?.find(
        p => p.CompetitivePriceId === '1'
      )?.Price?.LandedPrice?.Amount || null;
      
      // Informações das ofertas
      const offersList = offers?.Offers || [];
      
      // Verificar se temos o Buy Box
      const ourSellerId = process.env.AMAZON_SELLER_ID;
      const buyBoxWinner = offersList.find(offer => offer.IsBuyBoxWinner);
      const ourHasBuyBox = buyBoxWinner?.SellerId === ourSellerId;
      
      // Nossa oferta
      const ourOffer = offersList.find(offer => offer.SellerId === ourSellerId);
      const ourPrice = ourOffer?.ListingPrice?.Amount || null;

      // Salvar em buy_box_winners
      await client.query(`
        INSERT INTO buy_box_winners (
          product_asin,
          is_winner,
          our_price,
          buy_box_price,
          competitor_count,
          checked_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (product_asin) 
        DO UPDATE SET
          is_winner = EXCLUDED.is_winner,
          our_price = EXCLUDED.our_price,
          buy_box_price = EXCLUDED.buy_box_price,
          competitor_count = EXCLUDED.competitor_count,
          checked_at = NOW()
      `, [
        asin,
        ourHasBuyBox,
        ourPrice,
        buyBoxPrice,
        offersList.length - 1
      ]);

      // Salvar dados de competidores
      for (const offer of offersList) {
        if (offer.SellerId !== ourSellerId) {
          await client.query(`
            INSERT INTO competitor_pricing (
              product_asin,
              seller_id,
              price,
              shipping_cost,
              is_fba,
              is_buy_box,
              condition,
              collected_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (product_asin, seller_id, collected_at) DO NOTHING
          `, [
            asin,
            offer.SellerId,
            offer.ListingPrice?.Amount || 0,
            offer.Shipping?.Amount || 0,
            offer.IsFulfilledByAmazon || false,
            offer.IsBuyBoxWinner || false,
            offer.SubCondition || 'New'
          ]);
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Dados de Buy Box salvos para ASIN: ${asin}`);
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao salvar dados de Buy Box:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async syncAllBuyBoxData() {
    try {
      // Buscar todos os ASINs ativos
      const result = await pool.query(`
        SELECT DISTINCT asin 
        FROM products 
        WHERE marketplace = 'amazon' 
        AND status = 'active'
        ORDER BY asin
        LIMIT 10  -- Limitar para teste inicial
      `);

      const asins = result.rows.map(row => row.asin);
      console.log(`📦 Encontrados ${asins.length} produtos para sincronizar`);

      let successCount = 0;
      let errorCount = 0;
      const details = [];

      // Processar um por vez para evitar rate limiting
      for (const asin of asins) {
        try {
          const buyBoxData = await this.getBuyBoxDataForASIN(asin);
          if (buyBoxData) {
            await this.saveBuyBoxData(buyBoxData);
            successCount++;
            details.push({ asin, success: true });
            console.log(`✅ ${asin}: Sucesso`);
          } else {
            errorCount++;
            details.push({ asin, success: false, message: 'Sem dados' });
          }
        } catch (error) {
          console.error(`❌ ${asin}: ${error.message}`);
          errorCount++;
          details.push({ asin, success: false, message: error.message });
        }
        
        // Aguardar entre requisições
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`\n✅ Sincronização concluída: ${successCount} sucessos, ${errorCount} erros`);
      return {
        total: asins.length,
        success: successCount,
        errors: errorCount,
        details
      };

    } catch (error) {
      console.error('Erro na sincronização geral:', error);
      throw error;
    }
  }
}

module.exports = new BuyBoxServiceSDK();