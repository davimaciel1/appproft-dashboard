const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
});

(async () => {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas da tabela users:');
    result.rows.forEach(col => console.log(`- ${col.column_name}: ${col.data_type}`));
    
    // Verificar usuários existentes
    const users = await pool.query('SELECT id, email, created_at FROM users');
    console.log('\nUsuários existentes:');
    users.rows.forEach(u => console.log(`- [${u.id}] ${u.email}`));
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await pool.end();
  }
})();