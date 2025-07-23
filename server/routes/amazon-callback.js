const express = require('express');
const router = express.Router();
const https = require('https');
const querystring = require('querystring');
const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');

// Armazenar temporariamente os callbacks (em produção, usar Redis ou banco de dados)
const pendingCallbacks = new Map();

// Endpoint de callback da Amazon
router.get('/callback', async (req, res) => {
  try {
    const { spapi_oauth_code, state, selling_partner_id } = req.query;
    
    console.log('Amazon callback recebido:', {
      hasCode: !!spapi_oauth_code,
      state,
      sellerId: selling_partner_id
    });

    if (!spapi_oauth_code) {
      return res.status(400).send('Código de autorização não fornecido');
    }

    // Armazenar temporariamente
    pendingCallbacks.set(state, {
      code: spapi_oauth_code,
      sellerId: selling_partner_id,
      timestamp: Date.now()
    });

    // Retornar página de sucesso
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Autorização Amazon - Sucesso</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
          }
          .success {
            color: #28a745;
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
          .button {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #FF8C00;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            transition: background 0.2s;
          }
          .button:hover {
            background: #e67e00;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>Autorização Concluída!</h1>
          <p>A autorização com a Amazon foi realizada com sucesso.</p>
          <p>Volte para a página de credenciais e clique em "Verificar Autorização" para continuar.</p>
          <a href="/credentials" class="button">Voltar às Credenciais</a>
        </div>
        <script>
          // Fechar a aba após 5 segundos
          setTimeout(() => {
            window.close();
          }, 5000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Erro no callback da Amazon:', error);
    res.status(500).send('Erro ao processar autorização');
  }
});

// Endpoint para verificar se há callback pendente e trocar código por token
router.get('/check-callback', async (req, res) => {
  try {
    // Procurar por callbacks recentes (últimos 10 minutos)
    const now = Date.now();
    let foundCallback = null;

    for (const [state, data] of pendingCallbacks.entries()) {
      if (now - data.timestamp < 600000) { // 10 minutos
        foundCallback = data;
        pendingCallbacks.delete(state); // Usar apenas uma vez
        break;
      }
    }

    if (!foundCallback) {
      return res.json({ hasCallback: false });
    }

    // Trocar código por refresh token
    const tokenData = await exchangeCodeForToken(foundCallback.code);

    if (tokenData.refresh_token) {
      // Salvar no banco temporariamente (associado ao usuário depois)
      const userId = req.user?.id || 1; // Pegar do token JWT em produção
      
      await executeSQL(
        `UPDATE marketplace_credentials 
         SET refresh_token = $1, access_token = $2, updated_at = NOW()
         WHERE user_id = $3 AND marketplace = 'amazon'`,
        [tokenData.refresh_token, tokenData.access_token, userId]
      );

      res.json({
        hasCallback: true,
        refreshToken: tokenData.refresh_token,
        sellerId: foundCallback.sellerId
      });
    } else {
      res.json({ hasCallback: false, error: 'Falha ao obter refresh token' });
    }
  } catch (error) {
    console.error('Erro ao verificar callback:', error);
    res.status(500).json({ error: 'Erro ao processar callback' });
  }
});

// Função para trocar código por token
async function exchangeCodeForToken(code) {
  return new Promise((resolve, reject) => {
    // Pegar credenciais do .env
    const clientId = process.env.AMAZON_CLIENT_ID || process.env.AMAZON_SP_API_CLIENT_ID;
    const clientSecret = process.env.AMAZON_CLIENT_SECRET || process.env.AMAZON_SP_API_CLIENT_SECRET;

    const postData = querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      client_id: clientId,
      client_secret: clientSecret
    });

    const options = {
      hostname: 'api.amazon.com',
      port: 443,
      path: '/auth/o2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Limpar callbacks antigos a cada hora
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingCallbacks.entries()) {
    if (now - data.timestamp > 3600000) { // 1 hora
      pendingCallbacks.delete(state);
    }
  }
}, 3600000);

module.exports = router;