const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Rota pública temporária para teste das métricas agregadas
// ATENÇÃO: Remover em produção ou adicionar autenticação adequada

router.get('/aggregated-metrics', async (req, res) => {
  try {
    const userId = 1; // User padrão para teste
    const { 
      aggregationType = 'byDate', 
      granularity = 'DAY',
      startDate,
      endDate,
      marketplace = 'amazon',
      asinLevel = 'PARENT'
    } = req.query;
    
    console.log('Public Aggregated Metrics Request:', { aggregationType, granularity, startDate, endDate, marketplace });
    
    // Calcular datas padrão se não fornecidas
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 dias atrás
    
    if (aggregationType === 'byDate') {
      // Métricas agregadas por data
      let query = `
        WITH daily_metrics AS (
          SELECT 
            DATE_TRUNC($1, o.order_date) as metric_date,
            COUNT(DISTINCT o.id) as orders_count,
            COALESCE(SUM(oi.quantity), 0) as units_ordered,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) as ordered_product_sales,
            COALESCE(SUM(CASE WHEN o.is_business_order = true THEN oi.quantity * oi.unit_price ELSE 0 END), 0) as ordered_product_sales_b2b,
            COALESCE(AVG(oi.unit_price), 0) as average_selling_price,
            COALESCE(SUM(oi.quantity) / NULLIF(COUNT(DISTINCT o.id), 0), 0) as average_units_per_order,
            COUNT(DISTINCT oi.id) as total_order_items,
            COALESCE(SUM(CASE WHEN oi.is_refunded = true THEN oi.quantity ELSE 0 END), 0) as units_refunded,
            COALESCE(SUM(CASE WHEN o.status = 'shipped' THEN oi.quantity ELSE 0 END), 0) as units_shipped
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.user_id = $2
            AND o.marketplace = $3
            AND o.order_date >= $4
            AND o.order_date <= $5
          GROUP BY metric_date
        ),
        traffic_metrics AS (
          SELECT 
            DATE_TRUNC($1, tm.date) as metric_date,
            COALESCE(SUM(tm.page_views), 0) as page_views,
            COALESCE(SUM(tm.sessions), 0) as sessions,
            COALESCE(SUM(tm.browser_page_views), 0) as browser_page_views,
            COALESCE(SUM(tm.mobile_app_page_views), 0) as mobile_app_page_views,
            COALESCE(AVG(tm.buy_box_percentage), 0) as buy_box_percentage,
            COALESCE(AVG(tm.unit_session_percentage), 0) as unit_session_percentage,
            COALESCE(SUM(tm.feedback_received), 0) as feedback_received,
            COALESCE(SUM(tm.negative_feedback_received), 0) as negative_feedback_received
          FROM traffic_metrics tm
          WHERE tm.user_id = $2
            AND tm.marketplace = $3
            AND tm.date >= $4
            AND tm.date <= $5
          GROUP BY metric_date
        )
        SELECT 
          dm.metric_date as date,
          dm.orders_count,
          dm.units_ordered,
          dm.ordered_product_sales,
          dm.ordered_product_sales_b2b,
          dm.average_selling_price,
          dm.average_units_per_order,
          dm.total_order_items,
          dm.units_refunded,
          dm.units_shipped,
          CASE WHEN dm.units_ordered > 0 
            THEN (dm.units_refunded::decimal / dm.units_ordered * 100) 
            ELSE 0 
          END as refund_rate,
          COALESCE(tm.page_views, 0) as page_views,
          COALESCE(tm.sessions, 0) as sessions,
          COALESCE(tm.browser_page_views, 0) as browser_page_views,
          COALESCE(tm.mobile_app_page_views, 0) as mobile_app_page_views,
          COALESCE(tm.buy_box_percentage, 0) as buy_box_percentage,
          COALESCE(tm.unit_session_percentage, 0) as unit_session_percentage,
          COALESCE(tm.feedback_received, 0) as feedback_received,
          COALESCE(tm.negative_feedback_received, 0) as negative_feedback_received
        FROM daily_metrics dm
        LEFT JOIN traffic_metrics tm ON dm.metric_date = tm.metric_date
        ORDER BY dm.metric_date DESC
      `;
      
      const result = await pool.query(query, [granularity.toLowerCase(), userId, marketplace, start, end]);
      
      const formattedData = result.rows.map(row => ({
        date: row.date,
        sales: {
          orderedProductSales: {
            amount: parseFloat(row.ordered_product_sales),
            currencyCode: 'BRL'
          },
          orderedProductSalesB2B: {
            amount: parseFloat(row.ordered_product_sales_b2b),
            currencyCode: 'BRL'
          },
          averageSalesPerOrderItem: parseFloat(row.average_selling_price),
          averageSellingPrice: parseFloat(row.average_selling_price),
          unitsOrdered: parseInt(row.units_ordered),
          totalOrderItems: parseInt(row.total_order_items),
          unitsRefunded: parseInt(row.units_refunded),
          unitsShipped: parseInt(row.units_shipped),
          refundRate: parseFloat(row.refund_rate)
        },
        traffic: {
          pageViews: parseInt(row.page_views),
          sessions: parseInt(row.sessions),
          browserPageViews: parseInt(row.browser_page_views),
          mobileAppPageViews: parseInt(row.mobile_app_page_views),
          buyBoxPercentage: parseFloat(row.buy_box_percentage),
          unitSessionPercentage: parseFloat(row.unit_session_percentage),
          feedbackReceived: parseInt(row.feedback_received),
          negativeFeedbackReceived: parseInt(row.negative_feedback_received)
        }
      }));
      
      res.json({
        salesAndTrafficByDate: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          marketplaceId: marketplace === 'amazon' ? 'A2Q3Y263D00KWC' : 'MLB',
          granularity,
          data: formattedData
        }
      });
      
    } else if (aggregationType === 'byAsin') {
      // Métricas agregadas por ASIN/Produto
      let query = `
        SELECT 
          p.marketplace_product_id as asin,
          p.parent_asin,
          p.sku,
          p.name,
          COALESCE(SUM(oi.quantity), 0) as units_ordered,
          COALESCE(SUM(oi.quantity * oi.unit_price), 0) as ordered_product_sales,
          COALESCE(COUNT(DISTINCT pv.session_id), 0) as sessions,
          COALESCE(SUM(pv.page_views), 0) as page_views,
          COALESCE(AVG(p.buy_box_percentage), 0) as buy_box_percentage,
          CASE WHEN COUNT(DISTINCT pv.session_id) > 0 
            THEN (SUM(oi.quantity)::decimal / COUNT(DISTINCT pv.session_id) * 100) 
            ELSE 0 
          END as unit_session_percentage
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id
        LEFT JOIN product_page_views pv ON p.id = pv.product_id
        WHERE p.user_id = $1
          AND p.marketplace = $2
          AND (o.order_date >= $3 OR o.order_date IS NULL)
          AND (o.order_date <= $4 OR o.order_date IS NULL)
      `;
      
      // Filtrar por nível de ASIN se especificado
      if (asinLevel === 'PARENT') {
        query += ' AND p.parent_asin IS NOT NULL';
      } else if (asinLevel === 'CHILD') {
        query += ' AND p.parent_asin IS NULL';
      }
      
      query += `
        GROUP BY p.id, p.marketplace_product_id, p.parent_asin, p.sku, p.name
        HAVING SUM(oi.quantity) > 0
        ORDER BY ordered_product_sales DESC
        LIMIT 100
      `;
      
      const result = await pool.query(query, [userId, marketplace, start, end]);
      
      const formattedData = result.rows.map(row => ({
        parentAsin: row.parent_asin || row.asin,
        childAsin: row.asin,
        sku: row.sku,
        productName: row.name,
        sales: {
          orderedProductSales: {
            amount: parseFloat(row.ordered_product_sales),
            currencyCode: 'BRL'
          },
          unitsOrdered: parseInt(row.units_ordered)
        },
        traffic: {
          pageViews: parseInt(row.page_views),
          sessions: parseInt(row.sessions),
          buyBoxPercentage: parseFloat(row.buy_box_percentage),
          unitSessionPercentage: parseFloat(row.unit_session_percentage)
        }
      }));
      
      res.json({
        salesAndTrafficByAsin: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          marketplaceId: marketplace === 'amazon' ? 'A2Q3Y263D00KWC' : 'MLB',
          asinLevel,
          data: formattedData
        }
      });
    }
    
  } catch (error) {
    console.error('Error fetching aggregated metrics:', error);
    res.status(500).json({ error: 'Error fetching aggregated metrics', details: error.message });
  }
});

module.exports = router;