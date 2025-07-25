const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkCleanStatus() {
  try {
    const counts = await executeSQL(`
      SELECT 
        (SELECT COUNT(*) FROM products) as products_count,
        (SELECT COUNT(*) FROM orders) as orders_count,
        (SELECT COUNT(*) FROM competitor_tracking_advanced) as competitor_count,
        (SELECT COUNT(*) FROM buy_box_history) as buybox_count,
        (SELECT COUNT(*) FROM ai_insights_advanced) as insights_count
    `);
    
    console.log('📊 Status atual após limpeza parcial:');
    const c = counts.rows[0];
    console.log(`   • Products: ${c.products_count}`);
    console.log(`   • Orders: ${c.orders_count}`);
    console.log(`   • Competitor Tracking: ${c.competitor_count}`);
    console.log(`   • Buy Box History: ${c.buybox_count}`);
    console.log(`   • AI Insights: ${c.insights_count}`);
    
    // Limpar insights com dados mockados
    console.log('\n🧹 Limpando insights restantes...');
    const deleteInsights = await executeSQL(`
      DELETE FROM ai_insights_advanced 
      WHERE description LIKE '%Super Deals%' 
         OR description LIKE '%Top Produtos BR%'
         OR description LIKE '%Prime Vendas%'
         OR description LIKE '%MegaStore Brasil%'
         OR description LIKE '%Fast Commerce BR%'
         OR recommendation LIKE '%Super Deals%'
         OR recommendation LIKE '%Top Produtos BR%'
         OR recommendation LIKE '%Prime Vendas%'
         OR recommendation LIKE '%MegaStore Brasil%'
         OR recommendation LIKE '%Fast Commerce BR%'
      RETURNING id
    `);
    
    console.log(`   ✅ ${deleteInsights.rows.length} insights com dados mockados removidos`);
    
    // Verificar produtos ativos vs inativos
    console.log('\n📊 Status dos produtos:');
    const productStatus = await executeSQL(`
      SELECT 
        active,
        COUNT(*) as count
      FROM products
      GROUP BY active
    `);
    
    productStatus.rows.forEach(row => {
      console.log(`   • Produtos ${row.active ? 'ATIVOS' : 'INATIVOS'}: ${row.count}`);
    });
    
    // Verificar se ainda existem dados mockados
    console.log('\n🔍 Verificando se ainda existem dados mockados...');
    
    // Buscar por nomes suspeitos em outras tabelas
    const checkOrders = await executeSQL(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE customer_name LIKE '%Test%'
         OR customer_name LIKE '%Teste%'
         OR customer_name LIKE '%Mock%'
    `);
    
    if (checkOrders.rows[0].count > 0) {
      console.log(`   ⚠️  ${checkOrders.rows[0].count} pedidos com nomes suspeitos`);
    } else {
      console.log('   ✅ Nenhum pedido com dados mockados');
    }
    
    console.log('\n✅ VERIFICAÇÃO CONCLUÍDA!');
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkCleanStatus();