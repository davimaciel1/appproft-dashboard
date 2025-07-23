const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Banco em memória simples
const users = new Map();

// Usuário padrão para teste
users.set('admin@appproft.com', {
  id: 1,
  name: 'Admin',
  email: 'admin@appproft.com',
  password: '123456' // Senha simples para desenvolvimento
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    console.log('📝 Tentativa de registro:', { email, name });
    
    if (users.has(email)) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }
    
    const user = {
      id: Date.now(),
      email,
      name,
      password // Sem hash para simplicidade em desenvolvimento
    };
    
    users.set(email, user);
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Usuário registrado:', email);
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('❌ Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Tentativa de login:', email);
    
    const user = users.get(email);
    
    if (!user) {
      console.log('❌ Usuário não encontrado:', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    if (user.password !== password) {
      console.log('❌ Senha incorreta para:', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login realizado:', email);
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar usuários (apenas para debug)
router.get('/users', (req, res) => {
  const userList = Array.from(users.values()).map(user => ({
    id: user.id,
    name: user.name,
    email: user.email
  }));
  
  res.json(userList);
});

module.exports = router;