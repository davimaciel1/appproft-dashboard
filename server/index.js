require('dotenv').config();
console.log('Server started with USE_MOCK_DATA:', process.env.USE_MOCK_DATA);

// Verificar credenciais LWA obrigatórias
const lwaClientId = process.env.LWA_CLIENT_ID || process.env.AMAZON_CLIENT_ID || process.env.AMAZON_SP_API_CLIENT_ID;
const lwaClientSecret = process.env.LWA_CLIENT_SECRET || process.env.AMAZON_CLIENT_SECRET || process.env.AMAZON_SP_API_CLIENT_SECRET;

console.log('=== AMAZON LWA CREDENTIALS CHECK ===');
console.log('LWA Client ID configured:', !!lwaClientId ? 'Yes' : 'No');
console.log('LWA Client Secret configured:', !!lwaClientSecret ? 'Yes' : 'No');

if (!lwaClientId || !lwaClientSecret) {
  console.error('❌ ERRO CRÍTICO: LWA Client ID e Client Secret são obrigatórios para OAuth Amazon!');
  console.error('Configure no .env: LWA_CLIENT_ID e LWA_CLIENT_SECRET');
} else {
  console.log('✅ Credenciais LWA configuradas corretamente');
}
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const pool = require('./db/pool');
const { helmetConfig, generalLimiter, authLimiter, corsOptions, validateProductionEnv } = require('./config/security');
const secureLogger = require('./utils/secureLogger');
const tokenRenewalService = require('./services/tokenRenewalService');

const app = express();

// IMPORTANTE: Configurar trust proxy ANTES de outros middlewares
app.set('trust proxy', true);
console.log('Trust proxy configurado:', app.get('trust proxy'));
console.log('CORS_ORIGINS do ambiente:', process.env.CORS_ORIGINS);

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3003"],
    methods: ["GET", "POST"]
  }
});


// Validar ambiente de produção
if (process.env.NODE_ENV === 'production') {
  validateProductionEnv();
}

// Segurança
app.use(helmetConfig);
app.use(generalLimiter);
app.use(cors(corsOptions));

app.use(express.json());

// Middleware de debug - mostrar todas as requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (req.originalUrl.includes('/api/dashboard')) {
    console.log('Headers:', req.headers);
    console.log('Query:', req.query);
  }
  next();
});

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

const authMiddleware = require('./middleware/auth');
const autoAuthMiddleware = require('./middleware/autoAuth');
const { tenantIsolation } = require('./middleware/tenantIsolation');

app.use('/api/health', require('./routes/health'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/token-auth', require('./routes/token-auth'));
app.use('/api/marketplace', require('./routes/mercadolivre-callback'));
app.use('/api/amazon', authMiddleware, tenantIsolation, require('./routes/amazon'));
app.use('/api/mercadolivre', authMiddleware, tenantIsolation, require('./routes/mercadolivre'));
app.use('/api/dashboard', autoAuthMiddleware, tenantIsolation, require('./routes/dashboard-fallback'));
app.use('/api/dashboard/database', autoAuthMiddleware, tenantIsolation, require('./routes/dashboard-database'));
app.use('/api/dashboard-local', authMiddleware, require('./routes/dashboardLocal'));
app.use('/api/products', authMiddleware, tenantIsolation, require('./routes/products/summary'));
app.use('/api/sync', authMiddleware, tenantIsolation, require('./routes/sync/trigger'));
app.use('/api/credentials', authMiddleware, tenantIsolation, require('./routes/credentials'));
app.use('/auth', require('./routes/auth-callback'));
app.use('/auth', require('./routes/oauth-debug'));
app.use('/api/lwa', require('./routes/lwa-check'));
app.use('/api/public', require('./routes/public-metrics')); // Rota pública temporária
// app.use('/api/public-db', require('./routes/database-viewer-api')); // Removido por segurança
app.use('/db-viewer', require('./routes/database-viewer-public')); // Página HTML do banco
app.use('/api/data-kiosk', authMiddleware, require('./routes/dataKiosk')); // Data Kiosk routes
app.use('/api/database', authMiddleware, require('./routes/database-viewer')); // Database viewer
app.use('/api/buybox', authMiddleware, require('./routes/buyBoxDashboard')); // Buy Box Dashboard
app.use('/api/buybox', authMiddleware, require('./routes/buyBoxSync')); // Buy Box Sync
app.use('/api/brand-owner', autoAuthMiddleware, require('./routes/brandOwnerAPI')); // Brand Owner API
app.use('/api/profit-detector', authMiddleware, require('./routes/profitDetectorAPI')); // Profit Leak Detector

const notificationService = require('./services/notificationService');
const tokenManager = require('./services/tokenManager');
const schedulerService = require('./services/schedulerService');

io.on('connection', (socket) => {
  console.log('Novo cliente conectado');
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Serve React app for any non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Inicializar serviço de notificações
notificationService.initialize(io);

// Make io globally available for sync service
global.io = io;

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  secureLogger.info('Servidor iniciado com sucesso', { port: PORT });
  
  // Executar migração automática
  try {
    const autoMigrate = require('./db/auto-migrate');
    await autoMigrate();
    secureLogger.info('Verificação de migração concluída');
  } catch (error) {
    secureLogger.error('Erro na migração automática', { error: error.message });
  }
  
  // Iniciar serviço de agendamento automático
  try {
    await schedulerService.start();
    secureLogger.info('✅ Sincronização automática de Buy Box ativada');
  } catch (error) {
    secureLogger.error('Erro ao iniciar scheduler', { error: error.message });
  }
  
  // Sistema de renovação automática de tokens
  tokenRenewalService.startAutoRenewal();
  secureLogger.info('Sistema de renovação automática de tokens iniciado');
  
  // Start main sync worker para popular banco de dados
  try {
    const mainSyncWorker = require('../workers/mainSyncWorker');
    await mainSyncWorker.start();
    secureLogger.info('Worker de sincronização automática iniciado - sincronizando a cada 60 segundos');
    console.log('✅ Worker de sincronização iniciado - populando banco de dados automaticamente');
  } catch (error) {
    secureLogger.error('Erro ao iniciar worker de sincronização', { error: error.message });
    console.error('❌ Erro ao iniciar worker:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  secureLogger.info('SIGTERM recebido, encerrando servidor...');
  
  // Parar scheduler
  schedulerService.stop();
  
  // Fechar servidor
  server.close(() => {
    secureLogger.info('Servidor encerrado');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  secureLogger.info('SIGINT recebido, encerrando servidor...');
  
  // Parar scheduler
  schedulerService.stop();
  
  // Fechar servidor
  server.close(() => {
    secureLogger.info('Servidor encerrado');
    process.exit(0);
  });
});

module.exports = { io };