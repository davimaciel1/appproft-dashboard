const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
});

(async () => {
  try {
    // Verificar estrutura da tabela orders
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    
    console.log('\nColunas da tabela orders:');
    result.rows.forEach(col => console.log(`- ${col.column_name}: ${col.data_type}`));
    
    // Verificar constraint
    const constraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'orders'::regclass
    `);
    
    console.log('\nConstraints:');
    constraints.rows.forEach(c => console.log(`- ${c.conname}`));
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await pool.end();
  }
})();