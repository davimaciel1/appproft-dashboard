const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function populateBuyBoxManual() {
  console.log('📊 Populando dados de Buy Box manualmente...\n');
  
  try {
    // 1. Atualizar produtos conhecidos que têm Buy Box
    console.log('✅ Atualizando produtos com Buy Box...');
    
    // Produto que sabemos que tem Buy Box
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
    
    console.log('   B0CLBHB46K - Cutting Boards: ✅ Buy Box atualizado');
    
    // 2. Simular alguns competidores para testar o sistema
    console.log('\n🏴‍☠️ Criando cenários de teste com competidores...');
    
    // Produto com competidor real
    await executeSQL(`
      UPDATE buy_box_winners
      SET 
        is_winner = false,
        buy_box_price = 44.99,
        buy_box_winner_id = 'COMPETITOR_001',
        buy_box_winner_name = 'Kitchen Pro Store',
        competitor_count = 3,
        our_price = 45.99,
        checked_at = NOW()
      WHERE product_asin = 'B0CMYYZY2Q'
    `);
    
    console.log('   B0CMYYZY2Q - Chef Knife: ❌ Competidor tem Buy Box');
    
    // Mais alguns produtos com diferentes cenários
    await executeSQL(`
      UPDATE buy_box_winners
      SET 
        is_winner = false,
        buy_box_price = 119.99,
        buy_box_winner_id = 'COMPETITOR_002',
        buy_box_winner_name = 'Premium Kitchen Supplies',
        competitor_count = 5,
        our_price = 124.99,
        checked_at = NOW()
      WHERE product_asin = 'B0CLB8C9T8'
    `);
    
    console.log('   B0CLB8C9T8 - Knife Set: ❌ Competidor tem Buy Box');
    
    // Produto que recuperamos o Buy Box
    await executeSQL(`
      UPDATE buy_box_winners
      SET 
        is_winner = true,
        buy_box_price = 34.99,
        buy_box_winner_id = 'A27IMS7TINM85N',
        buy_box_winner_name = 'Connect Brands',
        competitor_count = 2,
        our_price = 34.99,
        checked_at = NOW()
      WHERE product_asin = 'B0C5WSYPMJ'
    `);
    
    console.log('   B0C5WSYPMJ - Mastery Series: ✅ Recuperamos o Buy Box!');
    
    // 3. Marcar produtos inativos
    console.log('\n⚠️ Marcando produtos sem ofertas...');
    
    await executeSQL(`
      UPDATE buy_box_winners
      SET 
        buy_box_price = NULL,
        buy_box_winner_id = NULL,
        buy_box_winner_name = 'Sem ofertas ativas',
        is_winner = false,
        checked_at = NOW()
      WHERE product_asin IN (
        SELECT asin 
        FROM products 
        WHERE price = 0 OR price IS NULL
      )
    `);
    
    // 4. Estatísticas finais
    console.log('\n📊 ESTATÍSTICAS ATUALIZADAS:\n');
    
    const stats = await executeSQL(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_winner = true THEN 1 END) as com_buy_box,
        COUNT(CASE WHEN is_winner = false AND buy_box_winner_id IS NOT NULL AND buy_box_winner_id != '' THEN 1 END) as competidor_tem,
        COUNT(CASE WHEN buy_box_price IS NULL THEN 1 END) as sem_ofertas
      FROM buy_box_winners
    `);
    
    const s = stats.rows[0];
    console.log(`Total de produtos: ${s.total}`);
    console.log(`✅ Temos o Buy Box: ${s.com_buy_box} produtos`);
    console.log(`❌ Competidor tem: ${s.competidor_tem} produtos`);
    console.log(`⚠️ Sem ofertas: ${s.sem_ofertas} produtos`);
    
    // 5. Mostrar exemplos
    console.log('\n📋 EXEMPLOS DE PRODUTOS:\n');
    
    const examples = await executeSQL(`
      SELECT 
        product_asin as "ASIN",
        SUBSTRING(product_name, 1, 40) || '...' as "Produto",
        buy_box_winner_name as "Buy Box Winner",
        CASE WHEN is_winner THEN '✅' ELSE '❌' END as "Nosso?",
        COALESCE('$' || buy_box_price::text, 'N/A') as "Preço",
        competitor_count as "Competidores"
      FROM buy_box_winners
      WHERE checked_at > NOW() - INTERVAL '5 minutes'
      ORDER BY is_winner DESC, buy_box_price DESC NULLS LAST
      LIMIT 10
    `);
    
    console.table(examples.rows);
    
    // 6. Verificar se há alertas de hijacker
    const hijackers = await executeSQL(`
      SELECT COUNT(*) as count
      FROM hijacker_alerts
      WHERE is_active = true
    `);
    
    if (hijackers.rows[0].count > 0) {
      console.log(`\n🚨 ATENÇÃO: ${hijackers.rows[0].count} hijackers ativos!`);
      
      const activeHijackers = await executeSQL(`
        SELECT 
          product_asin,
          hijacker_name,
          hijacker_price,
          our_price
        FROM hijacker_alerts
        WHERE is_active = true
        ORDER BY detected_at DESC
      `);
      
      console.log('\nHijackers ativos:');
      activeHijackers.rows.forEach(h => {
        console.log(`   ${h.product_asin}: ${h.hijacker_name} ($${h.hijacker_price} vs nosso $${h.our_price})`);
      });
    }
    
    console.log('\n✅ Dados de Buy Box atualizados manualmente!');
    console.log('💡 Use este script para simular cenários de teste enquanto a API não está disponível.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

populateBuyBoxManual();