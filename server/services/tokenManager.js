const pool = require('../db/pool');
const axios = require('axios');
const crypto = require('crypto');
const secureLogger = require('../utils/secureLogger');

class TokenManager {
  constructor() {
    this.renewalInterval = null;
    this.tokens = {
      amazon: {
        accessToken: null,
        expiresAt: null
      },
      mercadoLivre: {
        accessToken: null,
        expiresAt: null
      }
    };
    this.startAutoRenewal();
  }

  // Criptografar token antes de salvar
  encryptToken(token) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY não configurada');
    }
    
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Descriptografar token
  decryptToken(encryptedData) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY não configurada');
    }
    
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv(
      algorithm, 
      key, 
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Amazon SP-API Token Refresh
  async getAmazonToken() {
    try {
      // Verifica se o token ainda é válido
      if (this.tokens.amazon.accessToken && new Date() < this.tokens.amazon.expiresAt) {
        return this.tokens.amazon.accessToken;
      }

      secureLogger.info('Renovando token da Amazon SP-API');

      // Renova o token
      const response = await axios.post('https://api.amazon.com/auth/o2/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: process.env.AMAZON_REFRESH_TOKEN,
          client_id: process.env.AMAZON_CLIENT_ID,
          client_secret: process.env.AMAZON_CLIENT_SECRET
        }), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      const { access_token, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + (expires_in * 1000) - 60000); // 1 min antes de expirar
      
      // Armazena o novo token
      this.tokens.amazon.accessToken = access_token;
      this.tokens.amazon.expiresAt = expiresAt;
      
      // Salva no banco de forma segura
      await this.saveTokenToDatabase('amazon', {
        access_token,
        expires_at: expiresAt
      });
      
      secureLogger.info('Token da Amazon renovado com sucesso', {
        expiresAt: expiresAt.toISOString()
      });
      
      return access_token;
    } catch (error) {
      secureLogger.error('Erro ao renovar token da Amazon', {
        error: error.message
      });
      throw error;
    }
  }

  // Mercado Livre Token Refresh
  async getMercadoLivreToken() {
    try {
      // Verifica se o token ainda é válido
      if (this.tokens.mercadoLivre.accessToken && new Date() < this.tokens.mercadoLivre.expiresAt) {
        return this.tokens.mercadoLivre.accessToken;
      }

      secureLogger.info('Renovando token do Mercado Livre');

      const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'refresh_token',
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        refresh_token: process.env.ML_REFRESH_TOKEN
      });

      const { access_token, refresh_token, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + (expires_in * 1000) - 60000);

      // Armazena o novo token
      this.tokens.mercadoLivre.accessToken = access_token;
      this.tokens.mercadoLivre.expiresAt = expiresAt;

      // Salvar no banco de dados
      await this.saveTokenToDatabase('mercadolivre', {
        access_token,
        refresh_token,
        expires_at: expiresAt
      });

      // Atualizar refresh token se fornecido um novo
      if (refresh_token && refresh_token !== process.env.ML_REFRESH_TOKEN) {
        process.env.ML_REFRESH_TOKEN = refresh_token;
        await this.updateEnvFile('ML_REFRESH_TOKEN', refresh_token);
      }

      secureLogger.info('Token do Mercado Livre renovado com sucesso', {
        expiresAt: expiresAt.toISOString()
      });
      
      return access_token;
      
    } catch (error) {
      secureLogger.error('Erro ao renovar token do Mercado Livre', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  // Helper para atualizar o arquivo .env de forma segura
  async updateEnvFile(key, value) {
    const fs = require('fs').promises;
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '.env');
    
    try {
      let envContent = await fs.readFile(envPath, 'utf8');
      const regex = new RegExp(`^${key}=.*$`, 'm');
      
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
      
      await fs.writeFile(envPath, envContent);
      secureLogger.info('Arquivo .env atualizado com novo refresh token');
    } catch (error) {
      secureLogger.error('Erro ao atualizar .env', { error: error.message });
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

  // Salvar token no banco de dados de forma segura
  async saveTokenToDatabase(marketplace, tokenData) {
    const client = await pool.connect();
    
    try {
      // Criptografar tokens antes de salvar
      const encryptedAccessToken = tokenData.access_token ? 
        JSON.stringify(this.encryptToken(tokenData.access_token)) : null;
      
      const encryptedRefreshToken = tokenData.refresh_token ? 
        JSON.stringify(this.encryptToken(tokenData.refresh_token)) : null;

      await client.query(`
        INSERT INTO marketplace_tokens (
          marketplace, tenant_id, access_token, refresh_token, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (marketplace, tenant_id) 
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = CURRENT_TIMESTAMP
      `, [marketplace, 'default', encryptedAccessToken, encryptedRefreshToken, tokenData.expires_at]);
      
      secureLogger.info('Token salvo no banco de dados', { marketplace });
      
    } catch (error) {
      secureLogger.error('Erro ao salvar token no banco', {
        marketplace,
        error: error.message
      });
      throw error;
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
        WHERE user_id = 1 AND expires_at > NOW()
      `);

      for (const row of result.rows) {
        try {
          // Descriptografar tokens
          const accessToken = row.access_token ? 
            this.decryptToken(JSON.parse(row.access_token)) : null;
          
          const refreshToken = row.refresh_token ? 
            this.decryptToken(JSON.parse(row.refresh_token)) : null;

          if (row.marketplace === 'mercadolivre') {
            this.tokens.mercadoLivre.accessToken = accessToken;
            this.tokens.mercadoLivre.expiresAt = row.expires_at;
            if (refreshToken) {
              process.env.ML_REFRESH_TOKEN = refreshToken;
            }
            secureLogger.info('Token do Mercado Livre carregado do banco');
          } else if (row.marketplace === 'amazon') {
            this.tokens.amazon.accessToken = accessToken;
            this.tokens.amazon.expiresAt = row.expires_at;
            secureLogger.info('Token da Amazon carregado do banco');
          }
        } catch (error) {
          secureLogger.error('Erro ao descriptografar token', {
            marketplace: row.marketplace,
            error: error.message
          });
        }
      }
      
    } catch (error) {
      secureLogger.error('Erro ao carregar tokens do banco', {
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  // Verificar se tokens estão próximos do vencimento
  async checkTokenExpiration() {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT marketplace, expires_at,
               EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 as minutes_until_expiry
        FROM marketplace_credentials
        WHERE user_id = 1 AND expires_at < NOW() + INTERVAL '1 hour'
      `);

      for (const row of result.rows) {
        secureLogger.warn('Token próximo do vencimento', {
          marketplace: row.marketplace,
          minutesUntilExpiry: Math.round(row.minutes_until_expiry)
        });
        
        if (row.marketplace === 'mercadolivre') {
          await this.getMercadoLivreToken();
        } else if (row.marketplace === 'amazon') {
          await this.getAmazonToken();
        }
      }
      
    } catch (error) {
      secureLogger.error('Erro ao verificar expiração de tokens', {
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  // Iniciar renovação automática
  startAutoRenewal() {
    secureLogger.info('Sistema de renovação automática de tokens iniciado');
    
    // Carregar tokens existentes
    this.loadTokensFromDatabase().catch(err => 
      secureLogger.error('Erro ao carregar tokens na inicialização', { error: err.message })
    );
    
    // Verificar imediatamente
    setTimeout(() => {
      this.checkTokenExpiration().catch(err => 
        secureLogger.error('Erro na verificação inicial de tokens', { error: err.message })
      );
    }, 5000); // Aguarda 5 segundos para garantir que o sistema está pronto
    
    // Configurar intervalo de 30 minutos para verificações mais frequentes
    this.renewalInterval = setInterval(async () => {
      secureLogger.debug('Verificação automática de tokens iniciada');
      await this.checkTokenExpiration().catch(err => 
        secureLogger.error('Erro na verificação automática de tokens', { error: err.message })
      );
    }, 30 * 60 * 1000); // 30 minutos
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
    secureLogger.info('Forçando renovação de todos os tokens');
    
    const results = {
      amazon: { success: false, error: null },
      mercadolivre: { success: false, error: null }
    };
    
    try {
      // Renovar token Amazon
      try {
        await this.getAmazonToken();
        results.amazon.success = true;
      } catch (error) {
        results.amazon.error = error.message;
        secureLogger.error('Erro ao renovar token Amazon', { error: error.message });
      }
      
      // Renovar token Mercado Livre
      try {
        await this.getMercadoLivreToken();
        results.mercadolivre.success = true;
      } catch (error) {
        results.mercadolivre.error = error.message;
        secureLogger.error('Erro ao renovar token Mercado Livre', { error: error.message });
      }
      
      secureLogger.info('Renovação forçada concluída', { results });
      return results;
      
    } catch (error) {
      secureLogger.error('Erro crítico na renovação forçada', { error: error.message });
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