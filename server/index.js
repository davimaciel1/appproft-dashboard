require('dotenv').config({ path: '../.env' });
console.log('Server started with USE_MOCK_DATA:', process.env.USE_MOCK_DATA);
console.log('Amazon Client ID configured:', process.env.AMAZON_SP_API_CLIENT_ID ? 'Yes' : 'No');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const pool = require('./db/pool');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3003"],
    methods: ["GET", "POST"]
  }
});


// Configure CORS for production
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL || 'https://appproft.com']
  : ["http://localhost:3000", "http://localhost:3003"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

const authMiddleware = require('./middleware/auth');

app.use('/api/auth', require('./routes/auth-simple'));
app.use('/api/token-auth', require('./routes/token-auth'));
app.use('/api/marketplace', require('./routes/mercadolivre-callback'));
app.use('/api/amazon', authMiddleware, require('./routes/amazon'));
app.use('/api/mercadolivre', authMiddleware, require('./routes/mercadolivre'));
app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));
app.use('/api/sync', authMiddleware, require('./routes/sync'));

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
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log('Sistema de notificações ativo');
});

module.exports = { io };