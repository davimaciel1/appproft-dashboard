require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

/**
 * Script otimizado para sincronização respeitando rate limits da Amazon
 * Usa estratégias para minimizar chamadas à API
 */

async function optimizedSync() {
  console.log('🚀 Iniciando sincronização otimizada com Amazon SP-API\n');
  console.log('📊 Estratégias para contornar rate limits:\n');
  
  console.log('1️⃣ REPORTS API - Dados em Massa');
  console.log('   ✅ Use GET_MERCHANT_LISTINGS_ALL_DATA para catalog completo');
  console.log('   ✅ Use GET_FBA_MYI_ALL_INVENTORY_DATA para inventory');
  console.log('   ✅ Use GET_FLAT_FILE_ALL_ORDERS_DATA_BY_LAST_UPDATE para orders');
  console.log('   💡 1 report = milhares de registros vs milhares de chamadas\n');
  
  console.log('2️⃣ CACHE INTELIGENTE - Reduza Chamadas');
  console.log('   ✅ Sellers: Cache 24h (muda raramente)');
  console.log('   ✅ Catalog: Cache 6h (produtos não mudam muito)');
  console.log('   ✅ Inventory: Cache 30min (razoável para maioria)');
  console.log('   ✅ Pricing: Cache 5-15min (muda frequentemente)\n');
  
  console.log('3️⃣ BATCH REQUESTS - Agrupe Dados');
  console.log('   ✅ Pricing: Até 20 ASINs por chamada');
  console.log('   ✅ Orders: Use filtros de data para pegar vários');
  console.log('   ✅ Catalog: Use getItemsByAsins com múltiplos ASINs\n');
  
  console.log('4️⃣ PRIORIZAÇÃO - Foque no Importante');
  console.log('   ✅ Sincronize best sellers mais frequentemente');
  console.log('   ✅ Produtos sem vendas: sync 1x/dia');
  console.log('   ✅ Use webhooks para mudanças em tempo real\n');
  
  console.log('5️⃣ HORÁRIOS ESTRATÉGICOS');
  console.log('   ✅ Sync pesado de madrugada (menos concorrência)');
  console.log('   ✅ Updates críticos durante o dia');
  console.log('   ✅ Distribua carga ao longo de 24h\n');
  
  // Exemplo de implementação otimizada
  console.log('📝 Exemplo de Código Otimizado:\n');
  
  const exampleCode = `
// 1. Criar Report para dados em massa
async function syncViaReports() {
  // Inventory Report - 1 chamada retorna TODOS os produtos
  const inventoryReport = await createReport({
    reportType: 'GET_FBA_MYI_ALL_INVENTORY_DATA',
    marketplaceIds: ['ATVPDKIKX0DER']
  });
  
  // Aguardar processamento (polling a cada 30s)
  const reportData = await waitForReport(inventoryReport.reportId);
  
  // Processar milhares de registros de uma vez
  await processInventoryBulk(reportData);
}

// 2. Cache com Redis ou em memória
const cache = new Map();
const CACHE_TIMES = {
  sellers: 24 * 60 * 60 * 1000,    // 24 horas
  catalog: 6 * 60 * 60 * 1000,     // 6 horas
  inventory: 30 * 60 * 1000,        // 30 minutos
  pricing: 5 * 60 * 1000            // 5 minutos
};

async function getCachedOrFetch(key, fetcher, cacheType) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TIMES[cacheType]) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, time: Date.now() });
  return data;
}

// 3. Batch pricing requests
async function getBatchPricing(asins) {
  const batches = [];
  for (let i = 0; i < asins.length; i += 20) {
    batches.push(asins.slice(i, i + 20));
  }
  
  const results = [];
  for (const batch of batches) {
    const prices = await spApi.callAPI({
      operation: 'getItemOffersBatch',
      body: {
        requests: batch.map(asin => ({
          uri: \`/products/pricing/v0/items/\${asin}/offers\`,
          method: 'GET',
          MarketplaceId: 'ATVPDKIKX0DER'
        }))
      }
    });
    results.push(...prices);
    
    // Respeitar rate limit entre batches
    await new Promise(r => setTimeout(r, 100)); // 100ms = 10 req/seg
  }
  
  return results;
}

// 4. Sincronização por prioridade
async function syncByPriority() {
  // Best sellers - sync a cada 15 min
  const bestSellers = await getTopProducts(20);
  await syncProducts(bestSellers, { 
    inventory: true, 
    pricing: true, 
    competitors: true 
  });
  
  // Produtos médios - sync a cada hora
  const regularProducts = await getRegularProducts();
  await syncProducts(regularProducts, { 
    inventory: true, 
    pricing: false  // Pricing menos frequente
  });
  
  // Produtos sem venda - sync 1x/dia
  const slowMovers = await getSlowMovers();
  await syncProducts(slowMovers, { 
    inventory: true  // Só inventory
  });
}
`;

  console.log(exampleCode);
  
  console.log('\n⏰ Cronograma Sugerido:');
  console.log('- A cada 15min: Pricing dos top 20 produtos');
  console.log('- A cada 30min: Inventory via Reports API');
  console.log('- A cada 1h: Orders dos últimos 60min');
  console.log('- A cada 6h: Catalog completo via Reports');
  console.log('- A cada 24h: Sellers info (cache longo)');
  
  console.log('\n📈 Resultado Esperado:');
  console.log('✅ Redução de 90% nas chamadas à API');
  console.log('✅ Sincronização completa sem erros 429');
  console.log('✅ Dados sempre atualizados para decisões');
  console.log('✅ Sistema escalável para milhares de produtos');
  
  console.log('\n💡 Próximos Passos:');
  console.log('1. Implementar Reports API no dataCollector.js');
  console.log('2. Adicionar Redis para cache distribuído');
  console.log('3. Configurar webhooks para updates em tempo real');
  console.log('4. Implementar fila de priorização');
}

optimizedSync();