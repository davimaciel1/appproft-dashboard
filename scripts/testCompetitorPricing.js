// Script para testar coleta de dados reais de competidores

require('dotenv').config();
const pool = require('../server/db/pool');
const tokenManager = require('../server/services/tokenManager');
const AmazonService = require('../server/services/amazonService');
const CompetitorPricingService = require('../server/services/amazon/competitorPricingService');

async function testCompetitorPricing() {
  console.log('🔍 TESTANDO COLETA DE COMPETIDORES REAIS');
  console.log('='.repeat(50));
  
  try {
    // 1. Buscar produtos para monitorar
    console.log('1️⃣ Buscando produtos existentes...');
    const productsResult = await pool.query(`
      SELECT DISTINCT asin, name 
      FROM products 
      WHERE asin IS NOT NULL 
      AND asin != ''
      LIMIT 3
    `);
    
    if (productsResult.rows.length === 0) {
      console.log('❌ Nenhum produto com ASIN encontrado');
      return;
    }
    
    console.log(`✅ ${productsResult.rows.length} produtos encontrados`);
    
    // 2. Inicializar serviços
    console.log('\n2️⃣ Inicializando serviços...');
    const amazonService = new AmazonService(tokenManager, 'default');
    const competitorService = new CompetitorPricingService(amazonService, pool);
    
    // 3. Coletar dados de competidores para cada produto
    console.log('\n3️⃣ Coletando dados de competidores REAIS da Amazon...');
    
    for (const product of productsResult.rows) {
      console.log(`\n📦 Produto: ${product.name} (${product.asin})`);
      
      try {
        // Chamar API da Amazon para obter competidores reais
        const competitorData = await competitorService.getCompetitivePricing(
          product.asin,
          process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC'
        );
        
        if (competitorData.offers.length > 0) {
          console.log(`   ✅ ${competitorData.offers.length} competidores encontrados:`);
          
          // Mostrar cada competidor
          for (const offer of competitorData.offers) {
            console.log(`   
   🏪 Vendedor: ${offer.sellerName || offer.sellerId}
      - Preço: R$ ${offer.price}
      - Frete: R$ ${offer.shippingPrice}
      - Buy Box: ${offer.isBuyBoxWinner ? '🏆 SIM' : '❌ NÃO'}
      - FBA: ${offer.isFulfilledByAmazon ? '✅ SIM' : '❌ NÃO'}
      - Rating: ${offer.feedbackRating || 'N/A'}% (${offer.feedbackCount || 0} avaliações)
            `);
          }
          
          // Salvar no banco
          await competitorService.saveCompetitorData(competitorData);
          console.log('   💾 Dados salvos no banco');
          
        } else {
          console.log('   ⚠️ Nenhum competidor encontrado para este produto');
        }
        
        // Aguardar para respeitar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Erro ao coletar competidores: ${error.message}`);
      }
    }
    
    // 4. Verificar dados salvos
    console.log('\n4️⃣ Verificando dados salvos no banco...');
    
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT asin) as produtos_monitorados,
        COUNT(DISTINCT competitor_seller_id) as competidores_unicos,
        COUNT(*) as total_registros,
        COUNT(CASE WHEN is_buy_box_winner THEN 1 END) as buy_box_winners
      FROM competitor_tracking
      WHERE timestamp > NOW() - INTERVAL '1 hour'
    `);
    
    console.table(stats.rows[0]);
    
    console.log('\n✅ Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar
testCompetitorPricing().catch(console.error);