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
}

// Singleton instance
const secureLogger = new SecureLogger();

module.exports = secureLogger;