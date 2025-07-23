const express = require('express');
const router = express.Router();

// Endpoint para verificar configuração das credenciais LWA
router.get('/check', (req, res) => {
  const lwaClientId = process.env.LWA_CLIENT_ID || process.env.AMAZON_CLIENT_ID || process.env.AMAZON_SP_API_CLIENT_ID;
  const lwaClientSecret = process.env.LWA_CLIENT_SECRET || process.env.AMAZON_CLIENT_SECRET || process.env.AMAZON_SP_API_CLIENT_SECRET;
  
  const configured = !!lwaClientId && !!lwaClientSecret;
  
  res.json({
    configured,
    hasClientId: !!lwaClientId,
    hasClientSecret: !!lwaClientSecret,
    clientIdSource: process.env.LWA_CLIENT_ID ? 'LWA_CLIENT_ID' : 
                   process.env.AMAZON_CLIENT_ID ? 'AMAZON_CLIENT_ID' : 
                   process.env.AMAZON_SP_API_CLIENT_ID ? 'AMAZON_SP_API_CLIENT_ID' : 'none',
    message: configured ? 
      'Credenciais LWA configuradas corretamente' : 
      'LWA Client ID e Client Secret são obrigatórios para OAuth Amazon'
  });
});

module.exports = router;