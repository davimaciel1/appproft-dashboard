const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkProductsColumns() {
  try {
    console.log('🔍 Verificando estrutura da tabela products...\n');
    
    const columns = await executeSQL(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela products:');
    columns.rows.forEach(col => {
      console.log(`   • ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    
    // Ver amostra de dados
    const sample = await executeSQL(`
      SELECT * FROM products LIMIT 3
    `);
    
    if (sample.rows.length > 0) {
      console.log('\n📸 Amostra de dados:');
      sample.rows.forEach((row, idx) => {
        console.log(`\n${idx + 1}. ASIN: ${row.asin}`);
        console.log(`   Nome: ${row.name}`);
        console.log(`   Preço: ${row.price || row.listing_price || 'N/A'}`);
        console.log(`   Imagem: ${row.image_url ? '✅' : '❌'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkProductsColumns();