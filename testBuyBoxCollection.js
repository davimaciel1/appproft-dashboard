const { executeSQL } = require('./DATABASE_ACCESS_CONFIG');
const AmazonService = require('./server/services/amazonService');
const CompetitorPricingService = require('./server/services/amazon/competitorPricingService');

async function testBuyBoxCollection() {
  try {
    console.log('🔍 Testando coleta de dados de Buy Box...\n');
    
    // Inicializar serviços
    const amazonService = new AmazonService();
    const competitorService = new CompetitorPricingService(amazonService, {
      query: executeSQL,
      connect: () => ({ 
        query: executeSQL,
        release: () => {}
      })
    });
    
    // Buscar um produto para testar
    const productResult = await executeSQL(`
      SELECT asin, name, tenant_id 
      FROM products 
      WHERE marketplace = 'amazon' 
      AND asin IS NOT NULL 
      AND asin != ''
      LIMIT 1
    `);
    
    if (productResult.rows.length === 0) {
      console.log('❌ Nenhum produto com ASIN encontrado para testar');
      return;
    }
    
    const product = productResult.rows[0];
    console.log(`📦 Testando com produto: ${product.name}`);
    console.log(`   ASIN: ${product.asin}\n`);
    
    // Testar coleta de dados competitivos
    console.log('📊 Coletando dados de competidores...');
    try {
      const competitorData = await competitorService.getCompetitivePricing(product.asin);
      
      console.log('\n✅ Dados coletados com sucesso!');
      console.log(`   Total de ofertas: ${competitorData.offers.length}`);
      
      if (competitorData.summary.buyBoxWinner) {
        console.log(`   🏆 Buy Box Winner: ${competitorData.summary.buyBoxWinner.sellerName}`);
        console.log(`      Preço: R$ ${competitorData.summary.buyBoxWinner.price}`);
        console.log(`      FBA: ${competitorData.summary.buyBoxWinner.isFBA ? 'Sim' : 'Não'}`);
      } else {
        console.log('   ⚠️ Nenhum vendedor com Buy Box identificado');
      }
      
      // Verificar se dados foram salvos
      console.log('\n🔍 Verificando dados salvos no banco...');
      
      const savedData = await executeSQL(`
        SELECT * FROM competitor_tracking 
        WHERE asin = $1 
        ORDER BY timestamp DESC 
        LIMIT 5
      `, [product.asin]);
      
      console.log(`   Registros salvos: ${savedData.rows.length}`);
      
      if (savedData.rows.length > 0) {
        console.log('\n   Últimos registros:');
        savedData.rows.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.seller_name} - R$ ${row.price} ${row.is_buy_box_winner ? '🏆' : ''}`);
        });
      }
      
      // Verificar buy_box_history
      const buyBoxHistory = await executeSQL(`
        SELECT * FROM buy_box_history 
        WHERE asin = $1 
        ORDER BY started_at DESC 
        LIMIT 5
      `, [product.asin]);
      
      console.log(`\n📜 Histórico de Buy Box: ${buyBoxHistory.rows.length} registros`);
      
      if (buyBoxHistory.rows.length > 0) {
        console.log('   Últimos registros:');
        buyBoxHistory.rows.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.seller_name} - ${row.duration_minutes || 'Em andamento'} minutos`);
        });
      }
      
    } catch (error) {
      console.error('❌ Erro ao coletar dados:', error.message);
      console.error('   Detalhes:', error);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar teste
testBuyBoxCollection();