const https = require('https');
const querystring = require('querystring');
const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');
const secureLogger = require('../utils/secureLogger');
const crypto = require('crypto');

class TokenRenewalService {
  constructor() {
    this.renewalInterval = null;
    this.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key';
  }

  // Criptografar dados sensíveis
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  // Descriptografar dados
  decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.ENCRYPTION_KEY, 'hex'), iv);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  }

  // Iniciar serviço de renovação automática
  startAutoRenewal() {
    // Verificar tokens a cada 1 hora
    this.renewalInterval = setInterval(async () => {
      try {
        await this.checkAndRenewTokens();
      } catch (error) {
        secureLogger.error('Erro no ciclo de renovação automática', { error: error.message });
      }
    }, 3600000); // 1 hora

    // Executar verificação inicial
    this.checkAndRenewTokens();
    
    secureLogger.info('Serviço de renovação automática iniciado');
  }

  // Parar serviço
  stopAutoRenewal() {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
      secureLogger.info('Serviço de renovação automática parado');
    }
  }

  // Verificar e renovar tokens que estão próximos de expirar
  async checkAndRenewTokens() {
    try {
      // Buscar todas as credenciais do banco
      const result = await executeSQL(`
        SELECT 
          id,
          user_id,
          marketplace,
          client_id,
          client_secret,
          refresh_token,
          access_token,
          token_expires_at,
          updated_at
        FROM marketplace_credentials
        WHERE refresh_token IS NOT NULL
      `);

      for (const credential of result.rows) {
        try {
          // Descriptografar tokens
          const refreshToken = this.decrypt(credential.refresh_token);
          
          // Verificar se o token expira em menos de 1 hora
          const expiresAt = credential.token_expires_at ? new Date(credential.token_expires_at) : null;
          const oneHourFromNow = new Date(Date.now() + 3600000);
          
          if (!expiresAt || expiresAt < oneHourFromNow) {
            secureLogger.info('Token expirando, renovando...', {
              marketplace: credential.marketplace,
              userId: credential.user_id
            });

            if (credential.marketplace === 'amazon') {
              await this.renewAmazonToken(credential.id, refreshToken);
            } else if (credential.marketplace === 'mercadolivre') {
              await this.renewMercadoLivreToken(credential.id, refreshToken, credential.client_id, credential.client_secret);
            }
          }
        } catch (error) {
          secureLogger.error('Erro ao processar credencial', {
            credentialId: credential.id,
            error: error.message
          });
        }
      }
    } catch (error) {
      secureLogger.error('Erro ao verificar tokens', { error: error.message });
    }
  }

  // Renovar token da Amazon
  async renewAmazonToken(credentialId, refreshToken) {
    return new Promise((resolve, reject) => {
      const clientId = process.env.AMAZON_CLIENT_ID || process.env.AMAZON_SP_API_CLIENT_ID;
      const clientSecret = process.env.AMAZON_CLIENT_SECRET || process.env.AMAZON_SP_API_CLIENT_SECRET;

      const postData = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
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

        res.on('end', async () => {
          try {
            const response = JSON.parse(data);
            
            if (response.access_token) {
              // Calcular expiração
              const expiresAt = new Date(Date.now() + (response.expires_in * 1000));
              
              // Atualizar no banco
              await executeSQL(`
                UPDATE marketplace_credentials
                SET 
                  access_token = $1,
                  token_expires_at = $2,
                  updated_at = NOW()
                WHERE id = $3
              `, [
                this.encrypt(response.access_token),
                expiresAt,
                credentialId
              ]);

              secureLogger.info('Token Amazon renovado com sucesso', { credentialId });
              resolve(response);
            } else {
              reject(new Error('Token não retornado pela Amazon'));
            }
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

  // Renovar token do Mercado Livre
  async renewMercadoLivreToken(credentialId, refreshToken, clientId, clientSecret) {
    return new Promise((resolve, reject) => {
      const postData = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      });

      const options = {
        hostname: 'api.mercadolibre.com',
        port: 443,
        path: '/oauth/token',
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

        res.on('end', async () => {
          try {
            const response = JSON.parse(data);
            
            if (response.access_token) {
              // Calcular expiração
              const expiresAt = new Date(Date.now() + (response.expires_in * 1000));
              
              // Atualizar no banco
              const updateData = [
                this.encrypt(response.access_token),
                expiresAt,
                credentialId
              ];

              // Se retornar novo refresh token, atualizar também
              if (response.refresh_token) {
                await executeSQL(`
                  UPDATE marketplace_credentials
                  SET 
                    access_token = $1,
                    refresh_token = $4,
                    token_expires_at = $2,
                    updated_at = NOW()
                  WHERE id = $3
                `, [...updateData.slice(0, 3), this.encrypt(response.refresh_token)]);
              } else {
                await executeSQL(`
                  UPDATE marketplace_credentials
                  SET 
                    access_token = $1,
                    token_expires_at = $2,
                    updated_at = NOW()
                  WHERE id = $3
                `, updateData);
              }

              secureLogger.info('Token Mercado Livre renovado com sucesso', { credentialId });
              resolve(response);
            } else {
              reject(new Error('Token não retornado pelo Mercado Livre'));
            }
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

  // Renovar token específico manualmente
  async renewToken(userId, marketplace) {
    try {
      const result = await executeSQL(`
        SELECT * FROM marketplace_credentials
        WHERE user_id = $1 AND marketplace = $2
      `, [userId, marketplace]);

      if (result.rows.length === 0) {
        throw new Error('Credenciais não encontradas');
      }

      const credential = result.rows[0];
      const refreshToken = this.decrypt(credential.refresh_token);

      if (marketplace === 'amazon') {
        return await this.renewAmazonToken(credential.id, refreshToken);
      } else if (marketplace === 'mercadolivre') {
        return await this.renewMercadoLivreToken(
          credential.id, 
          refreshToken, 
          credential.client_id, 
          credential.client_secret
        );
      }

      throw new Error('Marketplace não suportado');
    } catch (error) {
      secureLogger.error('Erro ao renovar token manualmente', {
        userId,
        marketplace,
        error: error.message
      });
      throw error;
    }
  }
}

// Exportar instância única
module.exports = new TokenRenewalService();