const express = require('express');
const router = express.Router();
const secureLogger = require('../../utils/secureLogger');

// POST /api/sync/trigger - Disparar sincronização manual
router.post('/', async (req, res) => {
  try {
    const tenantId = req.userId;
    const { force = false, marketplace = 'all' } = req.body;

    secureLogger.log('Sincronização manual solicitada', { 
      tenantId, 
      force, 
      marketplace 
    });

    // Importar worker (lazy loading para evitar circular dependency)
    const MainSyncWorker = require('../../../workers/mainSyncWorker');
    
    // Trigger sincronização em background
    MainSyncWorker.triggerSync(tenantId).then(() => {
      secureLogger.log('Sincronização manual concluída', { tenantId });
    }).catch(error => {
      secureLogger.error('Erro na sincronização manual', { 
        tenantId, 
        error: error.message 
      });
    });

    res.json({ 
      status: 'syncing',
      message: 'Sincronização iniciada em background',
      tenantId,
      startedAt: new Date()
    });

  } catch (error) {
    secureLogger.error('Erro ao disparar sincronização', {
      tenantId: req.userId,
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Erro ao iniciar sincronização',
      message: error.message
    });
  }
});

// GET /api/sync/status - Status da sincronização
router.get('/status', async (req, res) => {
  try {
    const tenantId = req.userId;
    const pool = require('../../db/pool');

    // Buscar logs recentes de sincronização
    const logsResult = await pool.query(`
      SELECT 
        marketplace,
        sync_type,
        status,
        records_synced,
        error_message,
        started_at,
        completed_at,
        EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
      FROM sync_logs
      WHERE tenant_id = $1
      ORDER BY started_at DESC
      LIMIT 10
    `, [tenantId]);

    // Status geral dos produtos
    const productsResult = await pool.query(`
      SELECT 
        marketplace,
        COUNT(*) as total_products,
        COUNT(CASE WHEN total_units_sold > 0 THEN 1 END) as products_with_sales,
        SUM(total_units_sold) as total_units,
        SUM(total_revenue) as total_revenue,
        MAX(synced_at) as last_sync
      FROM dashboard_products
      WHERE tenant_id = $1
      GROUP BY marketplace
    `, [tenantId]);

    // Status do worker
    const MainSyncWorker = require('../../../workers/mainSyncWorker');
    const workerStatus = MainSyncWorker.getStatus();

    res.json({
      workerStatus,
      recentLogs: logsResult.rows,
      productStats: productsResult.rows,
      lastUpdate: new Date()
    });

  } catch (error) {
    secureLogger.error('Erro ao buscar status de sincronização', {
      tenantId: req.userId,
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Erro ao buscar status',
      message: error.message
    });
  }
});

module.exports = router;