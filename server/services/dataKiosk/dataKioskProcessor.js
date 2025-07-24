const pool = require('../../db/pool');

/**
 * Processador de dados do Amazon Data Kiosk
 * Salva os resultados no PostgreSQL
 */
class DataKioskProcessor {
  /**
   * Processar métricas diárias de vendas e tráfego
   */
  static async processDailyMetrics(data, tenantId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Extrair métricas do resultado
      const metricsData = data.data?.analytics_salesAndTraffic_2023_11_15?.salesAndTrafficByDate || [];
      
      console.log(`📊 Processando ${metricsData.length} dias de métricas...`);

      for (const dayData of metricsData) {
        // Usar as tabelas que já criamos
        await client.query(`
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
          1, // user_id padrão - ajustar para multi-tenant
          tenantId,
          'amazon',
          dayData.startDate,
          dayData.traffic?.pageViews || 0,
          dayData.traffic?.sessions || 0,
          Math.round((dayData.traffic?.pageViews || 0) * 0.7), // Estimativa browser
          Math.round((dayData.traffic?.pageViews || 0) * 0.3), // Estimativa mobile
          dayData.traffic?.buyBoxPercentage || 0,
          dayData.traffic?.unitSessionPercentage || 0,
          dayData.traffic?.feedbackReceived || 0,
          dayData.traffic?.negativeFeedbackReceived || 0
        ]);

        // Criar ou atualizar pedidos agregados para o dia
        if (dayData.sales?.totalOrderItems > 0) {
          await client.query(`
            INSERT INTO orders (
              user_id, tenant_id, marketplace, marketplace_order_id,
              status, total, order_date, items_count, is_business_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id, marketplace, marketplace_order_id) 
            DO UPDATE SET
              total = EXCLUDED.total,
              items_count = EXCLUDED.items_count,
              updated_at = NOW()
          `, [
            1, // user_id padrão
            tenantId,
            'amazon',
            `KIOSK-${dayData.startDate}`, // ID único para pedido agregado
            'completed',
            dayData.sales?.orderedProductSales?.amount || 0,
            dayData.startDate,
            dayData.sales?.totalOrderItems || 0,
            (dayData.sales?.orderedProductSalesB2B?.amount || 0) > 0
          ]);
        }
      }

      await client.query('COMMIT');
      
      console.log(`✅ ${metricsData.length} dias de métricas processados`);
      return { success: true, processed: metricsData.length };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao processar métricas diárias:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Processar métricas por ASIN
   */
  static async processAsinMetrics(data, tenantId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Extrair métricas do resultado
      const metricsData = data.data?.analytics_salesAndTraffic_2023_11_15?.salesAndTrafficByAsin || [];
      
      console.log(`📦 Processando ${metricsData.length} produtos...`);

      for (const asinData of metricsData) {
        // Verificar se o produto existe
        let productResult = await client.query(
          `SELECT id FROM products 
           WHERE (marketplace_product_id = $1 OR asin = $1 OR sku = $2) 
           AND user_id = 1`,
          [asinData.childAsin || asinData.parentAsin, asinData.sku]
        );

        let productId;
        
        if (productResult.rows.length === 0) {
          // Criar produto se não existir
          const insertResult = await client.query(`
            INSERT INTO products (
              user_id, tenant_id, marketplace, marketplace_product_id,
              asin, sku, name, parent_asin, buy_box_percentage
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `, [
            1, // user_id padrão
            tenantId,
            'amazon',
            asinData.childAsin || asinData.parentAsin,
            asinData.childAsin || asinData.parentAsin,
            asinData.sku || asinData.childAsin,
            `Produto ${asinData.childAsin || asinData.parentAsin}`,
            asinData.parentAsin,
            asinData.traffic?.buyBoxPercentage || 0
          ]);
          
          productId = insertResult.rows[0].id;
        } else {
          productId = productResult.rows[0].id;
          
          // Atualizar métricas do produto
          await client.query(`
            UPDATE products SET
              buy_box_percentage = $1,
              parent_asin = COALESCE(parent_asin, $2),
              updated_at = NOW()
            WHERE id = $3
          `, [
            asinData.traffic?.buyBoxPercentage || 0,
            asinData.parentAsin,
            productId
          ]);
        }

        // Salvar page views do produto se houver
        if (asinData.traffic?.pageViews > 0) {
          const endDate = new Date(asinData.endDate);
          
          await client.query(`
            INSERT INTO product_page_views (
              product_id, session_id, page_views, date
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (product_id, session_id, date) 
            DO UPDATE SET page_views = EXCLUDED.page_views
          `, [
            productId,
            `kiosk-${asinData.startDate}-${asinData.endDate}`,
            asinData.traffic.pageViews,
            endDate
          ]);
        }
      }

      await client.query('COMMIT');
      
      console.log(`✅ ${metricsData.length} produtos processados`);
      return { success: true, processed: metricsData.length };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao processar métricas por ASIN:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Processar resposta do dashboard AppProft
   */
  static async processAppProftDashboard(data, tenantId) {
    try {
      const results = data.data?.analytics_salesAndTraffic_2023_11_15;
      
      if (!results) {
        throw new Error('Dados inválidos recebidos do Data Kiosk');
      }

      // Processar métricas do dia
      if (results.todayMetrics?.length > 0) {
        await this.processDailyMetrics({
          data: {
            analytics_salesAndTraffic_2023_11_15: {
              salesAndTrafficByDate: results.todayMetrics
            }
          }
        }, tenantId);
      }

      // Processar últimos 30 dias
      if (results.last30Days?.length > 0) {
        await this.processDailyMetrics({
          data: {
            analytics_salesAndTraffic_2023_11_15: {
              salesAndTrafficByDate: results.last30Days
            }
          }
        }, tenantId);
      }

      return { success: true, message: 'Dashboard processado com sucesso' };
      
    } catch (error) {
      console.error('❌ Erro ao processar dashboard:', error.message);
      throw error;
    }
  }

  /**
   * Calcular métricas agregadas para o dashboard
   */
  static async calculateDashboardMetrics(tenantId, date = new Date()) {
    const client = await pool.connect();
    
    try {
      const dateStr = date.toISOString().split('T')[0];
      const yesterdayStr = new Date(date.getTime() - 24*60*60*1000).toISOString().split('T')[0];
      
      // Buscar métricas do dia
      const todayMetrics = await client.query(`
        SELECT 
          COALESCE(SUM(o.total), 0) as todays_sales,
          COALESCE(SUM(o.items_count), 0) as orders_count,
          COALESCE(SUM(oi.quantity), 0) as units_sold,
          COALESCE(AVG(tm.buy_box_percentage), 0) as buy_box_percentage,
          COALESCE(AVG(tm.unit_session_percentage), 0) as conversion_rate
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN traffic_metrics tm ON tm.date = DATE(o.order_date) AND tm.tenant_id = o.tenant_id
        WHERE o.tenant_id = $1 
          AND DATE(o.order_date) = $2
          AND o.marketplace = 'amazon'
      `, [tenantId, dateStr]);

      // Buscar métricas de ontem para comparação
      const yesterdayMetrics = await client.query(`
        SELECT COALESCE(SUM(total), 0) as yesterday_sales
        FROM orders
        WHERE tenant_id = $1 
          AND DATE(order_date) = $2
          AND marketplace = 'amazon'
      `, [tenantId, yesterdayStr]);

      const today = todayMetrics.rows[0];
      const yesterday = yesterdayMetrics.rows[0];
      
      // Calcular variação
      const yesterdayComparison = yesterday.yesterday_sales > 0 
        ? ((today.todays_sales - yesterday.yesterday_sales) / yesterday.yesterday_sales * 100).toFixed(0)
        : 0;

      return {
        todaysSales: parseFloat(today.todays_sales),
        ordersCount: parseInt(today.orders_count),
        unitsSold: parseInt(today.units_sold),
        avgUnitsPerOrder: today.orders_count > 0 
          ? (today.units_sold / today.orders_count).toFixed(1) 
          : '0',
        buyBoxPercentage: parseFloat(today.buy_box_percentage).toFixed(1),
        unitSessionPercentage: parseFloat(today.conversion_rate).toFixed(1),
        yesterdayComparison: yesterdayComparison > 0 ? `+${yesterdayComparison}` : yesterdayComparison,
        netProfit: parseFloat(today.todays_sales * 0.3).toFixed(2), // Estimativa 30%
        profitMargin: '30.0',
        acos: '15.0' // Placeholder - implementar quando tivermos dados de publicidade
      };
      
    } catch (error) {
      console.error('❌ Erro ao calcular métricas:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = DataKioskProcessor;