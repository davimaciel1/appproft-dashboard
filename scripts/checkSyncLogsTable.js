const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkSyncLogsTable() {
  try {
    // Verificar se a tabela existe
    const tableExists = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sync_logs'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabela sync_logs não existe!');
      console.log('\nCriando tabela sync_logs...');
      
      await executeSQL(`
        CREATE TABLE IF NOT EXISTS sync_logs (
          id SERIAL PRIMARY KEY,
          marketplace VARCHAR(50) NOT NULL,
          sync_type VARCHAR(50) NOT NULL,
          records_synced INTEGER DEFAULT 0,
          status VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      console.log('✅ Tabela sync_logs criada!');
    } else {
      console.log('✅ Tabela sync_logs existe!');
      
      // Verificar estrutura
      const columns = await executeSQL(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'sync_logs'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Colunas da tabela:');
      columns.rows.forEach(col => {
        console.log(`   • ${col.column_name}: ${col.data_type}`);
      });
    }
    
    // Verificar dados
    const count = await executeSQL('SELECT COUNT(*) FROM sync_logs');
    console.log(`\n📊 Total de registros: ${count.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkSyncLogsTable();