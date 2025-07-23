/**
 * Serviço de Gerenciamento de Credenciais Multi-tenant
 * Cada usuário tem suas próprias credenciais de API
 */

const crypto = require('crypto');
const pool = require('../db/pool');
const secureLogger = require('../utils/secureLogger');

class CredentialsService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.saltLength = 64;
    this.iterations = 100000;
    
    // Deriva a chave mestre do ENCRYPTION_KEY
    const masterKey = process.env.ENCRYPTION_KEY;
    if (!masterKey || masterKey.length < 32) {
      throw new Error('ENCRYPTION_KEY deve ter pelo menos 32 caracteres');
    }
    
    this.masterKey = crypto.scryptSync(masterKey, 'appproft-salt', this.keyLength);
  }

  /**
   * Criptografa um valor
   */
  encrypt(text) {
    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);
    
    const key = crypto.pbkdf2Sync(this.masterKey, salt, this.iterations, this.keyLength, 'sha256');
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  }

  /**
   * Descriptografa um valor
   */
  decrypt(encryptedData) {
    const data = Buffer.from(encryptedData, 'base64');
    
    const salt = data.slice(0, this.saltLength);
    const iv = data.slice(this.saltLength, this.saltLength + this.ivLength);
    const tag = data.slice(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
    const encrypted = data.slice(this.saltLength + this.ivLength + this.tagLength);
    
    const key = crypto.pbkdf2Sync(this.masterKey, salt, this.iterations, this.keyLength, 'sha256');
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  /**
   * Salva credenciais de um usuário
   */
  async saveCredentials(userId, service, credentials) {
    const client = await pool.connect();
    
    try {
      // Criptografa tokens sensíveis
      const encryptedCredentials = {};
      
      for (const [key, value] of Object.entries(credentials)) {
        if (this.isSensitiveField(key) && value) {
          encryptedCredentials[key] = this.encrypt(value);
        } else {
          encryptedCredentials[key] = value;
        }
      }
      
      await client.query(`
        INSERT INTO api_tokens (user_id, service, credentials, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, service) 
        DO UPDATE SET 
          credentials = $3,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, service, JSON.stringify(encryptedCredentials)]);
      
      secureLogger.info('Credenciais salvas com sucesso', {
        userId,
        service
      });
      
    } catch (error) {
      secureLogger.error('Erro ao salvar credenciais', {
        userId,
        service,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Busca credenciais de um usuário
   */
  async getCredentials(userId, service) {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT credentials 
        FROM api_tokens 
        WHERE user_id = $1 AND service = $2
      `, [userId, service]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const encryptedCredentials = JSON.parse(result.rows[0].credentials);
      const credentials = {};
      
      // Descriptografa campos sensíveis
      for (const [key, value] of Object.entries(encryptedCredentials)) {
        if (this.isSensitiveField(key) && value) {
          try {
            credentials[key] = this.decrypt(value);
          } catch (error) {
            secureLogger.error('Erro ao descriptografar credencial', {
              userId,
              service,
              field: key
            });
            credentials[key] = null;
          }
        } else {
          credentials[key] = value;
        }
      }
      
      return credentials;
      
    } catch (error) {
      secureLogger.error('Erro ao buscar credenciais', {
        userId,
        service,
        error: error.message
      });
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Remove credenciais de um usuário
   */
  async deleteCredentials(userId, service) {
    const client = await pool.connect();
    
    try {
      await client.query(`
        DELETE FROM api_tokens 
        WHERE user_id = $1 AND service = $2
      `, [userId, service]);
      
      secureLogger.info('Credenciais removidas', {
        userId,
        service
      });
      
    } catch (error) {
      secureLogger.error('Erro ao remover credenciais', {
        userId,
        service,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verifica se um campo é sensível
   */
  isSensitiveField(fieldName) {
    const sensitiveFields = [
      'access_token',
      'refresh_token',
      'client_secret',
      'secret_key',
      'api_key',
      'password',
      'private_key'
    ];
    
    return sensitiveFields.some(field => 
      fieldName.toLowerCase().includes(field)
    );
  }

  /**
   * Valida se o usuário tem credenciais válidas para um serviço
   */
  async hasValidCredentials(userId, service) {
    const credentials = await this.getCredentials(userId, service);
    
    if (!credentials) {
      return false;
    }
    
    // Verifica campos obrigatórios por serviço
    switch (service) {
      case 'amazon':
        return !!(
          credentials.client_id &&
          credentials.client_secret &&
          credentials.refresh_token
        );
        
      case 'mercadolivre':
        return !!(
          credentials.client_id &&
          credentials.client_secret &&
          (credentials.access_token || credentials.refresh_token)
        );
        
      default:
        return false;
    }
  }
}

// Singleton
const credentialsService = new CredentialsService();

module.exports = credentialsService;