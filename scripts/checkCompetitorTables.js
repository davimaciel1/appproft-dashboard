const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkCompetitorTables() {
  try {
    console.log('🔍 Verificando tabelas de competidores...\n');
    
    // Listar todas as tabelas relacionadas a competidores
    const tables = await executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE' 
      AND table_schema = 'public'
      AND (table_name LIKE '%competitor%' OR table_name LIKE '%buy_box%')
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas encontradas:');
    tables.rows.forEach(t => console.log(`   • ${t.table_name}`));
    
    // Verificar estrutura de cada tabela
    for (const table of tables.rows) {
      console.log(`\n📊 Estrutura da tabela ${table.table_name}:`);
      
      const columns = await executeSQL(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
        LIMIT 10
      `, [table.table_name]);
      
      columns.rows.forEach(col => {
        console.log(`   • ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
      
      // Contar registros
      const count = await executeSQL(`SELECT COUNT(*) FROM ${table.table_name}`);
      console.log(`   📈 Registros: ${count.rows[0].count}`);
    }
    
    // Verificar especificamente a tabela competitor_tracking_advanced
    console.log('\n🔎 Detalhes da tabela competitor_tracking_advanced:');
    
    const competitorColumns = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'competitor_tracking_advanced'
      ORDER BY ordinal_position
    `);
    
    if (competitorColumns.rows.length > 0) {
      console.log('   Colunas:');
      competitorColumns.rows.forEach(col => {
        console.log(`   • ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('   ❌ Tabela não encontrada ou sem colunas');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkCompetitorTables();