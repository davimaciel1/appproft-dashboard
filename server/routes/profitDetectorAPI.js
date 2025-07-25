const express = require('express');
const router = express.Router();
const profitDetectorService = require('../services/profitDetector');
// Authentication is handled by the main server middleware

// Get profit analyses with summary
router.get('/analyses', async (req, res) => {
  try {
    const { status, sortBy, order } = req.query;
    const result = await profitDetectorService.getProfitAnalyses({
      status,
      sortBy: sortBy || 'profit_margin',
      order: order || 'ASC'
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching profit analyses:', error);
    res.status(500).json({ error: 'Failed to fetch profit analyses' });
  }
});

// Get detailed analysis for specific product
router.get('/analyses/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const analysis = await profitDetectorService.getProductAnalysis(asin);
    res.json(analysis);
  } catch (error) {
    console.error('Error fetching product analysis:', error);
    res.status(error.message === 'Product analysis not found' ? 404 : 500)
      .json({ error: error.message });
  }
});

// Analyze specific product
router.post('/analyses/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const { productCost } = req.body;
    
    const result = await profitDetectorService.analyzeProduct(asin, productCost);
    res.json(result);
  } catch (error) {
    console.error('Error analyzing product:', error);
    res.status(500).json({ error: 'Failed to analyze product' });
  }
});

// Update product cost
router.put('/products/:asin/cost', async (req, res) => {
  try {
    const { asin } = req.params;
    const { cost } = req.body;
    
    if (!cost || cost < 0) {
      return res.status(400).json({ error: 'Valid cost is required' });
    }
    
    const result = await profitDetectorService.updateProductCost(asin, cost);
    res.json(result);
  } catch (error) {
    console.error('Error updating product cost:', error);
    res.status(500).json({ error: 'Failed to update product cost' });
  }
});

// Bulk update product costs
router.post('/products/bulk-cost', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Products array is required' });
    }
    
    const result = await profitDetectorService.bulkUpdateProductCosts(products);
    res.json(result);
  } catch (error) {
    console.error('Error bulk updating product costs:', error);
    res.status(500).json({ error: 'Failed to bulk update product costs' });
  }
});

// Get unread alerts
router.get('/alerts/unread', async (req, res) => {
  try {
    const { asin } = req.query;
    const alerts = await profitDetectorService.getUnreadAlerts(asin);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Mark alert as read
router.put('/alerts/:alertId/read', async (req, res) => {
  try {
    const { alertId } = req.params;
    await profitDetectorService.markAlertAsRead(alertId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

// Trigger manual sync
router.post('/sync', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    // Queue the sync task
    const persistentSyncManager = require('../services/persistentSyncManager');
    const profitIntegration = require('../services/profitDetector/persistentSyncIntegration');
    
    await profitIntegration.queueProfitSync(persistentSyncManager, tenantId || 'default');
    
    res.json({ 
      success: true, 
      message: 'Profit sync queued successfully' 
    });
  } catch (error) {
    console.error('Error triggering profit sync:', error);
    res.status(500).json({ error: 'Failed to trigger profit sync' });
  }
});

// Get sync status
router.get('/sync/status', async (req, res) => {
  try {
    const { executeSQL } = require('../utils/executeSQL');
    
    const result = await executeSQL(`
      SELECT 
        status,
        started_at,
        completed_at,
        last_error,
        attempt_count
      FROM sync_queue
      WHERE task_type LIKE 'profit_%'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    res.json({
      recentSyncs: result.rows,
      lastSync: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// Download CSV template for bulk cost update
router.get('/products/cost-template', (req, res) => {
  const csvContent = 'asin,sku,title,cost\n' +
    'B08N5WRWNW,SKU123,Echo Dot (4th Gen),25.50\n' +
    'B07FZ8S74R,SKU456,Echo Show 8,45.00\n';
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="product-costs-template.csv"');
  res.send(csvContent);
});

// Export profit analysis as CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { status } = req.query;
    const result = await profitDetectorService.getProfitAnalyses({ status });
    
    // Generate CSV
    let csv = 'ASIN,SKU,Title,Units Sold,Revenue,Product Cost,Total Costs,Profit,Margin %,Status,Main Issue,Action\n';
    
    result.analyses.forEach(row => {
      csv += `"${row.asin}","${row.sku || ''}","${row.title || ''}",` +
        `${row.units_sold},${row.total_revenue},${row.product_cost},` +
        `${row.total_costs},${row.gross_profit},${row.profit_margin},` +
        `"${row.profit_status}","${row.main_cost_driver}","${row.recommended_action}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="profit-analysis.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

module.exports = router;