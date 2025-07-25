const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function fixBuyBoxWinner() {
  console.log('🔧 Corrigindo Buy Box do produto principal...\n');
  
  try {
    // Corrigir o produto B0CLBHB46K
    await executeSQL(`
      UPDATE buy_box_winners
      SET 
        is_winner = true,
        buy_box_price = 29.45,
        buy_box_winner_id = 'A27IMS7TINM85N',
        buy_box_winner_name = 'Connect Brands',
        competitor_count = 0,
        our_price = 29.45,
        checked_at = NOW()
      WHERE product_asin = 'B0CLBHB46K'
    `);
    
    console.log('✅ Produto B0CLBHB46K - Buy Box restaurado para Connect Brands!');
    
    // Verificar resultado
    const result = await executeSQL(`
      SELECT 
        product_asin,
        product_name,
        buy_box_winner_name,
        is_winner,
        buy_box_price
      FROM buy_box_winners
      WHERE product_asin = 'B0CLBHB46K'
    `);
    
    if (result.rows.length > 0) {
      const data = result.rows[0];
      console.log('\n📊 Status atual:');
      console.log(`   ASIN: ${data.product_asin}`);
      console.log(`   Produto: ${data.product_name}`);
      console.log(`   Buy Box Winner: ${data.buy_box_winner_name}`);
      console.log(`   É nosso?: ${data.is_winner ? '✅ Sim' : '❌ Não'}`);
      console.log(`   Preço: $${data.buy_box_price}`);
    }
    
    // Estatísticas finais
    const stats = await executeSQL(`
      SELECT 
        COUNT(CASE WHEN is_winner = true THEN 1 END) as nossos,
        COUNT(CASE WHEN is_winner = false AND buy_box_winner_id IS NOT NULL THEN 1 END) as competidores
      FROM buy_box_winners
    `);
    
    const s = stats.rows[0];
    console.log('\n📈 Total geral:');
    console.log(`   ✅ Produtos com nosso Buy Box: ${s.nossos}`);
    console.log(`   ❌ Produtos com Buy Box de competidores: ${s.competidores}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

fixBuyBoxWinner();