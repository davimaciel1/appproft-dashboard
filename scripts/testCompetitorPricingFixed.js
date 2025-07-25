// Script para testar coleta de competidores com correções

require('dotenv').config();
const pool = require('../server/db/pool');
const tokenManager = require('../server/services/tokenManager');
const AmazonService = require('../server/services/amazonService');
const CompetitorPricingService = require('../server/services/amazon/competitorPricingService');

async function testCompetitorPricingFixed() {
  console.log('🔍 TESTANDO COLETA DE COMPETIDORES (VERSÃO CORRIGIDA)');
  console.log('='.repeat(50));
  
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
    
    // 2. Buscar produtos
    console.log('\n2️⃣ Buscando produtos...');
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
    
    // 3. Inicializar serviços
    console.log('\n3️⃣ Inicializando serviços...');
    const amazonService = new AmazonService(tokenManager, 'default');
    const competitorService = new CompetitorPricingService(amazonService, pool);
    
    // 4. Coletar dados
    console.log('\n4️⃣ Coletando dados de competidores...');
    console.log('Marketplace ID:', process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC');
    
    let successCount = 0;
    for (const product of productsResult.rows) {
      console.log(`\n📦 Produto: ${product.name}`);
      console.log(`   ASIN: ${product.asin}`);
      
      try {
        const competitorData = await competitorService.getCompetitivePricing(product.asin);
        
        if (competitorData.offers && competitorData.offers.length > 0) {
          console.log(`   ✅ ${competitorData.offers.length} competidores encontrados:`);
          
          for (const offer of competitorData.offers) {
            console.log(`   
   🏪 Vendedor: ${offer.sellerName || offer.sellerId}
      Preço: R$ ${offer.price}
      Buy Box: ${offer.isBuyBoxWinner ? '🏆 SIM' : 'NÃO'}
      FBA: ${offer.isFulfilledByAmazon ? 'SIM' : 'NÃO'}`);
          }
          
          successCount++;
        } else {
          console.log('   ⚠️ Nenhum competidor ativo');
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Sucesso em ${successCount} de ${productsResult.rows.length} produtos`);
    
  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
  } finally {
    await pool.end();
  }
}

testCompetitorPricingFixed().catch(console.error);
