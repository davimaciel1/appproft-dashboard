const { executeSQL } = require('./DATABASE_ACCESS_CONFIG');

async function checkBuyBoxTable() {
  try {
    // Verificar estrutura da tabela
    const structure = await executeSQL(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'buy_box_history'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== ESTRUTURA DA TABELA buy_box_history ===');
    console.table(structure.rows);
    
    // Contar registros
    const count = await executeSQL('SELECT COUNT(*) FROM buy_box_history');
    console.log('\nTotal de registros:', count.rows[0].count);
    
    // Verificar se há algum registro
    const sample = await executeSQL('SELECT * FROM buy_box_history LIMIT 5');
    console.log('\nAmostra de dados:', sample.rows);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkBuyBoxTable();