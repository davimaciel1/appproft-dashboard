const express = require('express');
const router = express.Router();

// Página de debug para OAuth Amazon
router.get('/debug', (req, res) => {
  const debugInfo = {
    query: req.query,
    headers: req.headers,
    url: req.url,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  };
  
  console.log('OAuth Debug Info:', JSON.stringify(debugInfo, null, 2));
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>OAuth Debug - AppProft</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          margin: 40px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 800px;
          margin: 0 auto;
        }
        pre {
          background: #f0f0f0;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
        }
        .error {
          color: #dc3545;
          background: #fee;
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
        }
        .success {
          color: #28a745;
          background: #efe;
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
        }
        h1 { color: #333; }
        h2 { color: #666; font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔍 OAuth Debug - AppProft</h1>
        
        <h2>Query Parameters:</h2>
        <pre>${JSON.stringify(req.query, null, 2)}</pre>
        
        <h2>Full URL:</h2>
        <pre>${req.protocol}://${req.get('host')}${req.originalUrl}</pre>
        
        ${req.query.error ? `
          <div class="error">
            <strong>❌ Erro OAuth:</strong><br>
            ${req.query.error}<br>
            ${req.query.error_description || ''}
          </div>
        ` : ''}
        
        ${req.query.code ? `
          <div class="success">
            <strong>✅ Código de autorização recebido!</strong><br>
            Code: ${req.query.code.substring(0, 20)}...
          </div>
        ` : ''}
        
        <h2>Possíveis Problemas:</h2>
        <ul>
          <li><strong>Application ID incorreto:</strong> Verifique se o Client ID está correto</li>
          <li><strong>Redirect URI não configurado:</strong> No Amazon Developer Console, adicione: <code>https://appproft.com/auth/callback</code></li>
          <li><strong>Conta não autorizada:</strong> A aplicação precisa estar associada à sua conta de vendedor</li>
          <li><strong>Região incorreta:</strong> Verifique se está usando o Seller Central correto (US vs BR)</li>
        </ul>
        
        <h2>Como Configurar no Amazon Developer Console:</h2>
        <ol>
          <li>Acesse <a href="https://developer.amazon.com" target="_blank">https://developer.amazon.com</a></li>
          <li>Vá para "Apps & Services" → "Login with Amazon"</li>
          <li>Encontre sua aplicação ou crie uma nova</li>
          <li>Em "Web Settings", adicione o Allowed Return URL: <code>https://appproft.com/auth/callback</code></li>
          <li>Salve as alterações</li>
          <li>Copie o Client ID e Client Secret</li>
        </ol>
        
        <h2>Debug Information:</h2>
        <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="/credentials" style="
            display: inline-block;
            padding: 12px 24px;
            background: #FF8C00;
            color: white;
            text-decoration: none;
            border-radius: 6px;
          ">Voltar às Credenciais</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

module.exports = router;