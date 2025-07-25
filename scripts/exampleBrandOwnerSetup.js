// Script de exemplo para configurar competidores manuais de um brand owner

require('dotenv').config();
const pool = require('../server/db/pool');
const tokenManager = require('../server/services/tokenManager');
const AmazonService = require('../server/services/amazonService');
const BrandOwnerCompetitorService = require('../server/services/brandOwnerCompetitorService');

async function exampleBrandOwnerSetup() {
  console.log('🏷️ EXEMPLO DE CONFIGURAÇÃO PARA BRAND OWNER');
  console.log('='.repeat(50));
  
  try {
    // 1. Inicializar serviços
    console.log('1️⃣ Inicializando serviços...');
    const amazonService = new AmazonService(tokenManager, 'default');
    const brandOwnerService = new BrandOwnerCompetitorService(amazonService, pool);
    
    // 2. Adicionar um brand owner (exemplo)
    console.log('\n2️⃣ Adicionando brand owner de exemplo...');
    
    const sellerId = process.env.AMAZON_SELLER_ID || 'EXAMPLE_SELLER_123';
    const brandName = 'Minha Marca Exclusiva';
    
    const brandOwnerId = await brandOwnerService.addBrandOwner(
      sellerId,
      brandName,
      true // é vendedor exclusivo
    );
    
    console.log(`✅ Brand owner criado com ID: ${brandOwnerId}`);
    
    // 3. Buscar alguns produtos do catálogo atual
    console.log('\n3️⃣ Buscando produtos do catálogo...');
    
    const productsResult = await pool.query(`
      SELECT asin, name FROM products 
      WHERE asin IS NOT NULL 
      LIMIT 3
    `);
    
    if (productsResult.rows.length === 0) {
      console.log('❌ Nenhum produto encontrado no catálogo');
      return;
    }
    
    // 4. Adicionar o primeiro produto como produto do brand owner
    const ourProduct = productsResult.rows[0];
    console.log(`\n4️⃣ Configurando produto do brand owner:`);
    console.log(`   ASIN: ${ourProduct.asin}`);
    console.log(`   Nome: ${ourProduct.name.substring(0, 50)}...`);
    
    await brandOwnerService.addBrandOwnerProduct(
      brandOwnerId,
      ourProduct.asin,
      ourProduct.name
    );
    
    console.log('✅ Produto adicionado ao brand owner');
    
    // 5. Definir outros produtos como competidores manuais
    console.log('\n5️⃣ Definindo competidores manuais...');
    
    for (let i = 1; i < productsResult.rows.length; i++) {
      const competitor = productsResult.rows[i];
      
      console.log(`\n   Adicionando competidor ${i}:`);
      console.log(`   ASIN: ${competitor.asin}`);
      console.log(`   Nome: ${competitor.name.substring(0, 50)}...`);
      
      const competitorId = await brandOwnerService.addManualCompetitor(
        sellerId,
        ourProduct.asin,        // nosso ASIN
        competitor.asin,        // ASIN do competidor
        'Marca Concorrente',    // marca do competidor
        'direct',               // competição direta
        `Competidor ${i} - Produto similar`
      );
      
      console.log(`   ✅ Competidor adicionado com ID: ${competitorId}`);
    }
    
    // 6. Executar monitoramento inicial
    console.log('\n6️⃣ Executando monitoramento inicial...');
    
    const monitoringResult = await brandOwnerService.monitorAllBrandOwnerCompetitors(sellerId);
    console.log('\n📊 Resultado do monitoramento:');
    console.log(`   ✅ Sucesso: ${monitoringResult.success}`);
    console.log(`   ❌ Erros: ${monitoringResult.errors}`);
    console.log(`   💡 Insights gerados: ${monitoringResult.insights}`);
    
    // 7. Mostrar dashboard de competição
    console.log('\n7️⃣ Dashboard de Competição:');
    
    const dashboard = await brandOwnerService.getCompetitionDashboard(sellerId);
    
    if (dashboard.length > 0) {
      console.log('\n📈 Análise de Preços:');
      dashboard.forEach(item => {
        console.log(`
🏷️ Nosso Produto: ${item.our_asin}
   vs Competidor: ${item.competitor_asin} (${item.competitor_brand})
   
   💰 Nosso Preço: R$ ${item.our_price || 'N/A'}
   💰 Preço Dele: R$ ${item.competitor_price || 'N/A'}
   📊 Diferença: R$ ${item.price_difference || 'N/A'} (${item.price_difference_percent || 'N/A'}%)
   🎯 Posição: ${item.price_position}
   
   🏆 Nosso Ranking: ${item.our_rank || 'N/A'}
   🏆 Ranking Dele: ${item.competitor_rank || 'N/A'}
   
   ⭐ Nossa Avaliação: ${item.our_rating || 'N/A'}
   ⭐ Avaliação Dele: ${item.competitor_rating || 'N/A'}
        `);
      });
    } else {
      console.log('⚠️ Nenhum dado de competição disponível ainda');
    }
    
    // 8. Mostrar queries SQL úteis
    console.log('\n8️⃣ Queries SQL úteis para análise:');
    console.log(`
-- Ver todos os competidores de um seller
SELECT * FROM manual_competitors mc
JOIN brand_owners bo ON mc.brand_owner_id = bo.id
WHERE bo.seller_id = '${sellerId}';

-- Ver histórico de monitoramento
SELECT * FROM competitor_monitoring
WHERE our_asin = '${ourProduct.asin}'
ORDER BY monitoring_date DESC;

-- Dashboard completo
SELECT * FROM brand_owner_competition_dashboard
WHERE brand_name = '${brandName}';

-- Insights gerados
SELECT * FROM ai_insights
WHERE asin = '${ourProduct.asin}'
AND insight_type = 'manual_competitor'
ORDER BY created_at DESC;
    `);
    
    console.log('\n✅ Configuração concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Adicione mais produtos seus e seus competidores');
    console.log('2. Configure monitoramento automático no PersistentSyncManager');
    console.log('3. Acompanhe os insights gerados sobre diferenças de preço');
    console.log('4. Use o dashboard para tomar decisões estratégicas');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Executar
exampleBrandOwnerSetup().catch(console.error);