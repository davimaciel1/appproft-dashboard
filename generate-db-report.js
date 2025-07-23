const { getAllTables, getTableRowCount, executeSQL } = require('./DATABASE_ACCESS_CONFIG');

async function generateDatabaseReport() {
  console.log('=== RELATÓRIO DO BANCO DE DADOS ===\n');
  
  try {
    // 1. Listar todas as tabelas
    console.log('📊 TABELAS DISPONÍVEIS:');
    const tablesResult = await getAllTables();
    
    if (tablesResult.rows.length === 0) {
      console.log('Nenhuma tabela encontrada no banco de dados.');
      return;
    }
    
    console.log('\nSchema | Tabela | Tamanho');
    console.log('--------|---------|--------');
    for (const table of tablesResult.rows) {
      console.log(`${table.schemaname} | ${table.tablename} | ${table.size}`);
    }
    
    // 2. Contar registros em cada tabela
    console.log('\n📈 CONTAGEM DE REGISTROS:');
    for (const table of tablesResult.rows) {
      try {
        const countResult = await getTableRowCount(table.tablename, table.schemaname);
        console.log(`${table.schemaname}.${table.tablename}: ${countResult.rows[0].count} registros`);
      } catch (err) {
        console.log(`${table.schemaname}.${table.tablename}: Erro ao contar`);
      }
    }
    
    // 3. Informações do banco
    console.log('\n🔧 INFORMAÇÕES DO BANCO:');
    const dbInfo = await executeSQL(`
      SELECT 
        current_database() as database,
        pg_database_size(current_database()) as size,
        pg_size_pretty(pg_database_size(current_database())) as size_pretty,
        version() as version
    `);
    
    const info = dbInfo.rows[0];
    console.log(`Database: ${info.database}`);
    console.log(`Tamanho: ${info.size_pretty}`);
    console.log(`Versão: ${info.version.split(',')[0]}`);
    
  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error.message);
  }
}

// Executar o relatório
generateDatabaseReport();