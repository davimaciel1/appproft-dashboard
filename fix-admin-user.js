const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
});

async function fixAdminUser() {
  console.log('=== CORRIGINDO USUÁRIO ADMIN ===\n');
  
  try {
    // Verificar se o usuário existe
    const checkUser = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      ['admin@appproft.com']
    );
    
    if (checkUser.rows.length > 0) {
      console.log('✅ Usuário admin já existe. Atualizando senha...');
      
      // Atualizar senha
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, 'admin@appproft.com']
      );
      
      console.log('✅ Senha atualizada com sucesso!');
    } else {
      console.log('⚠️ Usuário admin não existe. Criando...');
      
      // Criar usuário
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      const result = await pool.query(
        'INSERT INTO users (email, password, role, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
        ['admin@appproft.com', hashedPassword, 'admin']
      );
      
      console.log('✅ Usuário admin criado com sucesso! ID:', result.rows[0].id);
    }
    
    console.log('\nCredenciais do admin:');
    console.log('Email: admin@appproft.com');
    console.log('Senha: Admin@123');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

fixAdminUser();