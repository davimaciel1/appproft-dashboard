const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Middleware que usa automaticamente um usuário padrão se token não for fornecido
module.exports = async (req, res, next) => {
  try {
    // Verificar se já tem token no header
    const providedToken = req.header('Authorization')?.replace('Bearer ', '');
    
    if (providedToken) {
      // Se token foi fornecido, validar normalmente
      try {
        const decoded = jwt.verify(providedToken, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        return next();
      } catch (error) {
        return res.status(401).json({ error: 'Token inválido.' });
      }
    }
    
    // Se não tem token, usar usuário padrão do banco
    console.log('🔄 Nenhum token fornecido, usando usuário padrão do banco...');
    
    const result = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Nenhum usuário encontrado no banco de dados. Cadastre um usuário primeiro.' 
      });
    }
    
    // Usar o primeiro usuário do banco (admin)
    req.userId = result.rows[0].id;
    console.log(`✅ Usando usuário padrão ID: ${req.userId}`);
    
    next();
    
  } catch (error) {
    console.error('Erro no middleware de auto-auth:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro interno de autenticação' });
  }
};