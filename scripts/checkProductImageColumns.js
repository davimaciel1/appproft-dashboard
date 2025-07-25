const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkProductImageColumns() {
  try {
    // Verificar todas as colunas da tabela products
    const columns = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Todas as colunas da tabela products:');
    columns.rows.forEach(col => {
      console.log(`   • ${col.column_name}: ${col.data_type}`);
    });
    
    // Verificar se existe coluna de imagem
    const imageColumns = columns.rows.filter(col => 
      col.column_name.includes('image') || 
      col.column_name.includes('img') || 
      col.column_name.includes('photo') ||
      col.column_name.includes('picture')
    );
    
    if (imageColumns.length > 0) {
      console.log('\n📷 Colunas de imagem encontradas:');
      imageColumns.forEach(col => {
        console.log(`   • ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('\n❌ Nenhuma coluna de imagem encontrada na tabela products');
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkProductImageColumns();