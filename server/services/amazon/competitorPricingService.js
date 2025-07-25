const secureLogger = require('../../utils/secureLogger');

/**
 * Serviço para coleta de dados de competidores via Amazon SP-API
 * Implementa coleta de preços competitivos e identificação de vendedores
 */
class CompetitorPricingService {
  constructor(amazonService, db) {
    this.amazonService = amazonService;
    this.db = db;
  }

  /**
   * Coleta dados de preços competitivos para um ASIN
   * @param {string} asin - ASIN do produto
   * @param {string} marketplaceId - ID do marketplace
   * @returns {Object} Dados dos competidores
   */
  async getCompetitivePricing(asin, marketplaceId = 'A2Q3Y263D00KWC') {
    try {
      const path = `/products/pricing/v0/items/${asin}/offers?MarketplaceId=${marketplaceId}&ItemCondition=New&CustomerType=Consumer`;
      
      secureLogger.info('Buscando preços competitivos', { asin, marketplaceId });
      
      const response = await this.amazonService.callSPAPI(path);
      
      if (!response.payload) {
        return { offers: [], summary: null };
      }

      const offers = response.payload.offers || [];
      const summary = response.payload.summary || {};

      // Processar ofertas para identificar Buy Box
      const processedOffers = await this.processOffers(offers, asin);
      
      // Identificar quem tem a Buy Box
      const buyBoxWinner = processedOffers.find(offer => offer.isBuyBoxWinner);
      
      const result = {
        asin,
        marketplaceId,
        offers: processedOffers,
        summary: {
          ...summary,
          buyBoxWinner: buyBoxWinner ? {
            sellerId: buyBoxWinner.sellerId,
            sellerName: buyBoxWinner.sellerName,
            price: buyBoxWinner.price,
            isFBA: buyBoxWinner.isFulfilledByAmazon
          } : null,
          totalOffers: offers.length,
          timestamp: new Date().toISOString()
        }
      };

      // Salvar dados no banco
      await this.saveCompetitorData(result);

      return result;
      
    } catch (error) {
      secureLogger.error('Erro ao buscar preços competitivos', {
        asin,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Processa ofertas e tenta identificar vendedores
   * @param {Array} offers - Ofertas da API
   * @param {string} asin - ASIN do produto
   * @returns {Array} Ofertas processadas
   */
  async processOffers(offers, asin) {
    const processedOffers = [];

    for (const offer of offers) {
      try {
        const sellerId = offer.sellerId || offer.SellerId;
        
        // Tentar obter nome do vendedor
        const sellerName = await this.getSellerName(sellerId);
        
        const processedOffer = {
          sellerId,
          sellerName,
          price: this.extractPrice(offer),
          shippingPrice: this.extractShippingPrice(offer),
          condition: offer.itemCondition || offer.Condition,
          isFulfilledByAmazon: offer.isFulfilledByAmazon || false,
          isBuyBoxWinner: offer.isBuyBoxWinner || false,
          feedbackRating: offer.sellerFeedbackRating?.sellerPositiveFeedbackRating || null,
          feedbackCount: offer.sellerFeedbackRating?.feedbackCount || null,
          shippingTime: offer.shippingTime || null,
          timestamp: new Date().toISOString()
        };

        processedOffers.push(processedOffer);
        
      } catch (error) {
        secureLogger.error('Erro ao processar oferta', {
          asin,
          sellerId: offer.sellerId,
          error: error.message
        });
      }
    }

    return processedOffers;
  }

  /**
   * Extrai preço da oferta
   * @param {Object} offer - Oferta da API
   * @returns {number} Preço
   */
  extractPrice(offer) {
    if (offer.listingPrice?.amount) {
      return parseFloat(offer.listingPrice.amount);
    }
    if (offer.ListingPrice?.Amount) {
      return parseFloat(offer.ListingPrice.Amount);
    }
    return 0;
  }

  /**
   * Extrai preço de frete da oferta
   * @param {Object} offer - Oferta da API
   * @returns {number} Preço do frete
   */
  extractShippingPrice(offer) {
    if (offer.shipping?.amount) {
      return parseFloat(offer.shipping.amount);
    }
    if (offer.Shipping?.Amount) {
      return parseFloat(offer.Shipping.Amount);
    }
    return 0;
  }

  /**
   * Obtém nome do vendedor (com cache)
   * @param {string} sellerId - ID do vendedor
   * @returns {string} Nome do vendedor
   */
  async getSellerName(sellerId) {
    try {
      // 1. Verificar cache primeiro
      const cached = await this.db.query(
        'SELECT seller_name FROM sellers_cache WHERE seller_id = $1 AND last_updated > NOW() - INTERVAL \'7 days\'',
        [sellerId]
      );

      if (cached.rows.length > 0) {
        return cached.rows[0].seller_name;
      }

      // 2. Tentar obter via API (método futuro)
      // Por enquanto, usar ID truncado como nome
      const sellerName = `Vendedor ${sellerId.substring(0, 8)}`;
      
      // 3. Salvar no cache
      await this.cacheSellerInfo(sellerId, { sellerName });
      
      return sellerName;
      
    } catch (error) {
      secureLogger.error('Erro ao obter nome do vendedor', {
        sellerId,
        error: error.message
      });
      return `Vendedor ${sellerId.substring(0, 8)}`;
    }
  }

  /**
   * Salva informações do vendedor no cache
   * @param {string} sellerId - ID do vendedor
   * @param {Object} info - Informações do vendedor
   */
  async cacheSellerInfo(sellerId, info) {
    try {
      await this.db.query(`
        INSERT INTO sellers_cache 
        (seller_id, seller_name, feedback_rating, feedback_count, last_updated)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (seller_id) DO UPDATE SET
          seller_name = $2,
          feedback_rating = COALESCE($3, sellers_cache.feedback_rating),
          feedback_count = COALESCE($4, sellers_cache.feedback_count),
          last_updated = NOW()
      `, [
        sellerId, 
        info.sellerName, 
        info.feedbackRating || null, 
        info.feedbackCount || null
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar cache do vendedor', {
        sellerId,
        error: error.message
      });
    }
  }

  /**
   * Salva dados dos competidores no banco
   * @param {Object} competitorData - Dados dos competidores
   */
  async saveCompetitorData(competitorData) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Salvar cada oferta
      for (const offer of competitorData.offers) {
        await client.query(`
          INSERT INTO competitor_tracking 
          (asin, competitor_seller_id, seller_name, timestamp, price, shipping_price,
           is_buy_box_winner, is_fba, feedback_count, feedback_rating,
           price_difference, price_percentile)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          competitorData.asin,
          offer.sellerId,
          offer.sellerName,
          offer.timestamp,
          offer.price,
          offer.shippingPrice,
          offer.isBuyBoxWinner,
          offer.isFulfilledByAmazon,
          offer.feedbackCount,
          offer.feedbackRating,
          0, // Calcular depois
          0  // Calcular depois
        ]);
      }

      // Se houver mudança de Buy Box, registrar no histórico
      if (competitorData.summary.buyBoxWinner) {
        await this.trackBuyBoxChange(
          client,
          competitorData.asin,
          competitorData.summary.buyBoxWinner
        );
      }

      await client.query('COMMIT');
      
      secureLogger.info('Dados de competidores salvos', {
        asin: competitorData.asin,
        offersCount: competitorData.offers.length,
        buyBoxWinner: competitorData.summary.buyBoxWinner?.sellerName
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      secureLogger.error('Erro ao salvar dados de competidores', {
        asin: competitorData.asin,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Registra mudança de Buy Box
   * @param {Object} client - Cliente do banco
   * @param {string} asin - ASIN do produto
   * @param {Object} newWinner - Novo detentor da Buy Box
   */
  async trackBuyBoxChange(client, asin, newWinner) {
    try {
      // Verificar quem tinha a Buy Box antes
      const previous = await client.query(`
        SELECT seller_id, seller_name, timestamp, price
        FROM competitor_tracking
        WHERE asin = $1 AND is_buy_box_winner = true
        ORDER BY timestamp DESC
        LIMIT 1
      `, [asin]);

      if (previous.rows.length > 0) {
        const prev = previous.rows[0];
        
        if (prev.seller_id !== newWinner.sellerId) {
          // Registrar mudança de Buy Box
          const duration = (new Date() - new Date(prev.timestamp)) / 60000; // em minutos

          await client.query(`
            INSERT INTO buy_box_history 
            (asin, seller_id, seller_name, started_at, ended_at, duration_minutes, avg_price)
            VALUES ($1, $2, $3, $4, NOW(), $5, $6)
          `, [
            asin,
            prev.seller_id,
            prev.seller_name,
            prev.timestamp,
            Math.floor(duration),
            prev.price
          ]);

          secureLogger.info('Mudança de Buy Box registrada', {
            asin,
            previousOwner: prev.seller_name,
            newOwner: newWinner.sellerName,
            durationMinutes: Math.floor(duration)
          });

          // Gerar insight sobre a mudança
          await this.generateBuyBoxInsight(client, asin, newWinner, prev);
        }
      }
      
    } catch (error) {
      secureLogger.error('Erro ao rastrear mudança de Buy Box', {
        asin,
        error: error.message
      });
    }
  }

  /**
   * Gera insight sobre mudança de Buy Box
   * @param {Object} client - Cliente do banco
   * @param {string} asin - ASIN do produto
   * @param {Object} newWinner - Novo detentor
   * @param {Object} previous - Detentor anterior
   */
  async generateBuyBoxInsight(client, asin, newWinner, previous) {
    try {
      // Buscar informações do produto
      const productInfo = await client.query(
        'SELECT name FROM products WHERE asin = $1 LIMIT 1',
        [asin]
      );

      const productName = productInfo.rows[0]?.name || `Produto ${asin}`;
      const priceDifference = previous.price - newWinner.price;
      const percentDifference = (priceDifference / previous.price * 100).toFixed(1);

      if (priceDifference > 0) {
        // Perdeu Buy Box para preço mais baixo
        await client.query(`
          INSERT INTO ai_insights 
          (asin, insight_type, priority, title, description, recommendation, 
           competitor_name, competitor_action, supporting_data, confidence_score, potential_impact)
          VALUES ($1, 'buy_box', 'high', $2, $3, $4, $5, 'lowered_price', $6, 0.95, $7)
        `, [
          asin,
          `Perdeu Buy Box para ${newWinner.sellerName}`,
          `${newWinner.sellerName} baixou o preço em ${percentDifference}% (R$ ${priceDifference.toFixed(2)})`,
          `Considere ajustar preço para R$ ${(newWinner.price * 0.99).toFixed(2)} para recuperar Buy Box`,
          newWinner.sellerName,
          JSON.stringify({
            previous_price: previous.price,
            new_price: newWinner.price,
            price_difference: priceDifference,
            percent_difference: percentDifference,
            previous_owner: previous.seller_name
          }),
          Math.abs(priceDifference * 100) // Impacto estimado
        ]);
      }
      
    } catch (error) {
      secureLogger.error('Erro ao gerar insight de Buy Box', {
        asin,
        error: error.message
      });
    }
  }

  /**
   * Coleta dados competitivos para todos os produtos ativos
   * @param {string} tenantId - ID do tenant
   * @returns {Object} Resultado da coleta
   */
  async collectAllCompetitorData(tenantId) {
    try {
      // Buscar produtos ativos do tenant
      const products = await this.db.query(`
        SELECT asin
        FROM products 
        WHERE tenant_id = $1 AND marketplace = 'amazon' AND asin IS NOT NULL AND asin != ''
        LIMIT 50
      `, [tenantId]);

      const results = {
        success: 0,
        errors: 0,
        products: products.rows.length,
        details: []
      };

      for (const product of products.rows) {
        try {
          await this.getCompetitivePricing(product.asin);
          results.success++;
          
          // Aguardar para respeitar rate limits (max 10 requests/second)
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          results.errors++;
          results.details.push({
            asin: product.asin,
            error: error.message
          });
          
          secureLogger.error('Erro ao coletar dados do produto', {
            asin: product.asin,
            error: error.message
          });
        }
      }

      secureLogger.info('Coleta de dados competitivos concluída', results);
      return results;
      
    } catch (error) {
      secureLogger.error('Erro na coleta de dados competitivos', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtém status atual da Buy Box para dashboard
   * @param {string} tenantId - ID do tenant
   * @returns {Array} Status da Buy Box por produto
   */
  async getBuyBoxStatus(tenantId) {
    try {
      const query = `
        WITH latest_tracking AS (
          SELECT DISTINCT ON (ct.asin) 
            ct.asin,
            ct.seller_name,
            ct.price,
            ct.is_buy_box_winner,
            ct.is_fba,
            ct.feedback_rating,
            ct.timestamp,
            p.name as product_name
          FROM competitor_tracking ct
          JOIN products p ON ct.asin = p.asin
          WHERE p.tenant_id = $1 AND p.marketplace = 'amazon'
          ORDER BY ct.asin, ct.timestamp DESC
        )
        SELECT 
          lt.*,
          CASE 
            WHEN lt.seller_name LIKE 'Sua Loja%' OR lt.seller_name = 'Vendedora Principal' 
            THEN true 
            ELSE false 
          END as we_have_buybox
        FROM latest_tracking lt
        WHERE lt.is_buy_box_winner = true
        ORDER BY lt.timestamp DESC
      `;

      const result = await this.db.query(query, [tenantId]);
      return result.rows;
      
    } catch (error) {
      secureLogger.error('Erro ao obter status da Buy Box', {
        tenantId,
        error: error.message
      });
      return [];
    }
  }
}

module.exports = CompetitorPricingService;