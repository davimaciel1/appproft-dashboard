require('dotenv').config({ path: '../.env' });
console.log('Server started with USE_MOCK_DATA:', process.env.USE_MOCK_DATA);
console.log('Amazon Client ID configured:', process.env.AMAZON_SP_API_CLIENT_ID ? 'Yes' : 'No');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const pool = require('./db/pool');
const { helmetConfig, generalLimiter, authLimiter, corsOptions, validateProductionEnv } = require('./config/security');
const secureLogger = require('./utils/secureLogger');

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

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

const authMiddleware = require('./middleware/auth');
const { tenantIsolation } = require('./middleware/tenantIsolation');

app.use('/api/health', require('./routes/health'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/token-auth', require('./routes/token-auth'));
app.use('/api/marketplace', require('./routes/mercadolivre-callback'));
app.use('/api/amazon', authMiddleware, tenantIsolation, require('./routes/amazon'));
app.use('/api/mercadolivre', authMiddleware, tenantIsolation, require('./routes/mercadolivre'));
app.use('/api/dashboard', authMiddleware, tenantIsolation, require('./routes/dashboard'));
app.use('/api/sync', authMiddleware, tenantIsolation, require('./routes/sync'));
app.use('/api/credentials', authMiddleware, tenantIsolation, require('./routes/credentials'));

const notificationService = require('./services/notificationService');
const tokenManager = require('./services/tokenManager');

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  secureLogger.info('Servidor iniciado com sucesso', { port: PORT });
  
  // Sistema de renovação automática de tokens
  tokenManager.startAutoRenewal();
});

module.exports = { io };