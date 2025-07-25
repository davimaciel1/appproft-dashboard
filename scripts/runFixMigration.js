const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const fs = require('fs');
const path = require('path');

async function runFixMigration() {
  console.log('🔧 Executando correção da estrutura de IA...\n');
  
  try {
    // Verificar conexão
    await executeSQL('SELECT 1');
    console.log('✅ Conexão com PostgreSQL OK\n');
    
    // Ler arquivo de migração
    const migrationPath = path.join(__dirname, '../server/db/migrations/006_fix_ai_structure.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Executar migração completa
    await executeSQL(migrationSQL);
    
    console.log('✅ Migração de correção executada com sucesso!\n');
    
    // Verificar tabelas criadas
    const tables = await executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'ai_insights_advanced', 
          'sales_metrics', 
          'demand_forecasts', 
          'price_optimization',
          'competitor_tracking_detailed',
          'sync_logs'
        )
      ORDER BY table_name
    `);
    
    console.log('📊 Tabelas verificadas:');
    tables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Verificar views
    const views = await executeSQL(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name IN ('buy_box_status', 'competitor_dashboard')
      ORDER BY table_name
    `);
    
    console.log('\n📊 Views verificadas:');
    views.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    console.log('\n✅ Sistema de IA está pronto para uso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  }
}

runFixMigration();