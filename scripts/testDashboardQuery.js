const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function testDashboardQuery() {
  console.log('🔍 TESTANDO QUERIES DO DASHBOARD\n');
  
  try {
    // 1. Query que o dashboard usa para buscar produtos
    console.log('📊 PRODUTOS COM VENDAS (query do dashboard):');
    console.log('━'.repeat(60));
    
    const dashboardQuery = await executeSQL(`
      SELECT 
        p.id,
        p.name,
        p.asin,
        p.sku,
        p.image_url,
        p.price,
        p.inventory,
        p.marketplace,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
        COUNT(DISTINCT oi.order_id) as orders_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.marketplace = 'amazon'
      GROUP BY p.id
      ORDER BY revenue DESC
      LIMIT 20
    `);
    
    console.log('Produtos retornados:', dashboardQuery.rows.length);
    console.log('\nID | Nome | Estoque | Vendas | Receita');
    console.log('---|------|---------|--------|--------');
    
    dashboardQuery.rows.forEach(product => {
      const nome = product.name ? product.name.substring(0, 30) + '...' : 'N/A';
      console.log(
        `${product.id} | ${nome} | ${product.inventory || 0} | ${product.units_sold} | R$ ${parseFloat(product.revenue).toFixed(2)}`
      );
    });
    
    // 2. Filtrar apenas produtos com estoque
    console.log('\n\n📦 PRODUTOS COM ESTOQUE > 0:');
    console.log('━'.repeat(60));
    
    const withStock = dashboardQuery.rows.filter(p => p.inventory > 0);
    
    if (withStock.length > 0) {
      console.log('✅ Produtos com estoque encontrados no resultado do dashboard:');
      withStock.forEach(product => {
        console.log(`\n- ${product.name}`);
        console.log(`  ASIN: ${product.asin}`);
        console.log(`  SKU: ${product.sku}`);
        console.log(`  Estoque: ${product.inventory} unidades`);
        console.log(`  Imagem: ${product.image_url ? '✅ Tem imagem' : '❌ Sem imagem'}`);
      });
    } else {
      console.log('❌ Nenhum produto com estoque aparece no dashboard!');
    }
    
    // 3. Verificar diretamente produtos com estoque
    console.log('\n\n🔍 VERIFICAÇÃO DIRETA NO BANCO:');
    console.log('━'.repeat(60));
    
    const directCheck = await executeSQL(`
      SELECT 
        id, asin, sku, name, inventory, image_url,
        (SELECT COUNT(*) FROM order_items WHERE product_id = products.id) as vendas
      FROM products 
      WHERE inventory > 0 AND marketplace = 'amazon'
      ORDER BY inventory DESC
    `);
    
    console.log(`\nProdutos com estoque no banco: ${directCheck.rows.length}`);
    directCheck.rows.forEach(p => {
      console.log(`\n- ${p.name}`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Estoque: ${p.inventory}`);
      console.log(`  Vendas: ${p.vendas}`);
      console.log(`  ${p.vendas === '0' ? '⚠️ SEM VENDAS - pode não aparecer no dashboard!' : '✅ Tem vendas'}`);
    });
    
    // 4. Testar query específica para produtos com estoque
    console.log('\n\n📊 QUERY ALTERNATIVA (incluindo produtos sem vendas):');
    console.log('━'.repeat(60));
    
    const alternativeQuery = await executeSQL(`
      SELECT 
        p.*,
        COALESCE(vendas.units_sold, 0) as units_sold,
        COALESCE(vendas.revenue, 0) as revenue
      FROM products p
      LEFT JOIN (
        SELECT 
          product_id,
          SUM(quantity) as units_sold,
          SUM(quantity * unit_price) as revenue
        FROM order_items
        GROUP BY product_id
      ) vendas ON p.id = vendas.product_id
      WHERE p.marketplace = 'amazon' AND p.inventory > 0
    `);
    
    console.log(`\nProdutos com estoque (incluindo sem vendas): ${alternativeQuery.rows.length}`);
    alternativeQuery.rows.forEach(p => {
      console.log(`- ${p.name}: ${p.inventory} unidades (${p.units_sold} vendidas)`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testDashboardQuery();