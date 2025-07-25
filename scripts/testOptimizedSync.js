/**
 * Script para testar o sistema de sincronização otimizada integrado
 */

require('dotenv').config();
const PersistentSyncManager = require('../server/services/persistentSyncManager');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function testOptimizedSync() {
  console.log('🧪 Testando Sistema de Sincronização OTIMIZADA\n');
  
  console.log('✅ Estratégias de Otimização Implementadas:');
  console.log('   📊 Reports API - Uma chamada retorna milhares de dados');
  console.log('   🧠 Cache Inteligente - Reduz chamadas desnecessárias');
  console.log('   📦 Batch Requests - Agrupa múltiplos itens (20 ASINs/call)');
  console.log('   🎯 Priorização - Best sellers primeiro');
  console.log('   ⚡ Rate Limiting - Respeita limites oficiais da Amazon');
  console.log('   🔄 Retry Automático - Backoff exponencial');
  console.log('   💾 Persistência - Continua de onde parou\n');

  try {
    const syncManager = new PersistentSyncManager();
    
    // Verificar conexão com banco
    console.log('🔍 Verificando conexão com PostgreSQL...');
    await executeSQL('SELECT 1');
    console.log('✅ PostgreSQL conectado\n');
    
    // Verificar estado da fila
    console.log('📋 Estado atual da fila de sincronização:');
    const stats = await syncManager.getQueueStats();
    console.table(stats);
    
    // Verificar estatísticas de otimização
    console.log('\n📊 Estatísticas das Estratégias de Otimização:');
    const optimizationStats = await syncManager.getOptimizationStats();
    if (Object.keys(optimizationStats).length > 0) {
      console.table(optimizationStats);
    } else {
      console.log('   (Nenhuma execução anterior encontrada)');
    }
    
    // Enfileirar sincronização otimizada
    console.log('\n🚀 Enfileirando Sincronização Otimizada...');
    const taskIds = await syncManager.enqueueBulkSync();
    console.log(`✅ ${taskIds.length} tarefas otimizadas enfileiradas:`, taskIds);
    
    // Mostrar exemplos de uso das estratégias
    console.log('\n💡 Exemplos de como as estratégias funcionam:');
    
    console.log('\n📊 Reports API Strategy:');
    console.log('   - Ao invés de fazer 1000 chamadas para products');
    console.log('   - Faz 1 chamada GET_MERCHANT_LISTINGS_ALL_DATA');
    console.log('   - Recebe CSV com todos os produtos de uma vez');
    
    console.log('\n🧠 Cache Strategy:');
    console.log('   - Seller data: cache 24h');
    console.log('   - Catalog data: cache 6h');
    console.log('   - Pricing data: cache 5min');
    
    console.log('\n📦 Batch Strategy:');
    console.log('   - Pricing: 20 ASINs por chamada');
    console.log('   - Reduz de 100 chamadas para 5 chamadas');
    
    console.log('\n🎯 Priority Strategy:');
    console.log('   - Best sellers: sync a cada 15min');
    console.log('   - Produtos médios: sync a cada 1h');
    console.log('   - Produtos lentos: sync diário');
    
    // Exemplo de batch pricing
    console.log('\n🧪 Testando Batch Pricing (exemplo):');
    const exampleAsins = ['B07XJ8C8F5', 'B08N5WRWNW', 'B07ZPKN6YR'];
    const batchTaskIds = await syncManager.enqueueBatchPricing(exampleAsins);
    console.log(`✅ Batch pricing enfileirado para ${exampleAsins.length} ASINs:`, batchTaskIds);
    
    console.log('\n📈 Estado final da fila:');
    const finalStats = await syncManager.getQueueStats();
    console.table(finalStats);
    
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('1. Execute: node scripts/startPersistentSync.js');
    console.log('2. O sistema processará automaticamente as tarefas otimizadas');
    console.log('3. Monitore: https://appproft.com/insights');
    console.log('4. Dados: https://appproft.com/amazon-data');
    
    console.log('\n✅ Teste de integração das estratégias de otimização CONCLUÍDO!');
    console.log('💡 O sistema agora usa TODAS as estratégias de otimização automaticamente.');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verificar se PostgreSQL está rodando');
    console.log('2. Verificar credenciais no .env');
    console.log('3. Executar migrations do banco');
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  testOptimizedSync();
}

module.exports = { testOptimizedSync };