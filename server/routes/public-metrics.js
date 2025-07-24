const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Rota pública temporária para debug - REMOVER EM PRODUÇÃO
router.get('/dashboard', async (req, res) => {
  try {
    console.log('[PUBLIC] Acessando dashboard sem autenticação...');
    
    // Buscar produtos
    const productsQuery = `
      SELECT 
        p.id,
        p.marketplace,
        p.marketplace_product_id as asin,
        p.sku,
        p.name,
        p.image_url,
        p.price,
        COALESCE(SUM(oi.quantity), 0) as units,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
        COALESCE(SUM(oi.quantity * (oi.unit_price - COALESCE(oi.cost, oi.unit_price * 0.6))), 0) as profit
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      GROUP BY p.id
      ORDER BY revenue DESC
      LIMIT 20
    `;
    
    const productsResult = await pool.query(productsQuery);
    
    // Buscar métricas
    const metricsQuery = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.quantity), 0) as total_units,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_revenue,
        COALESCE(SUM(oi.quantity * (oi.unit_price - COALESCE(oi.cost, oi.unit_price * 0.6))), 0) as total_profit
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    const metricsResult = await pool.query(metricsQuery);
    const metrics = metricsResult.rows[0];
    
    // Formatar produtos
    const products = productsResult.rows.map(row => ({
      id: row.id,
      marketplace: row.marketplace,
      asin: row.asin,
      sku: row.sku,
      name: row.name,
      imageUrl: row.image_url,
      price: parseFloat(row.price || 0),
      units: parseInt(row.units || 0),
      revenue: parseFloat(row.revenue || 0),
      profit: parseFloat(row.profit || 0),
      roi: row.revenue > 0 ? ((row.profit / (row.revenue - row.profit)) * 100).toFixed(1) : '0',
      margin: row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(1) : '0'
    }));
    
    // Formatar métricas
    const formattedMetrics = {
      todaysSales: parseFloat(metrics.total_revenue || 0),
      ordersCount: parseInt(metrics.total_orders || 0),
      unitsSold: parseInt(metrics.total_units || 0),
      avgUnitsPerOrder: metrics.total_orders > 0 ? 
        (parseInt(metrics.total_units) / parseInt(metrics.total_orders)).toFixed(1) : '0',
      netProfit: parseFloat(metrics.total_profit || 0),
      profitMargin: metrics.total_revenue > 0 ? 
        ((metrics.total_profit / metrics.total_revenue) * 100).toFixed(1) : '0',
      acos: '15.0',
      yesterdayComparison: '+23',
      newOrders: 0,
      totalRevenue: parseFloat(metrics.total_revenue || 0),
      totalOrders: parseInt(metrics.total_orders || 0),
      totalUnits: parseInt(metrics.total_units || 0),
      averageOrderValue: metrics.total_orders > 0 ? 
        (parseFloat(metrics.total_revenue) / parseInt(metrics.total_orders)).toFixed(2) : '0'
    };
    
    console.log('[PUBLIC] Retornando dados:', {
      produtos: products.length,
      metricas: formattedMetrics.ordersCount
    });
    
    res.json({
      products,
      metrics: formattedMetrics,
      warning: 'Esta é uma rota pública temporária para debug. Remover em produção!'
    });
    
  } catch (error) {
    console.error('[PUBLIC] Erro:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar dados',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Rota de teste de conexão
router.get('/test-connection', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time, version() as version');
    res.json({
      status: 'connected',
      database: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Rotas públicas do Data Kiosk (TEMPORÁRIO - REMOVER EM PRODUÇÃO)
const DataKioskProcessor = require('../services/dataKiosk/dataKioskProcessor');

router.get('/data-kiosk/metrics', async (req, res) => {
  try {
    const tenantId = 1; // Tenant padrão para teste
    
    console.log('[PUBLIC Data Kiosk] Buscando métricas...');
    
    // Buscar métricas processadas do Data Kiosk
    const metrics = await DataKioskProcessor.calculateDashboardMetrics(tenantId);
    
    // Adicionar campos extras esperados pelo frontend
    const response = {
      ...metrics,
      totalRevenue: metrics.todaysSales,
      totalOrders: metrics.ordersCount,
      totalUnits: metrics.unitsSold,
      averageOrderValue: metrics.ordersCount > 0 
        ? (metrics.todaysSales / metrics.ordersCount).toFixed(2) 
        : '0',
      newOrders: Math.round(metrics.ordersCount * 0.2), // Estimativa
      warning: 'Esta é uma rota pública temporária para teste'
    };
    
    console.log('[PUBLIC Data Kiosk] Métricas retornadas:', {
      vendas: response.todaysSales,
      pedidos: response.ordersCount,
      unidades: response.unitsSold
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('[PUBLIC Data Kiosk] Erro:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar métricas', 
      details: error.message 
    });
  }
});

router.get('/data-kiosk/products', async (req, res) => {
  try {
    const userId = 1;
    const { marketplace = 'amazon' } = req.query;
    
    console.log('[PUBLIC Data Kiosk] Buscando produtos...');
    
    // Query para buscar produtos com métricas do Data Kiosk
    const query = `
      SELECT 
        p.id,
        p.marketplace,
        p.marketplace_product_id as asin,
        p.sku,
        p.name,
        p.image_url,
        p.price,
        p.buy_box_percentage,
        p.parent_asin,
        COALESCE(SUM(oi.quantity), 0) as units,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
        COALESCE(SUM(oi.quantity * (oi.unit_price - COALESCE(oi.cost, oi.unit_price * 0.6))), 0) as profit,
        COALESCE(COUNT(DISTINCT pv.session_id), 0) as sessions,
        COALESCE(SUM(pv.page_views), 0) as page_views
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN product_page_views pv ON p.id = pv.product_id
      WHERE p.user_id = $1
        AND p.marketplace = $2
      GROUP BY p.id
      HAVING SUM(oi.quantity) > 0 OR p.buy_box_percentage > 0
      ORDER BY revenue DESC
      LIMIT 20
    `;
    
    const result = await pool.query(query, [userId, marketplace]);
    
    // Formatar produtos com métricas do Data Kiosk
    const products = result.rows.map(row => ({
      id: row.id,
      marketplace: row.marketplace,
      asin: row.asin,
      parentAsin: row.parent_asin,
      sku: row.sku,
      name: row.name,
      imageUrl: row.image_url || `https://images-na.ssl-images-amazon.com/images/I/${row.asin}.jpg`,
      price: parseFloat(row.price || 0),
      units: parseInt(row.units || 0),
      revenue: parseFloat(row.revenue || 0),
      profit: parseFloat(row.profit || 0),
      roi: row.revenue > 0 ? ((row.profit / (row.revenue - row.profit)) * 100).toFixed(1) : '0',
      margin: row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(1) : '0',
      buyBoxPercentage: parseFloat(row.buy_box_percentage || 0).toFixed(1),
      pageViews: parseInt(row.page_views || 0),
      sessions: parseInt(row.sessions || 0),
      conversionRate: row.sessions > 0 ? ((row.units / row.sessions) * 100).toFixed(1) : '0',
      acos: '15.0' // Placeholder
    }));
    
    console.log('[PUBLIC Data Kiosk] Retornando', products.length, 'produtos');
    
    res.json({ 
      products,
      warning: 'Esta é uma rota pública temporária para teste'
    });
    
  } catch (error) {
    console.error('[PUBLIC Data Kiosk] Erro:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar produtos', 
      details: error.message 
    });
  }
});

router.get('/data-kiosk/status', async (req, res) => {
  try {
    const tenantId = 1;
    
    // Verificar última sincronização
    const lastSyncResult = await pool.query(`
      SELECT 
        MAX(date) as last_sync_date,
        COUNT(DISTINCT date) as days_with_data
      FROM traffic_metrics
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const productsResult = await pool.query(`
      SELECT COUNT(*) as products_with_metrics
      FROM products
      WHERE user_id = 1 AND buy_box_percentage > 0
    `, [1]);
    
    res.json({
      lastSyncDate: lastSyncResult.rows[0].last_sync_date,
      daysWithData: parseInt(lastSyncResult.rows[0].days_with_data || 0),
      productsWithMetrics: parseInt(productsResult.rows[0].products_with_metrics || 0),
      status: lastSyncResult.rows[0].last_sync_date ? 'active' : 'pending',
      warning: 'Esta é uma rota pública temporária para teste'
    });
    
  } catch (error) {
    console.error('[PUBLIC Data Kiosk] Erro:', error);
    res.status(500).json({ 
      error: 'Erro ao verificar status', 
      details: error.message 
    });
  }
});

module.exports = router;