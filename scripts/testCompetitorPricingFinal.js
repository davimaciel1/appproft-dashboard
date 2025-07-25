// Script final para testar coleta de competidores com V2

require('dotenv').config();
const pool = require('../server/db/pool');
const tokenManager = require('../server/services/tokenManager');
const AmazonService = require('../server/services/amazonService');
const CompetitorPricingServiceV2 = require('../server/services/amazon/competitorPricingServiceV2');

async function testCompetitorPricingFinal() {
  console.log('🚀 TESTE FINAL - COLETA DE COMPETIDORES V2');
  console.log('='.repeat(60));
  
  try {
    // 1. Testar token
    console.log('1️⃣ Testando obtenção de token...');
    try {
      const token = await tokenManager.getAmazonToken('default');
      console.log('✅ Token obtido com sucesso');
    } catch (error) {
      console.error('❌ Erro ao obter token:', error.message);
      return;
    }
    
    // 2. Buscar produtos - QUERY CORRIGIDA
    console.log('\n2️⃣ Buscando produtos para testar...');
    const productsResult = await pool.query(`
      SELECT asin, name 
      FROM products 
      WHERE asin IS NOT NULL 
      AND asin != ''
      GROUP BY asin, name
      ORDER BY RANDOM()
      LIMIT 5
    `);
    
    if (productsResult.rows.length === 0) {
      console.log('❌ Nenhum produto com ASIN encontrado');
      return;
    }
    
    console.log(`✅ ${productsResult.rows.length} produtos encontrados`);
    
    // 3. Inicializar serviços
    console.log('\n3️⃣ Inicializando serviços V2...');
    const amazonService = new AmazonService(tokenManager, 'default');
    const competitorService = new CompetitorPricingServiceV2(amazonService, pool);
    
    // 4. Testar com um produto primeiro
    console.log('\n4️⃣ Testando com 1 produto primeiro...');
    const testProduct = productsResult.rows[0];
    
    console.log(`\n📦 Teste: ${testProduct.name.substring(0, 50)}...`);
    console.log(`   ASIN: ${testProduct.asin}`);
    
    const startTime = Date.now();
    try {
      const competitorData = await competitorService.getCompetitivePricing(testProduct.asin);
      const elapsed = Date.now() - startTime;
      
      if (competitorData.offers && competitorData.offers.length > 0) {
        console.log(`   ✅ ${competitorData.offers.length} competidores encontrados em ${(elapsed/1000).toFixed(2)}s`);
        
        // Mostrar primeiro competidor
        const firstOffer = competitorData.offers[0];
        console.log(`   
   🏪 ${firstOffer.sellerName}
      Preço: R$ ${firstOffer.price.toFixed(2)}
      Buy Box: ${firstOffer.isBuyBoxWinner ? '🏆 SIM' : 'NÃO'}
      FBA: ${firstOffer.isFulfilledByAmazon ? 'SIM' : 'NÃO'}`);
        
        // Se funcionou, testar collectAllCompetitorData
        console.log('\n5️⃣ Testando coleta em massa (collectAllCompetitorData)...');
        console.log('   - Este método já inclui rate limiting');
        console.log('   - Retry automático com backoff exponencial');
        console.log('   - Processamento em lotes\n');
        
        const result = await competitorService.collectAllCompetitorData('default');
        
        console.log('\n📊 RESULTADO DA COLETA EM MASSA:');
        console.log(`✅ Sucesso: ${result.success} produtos`);
        console.log(`❌ Erros: ${result.errors} produtos`);
        console.log(`⏱️ Tempo total: ${result.duration?.toFixed(2)}s`);
        console.log(`⚡ Tempo médio: ${(result.duration / result.products).toFixed(2)}s por produto`);
        
        if (result.details && result.details.length > 0) {
          console.log('\n⚠️ Detalhes dos erros:');
          result.details.slice(0, 5).forEach(detail => {
            console.log(`   - ${detail.asin}: ${detail.error}`);
          });
        }
        
      } else {
        console.log(`   ⚠️ Nenhum competidor ativo (${(elapsed/1000).toFixed(2)}s)`);
      }
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`   ❌ Erro após ${(elapsed/1000).toFixed(2)}s: ${error.message}`);
      
      if (error.message.includes('429')) {
        console.log('\n⚠️ Rate limit detectado. O sistema V2 deveria ter tratado isso automaticamente.');
        console.log('   Verifique se o rate limiter está configurado corretamente.');
      }
    }
    
    // 6. Verificar dados salvos
    console.log('\n6️⃣ Verificando dados salvos no banco...');
    
    const dbStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT asin) as produtos_monitorados,
        COUNT(DISTINCT competitor_seller_id) as competidores_unicos,
        COUNT(*) as total_registros,
        COUNT(CASE WHEN is_buy_box_winner THEN 1 END) as buy_box_winners,
        MIN(timestamp) as primeira_coleta,
        MAX(timestamp) as ultima_coleta
      FROM competitor_tracking
      WHERE timestamp > NOW() - INTERVAL '1 hour'
    `);
    
    console.log('\n📈 Estatísticas do banco (última hora):');
    console.table(dbStats.rows[0]);
    
    console.log('\n✅ Teste concluído!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Se funcionou, o sistema está pronto para produção');
    console.log('2. Reiniciar o PersistentSyncManager para ativar coleta automática');
    console.log('3. Monitorar logs para verificar funcionamento contínuo');
    
  } catch (error) {
    console.error('\n❌ Erro crítico:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Executar
testCompetitorPricingFinal().catch(console.error);