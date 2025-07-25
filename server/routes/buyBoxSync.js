const express = require('express');
const router = express.Router();
// Usar versão simplificada que não requer AWS Role
const buyBoxService = require('../services/amazon/buyBoxServiceSimple');
const pool = require('../db/pool');

// Middleware de autenticação (se necessário)
const authenticateUser = (req, res, next) => {
  // Por enquanto, permitir acesso direto para testes
  // TODO: Implementar autenticação real
  next();
};

/**
 * GET /api/buybox/sync/scheduler
 * Retorna o status do scheduler automático
 */
router.get('/sync/scheduler', authenticateUser, async (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    const status = schedulerService.getStatus();
    
    res.json({
      status: 'success',
      data: {
        ...status,
        nextSync: new Date(Date.now() + 15 * 60 * 1000).toISOString() // Próxima sincronização em 15 min
      }
    });
  } catch (error) {
    console.error('Erro ao buscar status do scheduler:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao buscar status do scheduler'
    });
  }
});

/**
 * GET /api/buybox/sync/status
 * Retorna o status da última sincronização
 */
router.get('/sync/status', authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT asin) as total_asins,
        COUNT(*) as total_records,
        MAX(timestamp) as last_sync,
        MIN(timestamp) as first_sync
      FROM competitor_tracking_advanced
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `);

    const stats = result.rows[0];
    
    res.json({
      status: 'success',
      data: {
        totalAsins: stats.total_asins,
        totalRecords: stats.total_records,
        lastSync: stats.last_sync,
        firstSync: stats.first_sync,
        isActive: stats.last_sync && 
          new Date(stats.last_sync) > new Date(Date.now() - 60 * 60 * 1000) // última hora
      }
    });
  } catch (error) {
    console.error('Erro ao buscar status de sincronização:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao buscar status de sincronização'
    });
  }
});

/**
 * POST /api/buybox/sync/start
 * Inicia uma sincronização manual de Buy Box
 */
router.post('/sync/start', authenticateUser, async (req, res) => {
  try {
    // Verificar se já há uma sincronização em andamento
    const lockResult = await pool.query(`
      SELECT pg_try_advisory_lock(12345) as lock_acquired
    `);

    if (!lockResult.rows[0].lock_acquired) {
      return res.status(409).json({
        status: 'error',
        message: 'Já existe uma sincronização em andamento'
      });
    }

    // Iniciar sincronização em background
    res.json({
      status: 'success',
      message: 'Sincronização iniciada em background'
    });

    // Executar sincronização
    try {
      const result = await buyBoxService.syncAllBuyBoxData();
      
      // Registrar resultado da sincronização
      await pool.query(`
        INSERT INTO sync_logs (
          marketplace,
          sync_type,
          records_synced,
          status,
          details
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        'amazon',
        'buy_box',
        result.success,
        result.errors === 0 ? 'success' : 'partial',
        JSON.stringify(result)
      ]);
    } finally {
      // Liberar lock
      await pool.query('SELECT pg_advisory_unlock(12345)');
    }
  } catch (error) {
    console.error('Erro ao iniciar sincronização:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao iniciar sincronização'
    });
  }
});

/**
 * GET /api/buybox/sync/history
 * Retorna histórico de sincronizações
 */
router.get('/sync/history', authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        marketplace,
        sync_type,
        records_synced,
        status,
        details,
        created_at
      FROM sync_logs
      WHERE marketplace = 'amazon'
      AND sync_type = 'buy_box'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao buscar histórico de sincronizações'
    });
  }
});

/**
 * POST /api/buybox/sync/single/:asin
 * Sincroniza Buy Box para um único ASIN
 */
router.post('/sync/single/:asin', authenticateUser, async (req, res) => {
  try {
    const { asin } = req.params;
    
    console.log(`Sincronizando Buy Box para ASIN: ${asin}`);
    
    const buyBoxData = await buyBoxService.getBuyBoxDataForASIN(asin);
    
    if (!buyBoxData) {
      return res.status(404).json({
        status: 'error',
        message: 'Não foi possível obter dados de Buy Box para este ASIN'
      });
    }

    const saved = await buyBoxService.saveBuyBoxData(buyBoxData);
    
    if (saved) {
      res.json({
        status: 'success',
        message: 'Buy Box sincronizado com sucesso',
        data: {
          asin,
          buyBoxPrice: buyBoxData.competitivePricing?.CompetitivePrices?.[0]?.Price?.LandedPrice?.Amount,
          numberOfOffers: buyBoxData.offers?.Summary?.NumberOfOffers?.length || 0
        }
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Erro ao salvar dados de Buy Box'
      });
    }
  } catch (error) {
    console.error('Erro ao sincronizar ASIN único:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;