const express = require('express');
const router = express.Router();
const secureLogger = require('../utils/secureLogger');
const CredentialsService = require('../services/credentialsService');
const AmazonService = require('../services/amazonService');
const MercadoLivreService = require('../services/mercadolivreService');
const amazonCallbackRouter = require('./amazon-callback');

const credentialsService = new CredentialsService();

// Montar rotas de callback da Amazon
router.use('/amazon', amazonCallbackRouter);

// Obter credenciais configuradas
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    const [amazonCreds, mlCreds] = await Promise.all([
      credentialsService.getCredentials(userId, 'amazon'),
      credentialsService.getCredentials(userId, 'mercadolivre')
    ]);
    
    // Retorna apenas informações não sensíveis
    const credentials = {
      amazon: {
        configured: !!amazonCreds,
        sellerId: amazonCreds?.sellerId || null,
        marketplaceId: amazonCreds?.marketplaceId || null
      },
      mercadolivre: {
        configured: !!mlCreds,
        sellerId: mlCreds?.sellerId || null
      }
    };
    
    res.json(credentials);
  } catch (error) {
    secureLogger.error('Erro ao buscar credenciais', { 
      error: error.message,
      userId: req.userId 
    });
    res.status(500).json({ error: 'Erro ao buscar credenciais' });
  }
});

// Salvar credenciais Amazon
router.post('/amazon', async (req, res) => {
  try {
    const userId = req.userId;
    const credentials = req.body;
    
    // Validação básica
    const requiredFields = ['clientId', 'clientSecret'];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        return res.status(400).json({ 
          error: `Campo obrigatório ausente: ${field}` 
        });
      }
    }
    
    // Refresh token é necessário apenas se não estiver gerando
    if (!credentials.refreshToken && !credentials.generateRefreshToken) {
      return res.status(400).json({ 
        error: 'Refresh Token é obrigatório ou use o botão para gerar' 
      });
    }
    
    // Testa as credenciais antes de salvar
    const amazonService = new AmazonService(credentials);
    const testResult = await amazonService.testConnection();
    
    if (!testResult.success) {
      return res.status(400).json({ 
        error: 'Credenciais inválidas',
        details: testResult.error 
      });
    }
    
    // Salva as credenciais
    await credentialsService.saveCredentials(userId, 'amazon', credentials);
    
    secureLogger.info('Credenciais Amazon salvas', { userId });
    
    res.json({ 
      success: true, 
      message: 'Credenciais Amazon configuradas com sucesso',
      marketplaces: testResult.marketplaces
    });
  } catch (error) {
    secureLogger.error('Erro ao salvar credenciais Amazon', { 
      error: error.message,
      userId: req.userId 
    });
    res.status(500).json({ error: 'Erro ao salvar credenciais' });
  }
});

// Salvar credenciais Mercado Livre
router.post('/mercadolivre', async (req, res) => {
  try {
    const userId = req.userId;
    const credentials = req.body;
    
    // Validação básica
    const requiredFields = ['accessToken', 'refreshToken', 'clientId', 'clientSecret'];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        return res.status(400).json({ 
          error: `Campo obrigatório ausente: ${field}` 
        });
      }
    }
    
    // Testa as credenciais antes de salvar
    const mlService = new MercadoLivreService(credentials);
    const testResult = await mlService.testConnection();
    
    if (!testResult.success) {
      return res.status(400).json({ 
        error: 'Credenciais inválidas',
        details: testResult.error 
      });
    }
    
    // Salva as credenciais
    await credentialsService.saveCredentials(userId, 'mercadolivre', credentials);
    
    secureLogger.info('Credenciais ML salvas', { userId });
    
    res.json({ 
      success: true, 
      message: 'Credenciais Mercado Livre configuradas com sucesso',
      nickname: testResult.nickname,
      siteId: testResult.site_id
    });
  } catch (error) {
    secureLogger.error('Erro ao salvar credenciais ML', { 
      error: error.message,
      userId: req.userId 
    });
    res.status(500).json({ error: 'Erro ao salvar credenciais' });
  }
});

// Testar credenciais Amazon
router.post('/amazon/test', async (req, res) => {
  try {
    const credentials = req.body;
    const amazonService = new AmazonService(credentials);
    const result = await amazonService.testConnection();
    
    res.json(result);
  } catch (error) {
    secureLogger.error('Erro ao testar credenciais Amazon', { 
      error: error.message 
    });
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao testar credenciais' 
    });
  }
});

// Testar credenciais Mercado Livre
router.post('/mercadolivre/test', async (req, res) => {
  try {
    const credentials = req.body;
    const mlService = new MercadoLivreService(credentials);
    const result = await mlService.testConnection();
    
    res.json(result);
  } catch (error) {
    secureLogger.error('Erro ao testar credenciais ML', { 
      error: error.message 
    });
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao testar credenciais' 
    });
  }
});

// Remover credenciais
router.delete('/:service', async (req, res) => {
  try {
    const userId = req.userId;
    const service = req.params.service;
    
    if (!['amazon', 'mercadolivre'].includes(service)) {
      return res.status(400).json({ error: 'Serviço inválido' });
    }
    
    await credentialsService.deleteCredentials(userId, service);
    
    secureLogger.info('Credenciais removidas', { userId, service });
    
    res.json({ 
      success: true, 
      message: `Credenciais ${service} removidas com sucesso` 
    });
  } catch (error) {
    secureLogger.error('Erro ao remover credenciais', { 
      error: error.message,
      userId: req.userId,
      service: req.params.service
    });
    res.status(500).json({ error: 'Erro ao remover credenciais' });
  }
});

module.exports = router;