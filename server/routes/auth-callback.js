const express = require('express');
const router = express.Router();

// Callback OAuth para Amazon que redireciona para o handler correto
router.get('/callback', async (req, res) => {
  try {
    console.log('Auth callback recebido:', req.query);
    
    // Redirecionar para o handler correto mantendo todos os parâmetros
    const queryString = new URLSearchParams(req.query).toString();
    const redirectUrl = `/api/credentials/amazon/callback?${queryString}`;
    
    console.log('Redirecionando para:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Erro no auth callback:', error);
    res.status(500).send('Erro no callback de autorização');
  }
});

module.exports = router;