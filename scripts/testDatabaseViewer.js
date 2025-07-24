const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function showTables() {
  try {
    console.log('=== VISUALIZADOR DE BANCO DE DADOS ===\n');
    
    // 1. Listar todas as tabelas
    const tablesQuery = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const tables = await executeSQL(tablesQuery);
    
    console.log('TABELAS NO BANCO DE DADOS:\n');
    
    // Para cada tabela, buscar contagem e mostrar primeiros registros
    for (const table of tables.rows) {
      console.log(`\n📋 ${table.table_name.toUpperCase()}`);
      console.log(`   Colunas: ${table.column_count}`);
      
      try {
        // Contagem
        const countResult = await executeSQL(`SELECT COUNT(*) as total FROM ${table.table_name}`);
        console.log(`   Registros: ${countResult.rows[0].total}`);
        
        // Estrutura
        const columnsResult = await executeSQL(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [table.table_name]);
        
        console.log(`   Estrutura:`);
        columnsResult.rows.forEach(col => {
          console.log(`     - ${col.column_name}: ${col.data_type}`);
        });
        
        // Amostra de dados
        if (countResult.rows[0].total > 0) {
          const sampleData = await executeSQL(`SELECT * FROM ${table.table_name} LIMIT 3`);
          console.log(`\n   Amostra de dados:`);
          sampleData.rows.forEach((row, idx) => {
            console.log(`   [${idx + 1}]`, JSON.stringify(row, null, 2));
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Erro ao acessar tabela: ${error.message}`);
      }
    }
    
    console.log('\n✅ Visualização concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

showTables();