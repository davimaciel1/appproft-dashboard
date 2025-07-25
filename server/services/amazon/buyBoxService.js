const SellingPartnerAPI = require('amazon-sp-api');
const pool = require('../../db/pool');

class BuyBoxService {
  constructor() {
    this.spApi = new SellingPartnerAPI({
      region: 'na', // North America
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: process.env.AMAZON_CLIENT_ID || process.env.AMAZON_SP_API_CLIENT_ID,
        SELLING_PARTNER_APP_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET || process.env.AMAZON_SP_API_CLIENT_SECRET,
        AWS_ACCESS_KEY_ID: process.env.SP_API_AWS_ACCESS_KEY,
        AWS_SECRET_ACCESS_KEY: process.env.SP_API_AWS_SECRET_KEY,
        AWS_SELLING_PARTNER_ROLE: process.env.AWS_SELLING_PARTNER_ROLE || 'arn:aws:iam::123456789:role/SellingPartnerAPIRole'
      },
      options: {
        auto_request_tokens: true
      }
    });
  }

  /**
   * Busca informações de Buy Box para um ASIN específico
   */
  async getBuyBoxDataForASIN(asin) {
    try {
      // Buscar informações de preços competitivos
      const competitivePricing = await this.spApi.callAPI({
        operation: 'getCompetitivePricing',
        query: {
          MarketplaceId: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
          Asins: asin,
          ItemType: 'Asin'
        }
      });

      // Buscar ofertas do produto
      const offers = await this.spApi.callAPI({
        operation: 'getItemOffers',
        path: `/products/pricing/v0/items/${asin}/offers`,
        query: {
          MarketplaceId: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
          ItemCondition: 'New',
          CustomerType: 'Consumer'
        }
      });

      return {
        asin,
        competitivePricing: competitivePricing.payload,
        offers: offers.payload
      };
    } catch (error) {
      console.error(`Erro ao buscar Buy Box para ASIN ${asin}:`, error.message);
      return null;
    }
  }

  /**
   * Processa e salva dados de Buy Box no banco
   */
  async saveBuyBoxData(buyBoxData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { asin, competitivePricing, offers } = buyBoxData;
      
      // Extrair informações do Buy Box
      const buyBoxPrice = competitivePricing?.CompetitivePrices?.[0]?.Price?.LandedPrice?.Amount || null;
      const buyBoxSeller = offers?.Summary?.BuyBoxPrices?.[0]?.SellerSKU || null;
      const numberOfOffers = offers?.Summary?.NumberOfOffers?.length || 0;
      
      // Verificar se temos o Buy Box
      const ourSellerId = process.env.AMAZON_SELLER_ID;
      const ourHasBuyBox = offers?.Offers?.some(offer => 
        offer.SellerId === ourSellerId && offer.IsBuyBoxWinner
      ) || false;

      // Inserir dados na tabela competitor_tracking_advanced
      await client.query(`
        INSERT INTO competitor_tracking_advanced (
          asin,
          tenant_id,
          timestamp,
          buy_box_price,
          buy_box_seller,
          our_price,
          our_has_buy_box,
          total_offers,
          fba_offers,
          fbm_offers,
          lowest_fba_price,
          lowest_fbm_price,
          competitors
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        asin,
        1, // tenant_id padrão
        new Date(),
        buyBoxPrice,
        buyBoxSeller,
        await this.getOurPriceForASIN(asin),
        ourHasBuyBox,
        numberOfOffers,
        this.countFBAOffers(offers),
        this.countFBMOffers(offers),
        this.getLowestFBAPrice(offers),
        this.getLowestFBMPrice(offers),
        JSON.stringify(this.extractCompetitors(offers))
      ]);

      await client.query('COMMIT');
      
      console.log(`✅ Dados de Buy Box salvos para ASIN ${asin}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao salvar dados de Buy Box:', error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Busca nosso preço atual para um ASIN
   */
  async getOurPriceForASIN(asin) {
    const result = await pool.query(
      'SELECT price FROM products WHERE asin = $1',
      [asin]
    );
    return result.rows[0]?.price || null;
  }

  /**
   * Conta ofertas FBA
   */
  countFBAOffers(offers) {
    if (!offers?.Offers) return 0;
    return offers.Offers.filter(offer => 
      offer.FulfillmentChannel === 'Amazon'
    ).length;
  }

  /**
   * Conta ofertas FBM
   */
  countFBMOffers(offers) {
    if (!offers?.Offers) return 0;
    return offers.Offers.filter(offer => 
      offer.FulfillmentChannel === 'Merchant'
    ).length;
  }

  /**
   * Obtém menor preço FBA
   */
  getLowestFBAPrice(offers) {
    if (!offers?.Offers) return null;
    
    const fbaOffers = offers.Offers.filter(offer => 
      offer.FulfillmentChannel === 'Amazon'
    );
    
    if (fbaOffers.length === 0) return null;
    
    return Math.min(...fbaOffers.map(offer => 
      parseFloat(offer.ListingPrice?.Amount || Infinity)
    ));
  }

  /**
   * Obtém menor preço FBM
   */
  getLowestFBMPrice(offers) {
    if (!offers?.Offers) return null;
    
    const fbmOffers = offers.Offers.filter(offer => 
      offer.FulfillmentChannel === 'Merchant'
    );
    
    if (fbmOffers.length === 0) return null;
    
    return Math.min(...fbmOffers.map(offer => 
      parseFloat(offer.ListingPrice?.Amount || Infinity)
    ));
  }

  /**
   * Extrai informações dos competidores
   */
  extractCompetitors(offers) {
    if (!offers?.Offers) return [];
    
    return offers.Offers.map(offer => ({
      sellerId: offer.SellerId,
      sellerName: offer.SellerName || 'Unknown',
      price: offer.ListingPrice?.Amount,
      shipping: offer.Shipping?.Amount,
      fulfillment: offer.FulfillmentChannel,
      isBuyBoxWinner: offer.IsBuyBoxWinner || false,
      condition: offer.SubCondition || 'New',
      feedback: {
        rating: offer.SellerFeedbackRating?.Rating,
        count: offer.SellerFeedbackRating?.Count
      }
    }));
  }

  /**
   * Sincroniza Buy Box para todos os produtos ativos
   */
  async syncAllBuyBoxData() {
    try {
      console.log('🔄 Iniciando sincronização de Buy Box...');
      
      // Buscar todos os ASINs ativos
      const result = await pool.query(`
        SELECT DISTINCT asin 
        FROM products 
        WHERE asin IS NOT NULL 
        AND active = true
        AND marketplace = 'amazon'
        ORDER BY asin
      `);

      const asins = result.rows.map(row => row.asin);
      console.log(`📦 Encontrados ${asins.length} produtos para sincronizar`);

      let success = 0;
      let errors = 0;

      // Processar em lotes para respeitar rate limits
      for (let i = 0; i < asins.length; i += 5) {
        const batch = asins.slice(i, i + 5);
        
        await Promise.all(
          batch.map(async (asin) => {
            const buyBoxData = await this.getBuyBoxDataForASIN(asin);
            if (buyBoxData) {
              const saved = await this.saveBuyBoxData(buyBoxData);
              if (saved) success++;
              else errors++;
            } else {
              errors++;
            }
          })
        );

        // Aguardar 1 segundo entre lotes para respeitar rate limits
        if (i + 5 < asins.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Sincronização concluída: ${success} sucessos, ${errors} erros`);
      
      return {
        total: asins.length,
        success,
        errors
      };
    } catch (error) {
      console.error('Erro na sincronização de Buy Box:', error);
      throw error;
    }
  }
}

module.exports = new BuyBoxService();