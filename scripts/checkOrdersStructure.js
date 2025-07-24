const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkOrdersStructure() {
  try {
    const result = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    
    console.log('Estrutura da tabela orders:');
    result.rows.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkOrdersStructure();