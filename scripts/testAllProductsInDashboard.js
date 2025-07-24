const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function testAllProductsInDashboard() {
  console.log('🔍 VERIFICANDO SE TODOS OS PRODUTOS APARECEM NO DASHBOARD\n');
  
  try {
    // 1. Total de produtos no banco
    const totalProducts = await executeSQL(`
      SELECT COUNT(*) as total FROM products WHERE marketplace = 'amazon'
    `);
    console.log(`📊 Total de produtos Amazon no banco: ${totalProducts.rows[0].total}`);
    
    // 2. Produtos com estoque
    const withStock = await executeSQL(`
      SELECT COUNT(*) as total FROM products 
      WHERE marketplace = 'amazon' AND inventory > 0
    `);
    console.log(`📦 Produtos com estoque > 0: ${withStock.rows[0].total}`);
    
    // 3. Produtos sem vendas
    const noSales = await executeSQL(`
      SELECT COUNT(*) as total 
      FROM products p
      WHERE p.marketplace = 'amazon'
      AND NOT EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.product_id = p.id
      )
    `);
    console.log(`❌ Produtos sem nenhuma venda: ${noSales.rows[0].total}`);
    
    // 4. Simular query do dashboard (agora sem LIMIT)
    console.log('\n🔄 SIMULANDO QUERY DO DASHBOARD (sem limite):\n');
    
    const dashboardQuery = await executeSQL(`
      SELECT 
        p.id,
        p.marketplace,
        p.asin,
        p.sku,
        p.name,
        p.inventory,
        COALESCE(COUNT(DISTINCT oi.order_id), 0) as total_orders,
        COALESCE(SUM(oi.quantity), 0) as total_units_sold,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_revenue
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.tenant_id = 1 AND p.marketplace = 'amazon'
      GROUP BY p.id
      ORDER BY COALESCE(SUM(oi.quantity), 0) DESC, p.name
    `);
    
    console.log(`✅ Produtos retornados pela query: ${dashboardQuery.rows.length}`);
    
    // 5. Verificar produtos com estoque
    const productsWithStock = dashboardQuery.rows.filter(p => p.inventory > 0);
    console.log(`\n📦 PRODUTOS COM ESTOQUE NO RESULTADO:`);
    console.log('━'.repeat(80));
    
    productsWithStock.forEach(p => {
      console.log(`\n${p.name}`);
      console.log(`ASIN: ${p.asin} | SKU: ${p.sku}`);
      console.log(`Estoque: ${p.inventory} | Vendas: ${p.total_units_sold} | Receita: R$ ${parseFloat(p.total_revenue).toFixed(2)}`);
    });
    
    // 6. Verificar produtos sem vendas
    const productsNoSales = dashboardQuery.rows.filter(p => p.total_units_sold == 0);
    console.log(`\n\n❌ PRODUTOS SEM VENDAS NO RESULTADO: ${productsNoSales.length}`);
    
    if (productsNoSales.length > 0) {
      console.log('Primeiros 5 produtos sem vendas:');
      productsNoSales.slice(0, 5).forEach(p => {
        console.log(`- ${p.name} (Estoque: ${p.inventory})`);
      });
    }
    
    // 7. Conclusão
    console.log('\n\n📋 RESUMO FINAL:');
    console.log('━'.repeat(80));
    console.log(`Total no banco: ${totalProducts.rows[0].total}`);
    console.log(`Total no dashboard: ${dashboardQuery.rows.length}`);
    console.log(`${totalProducts.rows[0].total === dashboardQuery.rows.length ? '✅ TODOS os produtos aparecem!' : '❌ Faltam produtos!'}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testAllProductsInDashboard();