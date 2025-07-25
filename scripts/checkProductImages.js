const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkProductImages() {
  try {
    const result = await executeSQL(`
      SELECT 
        COUNT(*) as total,
        COUNT(image_url) as with_image,
        COUNT(*) - COUNT(image_url) as without_image
      FROM products
    `);
    
    console.log('📸 Status das imagens:');
    console.log(`   Total de produtos: ${result.rows[0].total}`);
    console.log(`   Com imagem: ${result.rows[0].with_image}`);
    console.log(`   Sem imagem: ${result.rows[0].without_image}`);
    
    // Ver exemplo
    const example = await executeSQL(`
      SELECT asin, name, image_url
      FROM products
      WHERE image_url IS NOT NULL
      LIMIT 3
    `);
    
    if (example.rows.length > 0) {
      console.log('\n📷 Exemplos de URLs:');
      example.rows.forEach(p => {
        console.log(`   • ${p.asin}: ${p.image_url}`);
      });
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkProductImages();