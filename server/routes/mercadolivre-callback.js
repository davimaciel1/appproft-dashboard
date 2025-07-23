const express = require('express');
const router = express.Router();
const tokenManager = require('../services/tokenManager');

// Callback de autorização do Mercado Livre (rota compatível com a configurada)
router.get('/mercadolivre/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Código de autorização não fornecido' 
      });
    }

    console.log('📥 Callback do Mercado Livre recebido com código:', code.substring(0, 10) + '...');

    const tokens = await tokenManager.processMercadoLivreCallback(code);
    
    // Página de sucesso para o usuário
    res.send(`
      <html>
        <head>
          <title>Autorização Concluída - AppProft</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
            .info { color: #6c757d; margin: 10px 0; }
            .token-info { 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 5px; 
              margin: 20px 0;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✅ Autorização Concluída!</h1>
            <p>Sua conta do Mercado Livre foi autorizada com sucesso no AppProft.</p>
            
            <div class="token-info">
              <strong>Informações do Token:</strong><br>
              <span class="info">Token expira em: ${tokens.expires_at.toLocaleString('pt-BR')}</span><br>
              <span class="info">Renovação automática: Ativada ✅</span><br>
              <span class="info">Status: Tokens salvos no banco de dados</span>
            </div>
            
            <p class="info">
              🤖 O sistema irá renovar automaticamente seus tokens a cada 5 horas.<br>
              Você pode fechar esta janela e voltar para o dashboard.
            </p>
            
            <button onclick="window.close()" style="
              background: #FF8C00; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              border-radius: 5px; 
              cursor: pointer;
              font-size: 16px;
            ">Fechar</button>
          </div>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ Erro no callback do Mercado Livre:', error.message);
    
    res.status(500).send(`
      <html>
        <head>
          <title>Erro na Autorização - AppProft</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
            .info { color: #6c757d; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">❌ Erro na Autorização</h1>
            <p>Ocorreu um erro ao processar a autorização do Mercado Livre.</p>
            <p class="info">Erro: ${error.message}</p>
            <p class="info">Tente novamente ou entre em contato com o suporte.</p>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;