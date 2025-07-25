require('dotenv').config();
const buyBoxService = require('../server/services/amazon/buyBoxSimple');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function testBuyBoxLimited() {
  console.log('🚀 Testando Buy Box com limite de 5 produtos...\n');
  
  try {
    // Buscar apenas 5 produtos para teste
    const result = await executeSQL(`
      SELECT DISTINCT asin 
      FROM products 
      WHERE marketplace = 'amazon' 
      ORDER BY asin
      LIMIT 5
    `);

    const asins = result.rows.map(row => row.asin);
    console.log(`📦 Testando com ${asins.length} produtos: ${asins.join(', ')}\n`);

    let success = 0;
    let errors = 0;

    for (const asin of asins) {
      try {
        console.log(`\n🔍 Processando ${asin}...`);
        const offersData = await buyBoxService.getBuyBoxData(asin);
        
        if (offersData) {
          console.log(`   ✅ Dados obtidos! ${offersData.Offers?.length || 0} ofertas encontradas`);
          
          const saved = await buyBoxService.saveBuyBoxData(asin, offersData);
          if (saved) {
            success++;
          } else {
            errors++;
          }
        } else {
          errors++;
        }
      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}`);
        errors++;
      }

      // Aguardar 2 segundos entre requisições
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n📊 Resultado do teste:`);
    console.log(`   ✅ Sucessos: ${success}`);
    console.log(`   ❌ Erros: ${errors}`);

    // Verificar dados salvos
    if (success > 0) {
      console.log('\n📋 Dados salvos no banco:');
      
      const savedData = await executeSQL(`
        SELECT 
          product_asin,
          is_winner,
          our_price,
          buy_box_price,
          competitor_count,
          checked_at
        FROM buy_box_winners
        ORDER BY checked_at DESC
      `);
      
      console.table(savedData.rows);

      // Verificar se há dados de competidores
      const competitorData = await executeSQL(`
        SELECT 
          COUNT(DISTINCT product_asin) as produtos,
          COUNT(DISTINCT seller_id) as vendedores,
          COUNT(*) as total_ofertas
        FROM competitor_pricing
      `);
      
      console.log('\n📊 Dados de competidores:');
      console.table(competitorData.rows);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
  
  process.exit(0);
}

testBuyBoxLimited();