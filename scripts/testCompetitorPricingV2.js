// Script para testar coleta de competidores com rate limiting robusto

require('dotenv').config();
const pool = require('../server/db/pool');
const tokenManager = require('../server/services/tokenManager');
const AmazonService = require('../server/services/amazonService');
const CompetitorPricingServiceV2 = require('../server/services/amazon/competitorPricingServiceV2');
const { getRateLimiter } = require('../server/services/rateLimiter');

async function testCompetitorPricingV2() {
  console.log('🚀 TESTANDO COLETA DE COMPETIDORES V2 (COM RATE LIMITING ROBUSTO)');
  console.log('='.repeat(60));
  
  try {
    // 1. Testar token primeiro
    console.log('1️⃣ Testando obtenção de token...');
    try {
      const token = await tokenManager.getAmazonToken('default');
      console.log('✅ Token obtido com sucesso');
    } catch (error) {
      console.error('❌ Erro ao obter token:', error.message);
      console.log('\nVerifique as credenciais no .env:');
      console.log('- AMAZON_CLIENT_ID');
      console.log('- AMAZON_CLIENT_SECRET');
      console.log('- AMAZON_REFRESH_TOKEN');
      return;
    }
    
    // 2. Verificar status do rate limiter
    console.log('\n2️⃣ Verificando status do rate limiter...');
    const rateLimiter = getRateLimiter();
    const stats = await rateLimiter.getUsageStats('default');
    console.log('📊 Estatísticas de uso:');
    console.table(stats);
    
    // 3. Buscar produtos
    console.log('\n3️⃣ Buscando produtos para testar...');
    const productsResult = await pool.query(`
      SELECT DISTINCT asin, name 
      FROM products 
      WHERE asin IS NOT NULL 
      AND asin != ''
      ORDER BY RANDOM()
      LIMIT 10
    `);
    
    if (productsResult.rows.length === 0) {
      console.log('❌ Nenhum produto com ASIN encontrado');
      return;
    }
    
    console.log(`✅ ${productsResult.rows.length} produtos encontrados`);
    
    // 4. Inicializar serviços
    console.log('\n4️⃣ Inicializando serviços V2...');
    const amazonService = new AmazonService(tokenManager, 'default');
    const competitorService = new CompetitorPricingServiceV2(amazonService, pool);
    
    // 5. Coletar dados com monitoramento
    console.log('\n5️⃣ Iniciando coleta com rate limiting inteligente...');
    console.log('   - Retry automático em caso de 429');
    console.log('   - Backoff exponencial');
    console.log('   - Processamento em lotes\n');
    
    const results = {
      success: [],
      errors: [],
      rateLimited: 0,
      totalTime: 0
    };
    
    const startTime = Date.now();
    
    for (let i = 0; i < productsResult.rows.length; i++) {
      const product = productsResult.rows[i];
      const productStartTime = Date.now();
      
      console.log(`\n📦 [${i + 1}/${productsResult.rows.length}] Produto: ${product.name.substring(0, 50)}...`);
      console.log(`   ASIN: ${product.asin}`);
      
      try {
        const competitorData = await competitorService.getCompetitivePricing(product.asin);
        const productTime = Date.now() - productStartTime;
        
        if (competitorData.offers && competitorData.offers.length > 0) {
          console.log(`   ✅ ${competitorData.offers.length} competidores encontrados em ${(productTime/1000).toFixed(2)}s`);
          
          // Mostrar top 3 competidores
          const topOffers = competitorData.offers.slice(0, 3);
          for (const offer of topOffers) {
            console.log(`   
   🏪 ${offer.sellerName}
      Preço: R$ ${offer.price.toFixed(2)}
      Buy Box: ${offer.isBuyBoxWinner ? '🏆 SIM' : 'NÃO'}
      FBA: ${offer.isFulfilledByAmazon ? 'SIM' : 'NÃO'}`);
          }
          
          results.success.push({
            asin: product.asin,
            name: product.name,
            competitorsCount: competitorData.offers.length,
            timeMs: productTime
          });
        } else {
          console.log(`   ⚠️ Nenhum competidor ativo (${(productTime/1000).toFixed(2)}s)`);
          results.success.push({
            asin: product.asin,
            name: product.name,
            competitorsCount: 0,
            timeMs: productTime
          });
        }
        
      } catch (error) {
        const productTime = Date.now() - productStartTime;
        console.error(`   ❌ Erro após ${(productTime/1000).toFixed(2)}s: ${error.message}`);
        
        if (error.message.includes('429')) {
          results.rateLimited++;
        }
        
        results.errors.push({
          asin: product.asin,
          name: product.name,
          error: error.message,
          timeMs: productTime
        });
      }
      
      // Mostrar progresso
      const elapsed = (Date.now() - startTime) / 1000;
      const avgTime = elapsed / (i + 1);
      const remaining = avgTime * (productsResult.rows.length - i - 1);
      
      console.log(`   ⏱️ Tempo médio: ${avgTime.toFixed(2)}s/produto | ETA: ${remaining.toFixed(0)}s`);
    }
    
    results.totalTime = Date.now() - startTime;
    
    // 6. Relatório final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO FINAL\n');
    
    console.log('✅ Produtos processados com sucesso:', results.success.length);
    console.log('❌ Produtos com erro:', results.errors.length);
    console.log('🚫 Rate limits encontrados:', results.rateLimited);
    console.log('⏱️ Tempo total:', (results.totalTime / 1000).toFixed(2), 'segundos');
    console.log('⚡ Tempo médio por produto:', (results.totalTime / productsResult.rows.length / 1000).toFixed(2), 'segundos');
    
    // Verificar dados salvos
    console.log('\n7️⃣ Verificando dados salvos no banco...');
    
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
    
    // Verificar uso final do rate limiter
    console.log('\n8️⃣ Status final do rate limiter:');
    const finalStats = await rateLimiter.getUsageStats('default');
    console.table(finalStats);
    
    console.log('\n✅ Teste concluído com sucesso!');
    
    if (results.errors.length > 0) {
      console.log('\n⚠️ Produtos com erro:');
      for (const error of results.errors) {
        console.log(`   - ${error.asin}: ${error.error}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Erro crítico:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Executar
testCompetitorPricingV2().catch(console.error);