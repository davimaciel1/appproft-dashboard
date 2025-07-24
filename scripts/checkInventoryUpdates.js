const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkInventoryUpdates() {
  console.log('🔍 Verificando produtos que foram atualizados com estoque...\n');
  
  try {
    const result = await executeSQL(`
      SELECT 
        id,
        asin,
        sku,
        name,
        inventory,
        updated_at
      FROM products 
      WHERE 
        inventory > 0 
        AND marketplace = 'amazon'
      ORDER BY inventory DESC
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ PRODUTOS COM ESTOQUE NO BANCO DE DADOS:');
      console.log('━'.repeat(60));
      console.log('ID | ASIN | SKU | Nome | Estoque | Última Atualização');
      console.log('---|------|-----|------|---------|-------------------');
      
      result.rows.forEach(product => {
        const nome = product.name ? product.name.substring(0, 25) + '...' : 'N/A';
        const dataAtualizacao = new Date(product.updated_at).toLocaleString('pt-BR');
        console.log(`${product.id} | ${product.asin} | ${product.sku || 'N/A'} | ${nome} | ${product.inventory} | ${dataAtualizacao}`);
      });
      
      console.log(`\nTotal: ${result.rows.length} produtos com estoque > 0`);
    } else {
      console.log('❌ Nenhum produto com estoque > 0 encontrado no banco!');
    }
    
    // Verificar se houve atualização recente
    const recentUpdates = await executeSQL(`
      SELECT COUNT(*) as total 
      FROM products 
      WHERE 
        updated_at > NOW() - INTERVAL '5 minutes'
        AND marketplace = 'amazon'
    `);
    
    console.log(`\n📊 Produtos atualizados nos últimos 5 minutos: ${recentUpdates.rows[0].total}`);
    
    // Verificar os ASINs específicos que encontramos com estoque
    console.log('\n🔍 Verificando ASINs específicos que tinham estoque:');
    const specificASINs = ['B0CLBFSQH1', 'B0CHXHY4F4', 'B0CMYYZY2Q'];
    
    for (const asin of specificASINs) {
      const product = await executeSQL(`
        SELECT asin, name, inventory, updated_at 
        FROM products 
        WHERE asin = $1
      `, [asin]);
      
      if (product.rows.length > 0) {
        const p = product.rows[0];
        console.log(`\n${p.asin}: ${p.inventory} unidades`);
        console.log(`   Nome: ${p.name}`);
        console.log(`   Atualizado: ${new Date(p.updated_at).toLocaleString('pt-BR')}`);
      }
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkInventoryUpdates();