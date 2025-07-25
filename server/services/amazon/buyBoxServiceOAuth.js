const SellingPartnerAPI = require('amazon-sp-api');
const pool = require('../../db/pool');

class BuyBoxServiceOAuth {
  constructor() {
    // Configuração correta para OAuth sem AWS IAM
    this.spApi = new SellingPartnerAPI({
      region: process.env.AMAZON_REGION || 'na',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      options: {
        credentials: {
          SELLING_PARTNER_APP_CLIENT_ID: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
          SELLING_PARTNER_APP_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
          // NÃO incluir AWS credentials quando usando OAuth
        },
        auto_request_tokens: true,
        use_sandbox: false
      }
    });
  }

  /**
   * Busca informações de Buy Box para um ASIN específico
   */
  async getBuyBoxDataForASIN(asin) {
    try {
      console.log(`🔍 Buscando Buy Box para ASIN: ${asin}`);
      
      // Buscar informações de preços competitivos
      const competitivePricing = await this.spApi.callAPI({
        operation: 'productPricing.getCompetitivePricing',
        query: {
          MarketplaceId: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
          Asins: [asin],
          ItemType: 'Asin'
        }
      });

      // Buscar ofertas do produto
      const offers = await this.spApi.callAPI({
        operation: 'productPricing.getItemOffers',
        path: {
          Asin: asin
        },
        query: {
          MarketplaceId: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
          ItemCondition: 'New',
          CustomerType: 'Consumer'
        }
      });

      return {
        asin,
        competitivePricing: competitivePricing,
        offers: offers
      };
    } catch (error) {
      console.error(`Erro ao buscar Buy Box para ASIN ${asin}:`, error.message);
      // Log mais detalhado para debug
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
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
      const competitivePrice = competitivePricing?.payload?.[0];
      const buyBoxPrice = competitivePrice?.Product?.CompetitivePricing?.CompetitivePrices?.find(
        p => p.CompetitivePriceId === '1'
      )?.Price?.LandedPrice?.Amount || null;
      
      // Informações das ofertas
      const offersList = offers?.payload?.Offers || [];
      const summary = offers?.payload?.Summary;
      
      // Verificar se temos o Buy Box
      const ourSellerId = process.env.AMAZON_SELLER_ID;
      const buyBoxWinner = offersList.find(offer => offer.IsBuyBoxWinner);
      const ourHasBuyBox = buyBoxWinner?.SellerId === ourSellerId;
      const buyBoxSellerId = buyBoxWinner?.SellerId || null;
      
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
        offersList.length - 1 // Total de competidores
      ]);

      // Verificar se houve mudança no Buy Box
      const previousWinner = await client.query(`
        SELECT is_winner FROM buy_box_winners 
        WHERE product_asin = $1
      `, [asin]);

      if (previousWinner.rows.length > 0 && previousWinner.rows[0].is_winner !== ourHasBuyBox) {
        // Registrar mudança no histórico
        await client.query(`
          INSERT INTO buy_box_history (
            product_asin,
            change_type,
            old_winner,
            new_winner,
            old_price,
            new_price,
            changed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          asin,
          ourHasBuyBox ? 'won' : 'lost',
          previousWinner.rows[0].is_winner ? ourSellerId : buyBoxSellerId,
          ourHasBuyBox ? ourSellerId : buyBoxSellerId,
          previousWinner.rows[0].is_winner ? ourPrice : buyBoxPrice,
          buyBoxPrice
        ]);
      }

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

  /**
   * Sincroniza dados de Buy Box para todos os produtos
   */
  async syncAllBuyBoxData() {
    try {
      // Buscar todos os ASINs ativos
      const result = await pool.query(`
        SELECT DISTINCT asin 
        FROM products 
        WHERE marketplace = 'amazon' 
        AND status = 'active'
        ORDER BY asin
      `);

      const asins = result.rows.map(row => row.asin);
      console.log(`📦 Encontrados ${asins.length} produtos para sincronizar`);

      let successCount = 0;
      let errorCount = 0;

      // Processar em lotes para evitar rate limiting
      const batchSize = 5;
      for (let i = 0; i < asins.length; i += batchSize) {
        const batch = asins.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (asin) => {
          try {
            const buyBoxData = await this.getBuyBoxDataForASIN(asin);
            if (buyBoxData) {
              await this.saveBuyBoxData(buyBoxData);
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            console.error(`Erro ao processar ASIN ${asin}:`, error.message);
            errorCount++;
          }
        }));

        // Aguardar para evitar rate limiting
        if (i + batchSize < asins.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Sincronização concluída: ${successCount} sucessos, ${errorCount} erros`);
      return {
        total: asins.length,
        success: successCount,
        errors: errorCount
      };

    } catch (error) {
      console.error('Erro na sincronização geral:', error);
      throw error;
    }
  }
}

module.exports = new BuyBoxServiceOAuth();