const pool = require('../db/pool');
const axios = require('axios');

class TokenManager {
  constructor() {
    this.renewalInterval = null;
    this.startAutoRenewal();
  }

  // Renovar token do Mercado Livre
  async renewMercadoLivreToken() {
    try {
      console.log('🔄 Renovando token do Mercado Livre...');
      
      const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'refresh_token',
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        refresh_token: process.env.ML_REFRESH_TOKEN
      });

      const { access_token, refresh_token, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + (expires_in * 1000));

      // Salvar no banco de dados
      await this.saveTokenToDatabase('mercadolivre', {
        access_token,
        refresh_token,
        expires_at: expiresAt
      });

      // Atualizar variáveis de ambiente em runtime
      process.env.ML_ACCESS_TOKEN = access_token;
      if (refresh_token) {
        process.env.ML_REFRESH_TOKEN = refresh_token;
      }

      console.log('✅ Token do Mercado Livre renovado com sucesso!');
      console.log(`🕐 Expira em: ${expiresAt.toLocaleString('pt-BR')}`);
      
      return { access_token, refresh_token, expires_at: expiresAt };
      
    } catch (error) {
      console.error('❌ Erro ao renovar token do Mercado Livre:', error.response?.data || error.message);
      throw error;
    }
  }

  // Obter novo token do Mercado Livre via autorização manual
  async getMercadoLivreAuthUrl() {
    const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI || 'https://appproft.com/api/marketplace/mercadolivre/callback';
    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${redirectUri}`;
    return authUrl;
  }

  // Processar callback de autorização do ML
  async processMercadoLivreCallback(code) {
    try {
      console.log('🔄 Processando autorização do Mercado Livre...');
      
      const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI || 'https://appproft.com/api/marketplace/mercadolivre/callback';
      const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'authorization_code',
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri
      });

      const { access_token, refresh_token, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + (expires_in * 1000));

      // Salvar no banco
      await this.saveTokenToDatabase('mercadolivre', {
        access_token,
        refresh_token,
        expires_at: expiresAt
      });

      // Atualizar env
      process.env.ML_ACCESS_TOKEN = access_token;
      process.env.ML_REFRESH_TOKEN = refresh_token;

      console.log('✅ Autorização do Mercado Livre concluída!');
      return { access_token, refresh_token, expires_at: expiresAt };
      
    } catch (error) {
      console.error('❌ Erro na autorização do Mercado Livre:', error.response?.data || error.message);
      throw error;
    }
  }

  // Salvar token no banco de dados
  async saveTokenToDatabase(marketplace, tokenData) {
    const client = await pool.connect();
    
    try {
      await client.query(`
        INSERT INTO marketplace_credentials (
          user_id, marketplace, access_token, refresh_token, expires_at
        ) VALUES (1, $1, $2, $3, $4)
        ON CONFLICT (user_id, marketplace) 
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = CURRENT_TIMESTAMP
      `, [marketplace, tokenData.access_token, tokenData.refresh_token, tokenData.expires_at]);
      
      console.log(`💾 Token do ${marketplace} salvo no banco de dados`);
      
    } finally {
      client.release();
    }
  }

  // Carregar tokens do banco de dados
  async loadTokensFromDatabase() {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT marketplace, access_token, refresh_token, expires_at
        FROM marketplace_credentials
        WHERE user_id = 1
      `);

      for (const row of result.rows) {
        if (row.marketplace === 'mercadolivre') {
          process.env.ML_ACCESS_TOKEN = row.access_token;
          process.env.ML_REFRESH_TOKEN = row.refresh_token;
          console.log(`📥 Token do Mercado Livre carregado do banco`);
        }
      }
      
    } finally {
      client.release();
    }
  }

  // Verificar se tokens estão próximos do vencimento
  async checkTokenExpiration() {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT marketplace, expires_at
        FROM marketplace_credentials
        WHERE user_id = 1 AND expires_at < NOW() + INTERVAL '1 hour'
      `);

      for (const row of result.rows) {
        console.log(`⚠️  Token do ${row.marketplace} expira em menos de 1 hora!`);
        
        if (row.marketplace === 'mercadolivre') {
          await this.renewMercadoLivreToken();
        }
      }
      
    } finally {
      client.release();
    }
  }

  // Iniciar renovação automática a cada 5 horas
  startAutoRenewal() {
    console.log('🤖 Sistema de renovação automática de tokens iniciado');
    console.log('⏰ Verificação a cada 5 horas');
    
    // Carregar tokens existentes
    this.loadTokensFromDatabase().catch(console.error);
    
    // Verificar imediatamente
    this.checkTokenExpiration().catch(console.error);
    
    // Configurar intervalo de 5 horas (18000000 ms)
    this.renewalInterval = setInterval(async () => {
      console.log('🔄 Verificação automática de tokens...');
      await this.checkTokenExpiration().catch(console.error);
    }, 5 * 60 * 60 * 1000); // 5 horas
  }

  // Parar renovação automática
  stopAutoRenewal() {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
      console.log('🛑 Sistema de renovação automática parado');
    }
  }

  // Forçar renovação manual de todos os tokens
  async forceRenewalAll() {
    console.log('🔄 Forçando renovação de todos os tokens...');
    
    try {
      await this.renewMercadoLivreToken();
      console.log('✅ Renovação forçada concluída!');
    } catch (error) {
      console.error('❌ Erro na renovação forçada:', error.message);
      throw error;
    }
  }

  // Obter status dos tokens
  async getTokensStatus() {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT marketplace, expires_at, 
               CASE 
                 WHEN expires_at > NOW() + INTERVAL '1 hour' THEN 'valid'
                 WHEN expires_at > NOW() THEN 'expiring_soon'
                 ELSE 'expired'
               END as status
        FROM marketplace_credentials
        WHERE user_id = 1
      `);

      return result.rows;
      
    } finally {
      client.release();
    }
  }
}

module.exports = new TokenManager();