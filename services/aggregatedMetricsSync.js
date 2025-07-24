const { Pool } = require('pg');
const AmazonGraphQLService = require('./amazonGraphQLService');
require('dotenv').config();

/**
 * Serviço de Sincronização de Métricas Agregadas
 * Sincroniza dados reais da Amazon SP-API para o PostgreSQL
 */
class AggregatedMetricsSync {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    this.amazonService = new AmazonGraphQLService();
    this.userId = 1; // Default user - em produção, usar multi-tenant
  }

  /**
   * Sincronizar métricas por data
   */
  async syncSalesAndTrafficByDate(startDate, endDate, granularity = 'DAY') {
    try {
      console.log('\n🔄 Sincronizando métricas agregadas por data...');
      
      // Buscar dados da Amazon
      const metricsData = await this.amazonService.getSalesAndTrafficByDate(
        startDate, 
        endDate, 
        granularity
      );

      let savedCount = 0;
      
      for (const dayData of metricsData) {
        const { date, sales, traffic } = dayData;
        
        // Salvar métricas de tráfego
        if (traffic) {
          await this.pool.query(`
            INSERT INTO traffic_metrics (
              user_id, tenant_id, marketplace, date,
              page_views, sessions, browser_page_views, mobile_app_page_views,
              buy_box_percentage, unit_session_percentage,
              feedback_received, negative_feedback_received
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (user_id, marketplace, date) 
            DO UPDATE SET
              page_views = EXCLUDED.page_views,
              sessions = EXCLUDED.sessions,
              browser_page_views = EXCLUDED.browser_page_views,
              mobile_app_page_views = EXCLUDED.mobile_app_page_views,
              buy_box_percentage = EXCLUDED.buy_box_percentage,
              unit_session_percentage = EXCLUDED.unit_session_percentage,
              feedback_received = EXCLUDED.feedback_received,
              negative_feedback_received = EXCLUDED.negative_feedback_received,
              updated_at = NOW()
          `, [
            this.userId,
            this.userId,
            'amazon',
            date,
            traffic.pageViews || 0,
            traffic.sessions || 0,
            traffic.browserPageViews || 0,
            traffic.mobileAppPageViews || 0,
            traffic.buyBoxPercentage || 0,
            traffic.unitSessionPercentage || 0,
            traffic.feedbackReceived || 0,
            traffic.negativeFeedbackReceived || 0
          ]);
        }

        // Salvar ou atualizar métricas de vendas nas orders existentes
        if (sales && sales.orderedProductSales) {
          // Atualizar totais de vendas para o dia
          await this.pool.query(`
            UPDATE orders 
            SET 
              total = $1,
              is_business_order = CASE 
                WHEN $2 > 0 THEN true 
                ELSE is_business_order 
              END
            WHERE user_id = $3 
              AND marketplace = 'amazon' 
              AND DATE(order_date) = $4
          `, [
            sales.orderedProductSales.amount || 0,
            sales.orderedProductSalesB2B?.amount || 0,
            this.userId,
            date
          ]);

          // Se não houver pedidos para o dia, criar um registro agregado
          const checkOrders = await this.pool.query(
            'SELECT COUNT(*) FROM orders WHERE user_id = $1 AND marketplace = $2 AND DATE(order_date) = $3',
            [this.userId, 'amazon', date]
          );

          if (checkOrders.rows[0].count === '0' && sales.totalOrderItems > 0) {
            await this.pool.query(`
              INSERT INTO orders (
                user_id, tenant_id, marketplace, marketplace_order_id,
                status, total, order_date, items_count
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              this.userId,
              this.userId,
              'amazon',
              `AGGREGATED-${date}`,
              'completed',
              sales.orderedProductSales.amount || 0,
              date,
              sales.totalOrderItems || 0
            ]);
          }
        }

        savedCount++;
      }

      console.log(`✅ ${savedCount} dias de métricas sincronizadas`);
      return { success: true, recordsProcessed: savedCount };

    } catch (error) {
      console.error('❌ Erro na sincronização por data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sincronizar métricas por ASIN
   */
  async syncSalesAndTrafficByAsin(startDate, endDate, asinGranularity = 'PARENT') {
    try {
      console.log('\n🔄 Sincronizando métricas agregadas por ASIN...');
      
      // Buscar dados da Amazon
      const metricsData = await this.amazonService.getSalesAndTrafficByAsin(
        startDate, 
        endDate, 
        asinGranularity
      );

      let savedCount = 0;
      
      for (const productData of metricsData) {
        const { asin, sales, traffic } = productData;
        
        // Verificar se o produto existe
        let product = await this.pool.query(
          'SELECT id FROM products WHERE marketplace_product_id = $1 OR asin = $1',
          [asin]
        );

        // Se não existir, criar o produto
        if (product.rows.length === 0) {
          const insertResult = await this.pool.query(`
            INSERT INTO products (
              user_id, tenant_id, marketplace, marketplace_product_id,
              asin, sku, name, parent_asin
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [
            this.userId,
            this.userId,
            'amazon',
            asin,
            asin,
            sales?.sku || asin,
            `Product ${asin}`, // Nome será atualizado em outra sincronização
            sales?.parentAsin || null
          ]);
          
          product = { rows: [{ id: insertResult.rows[0].id }] };
        }

        const productId = product.rows[0].id;

        // Atualizar métricas do produto
        if (traffic) {
          await this.pool.query(`
            UPDATE products 
            SET 
              buy_box_percentage = $1,
              updated_at = NOW()
            WHERE id = $2
          `, [
            traffic.buyBoxPercentage || 0,
            productId
          ]);

          // Salvar page views do produto
          if (traffic.pageViews > 0) {
            await this.pool.query(`
              INSERT INTO product_page_views (
                product_id, session_id, page_views, date
              ) VALUES ($1, $2, $3, $4)
              ON CONFLICT (product_id, session_id, date) 
              DO UPDATE SET page_views = EXCLUDED.page_views
            `, [
              productId,
              `aggregated-${startDate}-${endDate}`,
              traffic.pageViews,
              endDate
            ]);
          }
        }

        savedCount++;
      }

      console.log(`✅ ${savedCount} produtos sincronizados`);
      return { success: true, recordsProcessed: savedCount };

    } catch (error) {
      console.error('❌ Erro na sincronização por ASIN:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sincronização completa
   */
  async syncAll(daysBack = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`\n🚀 Iniciando sincronização completa`);
    console.log(`📅 Período: ${startDateStr} até ${endDateStr}`);

    // Testar conexão primeiro
    const isConnected = await this.amazonService.testConnection();
    if (!isConnected) {
      console.error('❌ Não foi possível conectar à Amazon SP-API');
      return;
    }

    // Sincronizar métricas por data
    const dateResults = await this.syncSalesAndTrafficByDate(
      startDateStr,
      endDateStr,
      'DAY'
    );

    // Sincronizar métricas por ASIN
    const asinResults = await this.syncSalesAndTrafficByAsin(
      startDateStr,
      endDateStr,
      'PARENT'
    );

    console.log('\n✨ Sincronização completa!');
    console.log(`📊 Métricas por data: ${dateResults.recordsProcessed || 0} registros`);
    console.log(`📦 Métricas por produto: ${asinResults.recordsProcessed || 0} registros`);

    return {
      dateMetrics: dateResults,
      productMetrics: asinResults
    };
  }

  /**
   * Fechar conexões
   */
  async close() {
    await this.pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const sync = new AggregatedMetricsSync();
  
  const args = process.argv.slice(2);
  const daysBack = args.includes('--full') ? 90 : 30;

  sync.syncAll(daysBack)
    .then(() => {
      console.log('\n📊 URLs para visualizar os dados em produção:');
      console.log('https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byDate');
      console.log('https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byAsin');
    })
    .catch(console.error)
    .finally(() => sync.close());
}

module.exports = AggregatedMetricsSync;