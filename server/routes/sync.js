const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const dataService = require('../services/dataService');

// Sincronizar dados da Amazon
router.post('/amazon', auth, async (req, res) => {
  try {
    console.log('📦 Iniciando sincronização Amazon para usuário:', req.user.id);
    
    const result = await dataService.syncAmazonData(req.user.id);
    
    res.json({
      success: true,
      message: 'Dados Amazon sincronizados com sucesso',
      data: result
    });
  } catch (error) {
    console.error('Erro ao sincronizar Amazon:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar dados da Amazon',
      error: error.message
    });
  }
});

// Sincronizar dados do Mercado Livre
router.post('/mercadolivre', auth, async (req, res) => {
  try {
    console.log('🛒 Iniciando sincronização Mercado Livre para usuário:', req.user.id);
    
    const result = await dataService.syncMercadoLivreData(req.user.id);
    
    res.json({
      success: true,
      message: 'Dados Mercado Livre sincronizados com sucesso',
      data: result
    });
  } catch (error) {
    console.error('Erro ao sincronizar Mercado Livre:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar dados do Mercado Livre',
      error: error.message
    });
  }
});

// Sincronizar todos os marketplaces
router.post('/all', auth, async (req, res) => {
  try {
    console.log('🔄 Iniciando sincronização completa para usuário:', req.user.id);
    
    const results = {
      amazon: null,
      mercadolivre: null
    };
    
    // Sincroniza em paralelo
    const [amazonResult, mlResult] = await Promise.allSettled([
      dataService.syncAmazonData(req.user.id),
      dataService.syncMercadoLivreData(req.user.id)
    ]);
    
    if (amazonResult.status === 'fulfilled') {
      results.amazon = amazonResult.value;
    } else {
      results.amazon = { error: amazonResult.reason.message };
    }
    
    if (mlResult.status === 'fulfilled') {
      results.mercadolivre = mlResult.value;
    } else {
      results.mercadolivre = { error: mlResult.reason.message };
    }
    
    res.json({
      success: true,
      message: 'Sincronização completa finalizada',
      data: results
    });
  } catch (error) {
    console.error('Erro ao sincronizar todos os marketplaces:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar marketplaces',
      error: error.message
    });
  }
});

// Obter dados do dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const dashboardData = await dataService.getDashboardData(req.user.id);
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do dashboard',
      error: error.message
    });
  }
});

module.exports = router;