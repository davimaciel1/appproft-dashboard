/**
 * Worker para coleta automática de dados de competidores
 * Executa coleta de preços competitivos e tracking de Buy Box em intervalos regulares
 */

const cron = require('node-cron');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const AmazonService = require('../server/services/amazonService');
const CompetitorPricingService = require('../server/services/amazon/competitorPricingService');
const secureLogger = require('../server/utils/secureLogger');

class CompetitorDataWorker {
  constructor() {
    this.isRunning = false;
    this.amazonService = new AmazonService();
    this.competitorService = new CompetitorPricingService(this.amazonService, { 
      query: executeSQL,
      connect: () => ({ query: executeSQL })
    });
  }

  /**
   * Inicia o worker de coleta de dados competitivos
   */
  start() {
    console.log('🚀 Iniciando CompetitorDataWorker...');

    // Coleta a cada 15 minutos (respeita rate limits da Amazon)
    cron.schedule('*/15 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏳ Coleta anterior ainda em execução, pulando...');
        return;
      }

      await this.runCompetitorCollection();
    });

    // Coleta intensiva a cada hora nos horários de pico
    cron.schedule('0 9-22 * * *', async () => {
      console.log('📈 Executando coleta intensiva (horário comercial)');
      await this.runIntensiveCollection();
    });

    // Limpeza de dados antigos à meia-noite
    cron.schedule('0 0 * * *', async () => {
      await this.cleanupOldData();
    });

    console.log('✅ CompetitorDataWorker iniciado');
    console.log('⏰ Próxima coleta: a cada 15 minutos');
    console.log('🕘 Coleta intensiva: 9h às 22h a cada hora');
    console.log('🧹 Limpeza de dados: diariamente à meia-noite');
  }

  /**
   * Executa coleta regular de dados de competidores
   */
  async runCompetitorCollection() {
    this.isRunning = true;
    
    try {
      console.log('🔍 Iniciando coleta de dados de competidores...');

      // Buscar produtos ativos para monitorar
      const products = await this.getActiveProducts();
      
      if (products.length === 0) {
        console.log('⚠️ Nenhum produto ativo encontrado para monitorar');
        return;
      }

      console.log(`📦 Monitorando ${products.length} produtos`);

      let successCount = 0;
      let errorCount = 0;

      for (const product of products) {
        try {
          // Coletar dados competitivos para o produto
          const competitorData = await this.competitorService.getCompetitivePricing(
            product.marketplace_id
          );

          if (competitorData.offers.length > 0) {
            successCount++;
            
            // Log apenas se houver mudança de Buy Box
            const buyBoxWinner = competitorData.offers.find(o => o.isBuyBoxWinner);
            if (buyBoxWinner) {
              console.log(`🏆 ${product.name}: Buy Box com ${buyBoxWinner.sellerName} (R$ ${buyBoxWinner.price})`);
            }
          }

          // Aguardar para respeitar rate limits (máximo 10 req/sec)
          await this.sleep(120); // 120ms = ~8 req/sec
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Erro ao coletar dados de ${product.marketplace_id}:`, error.message);
          
          // Se for erro de rate limit, aguardar mais tempo
          if (error.message.includes('rate') || error.message.includes('429')) {
            console.log('⏳ Rate limit detectado, aguardando 30 segundos...');
            await this.sleep(30000);
          }
        }
      }

      console.log(`✅ Coleta concluída: ${successCount} sucessos, ${errorCount} erros`);

      // Gerar insights se houver dados novos
      if (successCount > 0) {
        await this.generateInsights();
      }

      // Atualizar estatísticas
      await this.updateCollectionStats(successCount, errorCount);

    } catch (error) {
      console.error('❌ Erro na coleta de competidores:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Executa coleta intensiva em horários comerciais
   */
  async runIntensiveCollection() {
    try {
      console.log('🚀 Coleta intensiva iniciada');

      // Focar nos produtos com mais movimento
      const hotProducts = await this.getHotProducts();
      
      for (const product of hotProducts) {
        await this.competitorService.getCompetitivePricing(product.marketplace_id);
        await this.sleep(100); // Coleta mais rápida para produtos quentes
      }

      console.log(`✅ Coleta intensiva concluída: ${hotProducts.length} produtos`);

    } catch (error) {
      console.error('❌ Erro na coleta intensiva:', error);
    }
  }

  /**
   * Busca produtos ativos para monitoramento
   */
  async getActiveProducts() {
    try {
      const result = await executeSQL(`
        SELECT 
          p.asin as marketplace_id,
          p.name,
          p.tenant_id,
          COUNT(ct.id) as competitor_count,
          MAX(ct.timestamp) as last_check
        FROM products p
        LEFT JOIN competitor_tracking ct ON p.asin = ct.asin
        WHERE p.marketplace = 'amazon'
        AND p.asin IS NOT NULL
        AND p.asin != ''
        GROUP BY p.asin, p.name, p.tenant_id
        ORDER BY competitor_count DESC, last_check ASC NULLS FIRST
        LIMIT 50
      `);

      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar produtos ativos:', error);
      return [];
    }
  }

  /**
   * Busca produtos com mais atividade competitiva
   */
  async getHotProducts() {
    try {
      const result = await executeSQL(`
        SELECT DISTINCT
          p.asin as marketplace_id,
          p.name,
          COUNT(ct.id) as recent_changes
        FROM products p
        JOIN competitor_tracking ct ON p.asin = ct.asin
        WHERE ct.timestamp >= NOW() - INTERVAL '2 hours'
        GROUP BY p.asin, p.name
        HAVING COUNT(ct.id) >= 3
        ORDER BY recent_changes DESC
        LIMIT 20
      `);

      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao buscar produtos quentes:', error);
      return [];
    }
  }

  /**
   * Gera insights baseado nos dados coletados
   */
  async generateInsights() {
    try {
      // Detectar mudanças recentes de Buy Box
      const recentChanges = await executeSQL(`
        SELECT * FROM get_buy_box_changes(1)
        WHERE change_time >= NOW() - INTERVAL '15 minutes'
      `);

      for (const change of recentChanges.rows) {
        await this.createBuyBoxChangeInsight(change);
      }

      // Detectar novos competidores
      const newCompetitors = await this.detectNewCompetitors();
      
      for (const competitor of newCompetitors) {
        await this.createNewCompetitorInsight(competitor);
      }

      console.log(`🧠 Gerados insights para ${recentChanges.rows.length} mudanças de Buy Box e ${newCompetitors.length} novos competidores`);

    } catch (error) {
      console.error('❌ Erro ao gerar insights:', error);
    }
  }

  /**
   * Cria insight para mudança de Buy Box
   */
  async createBuyBoxChangeInsight(change) {
    try {
      const priceChangeText = change.price_change_pct > 0 
        ? `reduziu o preço em ${change.price_change_pct}%`
        : change.price_change_pct < 0 
        ? `aumentou o preço em ${Math.abs(change.price_change_pct)}%`
        : 'manteve o preço';

      await executeSQL(`
        INSERT INTO ai_insights 
        (asin, insight_type, priority, title, description, recommendation, 
         competitor_name, competitor_action, supporting_data, confidence_score, potential_impact)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        change.asin,
        'buy_box',
        'high',
        `Buy Box perdida para ${change.new_owner}`,
        `${change.new_owner} ${priceChangeText} e assumiu a Buy Box`,
        `Considere ajustar preço para R$ ${(change.new_price * 0.99).toFixed(2)} para recuperar`,
        change.new_owner,
        'won_buy_box',
        JSON.stringify({
          previous_owner: change.previous_owner,
          new_owner: change.new_owner,
          previous_price: change.previous_price,
          new_price: change.new_price,
          price_change_pct: change.price_change_pct,
          change_time: change.change_time
        }),
        0.95,
        Math.abs(change.price_change_pct) * 10
      ]);

    } catch (error) {
      console.error('❌ Erro ao criar insight de Buy Box:', error);
    }
  }

  /**
   * Detecta novos competidores
   */
  async detectNewCompetitors() {
    try {
      const result = await executeSQL(`
        SELECT DISTINCT
          ct.asin,
          ct.seller_name,
          ct.seller_id,
          MIN(ct.timestamp) as first_seen,
          COUNT(*) as appearances,
          AVG(ct.price) as avg_price
        FROM competitor_tracking ct
        WHERE ct.timestamp >= NOW() - INTERVAL '1 day'
        AND ct.seller_id NOT IN (
          SELECT DISTINCT seller_id 
          FROM competitor_tracking 
          WHERE timestamp < NOW() - INTERVAL '1 day'
        )
        GROUP BY ct.asin, ct.seller_name, ct.seller_id
        HAVING COUNT(*) >= 3
      `);

      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao detectar novos competidores:', error);
      return [];
    }
  }

  /**
   * Cria insight para novo competidor
   */
  async createNewCompetitorInsight(competitor) {
    try {
      await executeSQL(`
        INSERT INTO ai_insights 
        (asin, insight_type, priority, title, description, recommendation, 
         competitor_name, competitor_action, supporting_data, confidence_score, potential_impact)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        competitor.asin,
        'buy_box',
        'medium',
        `Novo competidor: ${competitor.seller_name}`,
        `Detectado vendendo com preço médio de R$ ${competitor.avg_price.toFixed(2)}`,
        'Monitore estratégia de preços e avalie impacto nas vendas',
        competitor.seller_name,
        'new_competitor',
        JSON.stringify({
          seller_id: competitor.seller_id,
          first_seen: competitor.first_seen,
          appearances: competitor.appearances,
          avg_price: competitor.avg_price
        }),
        0.8,
        50
      ]);

    } catch (error) {
      console.error('❌ Erro ao criar insight de novo competidor:', error);
    }
  }

  /**
   * Atualiza estatísticas de coleta
   */
  async updateCollectionStats(successCount, errorCount) {
    try {
      await executeSQL(`
        INSERT INTO sync_logs 
        (tenant_id, marketplace, sync_type, status, records_synced, error_message, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        'system',
        'amazon',
        'competitor_pricing',
        errorCount === 0 ? 'success' : 'partial',
        successCount,
        errorCount > 0 ? `${errorCount} erros durante coleta` : null
      ]);
    } catch (error) {
      console.error('❌ Erro ao atualizar estatísticas:', error);
    }
  }

  /**
   * Limpa dados antigos para manter performance
   */
  async cleanupOldData() {
    try {
      console.log('🧹 Iniciando limpeza de dados antigos...');

      // Manter apenas 30 dias de dados de competitor_tracking
      const cleanupResult = await executeSQL(`
        DELETE FROM competitor_tracking 
        WHERE timestamp < NOW() - INTERVAL '30 days'
      `);

      // Manter apenas 90 dias de buy_box_history
      const historyCleanup = await executeSQL(`
        DELETE FROM buy_box_history 
        WHERE started_at < NOW() - INTERVAL '90 days'
      `);

      // Manter apenas insights não aplicados dos últimos 7 dias
      const insightsCleanup = await executeSQL(`
        DELETE FROM ai_insights 
        WHERE created_at < NOW() - INTERVAL '7 days' 
        AND status = 'dismissed'
      `);

      // Atualizar cache de vendedores antigos
      await executeSQL(`
        DELETE FROM sellers_cache 
        WHERE last_updated < NOW() - INTERVAL '30 days'
      `);

      console.log(`🧹 Limpeza concluída:`);
      console.log(`  - ${cleanupResult.rowCount} registros de tracking removidos`);
      console.log(`  - ${historyCleanup.rowCount} registros de histórico removidos`);
      console.log(`  - ${insightsCleanup.rowCount} insights antigos removidos`);

    } catch (error) {
      console.error('❌ Erro na limpeza de dados:', error);
    }
  }

  /**
   * Para o worker
   */
  stop() {
    console.log('🛑 Parando CompetitorDataWorker...');
    // Os cron jobs são parados automaticamente quando o processo termina
  }

  /**
   * Utilitário para aguardar
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém estatísticas do worker
   */
  async getStats() {
    try {
      const stats = await executeSQL(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(DISTINCT competitor_seller_id) as total_competitors,
          MAX(timestamp) as last_collection,
          COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '1 hour') as recent_collections
        FROM competitor_tracking ct
        JOIN products p ON ct.asin = p.asin
      `);

      const insights = await executeSQL(`
        SELECT 
          COUNT(*) as total_insights,
          COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_insights
        FROM ai_insights
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);

      return {
        collection: stats.rows[0],
        insights: insights.rows[0],
        worker_status: this.isRunning ? 'running' : 'idle'
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const worker = new CompetitorDataWorker();
  worker.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Recebido SIGINT, parando worker...');
    worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 Recebido SIGTERM, parando worker...');
    worker.stop();
    process.exit(0);
  });
}

module.exports = CompetitorDataWorker;