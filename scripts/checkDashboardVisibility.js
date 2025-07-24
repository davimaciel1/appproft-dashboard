const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkDashboardVisibility() {
  console.log('🔍 ANALISANDO VISIBILIDADE DOS PRODUTOS COM ESTOQUE NO DASHBOARD\n');
  
  try {
    // 1. Verificar produtos com estoque
    console.log('📦 PRODUTOS COM ESTOQUE:');
    console.log('━'.repeat(80));
    
    const stockProducts = await executeSQL(`
      SELECT 
        p.id,
        p.asin,
        p.sku,
        p.name,
        p.inventory,
        p.tenant_id,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
        COUNT(DISTINCT oi.order_id) as orders_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.inventory > 0 AND p.marketplace = 'amazon'
      GROUP BY p.id
      ORDER BY p.inventory DESC
    `);
    
    console.log('ID | ASIN | Nome | Estoque | Vendas | Receita | Pedidos');
    console.log('---|------|------|---------|--------|---------|--------');
    
    stockProducts.rows.forEach(p => {
      const nome = p.name.substring(0, 30) + '...';
      console.log(`${p.id} | ${p.asin} | ${nome} | ${p.inventory} | ${p.units_sold} | R$ ${parseFloat(p.revenue).toFixed(2)} | ${p.orders_count}`);
    });
    
    // 2. Verificar view product_sales_summary
    console.log('\n\n📊 VERIFICANDO VIEW product_sales_summary:');
    console.log('━'.repeat(80));
    
    const viewCheck = await executeSQL(`
      SELECT 
        ps.id,
        ps.asin,
        ps.name,
        ps.total_units_sold,
        ps.total_revenue,
        ps.sales_rank,
        p.inventory
      FROM product_sales_summary ps
      JOIN products p ON ps.id = p.id
      WHERE p.inventory > 0
      ORDER BY p.inventory DESC
    `);
    
    if (viewCheck.rows.length === 0) {
      console.log('❌ Nenhum produto com estoque aparece na view product_sales_summary!');
      console.log('   Isso indica que a view pode não estar atualizada ou não inclui produtos sem vendas.');
    } else {
      console.log('✅ Produtos com estoque na view:');
      viewCheck.rows.forEach(p => {
        console.log(`- ${p.name}: ${p.inventory} unidades, rank #${p.sales_rank}`);
      });
    }
    
    // 3. Verificar query do dashboard (da rota)
    console.log('\n\n📱 SIMULANDO QUERY DO DASHBOARD:');
    console.log('━'.repeat(80));
    
    // Query exata do dashboard (linha 251 de dashboard.js)
    const dashboardQuery = await executeSQL(`
      SELECT 
        p.id,
        p.marketplace,
        p.country_code,
        p.asin,
        p.sku,
        p.name,
        p.image_url,
        COALESCE(ps.total_orders, 0) as total_orders,
        COALESCE(ps.total_units_sold, 0) as total_units_sold,
        COALESCE(ps.total_revenue, 0) as total_revenue,
        COALESCE(ps.total_profit, 0) as total_profit,
        COALESCE(ps.roi, 0) as roi,
        COALESCE(ps.sales_rank, 999) as sales_rank,
        COALESCE(i.quantity, 0) as inventory,
        COALESCE(i.alert_level, 10) as alert_level,
        COALESCE(
          (SELECT SUM(oi2.quantity) 
           FROM order_items oi2 
           JOIN orders o2 ON oi2.order_id = o2.id 
           WHERE oi2.product_id = p.id 
           AND DATE(o2.order_date) = CURRENT_DATE), 0
        ) as today_units,
        CASE 
          WHEN ps.total_revenue > 0 
          THEN (ps.total_profit / ps.total_revenue * 100)
          ELSE 0 
        END as profit_margin
      FROM products p
      LEFT JOIN product_sales_summary ps ON p.id = ps.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.tenant_id = 1
      ORDER BY COALESCE(ps.total_units_sold, 0) DESC, p.name
      LIMIT 100
    `);
    
    console.log(`Total de produtos retornados: ${dashboardQuery.rows.length}\n`);
    
    // Filtrar produtos com estoque
    const withStock = dashboardQuery.rows.filter(p => p.inventory > 0);
    
    if (withStock.length > 0) {
      console.log(`✅ ${withStock.length} produtos com estoque aparecem no dashboard:`);
      withStock.forEach((p, idx) => {
        const posicao = dashboardQuery.rows.findIndex(prod => prod.id === p.id) + 1;
        console.log(`\n${idx + 1}. ${p.name}`);
        console.log(`   ASIN: ${p.asin} | Estoque: ${p.inventory} unidades`);
        console.log(`   Vendas totais: ${p.total_units_sold} | Receita: R$ ${parseFloat(p.total_revenue).toFixed(2)}`);
        console.log(`   Posição no ranking: #${posicao} de ${dashboardQuery.rows.length}`);
      });
    } else {
      console.log('❌ NENHUM produto com estoque aparece no resultado do dashboard!');
    }
    
    // 4. Verificar se o problema é a ordenação
    console.log('\n\n🔄 VERIFICANDO ORDENAÇÃO:');
    console.log('━'.repeat(80));
    
    const bottomProducts = dashboardQuery.rows.slice(-10);
    console.log('Últimos 10 produtos do dashboard (podem estar com estoque mas sem vendas):');
    bottomProducts.forEach((p, idx) => {
      const posicao = dashboardQuery.rows.length - 10 + idx + 1;
      console.log(`#${posicao} - ${p.name.substring(0, 40)}... | Vendas: ${p.total_units_sold} | Estoque: ${p.inventory}`);
    });
    
    // 5. Solução proposta
    console.log('\n\n💡 SOLUÇÃO PROPOSTA:');
    console.log('━'.repeat(80));
    console.log('Para garantir que produtos com estoque apareçam no dashboard, sugerimos:');
    console.log('1. Modificar a ordenação para priorizar produtos com estoque');
    console.log('2. Ou criar uma seção separada "Produtos em Estoque" no dashboard');
    console.log('3. Ou incluir um filtro para mostrar apenas produtos com estoque > 0');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkDashboardVisibility();