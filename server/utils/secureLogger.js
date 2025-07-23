/**
 * SecureLogger - NUNCA loga informações sensíveis
 * Baseado nas especificações de segurança do CLAUDE.md
 */

class SecureLogger {
  constructor() {
    this.sensitivePatterns = [
      /password/i,
      /token/i,
      /key/i,
      /secret/i,
      /credential/i,
      /api[-_]?key/i,
      /access[-_]?token/i,
      /refresh[-_]?token/i,
      /bearer/i,
      /authorization/i,
      /cookie/i,
      /session/i,
      /credit[-_]?card/i,
      /cvv/i,
      /ssn/i,
      /tax[-_]?id/i,
      /cpf/i,
      /cnpj/i
    ];

    this.redactValue = '[REDACTED]';
  }

  /**
   * Sanitiza um objeto removendo valores sensíveis
   */
  sanitize(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Verifica se a chave contém informação sensível
        const isSensitiveKey = this.sensitivePatterns.some(pattern => 
          pattern.test(key)
        );

        if (isSensitiveKey) {
          sanitized[key] = this.redactValue;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Recursivamente sanitiza objetos aninhados
          sanitized[key] = this.sanitize(obj[key]);
        } else if (typeof obj[key] === 'string') {
          // Verifica se o valor parece ser sensível
          const isSensitiveValue = this.looksLikeSensitiveData(obj[key]);
          sanitized[key] = isSensitiveValue ? this.redactValue : obj[key];
        } else {
          sanitized[key] = obj[key];
        }
      }
    }

    return sanitized;
  }

  /**
   * Verifica se uma string parece conter dados sensíveis
   */
  looksLikeSensitiveData(value) {
    if (!value || typeof value !== 'string') return false;

    // Padrões de dados sensíveis
    const patterns = [
      /^Bearer\s+/i,                    // Bearer tokens
      /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/, // JWT
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/, // Senhas fortes
      /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/, // Cartão de crédito
      /^[0-9]{11}$|^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$/, // CPF
      /^[0-9]{14}$|^[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}$/, // CNPJ
      /^AKIA[0-9A-Z]{16}$/,             // AWS Access Key
      /^[0-9a-zA-Z/+=]{40}$/,           // AWS Secret Key pattern
      /^amzn1\./,                       // Amazon tokens
      /^APP[-_]USR/,                    // MercadoLibre tokens
      /^sk_live_[0-9a-zA-Z]{24,}/,     // Stripe keys
      /^pk_live_[0-9a-zA-Z]{24,}/      // Stripe public keys
    ];

    return patterns.some(pattern => pattern.test(value));
  }

  /**
   * Log seguro - remove informações sensíveis
   */
  log(level, message, data = {}) {
    const sanitizedData = this.sanitize(data);
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      level,
      message,
      ...(Object.keys(sanitizedData).length > 0 && { data: sanitizedData })
    };

    console.log(JSON.stringify(logEntry));
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  debug(message, data) {
    if (process.env.NODE_ENV === 'development') {
      this.log('DEBUG', message, data);
    }
  }

  /**
   * Cria uma versão segura do objeto de requisição Express
   */
  sanitizeRequest(req) {
    return this.sanitize({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      body: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.userId || req.user?.id
    });
  }

  /**
   * Cria uma versão segura do erro
   */
  sanitizeError(error) {
    return {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: error.code,
      statusCode: error.statusCode
    };
  }

  /**
   * Mascara dados sensíveis em strings
   */
  maskSensitiveData(str) {
    if (!str || typeof str !== 'string') return str;

    // Mascara tokens (mantém apenas primeiros 10 caracteres)
    str = str.replace(/([A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/g, (match) => {
      return match.substring(0, 10) + '...';
    });

    // Mascara Bearer tokens
    str = str.replace(/Bearer\s+([A-Za-z0-9-_=]+)/gi, 'Bearer xxx...');

    // Mascara emails (mantém domínio)
    str = str.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, user, domain) => {
      return user.substring(0, 3) + '***@' + domain;
    });

    // Mascara CPF
    str = str.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, 'XXX.XXX.XXX-XX');
    
    // Mascara CNPJ
    str = str.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, 'XX.XXX.XXX/XXXX-XX');

    // Mascara cartão de crédito
    str = str.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, 'XXXX-XXXX-XXXX-XXXX');

    return str;
  }

  /**
   * Log de auditoria para ações críticas
   */
  audit(userId, action, details = {}) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      userId,
      action,
      details: this.sanitize(details),
      ip: details.ip,
      userAgent: details.userAgent
    };

    // Em produção, isso deveria ir para um sistema de auditoria separado
    console.log('[AUDIT]', JSON.stringify(auditEntry));
  }

  /**
   * Log de métricas de performance
   */
  performance(operation, duration, metadata = {}) {
    const perfEntry = {
      timestamp: new Date().toISOString(),
      level: 'PERFORMANCE',
      operation,
      duration: `${duration}ms`,
      ...this.sanitize(metadata)
    };

    if (duration > 1000) {
      perfEntry.warning = 'Slow operation detected';
    }

    console.log('[PERF]', JSON.stringify(perfEntry));
  }

  /**
   * Cria um logger contextual para requisições
   */
  createRequestLogger(req) {
    const requestId = req.id || Math.random().toString(36).substring(7);
    const startTime = Date.now();

    return {
      info: (message, data) => {
        this.info(`[${requestId}] ${message}`, { ...data, requestId });
      },
      warn: (message, data) => {
        this.warn(`[${requestId}] ${message}`, { ...data, requestId });
      },
      error: (message, data) => {
        this.error(`[${requestId}] ${message}`, { ...data, requestId });
      },
      debug: (message, data) => {
        this.debug(`[${requestId}] ${message}`, { ...data, requestId });
      },
      performance: (operation) => {
        const duration = Date.now() - startTime;
        this.performance(operation, duration, { requestId });
      }
    };
  }
}

// Singleton instance
const secureLogger = new SecureLogger();

module.exports = secureLogger;