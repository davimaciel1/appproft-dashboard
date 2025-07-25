const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkTableStructure() {
  console.log('🔍 Verificando estrutura das tabelas...\n');
  
  try {
    // Listar todas as tabelas
    const tables = await executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Tabelas encontradas:');
    console.table(tables.rows);
    
    // Para cada tabela relevante, mostrar as colunas
    const relevantTables = ['competitor_tracking_advanced', 'buy_box_history', 'products', 'orders', 'ai_insights_advanced'];
    
    for (const tableName of relevantTables) {
      console.log(`\n📋 Estrutura da tabela: ${tableName}`);
      
      const columns = await executeSQL(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [tableName]);
      
      if (columns.rows.length > 0) {
        console.table(columns.rows);
        
        // Mostrar alguns registros de exemplo
        console.log(`\n📝 Primeiros 3 registros de ${tableName}:`);
        const sample = await executeSQL(`SELECT * FROM ${tableName} LIMIT 3`);
        if (sample.rows.length > 0) {
          console.table(sample.rows);
        } else {
          console.log('✅ Tabela vazia');
        }
      } else {
        console.log(`❌ Tabela ${tableName} não encontrada`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkTableStructure().then(() => {
  console.log('\n✅ Verificação concluída!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});