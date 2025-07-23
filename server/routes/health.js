const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const secureLogger = require('../utils/secureLogger');

/**
 * Health check endpoint
 * Verifica se o sistema está funcionando corretamente
 */
router.get('/', async (req, res) => {
  const checks = {
    server: 'ok',
    database: 'checking',
    timestamp: new Date().toISOString()
  };
  
  try {
    // Verifica conexão com banco
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    checks.database = 'ok';
    
    res.status(200).json({
      status: 'healthy',
      checks
    });
    
  } catch (error) {
    checks.database = 'error';
    
    secureLogger.error('Health check falhou', {
      error: error.message,
      checks
    });
    
    res.status(503).json({
      status: 'unhealthy',
      checks
    });
  }
});

module.exports = router;