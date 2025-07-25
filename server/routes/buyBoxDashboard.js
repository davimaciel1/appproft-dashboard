/**
 * Rotas para o Dashboard de Buy Box
 * Endpoints para visualização e monitoramento de competidores
 */

const express = require('express');
const router = express.Router();
const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');
const secureLogger = require('../utils/secureLogger');

/**
 * GET /api/buybox/status
 * Retorna status atual da Buy Box para todos os produtos
 */
router.get('/status', async (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 'default';
    
    // Status atual da Buy Box por produto
    const buyBoxStatus = await executeSQL(`
      WITH latest_tracking AS (
        SELECT DISTINCT ON (ct.asin) 
          ct.asin,
          ct.seller_name,
          ct.price,
          ct.is_buy_box_winner,
          ct.is_fba,
          ct.feedback_rating,
          ct.timestamp,
          p.name as product_name,
          p.price as our_price
        FROM competitor_tracking ct
        JOIN products p ON ct.asin = p.asin
        WHERE ct.is_buy_box_winner = true
        ORDER BY ct.asin, ct.timestamp DESC
        LIMIT 50
      )
      SELECT 
        lt.asin,
        lt.product_name,
        lt.seller_name as buy_box_owner,
        lt.price as buy_box_price,
        lt.our_price,
        lt.is_fba,
        lt.feedback_rating,
        lt.timestamp as last_updated,
        CASE 
          WHEN lt.seller_name ILIKE '%nossa%' OR lt.seller_name ILIKE '%vendedor principal%'
          THEN true 
          ELSE false 
        END as we_have_buybox,
        CASE 
          WHEN lt.our_price IS NOT NULL AND lt.our_price > 0
          THEN ROUND(((lt.our_price - lt.price) / lt.our_price * 100), 2)
          ELSE 0 
        END as price_difference_pct,
        CASE 
          WHEN lt.our_price IS NOT NULL AND lt.our_price > lt.price
          THEN ROUND(lt.price * 0.99, 2)
          ELSE lt.price
        END as suggested_price
      FROM latest_tracking lt
      ORDER BY lt.timestamp DESC
    `);

    // Estatísticas resumidas
    const summary = await executeSQL(`
      WITH buy_box_summary AS (
        SELECT 
          COUNT(DISTINCT ct.asin) as total_products,
          COUNT(DISTINCT ct.asin) FILTER (
            WHERE ct.seller_name ILIKE '%nossa%' OR ct.seller_name ILIKE '%vendedor principal%'
          ) as products_with_buybox,
          COUNT(DISTINCT ct.competitor_seller_id) as active_competitors,
          COUNT(*) FILTER (WHERE ct.timestamp >= NOW() - INTERVAL '1 day') as daily_changes
        FROM competitor_tracking ct
        WHERE ct.is_buy_box_winner = true
        AND ct.timestamp >= NOW() - INTERVAL '30 days'
      )
      SELECT 
        total_products,
        products_with_buybox,
        CASE 
          WHEN total_products > 0 
          THEN ROUND((products_with_buybox::DECIMAL / total_products * 100), 1)
          ELSE 0 
        END as buybox_percentage,
        active_competitors,
        daily_changes
      FROM buy_box_summary
    `);

    // Mudanças recentes (últimas 2 horas)
    const recentChanges = await executeSQL(`
      SELECT * FROM get_buy_box_changes(2)
      ORDER BY change_time DESC
      LIMIT 10
    `);

    res.json({
      status: 'success',
      data: {
        products: buyBoxStatus.rows,
        summary: summary.rows[0] || {
          total_products: 0,
          products_with_buybox: 0,
          buybox_percentage: 0,
          active_competitors: 0,
          daily_changes: 0
        },
        recent_changes: recentChanges.rows,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    secureLogger.error('Erro ao buscar status da Buy Box', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/buybox/competitors
 * Retorna ranking dos competidores mais ativos
 */
router.get('/competitors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const days = parseInt(req.query.days) || 30;

    const competitors = await executeSQL(`
      SELECT 
        ct.seller_name,
        COUNT(DISTINCT ct.asin) as products_competing,
        COUNT(*) FILTER (WHERE ct.is_buy_box_winner = true) as buybox_wins,
        ROUND(AVG(ct.price), 2) as avg_price,
        ROUND(AVG(ct.feedback_rating), 1) as avg_rating,
        MAX(ct.timestamp) as last_seen,
        COUNT(*) FILTER (WHERE ct.is_fba = true) as fba_offers,
        COUNT(*) as total_offers,
        ROUND(
          COUNT(*) FILTER (WHERE ct.is_buy_box_winner = true)::DECIMAL / 
          NULLIF(COUNT(*), 0) * 100, 
          1
        ) as buybox_win_rate
      FROM competitor_tracking ct
      WHERE ct.timestamp >= NOW() - INTERVAL '${days} days'
      AND ct.seller_name IS NOT NULL
      GROUP BY ct.seller_name
      HAVING COUNT(DISTINCT ct.asin) >= 2
      ORDER BY buybox_wins DESC, products_competing DESC
      LIMIT ${limit}
    `);

    res.json({
      status: 'success',
      data: {
        competitors: competitors.rows,
        period_days: days,
        total_found: competitors.rows.length
      }
    });

  } catch (error) {
    secureLogger.error('Erro ao buscar competidores', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/buybox/history/:asin
 * Retorna histórico de Buy Box para um produto específico
 */
router.get('/history/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const hours = parseInt(req.query.hours) || 48;

    // Validar ASIN
    if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
      return res.status(400).json({
        status: 'error',
        message: 'ASIN inválido'
      });
    }

    const history = await executeSQL(`
      SELECT 
        ct.timestamp,
        ct.seller_name,
        ct.price,
        ct.is_fba,
        ct.feedback_rating,
        ct.feedback_count,
        p.name as product_name
      FROM competitor_tracking ct
      LEFT JOIN products p ON ct.asin = p.asin
      WHERE ct.asin = $1
      AND ct.is_buy_box_winner = true
      AND ct.timestamp >= NOW() - INTERVAL '${hours} hours'
      ORDER BY ct.timestamp DESC
      LIMIT 100
    `, [asin]);

    // Estatísticas do produto
    const productStats = await executeSQL(`
      SELECT 
        COUNT(DISTINCT seller_name) as total_competitors,
        ROUND(AVG(price), 2) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(*) as total_buy_box_changes
      FROM competitor_tracking
      WHERE asin = $1
      AND is_buy_box_winner = true
      AND timestamp >= NOW() - INTERVAL '${hours} hours'
    `, [asin]);

    res.json({
      status: 'success',
      data: {
        asin,
        product_stats: productStats.rows[0],
        history: history.rows,
        period_hours: hours
      }
    });

  } catch (error) {
    secureLogger.error('Erro ao buscar histórico de Buy Box', { 
      asin: req.params.asin,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/buybox/insights
 * Retorna insights gerados pela IA sobre Buy Box
 */
router.get('/insights', async (req, res) => {
  try {
    const priority = req.query.priority; // 'high', 'medium', 'low'
    const status = req.query.status || 'pending'; // 'pending', 'applied', 'dismissed'
    const limit = parseInt(req.query.limit) || 50;

    let whereClause = `WHERE ai.insight_type IN ('buy_box', 'pricing')`;
    
    if (priority) {
      whereClause += ` AND ai.priority = '${priority}'`;
    }
    
    if (status) {
      whereClause += ` AND ai.status = '${status}'`;
    }

    const insights = await executeSQL(`
      SELECT 
        ai.id,
        ai.asin,
        ai.insight_type,
        ai.priority,
        ai.title,
        ai.description,
        ai.recommendation,
        ai.competitor_name,
        ai.competitor_action,
        ai.supporting_data,
        ai.confidence_score,
        ai.potential_impact,
        ai.status,
        ai.created_at,
        p.name as product_name
      FROM ai_insights ai
      LEFT JOIN products p ON ai.asin = p.asin
      ${whereClause}
      ORDER BY 
        CASE ai.priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END,
        ai.created_at DESC
      LIMIT ${limit}
    `);

    // Contar insights por prioridade
    const insightCounts = await executeSQL(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM ai_insights
      WHERE insight_type IN ('buy_box', 'pricing')
      AND status = 'pending'
      AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY priority
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END
    `);

    res.json({
      status: 'success',
      data: {
        insights: insights.rows,
        counts: insightCounts.rows,
        filters: { priority, status, limit }
      }
    });

  } catch (error) {
    secureLogger.error('Erro ao buscar insights', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/buybox/query
 * Executa queries personalizadas para o dashboard
 */
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: 'Query SQL é obrigatória'
      });
    }

    // Sanitizar query - remover comandos perigosos
    const dangerousCommands = ['DROP', 'DELETE', 'TRUNCATE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE'];
    const upperQuery = query.toUpperCase();
    
    for (const cmd of dangerousCommands) {
      if (upperQuery.includes(cmd)) {
        return res.status(403).json({
          status: 'error',
          message: `Comando SQL não permitido: ${cmd}`
        });
      }
    }

    // Executar query
    const result = await executeSQL(query);
    
    res.json({
      status: 'success',
      data: {
        rows: result.rows,
        rowCount: result.rowCount
      }
    });
  } catch (error) {
    secureLogger.error('Erro ao executar query personalizada', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: error.message || 'Erro ao executar consulta'
    });
  }
});

/**
 * GET /api/buybox/summary
 * Retorna resumo consolidado do Buy Box
 */
router.get('/summary', async (req, res) => {
  try {
    const summaryQuery = `
      WITH summary_data AS (
        SELECT 
          COUNT(DISTINCT p.asin) as total_products,
          COUNT(DISTINCT CASE WHEN bs.buy_box_owner = 'Sua Loja' THEN p.asin END) as won_count,
          COUNT(DISTINCT ct.seller_name) as active_competitors
        FROM products p
        LEFT JOIN buy_box_status bs ON p.asin = bs.asin
        LEFT JOIN competitor_tracking ct ON p.asin = ct.asin 
          AND ct.timestamp >= NOW() - INTERVAL '24 hours'
        WHERE p.active = true
      ),
      changes_today AS (
        SELECT COUNT(*) as changes_count
        FROM (
          SELECT 
            asin,
            seller_name,
            LAG(seller_name) OVER (PARTITION BY asin ORDER BY timestamp) as previous_owner
          FROM competitor_tracking
          WHERE is_buy_box_winner = true
          AND timestamp >= CURRENT_DATE
        ) sub
        WHERE seller_name != previous_owner
        AND previous_owner IS NOT NULL
      )
      SELECT 
        sd.total_products,
        sd.won_count,
        CASE 
          WHEN sd.total_products > 0 
          THEN ROUND((sd.won_count::numeric / sd.total_products * 100), 1)
          ELSE 0 
        END as buy_box_percentage,
        sd.active_competitors,
        ct.changes_count as changes_today
      FROM summary_data sd
      CROSS JOIN changes_today ct
    `;

    const result = await executeSQL(summaryQuery);
    
    res.json({
      status: 'success',
      data: result.rows[0] || {
        total_products: 0,
        won_count: 0,
        buy_box_percentage: 0,
        active_competitors: 0,
        changes_today: 0
      }
    });
  } catch (error) {
    secureLogger.error('Erro ao obter resumo do Buy Box', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Erro ao obter resumo do Buy Box'
    });
  }
});

/**
 * POST /api/buybox/insights/:id/apply
 * Marca um insight como aplicado
 */
router.post('/insights/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await executeSQL(`
      UPDATE ai_insights 
      SET 
        status = 'applied',
        applied_at = NOW(),
        supporting_data = COALESCE(supporting_data, '{}') || $2
      WHERE id = $1
      RETURNING *
    `, [id, JSON.stringify({ application_notes: notes || 'Aplicado via dashboard' })]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Insight não encontrado'
      });
    }

    res.json({
      status: 'success',
      data: {
        insight: result.rows[0],
        message: 'Insight marcado como aplicado'
      }
    });

  } catch (error) {
    secureLogger.error('Erro ao aplicar insight', { 
      insightId: req.params.id,
      error: error.message 
    });
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/buybox/analytics
 * Retorna analytics consolidados de Buy Box
 */
router.get('/analytics', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    // Performance por dia
    const dailyPerformance = await executeSQL(`
      SELECT 
        DATE(ct.timestamp) as date,
        COUNT(DISTINCT ct.asin) as products_tracked,
        COUNT(*) FILTER (
          WHERE ct.seller_name ILIKE '%nossa%' OR ct.seller_name ILIKE '%vendedor principal%'
        ) as our_buybox_wins,
        COUNT(*) as total_buybox_wins,
        ROUND(
          COUNT(*) FILTER (
            WHERE ct.seller_name ILIKE '%nossa%' OR ct.seller_name ILIKE '%vendedor principal%'
          )::DECIMAL / NULLIF(COUNT(*), 0) * 100,
          1
        ) as our_win_rate
      FROM competitor_tracking ct
      WHERE ct.is_buy_box_winner = true
      AND ct.timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(ct.timestamp)
      ORDER BY date DESC
    `);

    // Competidores mais agressivos
    const topThreats = await executeSQL(`
      SELECT 
        ct.seller_name,
        COUNT(DISTINCT ct.asin) as products_attacked,
        COUNT(*) as buybox_wins,
        ROUND(AVG(ct.price), 2) as avg_winning_price,
        MAX(ct.timestamp) as last_win
      FROM competitor_tracking ct
      WHERE ct.is_buy_box_winner = true
      AND ct.timestamp >= NOW() - INTERVAL '${days} days'
      AND NOT (ct.seller_name ILIKE '%nossa%' OR ct.seller_name ILIKE '%vendedor principal%')
      GROUP BY ct.seller_name
      HAVING COUNT(*) >= 3
      ORDER BY buybox_wins DESC
      LIMIT 10
    `);

    // Produtos mais disputados
    const contestedProducts = await executeSQL(`
      SELECT 
        ct.asin,
        p.name as product_name,
        COUNT(DISTINCT ct.seller_name) as competitors,
        COUNT(*) as buybox_changes,
        ROUND(AVG(ct.price), 2) as avg_buybox_price,
        MAX(ct.timestamp) as last_change
      FROM competitor_tracking ct
      LEFT JOIN products p ON ct.asin = p.asin
      WHERE ct.is_buy_box_winner = true
      AND ct.timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY ct.asin, p.name
      HAVING COUNT(DISTINCT ct.seller_name) >= 3
      ORDER BY buybox_changes DESC
      LIMIT 10
    `);

    res.json({
      status: 'success',
      data: {
        daily_performance: dailyPerformance.rows,
        top_threats: topThreats.rows,
        contested_products: contestedProducts.rows,
        period_days: days
      }
    });

  } catch (error) {
    secureLogger.error('Erro ao buscar analytics', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;