const { getDataCollector } = require('../server/services/dataCollector');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const secureLogger = require('../server/utils/secureLogger');

async function forceSync() {
  try {
    console.log('🚀 Forçando sincronização imediata com Amazon...\n');
    
    const dataCollector = getDataCollector();
    const tenantId = 1; // Usar tenant ID 1
    
    // Resultados
    const results = {
      inventory: { success: 0, errors: 0 },
      pricing: { success: 0, errors: 0 },
      competitors: { success: 0, errors: 0 },
      sales: { success: 0, errors: 0 },
      orders: { success: 0, errors: 0 },
      keywords: { success: 0, errors: 0 },
      advertising: { success: 0, errors: 0 }
    };
    
    console.log('📦 Coletando inventário...');
    try {
      await dataCollector.collectInventory(tenantId, results.inventory);
      console.log(`✅ Inventário: ${results.inventory.success} produtos sincronizados`);
    } catch (error) {
      console.error('❌ Erro no inventário:', error.message);
    }
    
    console.log('\n💰 Coletando preços e competidores...');
    try {
      await dataCollector.collectPricingAndCompetitors(tenantId, results.pricing, results.competitors);
      console.log(`✅ Preços: ${results.pricing.success} atualizados`);
      console.log(`✅ Competidores: ${results.competitors.success} rastreados`);
    } catch (error) {
      console.error('❌ Erro em preços/competidores:', error.message);
    }
    
    console.log('\n📊 Coletando vendas e ordens...');
    try {
      await dataCollector.collectSalesAndOrders(tenantId, results.sales, results.orders);
      console.log(`✅ Vendas: ${results.sales.success} registradas`);
      console.log(`✅ Ordens: ${results.orders.success} processadas`);
    } catch (error) {
      console.error('❌ Erro em vendas/ordens:', error.message);
    }
    
    console.log('\n🔍 Coletando keywords e advertising...');
    try {
      await dataCollector.collectKeywordsAndAdvertising(tenantId, results.keywords, results.advertising);
      console.log(`✅ Keywords: ${results.keywords.success} analisadas`);
      console.log(`✅ Advertising: ${results.advertising.success} campanhas sincronizadas`);
    } catch (error) {
      console.error('❌ Erro em keywords/advertising:', error.message);
    }
    
    // Resumo final
    console.log('\n📈 Resumo da Sincronização:');
    console.log('─────────────────────────');
    let totalSuccess = 0;
    let totalErrors = 0;
    
    Object.entries(results).forEach(([key, value]) => {
      totalSuccess += value.success;
      totalErrors += value.errors;
      console.log(`${key}: ${value.success} sucesso, ${value.errors} erros`);
    });
    
    console.log('─────────────────────────');
    console.log(`TOTAL: ${totalSuccess} sucessos, ${totalErrors} erros`);
    
    // Verificar dados salvos
    console.log('\n🔍 Verificando dados salvos no banco...');
    
    const counts = await executeSQL(`
      SELECT 
        (SELECT COUNT(*) FROM products WHERE tenant_id = 1) as products,
        (SELECT COUNT(*) FROM inventory_snapshots WHERE created_at > NOW() - INTERVAL '1 hour') as inventory,
        (SELECT COUNT(*) FROM competitor_tracking_advanced WHERE timestamp > NOW() - INTERVAL '1 hour') as competitors,
        (SELECT COUNT(*) FROM sales_metrics WHERE date >= CURRENT_DATE) as sales,
        (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 day') as orders
    `);
    
    console.log('\n📊 Dados no banco:');
    console.log(`- Produtos: ${counts.rows[0].products}`);
    console.log(`- Snapshots de inventário (última hora): ${counts.rows[0].inventory}`);
    console.log(`- Rastreamento de competidores (última hora): ${counts.rows[0].competitors}`);
    console.log(`- Métricas de vendas (hoje): ${counts.rows[0].sales}`);
    console.log(`- Ordens (último dia): ${counts.rows[0].orders}`);
    
    console.log('\n✅ Sincronização forçada concluída!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar com delay para garantir conexões
console.log('⏳ Aguardando 2 segundos para estabilizar conexões...\n');
setTimeout(forceSync, 2000);