/**
 * Configurações de Segurança para Produção
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const secureLogger = require('../utils/secureLogger');

/**
 * Configuração do Helmet para segurança
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'", "https://api.mercadolibre.com", "https://sellingpartnerapi-na.amazon.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Rate limiting por IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: 'Muitas requisições deste IP',
  handler: (req, res) => {
    secureLogger.warn('Rate limit excedido', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({ error: 'Muitas requisições. Tente novamente mais tarde.' });
  }
});

/**
 * Rate limiting para autenticação (mais restritivo)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas de login
  skipSuccessfulRequests: true,
  message: 'Muitas tentativas de login',
  handler: (req, res) => {
    secureLogger.warn('Muitas tentativas de login', {
      ip: req.ip,
      email: req.body?.email
    });
    res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  }
});

/**
 * CORS configurado para origens permitidas
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Usar CORS_ORIGINS do ambiente ou fallback para valores padrão
    const corsOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : ['https://appproft.com', 'https://www.appproft.com', 'https://app.appproft.com'];
    
    // Em produção, adicionar também versões HTTP
    const allowedOrigins = [
      ...corsOrigins,
      'http://appproft.com',
      'http://www.appproft.com',
      'http://localhost:3000',
      'http://localhost:3003'
    ];
    
    // Log para debug
    console.log('CORS check - Origin:', origin);
    console.log('CORS check - Allowed:', allowedOrigins);
    
    // Permite requisições sem origin (ex: Postman) apenas em dev
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Em produção, permitir requisições sem origin também (para healthcheck)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      secureLogger.warn('CORS bloqueado', {
        origin,
        allowedOrigins
      });
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 horas
};

/**
 * Validação de ambiente de produção
 */
const validateProductionEnv = () => {
  const requiredEnvVars = [
    'NODE_ENV',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'DATABASE_URL'
  ];
  
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    secureLogger.error('Variáveis de ambiente obrigatórias faltando', {
      missing
    });
    throw new Error('Configuração de produção incompleta');
  }
  
  // Validações específicas
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  }
  
  if (process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY deve ter pelo menos 32 caracteres');
  }
  
  if (process.env.NODE_ENV !== 'production') {
    secureLogger.warn('Sistema rodando fora do modo production');
  }
};

module.exports = {
  helmetConfig,
  generalLimiter,
  authLimiter,
  corsOptions,
  validateProductionEnv
};