/**
 * Gerenciador de Tokens para Amazon Advertising API
 * Implementa OAuth 2.0 com refresh automático
 */

const secureLogger = require('../utils/secureLogger');
const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');

class AdvertisingTokenManager {
  constructor() {
    this.tokens = {
      accessToken: null,
      refreshToken: process.env.ADVERTISING_REFRESH_TOKEN,
      expiresAt: null
    };
    
    this.clientId = process.env.ADVERTISING_CLIENT_ID;
    this.clientSecret = process.env.ADVERTISING_CLIENT_SECRET;
    this.redirectUri = process.env.ADVERTISING_REDIRECT_URI || 'http://localhost:3000/auth/amazon/callback';
    
    // URLs da Advertising API
    this.authBaseUrl = 'https://www.amazon.com/ap/oa';
    this.tokenUrl = 'https://api.amazon.com/auth/o2/token';
    this.apiBaseUrl = 'https://advertising-api.amazon.com';
    
    // Validar configuração
    this.validateConfig();
    
    // Carregar tokens salvos na inicialização
    this.loadSavedTokens();
  }

  validateConfig() {
    const required = ['ADVERTISING_CLIENT_ID', 'ADVERTISING_CLIENT_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      secureLogger.error('Configuração Advertising API incompleta', {
        missing,
        note: 'Configure estas variáveis no arquivo .env'
      });
    } else {
      secureLogger.info('✅ Configuração Advertising API validada');
    }
  }

  async loadSavedTokens() {
    try {
      const result = await executeSQL(`
        SELECT token_data FROM tokens_storage 
        WHERE service = 'advertising_api' 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        const tokenData = result.rows[0].token_data;
        this.tokens.accessToken = tokenData.access_token;
        this.tokens.expiresAt = new Date(tokenData.expires_at);
        
        secureLogger.info('Tokens Advertising API carregados do banco');
      }
    } catch (error) {
      secureLogger.error('Erro ao carregar tokens salvos:', error);
    }
  }

  async saveTokens(tokenData) {
    try {
      await executeSQL(`
        CREATE TABLE IF NOT EXISTS tokens_storage (
          id SERIAL PRIMARY KEY,
          service VARCHAR(50) NOT NULL,
          token_data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await executeSQL(`
        INSERT INTO tokens_storage (service, token_data)
        VALUES ('advertising_api', $1)
      `, [JSON.stringify(tokenData)]);
      
      secureLogger.info('Tokens Advertising API salvos no banco');
    } catch (error) {
      secureLogger.error('Erro ao salvar tokens:', error);
    }
  }

  /**
   * Gerar URL de autorização para obter código inicial
   */
  getAuthorizationUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: 'advertising::campaign_management',
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state: 'advertising_auth_' + Date.now()
    });

    const authUrl = `${this.authBaseUrl}?${params.toString()}`;
    
    secureLogger.info('URL de autorização Advertising API gerada', {
      redirectUri: this.redirectUri,
      scope: 'advertising::campaign_management'
    });
    
    return authUrl;
  }

  /**
   * Trocar código de autorização por tokens
   */
  async exchangeCodeForTokens(authCode) {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      
      // Salvar tokens
      this.tokens.accessToken = tokenData.access_token;
      this.tokens.refreshToken = tokenData.refresh_token;
      this.tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000) - 60000); // 1 min buffer
      
      // Persistir no banco
      await this.saveTokens({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: this.tokens.expiresAt.toISOString(),
        expires_in: tokenData.expires_in
      });
      
      secureLogger.info('✅ Tokens Advertising API obtidos com sucesso');
      return tokenData;
      
    } catch (error) {
      secureLogger.error('Erro ao trocar código por tokens:', error);
      throw error;
    }
  }

  /**
   * Renovar access token usando refresh token
   */
  async refreshAccessToken() {
    if (!this.tokens.refreshToken) {
      throw new Error('Refresh token não disponível. Reautorização necessária.');
    }

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.tokens.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      
      // Atualizar tokens
      this.tokens.accessToken = tokenData.access_token;
      this.tokens.expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000) - 60000);
      
      // Atualizar refresh token se fornecido
      if (tokenData.refresh_token) {
        this.tokens.refreshToken = tokenData.refresh_token;
      }
      
      // Persistir no banco
      await this.saveTokens({
        access_token: tokenData.access_token,
        refresh_token: this.tokens.refreshToken,
        expires_at: this.tokens.expiresAt.toISOString(),
        expires_in: tokenData.expires_in
      });
      
      secureLogger.info('✅ Access token Advertising API renovado');
      return tokenData.access_token;
      
    } catch (error) {
      secureLogger.error('Erro ao renovar access token:', error);
      throw error;
    }
  }

  /**
   * Obter access token válido (renova automaticamente se necessário)
   */
  async getValidAccessToken() {
    // Verificar se token atual ainda é válido
    if (this.tokens.accessToken && this.tokens.expiresAt && new Date() < this.tokens.expiresAt) {
      return this.tokens.accessToken;
    }

    // Token expirado ou inexistente, tentar renovar
    if (this.tokens.refreshToken) {
      return await this.refreshAccessToken();
    }

    // Sem refresh token, precisa reautorizar
    throw new Error('Token expirado e refresh token indisponível. Reautorização necessária.');
  }

  /**
   * Fazer chamada autenticada para Advertising API
   */
  async makeAuthenticatedRequest(endpoint, options = {}) {
    const accessToken = await this.getValidAccessToken();
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Amazon-Advertising-API-ClientId': this.clientId,
      ...options.headers
    };

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token inválido, tentar renovar uma vez
        secureLogger.warn('Token rejeitado, tentando renovar...');
        const newToken = await this.refreshAccessToken();
        
        // Retry com novo token
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${this.apiBaseUrl}${endpoint}`, {
          ...options,
          headers
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Advertising API error after token refresh: ${retryResponse.status}`);
        }
        
        return retryResponse;
      }
      
      throw new Error(`Advertising API error: ${response.status} - ${await response.text()}`);
    }

    return response;
  }

  /**
   * Obter perfis de advertising disponíveis
   */
  async getProfiles() {
    try {
      const response = await this.makeAuthenticatedRequest('/v2/profiles');
      const profiles = await response.json();
      
      secureLogger.info(`${profiles.length} perfis de advertising encontrados`);
      return profiles;
      
    } catch (error) {
      secureLogger.error('Erro ao obter perfis:', error);
      throw error;
    }
  }

  /**
   * Verificar status da autenticação
   */
  async checkAuthStatus() {
    try {
      const profiles = await this.getProfiles();
      return {
        authenticated: true,
        profilesCount: profiles.length,
        tokenExpiresAt: this.tokens.expiresAt
      };
    } catch (error) {
      return {
        authenticated: false,
        error: error.message,
        needsReauthorization: error.message.includes('Reautorização necessária')
      };
    }
  }
}

// Singleton
let instance = null;

module.exports = {
  getAdvertisingTokenManager: () => {
    if (!instance) {
      instance = new AdvertisingTokenManager();
    }
    return instance;
  },
  AdvertisingTokenManager
};