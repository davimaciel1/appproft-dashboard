const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
});

(async () => {
  try {
    console.log('🔐 Criando usuário de teste e token...');
    
    // Usar usuário admin existente
    const userId = 1;
    const userEmail = 'admin@appproft.com';
    console.log('✅ Usando usuário existente ID:', userId);
    
    // Criar token JWT
    const token = jwt.sign(
      { 
        id: userId, 
        email: userEmail,
        userId: userId
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      { expiresIn: '7d' }
    );
    
    console.log('\n🎉 Token JWT criado com sucesso!');
    console.log('\n🔑 Use este token para acessar a API:');
    console.log('\nBearer', token);
    
    console.log('\n📝 Exemplo de uso com curl:');
    console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/dashboard/products?period=30d&marketplace=all`);
    
    console.log('\n🌐 Ou acesse o dashboard no navegador e use o console:');
    console.log(`localStorage.setItem('token', '${token}');`);
    console.log('window.location.reload();');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
})();