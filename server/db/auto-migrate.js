const pool = require('./pool');
const fs = require('fs');
const path = require('path');

async function autoMigrate() {
  try {
    console.log('🔍 Verificando se as tabelas existem...');
    
    // Verificar se as tabelas já existem
    const tableCheckQuery = `
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('products', 'orders', 'order_items')
    `;
    
    const result = await pool.query(tableCheckQuery);
    const tableCount = parseInt(result.rows[0].count);
    
    if (tableCount >= 3) {
      console.log('✅ Tabelas já existem, pulando migração.');
      return;
    }
    
    console.log('📦 Executando migração do banco de dados...');
    
    // Ler arquivo schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Executar schema
    await pool.query(schema);
    
    console.log('✅ Migração concluída com sucesso!');
    
    // Tentar refresh da materialized view
    try {
      await pool.query('SELECT refresh_product_sales_summary()');
      console.log('✅ Materialized view atualizada');
    } catch (e) {
      console.log('ℹ️ Materialized view ainda sem dados');
    }
    
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    // Não falhar o servidor se a migração falhar
  }
}

module.exports = autoMigrate;