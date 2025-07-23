const express = require('express');
const router = express.Router();

// Callback OAuth para Amazon que redireciona para o handler correto
router.get('/callback', async (req, res) => {
  try {
    console.log('=== AUTH CALLBACK RECEBIDO ===');
    console.log('Query params:', req.query);
    console.log('Headers:', req.headers);
    console.log('Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    
    // Verificar se há erro da Amazon
    if (req.query.error) {
      console.error('Erro OAuth da Amazon:', req.query.error, req.query.error_description);
      
      // Redirecionar para página de debug com erro
      const errorParams = new URLSearchParams({
        error: req.query.error,
        error_description: req.query.error_description || 'Erro desconhecido'
      }).toString();
      
      return res.redirect(`/auth/debug?${errorParams}`);
    }
    
    // Verificar se há código de autorização
    if (!req.query.code && !req.query.spapi_oauth_code) {
      console.error('Nenhum código de autorização recebido');
      return res.redirect('/auth/debug?error=no_code&error_description=Nenhum código de autorização foi recebido');
    }
    
    // Redirecionar para o handler correto mantendo todos os parâmetros
    const queryString = new URLSearchParams(req.query).toString();
    const redirectUrl = `/api/credentials/amazon/callback?${queryString}`;
    
    console.log('Redirecionando para:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Erro no auth callback:', error);
    res.redirect('/auth/debug?error=server_error&error_description=' + encodeURIComponent(error.message));
  }
});

module.exports = router;