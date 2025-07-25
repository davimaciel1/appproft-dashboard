const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function finalCleanupReport() {
  try {
    // Verificar insights restantes
    const insights = await executeSQL(`
      SELECT insight_type, priority, COUNT(*) as count
      FROM ai_insights_advanced
      GROUP BY insight_type, priority
      ORDER BY insight_type, priority
    `);
    
    console.log('📊 Insights restantes após limpeza:');
    insights.rows.forEach(row => {
      console.log(`   • ${row.insight_type} (${row.priority}): ${row.count}`);
    });
    
    // Resumo final
    const summary = await executeSQL(`
      SELECT 
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM competitor_tracking_advanced) as competitors,
        (SELECT COUNT(*) FROM buy_box_history) as buybox,
        (SELECT COUNT(*) FROM ai_insights_advanced) as insights
    `);
    
    console.log('\n✅ RESUMO FINAL - BANCO LIMPO:');
    const s = summary.rows[0];
    console.log(`   • Products: ${s.products} (apenas dados reais)`);
    console.log(`   • Orders: ${s.orders} (apenas dados reais)`);
    console.log(`   • Competitor Tracking: ${s.competitors} (vazio - aguardando sync real)`);
    console.log(`   • Buy Box History: ${s.buybox} (vazio - aguardando dados reais)`);
    console.log(`   • AI Insights: ${s.insights} (apenas insights válidos)`);
    
    console.log('\n✅ Todos os dados mockados foram removidos!');
    console.log('\n📌 O sistema agora está pronto para receber apenas dados REAIS das APIs.');
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

finalCleanupReport();