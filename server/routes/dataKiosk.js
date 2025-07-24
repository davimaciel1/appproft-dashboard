const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const AmazonService = require('../services/amazonService');
const DataKioskProcessor = require('../services/dataKiosk/dataKioskProcessor');

/**
 * Rota para métricas do dashboard usando Data Kiosk
 */
router.get('/metrics', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const tenantId = req.tenantId || userId;
    
    console.log('[Data Kiosk] Buscando métricas para tenant:', tenantId);
    
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
      newOrders: Math.round(metrics.ordersCount * 0.2) // Estimativa
    };
    
    console.log('[Data Kiosk] Métricas retornadas:', {
      vendas: response.todaysSales,
      pedidos: response.ordersCount,
      unidades: response.unitsSold
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('[Data Kiosk] Erro ao buscar métricas:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar métricas', 
      details: error.message 
    });
  }
});

/**
 * Rota para produtos com métricas do Data Kiosk
 */
router.get('/products', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const tenantId = req.tenantId || userId;
    const { marketplace = 'amazon', period = '30d' } = req.query;
    
    console.log('[Data Kiosk] Buscando produtos para tenant:', tenantId);
    
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
      LIMIT 100
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
    
    console.log('[Data Kiosk] Retornando', products.length, 'produtos');
    
    res.json({ products });
    
  } catch (error) {
    console.error('[Data Kiosk] Erro ao buscar produtos:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar produtos', 
      details: error.message 
    });
  }
});

/**
 * Rota para sincronizar dados do Data Kiosk
 */
router.post('/sync', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const tenantId = req.tenantId || userId;
    const { daysBack = 30 } = req.body;
    
    console.log('[Data Kiosk] Iniciando sincronização para tenant:', tenantId);
    
    // Buscar credenciais do usuário
    const credentialsResult = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
      [userId, 'amazon']
    );
    
    if (credentialsResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Credenciais Amazon não encontradas' 
      });
    }
    
    const credentials = credentialsResult.rows[0];
    
    // Criar instância do AmazonService
    const amazonService = new AmazonService({
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      refreshToken: credentials.refresh_token,
      sellerId: credentials.seller_id,
      marketplaceId: credentials.marketplace_id
    });
    
    // Executar sincronização do Data Kiosk
    const result = await amazonService.syncDataKioskMetrics(tenantId, daysBack);
    
    console.log('[Data Kiosk] Sincronização concluída:', result);
    
    res.json({
      success: true,
      message: 'Sincronização iniciada com sucesso',
      details: result
    });
    
  } catch (error) {
    console.error('[Data Kiosk] Erro na sincronização:', error);
    res.status(500).json({ 
      error: 'Erro na sincronização', 
      details: error.message 
    });
  }
});

/**
 * Rota para verificar status do Data Kiosk
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const tenantId = req.tenantId || userId;
    
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
      WHERE user_id = $1 AND buy_box_percentage > 0
    `, [userId]);
    
    res.json({
      lastSyncDate: lastSyncResult.rows[0].last_sync_date,
      daysWithData: parseInt(lastSyncResult.rows[0].days_with_data || 0),
      productsWithMetrics: parseInt(productsResult.rows[0].products_with_metrics || 0),
      status: lastSyncResult.rows[0].last_sync_date ? 'active' : 'pending'
    });
    
  } catch (error) {
    console.error('[Data Kiosk] Erro ao verificar status:', error);
    res.status(500).json({ 
      error: 'Erro ao verificar status', 
      details: error.message 
    });
  }
});

module.exports = router;