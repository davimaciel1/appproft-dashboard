const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkCompetitorStructure() {
  try {
    // Verificar estrutura de competitor_tracking_advanced
    const columns = await executeSQL(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'competitor_tracking_advanced'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas em competitor_tracking_advanced:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}`);
    });
    
    // Verificar alguns dados
    const data = await executeSQL(`
      SELECT * FROM competitor_tracking_advanced LIMIT 2
    `);
    
    console.log('\n📊 Exemplo de dados:');
    if (data.rows.length > 0) {
      console.log(JSON.stringify(data.rows[0], null, 2));
    }
    
    // Verificar estrutura de buy_box_history
    const buyBoxColumns = await executeSQL(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'buy_box_history'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estrutura de buy_box_history:');
    buyBoxColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkCompetitorStructure();