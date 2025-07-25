const secureLogger = require('../utils/secureLogger');
const { getRateLimiter } = require('./rateLimiter');

/**
 * Serviço para gerenciar competidores manuais de Brand Owners
 * Permite definir ASINs específicos como competidores e monitorá-los
 */
class BrandOwnerCompetitorService {
  constructor(amazonService, db) {
    this.amazonService = amazonService;
    this.db = db;
    this.rateLimiter = getRateLimiter();
  }

  /**
   * Adiciona um brand owner ao sistema
   */
  async addBrandOwner(sellerId, brandName, isExclusive = true) {
    try {
      const result = await this.db.query(`
        INSERT INTO brand_owners (seller_id, brand_name, is_exclusive)
        VALUES ($1, $2, $3)
        ON CONFLICT (seller_id) DO UPDATE SET
          brand_name = $2,
          is_exclusive = $3,
          updated_at = NOW()
        RETURNING id
      `, [sellerId, brandName, isExclusive]);

      secureLogger.info('Brand owner adicionado', {
        sellerId,
        brandName,
        brandOwnerId: result.rows[0].id
      });

      return result.rows[0].id;

    } catch (error) {
      secureLogger.error('Erro ao adicionar brand owner', {
        sellerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Adiciona produtos do brand owner
   */
  async addBrandOwnerProduct(brandOwnerId, asin, productName = null, category = null) {
    try {
      // Se não tiver nome, buscar da API
      if (!productName) {
        const productInfo = await this.getProductInfo(asin);
        productName = productInfo.title;
        category = productInfo.category;
      }

      await this.db.query(`
        INSERT INTO brand_owner_products (brand_owner_id, asin, product_name, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (brand_owner_id, asin) DO UPDATE SET
          product_name = $3,
          category = $4
      `, [brandOwnerId, asin, productName, category]);

      secureLogger.info('Produto do brand owner adicionado', {
        brandOwnerId,
        asin,
        productName
      });

      return true;

    } catch (error) {
      secureLogger.error('Erro ao adicionar produto', {
        brandOwnerId,
        asin,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Define um competidor manual para um produto
   */
  async addManualCompetitor(sellerId, ourAsin, competitorAsin, competitorBrand = null, level = 'direct', notes = null) {
    try {
      // Primeiro buscar o brand_name do seller
      const brandOwnerResult = await this.db.query(`
        SELECT brand_name FROM brand_owners WHERE seller_id = $1 LIMIT 1
      `, [sellerId]);
      
      if (brandOwnerResult.rows.length === 0) {
        throw new Error('Brand owner não encontrado para o seller_id: ' + sellerId);
      }
      
      const brandName = brandOwnerResult.rows[0].brand_name;
      
      const result = await this.db.query(`
        SELECT add_manual_competitor($1, $2, $3, $4, $5, $6, $7)
      `, [
        sellerId,
        brandName,
        ourAsin,
        competitorAsin,
        competitorBrand || 'Unknown',
        level,
        notes
      ]);

      const competitorId = result.rows[0].add_manual_competitor;

      // Coletar dados iniciais do competidor
      await this.updateCompetitorData(competitorId);

      secureLogger.info('Competidor manual adicionado', {
        ourAsin,
        competitorAsin,
        competitorId
      });

      return competitorId;

    } catch (error) {
      secureLogger.error('Erro ao adicionar competidor manual', {
        ourAsin,
        competitorAsin,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Atualiza dados de um competidor específico
   */
  async updateCompetitorData(manualCompetitorId) {
    try {
      // Buscar informações do competidor
      const competitor = await this.db.query(`
        SELECT mc.*, bo.seller_id
        FROM manual_competitors mc
        JOIN brand_owners bo ON mc.brand_owner_id = bo.id
        WHERE mc.id = $1
      `, [manualCompetitorId]);

      if (competitor.rows.length === 0) {
        throw new Error('Competidor não encontrado');
      }

      const { our_asin, competitor_asin } = competitor.rows[0];

      // Buscar dados dos dois produtos
      const [ourData, competitorData] = await Promise.all([
        this.getProductDetails(our_asin),
        this.getProductDetails(competitor_asin)
      ]);

      // Salvar monitoramento
      await this.db.query(`
        INSERT INTO competitor_monitoring (
          manual_competitor_id, our_asin, competitor_asin,
          our_price, competitor_price, price_difference, price_difference_percent,
          our_rank, competitor_rank, our_reviews_count, competitor_reviews_count,
          our_rating, competitor_rating
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        manualCompetitorId,
        our_asin,
        competitor_asin,
        ourData.price,
        competitorData.price,
        ourData.price - competitorData.price,
        competitorData.price > 0 ? ((ourData.price - competitorData.price) / competitorData.price * 100) : 0,
        ourData.rank,
        competitorData.rank,
        ourData.reviewsCount,
        competitorData.reviewsCount,
        ourData.rating,
        competitorData.rating
      ]);

      // Gerar insight se houver diferença significativa de preço
      if (Math.abs(ourData.price - competitorData.price) / competitorData.price > 0.1) {
        await this.generateCompetitorInsight(
          our_asin,
          competitor_asin,
          ourData,
          competitorData
        );
      }

      return {
        ourData,
        competitorData,
        priceDifference: ourData.price - competitorData.price,
        priceDifferencePercent: ((ourData.price - competitorData.price) / competitorData.price * 100).toFixed(2)
      };

    } catch (error) {
      secureLogger.error('Erro ao atualizar dados do competidor', {
        manualCompetitorId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Busca detalhes de um produto
   */
  async getProductDetails(asin) {
    try {
      // Aguardar rate limit
      await this.rateLimiter.waitForToken('sp-api', '/catalog/v2022-04-01/items/{asin}');

      // Buscar informações do catálogo
      const catalogPath = `/catalog/v2022-04-01/items/${asin}?marketplaceIds=${this.amazonService.marketplaceId}&includedData=attributes,images,productTypes,salesRanks,summaries,variations`;
      const catalogData = await this.amazonService.callSPAPI(catalogPath);

      // Buscar preço
      await this.rateLimiter.waitForToken('sp-api', '/products/pricing/v0/items/{asin}/offers');
      const pricingPath = `/products/pricing/v0/items/${asin}/offers?MarketplaceId=${this.amazonService.marketplaceId}&ItemCondition=New`;
      const pricingData = await this.amazonService.callSPAPI(pricingPath);

      // Extrair dados
      const item = catalogData.payload;
      const offers = pricingData.payload?.offers || [];
      const lowestPrice = offers.length > 0 ? 
        Math.min(...offers.map(o => parseFloat(o.listingPrice?.amount || 999999))) : 
        0;

      const salesRank = item.salesRanks?.[0]?.rank || 0;
      const reviewsCount = parseInt(item.attributes?.total_review_count?.[0]?.value || '0');
      const rating = parseFloat(item.attributes?.star_rating?.[0]?.value || '0');

      return {
        asin,
        title: item.summaries?.[0]?.itemName || 'Unknown',
        price: lowestPrice,
        rank: salesRank,
        reviewsCount,
        rating,
        imageUrl: item.images?.[0]?.images?.[0]?.link || null
      };

    } catch (error) {
      secureLogger.error('Erro ao buscar detalhes do produto', {
        asin,
        error: error.message
      });
      
      // Retornar dados parciais em caso de erro
      return {
        asin,
        title: 'Unknown',
        price: 0,
        rank: 0,
        reviewsCount: 0,
        rating: 0,
        imageUrl: null
      };
    }
  }

  /**
   * Gera insight sobre competidor
   */
  async generateCompetitorInsight(ourAsin, competitorAsin, ourData, competitorData) {
    try {
      let title, description, recommendation;
      const priceDiffPercent = ((ourData.price - competitorData.price) / competitorData.price * 100).toFixed(1);

      if (ourData.price > competitorData.price) {
        title = `Seu preço está ${Math.abs(priceDiffPercent)}% acima do competidor`;
        description = `${competitorData.title} está R$ ${(ourData.price - competitorData.price).toFixed(2)} mais barato`;
        recommendation = `Considere ajustar o preço para R$ ${(competitorData.price * 0.99).toFixed(2)} para ser mais competitivo`;
      } else {
        title = `Vantagem de preço: ${Math.abs(priceDiffPercent)}% abaixo do competidor`;
        description = `Você está R$ ${Math.abs(ourData.price - competitorData.price).toFixed(2)} mais barato que ${competitorData.title}`;
        recommendation = 'Mantenha o preço competitivo e monitore mudanças do concorrente';
      }

      await this.db.query(`
        INSERT INTO ai_insights (
          asin, insight_type, priority, title, description, recommendation,
          competitor_name, supporting_data, confidence_score, potential_impact
        ) VALUES ($1, 'manual_competitor', $2, $3, $4, $5, $6, $7, 0.9, $8)
      `, [
        ourAsin,
        Math.abs(priceDiffPercent) > 20 ? 'high' : 'medium',
        title,
        description,
        recommendation,
        competitorData.title,
        JSON.stringify({
          our_price: ourData.price,
          competitor_price: competitorData.price,
          price_difference: ourData.price - competitorData.price,
          price_difference_percent: priceDiffPercent,
          our_rank: ourData.rank,
          competitor_rank: competitorData.rank
        }),
        Math.abs(ourData.price - competitorData.price) * 10 // Impacto estimado
      ]);

    } catch (error) {
      secureLogger.error('Erro ao gerar insight', {
        ourAsin,
        competitorAsin,
        error: error.message
      });
    }
  }

  /**
   * Busca informações básicas de um produto
   */
  async getProductInfo(asin) {
    try {
      const result = await this.db.query(`
        SELECT name as title, category FROM products WHERE asin = $1 LIMIT 1
      `, [asin]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Se não encontrar no banco, buscar da API
      const details = await this.getProductDetails(asin);
      return {
        title: details.title,
        category: 'Unknown'
      };

    } catch (error) {
      return {
        title: `Product ${asin}`,
        category: 'Unknown'
      };
    }
  }

  /**
   * Monitora todos os competidores manuais de um brand owner
   */
  async monitorAllBrandOwnerCompetitors(sellerId) {
    try {
      // Buscar todos os competidores ativos
      const competitors = await this.db.query(`
        SELECT mc.id, mc.our_asin, mc.competitor_asin, bo.brand_name
        FROM manual_competitors mc
        JOIN brand_owners bo ON mc.brand_owner_id = bo.id
        WHERE bo.seller_id = $1 AND mc.is_active = true
      `, [sellerId]);

      const results = {
        success: 0,
        errors: 0,
        insights: 0
      };

      secureLogger.info('Iniciando monitoramento de competidores manuais', {
        sellerId,
        totalCompetitors: competitors.rows.length
      });

      // Processar em lotes para melhor performance
      const batchSize = 5;
      for (let i = 0; i < competitors.rows.length; i += batchSize) {
        const batch = competitors.rows.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (competitor) => {
          try {
            const result = await this.updateCompetitorData(competitor.id);
            results.success++;
            
            if (Math.abs(result.priceDifferencePercent) > 10) {
              results.insights++;
            }
          } catch (error) {
            results.errors++;
            secureLogger.error('Erro ao monitorar competidor', {
              competitorId: competitor.id,
              error: error.message
            });
          }
        }));
        
        // Aguardar entre lotes
        if (i + batchSize < competitors.rows.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      secureLogger.info('Monitoramento de competidores concluído', results);
      return results;

    } catch (error) {
      secureLogger.error('Erro no monitoramento de competidores', {
        sellerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtém dashboard de competição para um brand owner
   */
  async getCompetitionDashboard(sellerId) {
    try {
      const result = await this.db.query(`
        SELECT * FROM brand_owner_competition_dashboard
        WHERE brand_name IN (
          SELECT brand_name FROM brand_owners WHERE seller_id = $1
        )
        ORDER BY price_difference_percent DESC
      `, [sellerId]);

      return result.rows;

    } catch (error) {
      secureLogger.error('Erro ao obter dashboard de competição', {
        sellerId,
        error: error.message
      });
      return [];
    }
  }
}

module.exports = BrandOwnerCompetitorService;