const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Banco de dados em memória para desenvolvimento
const users = new Map();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Usar banco em memória se PostgreSQL não estiver disponível
    if (process.env.USE_MOCK_DATA === 'true' || !pool) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: Date.now(),
        email,
        name,
        password: hashedPassword
      };
      
      users.set(email, user);
      
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      return res.json({
        token,
        user: { id: user.id, email, name }
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );
    
    const token = jwt.sign(
      { userId: result.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    
    // Se for erro de conexão com banco, usar memória
    if (error.code === 'ECONNREFUSED') {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: Date.now(),
        email,
        name,
        password: hashedPassword
      };
      
      users.set(email, user);
      
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      return res.json({
        token,
        user: { id: user.id, email, name }
      });
    }
    
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, USE_MOCK_DATA: process.env.USE_MOCK_DATA });
    
    // Usar banco em memória se PostgreSQL não estiver disponível
    if (process.env.USE_MOCK_DATA === 'true' || !pool) {
      const user = users.get(email);
      
      if (!user) {
        // Se não existe, criar usuário automaticamente para facilitar teste
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
          id: Date.now(),
          email,
          name: email.split('@')[0],
          password: hashedPassword
        };
        users.set(email, newUser);
        
        const token = jwt.sign(
          { userId: newUser.id },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        return res.json({
          token,
          user: { id: newUser.id, email, name: newUser.name }
        });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }
      
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      return res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name }
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

module.exports = router;