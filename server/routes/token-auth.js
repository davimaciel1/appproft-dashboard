const express = require('express');
const router = express.Router();
const tokenManager = require('../services/tokenManager');

// Obter URL de autorização do Mercado Livre
router.get('/mercadolivre/auth-url', (req, res) => {
  try {
    const authUrl = tokenManager.getMercadoLivreAuthUrl();
    res.json({ 
      success: true, 
      authUrl,
      message: 'Acesse esta URL para autorizar o aplicativo no Mercado Livre'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Callback de autorização do Mercado Livre
router.get('/ml-callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Código de autorização não fornecido' 
      });
    }

    const tokens = await tokenManager.processMercadoLivreCallback(code);
    
    res.json({
      success: true,
      message: 'Autorização concluída com sucesso!',
      tokens: {
        expires_at: tokens.expires_at,
        // Não retornar tokens sensíveis no response
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Renovar token do Mercado Livre manualmente
router.post('/mercadolivre/renew', async (req, res) => {
  try {
    const result = await tokenManager.renewMercadoLivreToken();
    
    res.json({
      success: true,
      message: 'Token renovado com sucesso!',
      expires_at: result.expires_at
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Forçar renovação de todos os tokens
router.post('/renew-all', async (req, res) => {
  try {
    await tokenManager.forceRenewalAll();
    
    res.json({
      success: true,
      message: 'Todos os tokens foram renovados!'
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Obter status dos tokens
router.get('/status', async (req, res) => {
  try {
    const status = await tokenManager.getTokensStatus();
    
    res.json({
      success: true,
      tokens: status
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;