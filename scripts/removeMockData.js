const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

/**
 * Script para remover TODOS os dados mockados do banco de dados
 * Mantém apenas dados reais
 */
async function cleanMockData() {
  console.log('🧹 LIMPEZA DE DADOS MOCKADOS\n');
  console.log('⚠️  Este script irá REMOVER todos os dados falsos do banco de dados.');
  console.log('Dados mockados identificados:');
  console.log('- Empresas falsas: Super Deals, Top Produtos BR, Prime Vendas, MegaStore Brasil, Fast Commerce BR');
  console.log('- Produto de teste: "Produto Teste - Amazon Echo Dot"');
  console.log('- Todos os dados de competitor tracking e buy box history\n');
  
  try {
    // 1. Remover produto de teste
    console.log('1️⃣ Removendo produto de teste...');
    const deleteProduct = await executeSQL(`
      DELETE FROM products 
      WHERE name LIKE '%Produto Teste%' 
      OR id = 162
      RETURNING id, name
    `);
    
    if (deleteProduct.rows.length > 0) {
      console.log(`   ✅ Removido: ${deleteProduct.rows[0].name}`);
    } else {
      console.log('   ℹ️  Nenhum produto de teste encontrado');
    }
    
    // 2. Limpar buy_box_history (todos os dados são mockados)
    console.log('\n2️⃣ Limpando tabela buy_box_history...');
    const buyBoxCount = await executeSQL('SELECT COUNT(*) FROM buy_box_history');
    console.log(`   📊 ${buyBoxCount.rows[0].count} registros mockados encontrados`);
    
    await executeSQL('TRUNCATE TABLE buy_box_history');
    console.log('   ✅ Tabela buy_box_history limpa');
    
    // 3. Limpar competitor_tracking_advanced (todos os dados são mockados)
    console.log('\n3️⃣ Limpando tabela competitor_tracking_advanced...');
    const competitorCount = await executeSQL('SELECT COUNT(*) FROM competitor_tracking_advanced');
    console.log(`   📊 ${competitorCount.rows[0].count} registros mockados encontrados`);
    
    await executeSQL('TRUNCATE TABLE competitor_tracking_advanced');
    console.log('   ✅ Tabela competitor_tracking_advanced limpa');
    
    // 4. Limpar ai_insights_advanced que mencionam empresas falsas
    console.log('\n4️⃣ Limpando insights com dados mockados...');
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
    
    // 5. Verificar sync_logs relacionados
    console.log('\n5️⃣ Verificando sync_logs...');
    const syncLogsCheck = await executeSQL(`
      SELECT COUNT(*) as count 
      FROM sync_logs 
      WHERE sync_type IN ('competitor_pricing', 'buy_box_tracking')
    `);
    
    if (syncLogsCheck.rows[0].count > 0) {
      console.log(`   📊 ${syncLogsCheck.rows[0].count} logs de sync encontrados (mantidos para histórico)`);
    }
    
    // 6. Resumo final
    console.log('\n📊 RESUMO DA LIMPEZA:');
    
    const finalCounts = await executeSQL(`
      SELECT 
        (SELECT COUNT(*) FROM products) as products_count,
        (SELECT COUNT(*) FROM orders) as orders_count,
        (SELECT COUNT(*) FROM competitor_tracking_advanced) as competitor_count,
        (SELECT COUNT(*) FROM buy_box_history) as buybox_count,
        (SELECT COUNT(*) FROM ai_insights_advanced) as insights_count
    `);
    
    const counts = finalCounts.rows[0];
    console.log(`\n✅ Estado final do banco:`);
    console.log(`   • Products: ${counts.products_count} (apenas produtos reais)`);
    console.log(`   • Orders: ${counts.orders_count} (dados reais mantidos)`);
    console.log(`   • Competitor Tracking: ${counts.competitor_count} (aguardando dados reais)`);
    console.log(`   • Buy Box History: ${counts.buybox_count} (aguardando dados reais)`);
    console.log(`   • AI Insights: ${counts.insights_count} (apenas insights válidos)`);
    
    console.log('\n✅ LIMPEZA CONCLUÍDA!');
    console.log('\n📌 Próximos passos:');
    console.log('1. Configurar worker para coletar dados REAIS de competidores');
    console.log('2. Ajustar marketplace para corresponder aos ASINs (USA vs Brasil)');
    console.log('3. Executar sincronização com APIs reais da Amazon');
    console.log('4. Implementar filtros para listings ativos/inativos');
    
  } catch (error) {
    console.error('\n❌ Erro durante limpeza:', error.message);
    console.error(error.stack);
  }
}

// Executar limpeza
cleanMockData();