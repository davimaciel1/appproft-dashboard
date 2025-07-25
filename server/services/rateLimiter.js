/**
 * Sistema de Rate Limiting para APIs Amazon
 * Implementa token bucket algorithm para respeitar limites das APIs
 */

const { executeSQL } = require('../utils/executeSQL');
const secureLogger = require('../utils/secureLogger');

class RateLimiter {
  constructor() {
    // Limites oficiais atualizados das APIs Amazon (2024-2025)
    this.limits = {
      'sp-api': {
        // Orders API - LIMITES MUITO BAIXOS!
        '/orders/v0/orders': { rate: 0.0167, burst: 20 }, // 1 req por minuto!
        '/orders/v0/orders/{orderId}': { rate: 0.5, burst: 30 }, // 0.5/sec
        '/orders/v0/orders/{orderId}/items': { rate: 0.5, burst: 30 }, // 0.5/sec
        
        // Inventory API - CONFIRMAR LIMITES ATUAIS
        '/fba/inventory/v1/summaries': { rate: 2, burst: 2 }, // Estimado - verificar docs
        
        // Catalog Items API - CONFIRMADOS
        '/catalog/v2022-04-01/items': { rate: 2, burst: 2 }, // 2/sec confirmado
        '/catalog/v2022-04-01/items/{asin}': { rate: 2, burst: 2 }, // 2/sec confirmado
        '/catalog/v2022-04-01/items/search': { rate: 2, burst: 2 }, // 2/sec confirmado
        
        // Product Pricing API
        '/products/pricing/v0/price': { rate: 10, burst: 20 }, // 10/sec
        '/products/pricing/v0/competitivePrice': { rate: 10, burst: 20 },
        '/products/pricing/v0/items/{asin}/offers': { rate: 5, burst: 10 },
        
        // Product Fees API
        '/products/fees/v0/feesEstimate': { rate: 10, burst: 20 },
        
        // Reports API
        '/reports/2021-06-30/reports': { rate: 2, burst: 15 }, // 2/sec, burst 15
        '/reports/2021-06-30/documents/{documentId}': { rate: 2, burst: 15 },
        
        // Default for unknown endpoints
        'default': { rate: 5, burst: 10 }
      },
      'advertising-api': {
        // Campaign endpoints
        '/v2/sp/campaigns': { rate: 10, burst: 10 },
        '/v2/sp/campaigns/report': { rate: 1, burst: 5 }, // Reports são mais pesados
        
        // Keywords endpoints
        '/v2/sp/keywords': { rate: 10, burst: 10 },
        '/v2/sp/keywords/report': { rate: 1, burst: 5 },
        
        // Search Terms
        '/v2/sp/searchTerms/report': { rate: 1, burst: 5 },
        
        // Default
        'default': { rate: 5, burst: 10 }
      }
    };
    
    // Cache de buckets em memória para performance
    this.buckets = new Map();
    
    // Intervalo para persistir estado no banco
    this.persistInterval = setInterval(() => this.persistBuckets(), 30000); // 30 segundos
  }
  
  /**
   * Verifica se pode fazer a chamada e consome token se disponível
   * @param {string} api - 'sp-api' ou 'advertising-api'
   * @param {string} endpoint - Endpoint da API
   * @param {string} tenantId - ID do tenant
   * @returns {Object} { allowed: boolean, waitTime: number }
   */
  async checkAndConsume(api, endpoint, tenantId = 'default') {
    const bucketKey = `${api}:${endpoint}:${tenantId}`;
    
    // Buscar ou criar bucket
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = await this.loadOrCreateBucket(api, endpoint, tenantId);
      this.buckets.set(bucketKey, bucket);
    }
    
    // Atualizar tokens baseado no tempo passado
    this.refillTokens(bucket);
    
    // Verificar se tem token disponível
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      bucket.lastCallAt = new Date();
      bucket.callsThisHour += 1;
      bucket.callsToday += 1;
      
      secureLogger.debug('Rate limit check passed', {
        api,
        endpoint,
        tokensRemaining: Math.floor(bucket.tokens),
        rate: bucket.rate
      });
      
      return { allowed: true, waitTime: 0 };
    }
    
    // Calcular tempo de espera
    const waitTime = this.calculateWaitTime(bucket);
    
    secureLogger.warn('Rate limit exceeded', {
      api,
      endpoint,
      waitTime,
      tokensAvailable: bucket.tokens
    });
    
    return { allowed: false, waitTime };
  }
  
  /**
   * Carrega bucket do banco ou cria novo
   */
  async loadOrCreateBucket(api, endpoint, tenantId) {
    try {
      // Tentar carregar do banco
      const result = await executeSQL(`
        SELECT * FROM api_rate_limits
        WHERE api_name = $1 AND endpoint = $2 AND tenant_id = $3
      `, [api, endpoint, tenantId]);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          api,
          endpoint,
          tenantId,
          rate: parseFloat(row.calls_per_second),
          burst: row.burst_size,
          tokens: parseFloat(row.tokens_available),
          lastRefillAt: new Date(row.last_refill_at),
          callsToday: row.calls_today,
          callsThisHour: row.calls_this_hour,
          lastCallAt: row.last_call_at ? new Date(row.last_call_at) : null
        };
      }
    } catch (error) {
      secureLogger.error('Erro ao carregar bucket do banco', { error: error.message });
    }
    
    // Criar novo bucket
    const limits = this.getLimits(api, endpoint);
    const now = new Date();
    
    const bucket = {
      api,
      endpoint,
      tenantId,
      rate: limits.rate,
      burst: limits.burst,
      tokens: limits.burst, // Começa com burst completo
      lastRefillAt: now,
      callsToday: 0,
      callsThisHour: 0,
      lastCallAt: null
    };
    
    // Salvar no banco
    await this.saveBucket(bucket);
    
    return bucket;
  }
  
  /**
   * Obtém limites para endpoint específico
   */
  getLimits(api, endpoint) {
    const apiLimits = this.limits[api] || this.limits['sp-api'];
    
    // Procurar match exato
    if (apiLimits[endpoint]) {
      return apiLimits[endpoint];
    }
    
    // Procurar match parcial (para endpoints com parâmetros)
    for (const [pattern, limits] of Object.entries(apiLimits)) {
      if (pattern === 'default') continue;
      
      // Converter pattern para regex (substitui {param} por .*)
      const regex = new RegExp('^' + pattern.replace(/\{[^}]+\}/g, '[^/]+') + '$');
      if (regex.test(endpoint)) {
        return limits;
      }
    }
    
    // Retornar default
    return apiLimits.default;
  }
  
  /**
   * Reabastece tokens baseado no tempo passado
   */
  refillTokens(bucket) {
    const now = new Date();
    const timePassed = (now - bucket.lastRefillAt) / 1000; // em segundos
    
    if (timePassed > 0) {
      // Adicionar tokens baseado na taxa
      const tokensToAdd = timePassed * bucket.rate;
      bucket.tokens = Math.min(bucket.tokens + tokensToAdd, bucket.burst);
      bucket.lastRefillAt = now;
      
      // Reset contadores por hora
      const hoursPassed = Math.floor((now - bucket.lastCallAt) / (1000 * 60 * 60));
      if (hoursPassed >= 1) {
        bucket.callsThisHour = 0;
      }
      
      // Reset contadores diários
      if (bucket.lastCallAt) {
        const lastCallDate = bucket.lastCallAt.toDateString();
        const currentDate = now.toDateString();
        if (lastCallDate !== currentDate) {
          bucket.callsToday = 0;
        }
      }
    }
  }
  
  /**
   * Calcula tempo de espera até ter tokens disponíveis
   */
  calculateWaitTime(bucket) {
    if (bucket.tokens >= 1) return 0;
    
    const tokensNeeded = 1 - bucket.tokens;
    const waitTimeSeconds = tokensNeeded / bucket.rate;
    
    return Math.ceil(waitTimeSeconds * 1000); // em milissegundos
  }
  
  /**
   * Salva bucket no banco de dados
   */
  async saveBucket(bucket) {
    try {
      await executeSQL(`
        INSERT INTO api_rate_limits 
        (api_name, endpoint, tenant_id, calls_per_second, burst_size, 
         tokens_available, last_refill_at, calls_today, calls_this_hour, last_call_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (api_name, endpoint, tenant_id) DO UPDATE SET
          tokens_available = $6,
          last_refill_at = $7,
          calls_today = $8,
          calls_this_hour = $9,
          last_call_at = $10
      `, [
        bucket.api,
        bucket.endpoint,
        bucket.tenantId,
        bucket.rate,
        bucket.burst,
        bucket.tokens,
        bucket.lastRefillAt,
        bucket.callsToday,
        bucket.callsThisHour,
        bucket.lastCallAt
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar bucket', { error: error.message });
    }
  }
  
  /**
   * Persiste todos os buckets em memória
   */
  async persistBuckets() {
    for (const bucket of this.buckets.values()) {
      await this.saveBucket(bucket);
    }
  }
  
  /**
   * Aguarda até ter tokens disponíveis
   */
  async waitForToken(api, endpoint, tenantId = 'default', maxWaitTime = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.checkAndConsume(api, endpoint, tenantId);
      
      if (result.allowed) {
        return true;
      }
      
      // Aguardar o tempo recomendado ou 100ms (o que for maior)
      const waitTime = Math.max(result.waitTime, 100);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    throw new Error(`Timeout esperando por token de rate limit (${maxWaitTime}ms)`);
  }
  
  /**
   * Obtém estatísticas de uso
   */
  async getUsageStats(tenantId = 'default') {
    try {
      const result = await executeSQL(`
        SELECT 
          api_name,
          COUNT(DISTINCT endpoint) as endpoints_used,
          SUM(calls_today) as total_calls_today,
          SUM(calls_this_hour) as total_calls_hour,
          AVG(tokens_available) as avg_tokens_available
        FROM api_rate_limits
        WHERE tenant_id = $1
        GROUP BY api_name
      `, [tenantId]);
      
      return result.rows;
    } catch (error) {
      secureLogger.error('Erro ao obter estatísticas', { error: error.message });
      return [];
    }
  }
  
  /**
   * Reseta contadores (útil para testes)
   */
  async resetCounters(api, endpoint, tenantId = 'default') {
    const bucketKey = `${api}:${endpoint}:${tenantId}`;
    const bucket = this.buckets.get(bucketKey);
    
    if (bucket) {
      bucket.tokens = bucket.burst;
      bucket.callsToday = 0;
      bucket.callsThisHour = 0;
      bucket.lastRefillAt = new Date();
      
      await this.saveBucket(bucket);
    }
    
    await executeSQL(`
      UPDATE api_rate_limits
      SET tokens_available = burst_size,
          calls_today = 0,
          calls_this_hour = 0,
          last_refill_at = NOW()
      WHERE api_name = $1 AND endpoint = $2 AND tenant_id = $3
    `, [api, endpoint, tenantId]);
  }
  
  /**
   * Limpa recursos ao desligar
   */
  async shutdown() {
    clearInterval(this.persistInterval);
    await this.persistBuckets();
  }
}

// Singleton
let instance = null;

module.exports = {
  getRateLimiter: () => {
    if (!instance) {
      instance = new RateLimiter();
    }
    return instance;
  },
  
  // Middleware para Express
  rateLimitMiddleware: (api) => {
    return async (req, res, next) => {
      const rateLimiter = module.exports.getRateLimiter();
      const endpoint = req.baseUrl + req.path;
      const tenantId = req.user?.tenantId || 'default';
      
      try {
        const result = await rateLimiter.checkAndConsume(api, endpoint, tenantId);
        
        if (!result.allowed) {
          res.setHeader('X-RateLimit-Limit', rateLimiter.getLimits(api, endpoint).rate);
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.waitTime).toISOString());
          res.setHeader('Retry-After', Math.ceil(result.waitTime / 1000));
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Please retry after ${Math.ceil(result.waitTime / 1000)} seconds`,
            retryAfter: result.waitTime
          });
        }
        
        // Adicionar headers de rate limit
        const bucket = rateLimiter.buckets.get(`${api}:${endpoint}:${tenantId}`);
        res.setHeader('X-RateLimit-Limit', bucket.rate);
        res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.tokens));
        
        next();
      } catch (error) {
        secureLogger.error('Erro no rate limit middleware', { error: error.message });
        next(); // Permitir em caso de erro
      }
    };
  }
};