const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function updateConnectBrands() {
  console.log('🏢 Atualizando nome da empresa para Connect Brands...\n');

  try {
    // 1. Atualizar sellers_cache
    console.log('📝 Atualizando cache de vendedores...');
    await executeSQL(`
      UPDATE sellers_cache 
      SET seller_name = 'Connect Brands'
      WHERE seller_id = 'A27IMS7TINM85N'
    `);

    // 2. Atualizar buy_box_winners
    console.log('📝 Atualizando tabela buy_box_winners...');
    await executeSQL(`
      UPDATE buy_box_winners 
      SET buy_box_winner_name = 'Connect Brands'
      WHERE buy_box_winner_id = 'A27IMS7TINM85N'
      OR (is_winner = true AND buy_box_winner_name = 'A27IMS7TINM85N')
    `);

    // 3. Atualizar competitor_tracking_advanced se existir
    console.log('📝 Atualizando tabela competitor_tracking_advanced...');
    await executeSQL(`
      UPDATE competitor_tracking_advanced 
      SET buy_box_seller_name = 'Connect Brands'
      WHERE buy_box_seller = 'A27IMS7TINM85N'
    `).catch(() => console.log('   (tabela não existe ou sem dados)'));

    console.log('\n✅ Nome atualizado com sucesso!\n');

    // 4. Mostrar resultado final
    console.log('📊 PRODUTOS E QUEM TEM O BUY BOX:\n');
    
    const result = await executeSQL(`
      SELECT 
        bw.product_asin as "ASIN",
        SUBSTRING(p.name, 1, 40) || '...' as "Produto",
        CASE 
          WHEN bw.is_winner = true THEN '✅ ' || COALESCE(bw.buy_box_winner_name, 'Connect Brands')
          WHEN bw.buy_box_winner_name IS NOT NULL THEN '❌ ' || bw.buy_box_winner_name
          WHEN bw.buy_box_winner_id IS NOT NULL THEN '❌ ' || bw.buy_box_winner_id
          ELSE '⚠️ Sem Buy Box'
        END as "Empresa com Buy Box",
        '$' || bw.buy_box_price as "Preço Buy Box",
        '$' || COALESCE(bw.our_price::text, 'N/A') as "Seu Preço"
      FROM buy_box_winners bw
      LEFT JOIN products p ON bw.product_asin = p.asin
      WHERE bw.buy_box_price IS NOT NULL
      ORDER BY bw.is_winner DESC, bw.product_asin
    `);

    console.table(result.rows);

    // 5. Verificar sellers_cache
    console.log('\n🏢 VENDEDORES CADASTRADOS:\n');
    const sellers = await executeSQL(`
      SELECT 
        seller_id as "ID do Vendedor",
        seller_name as "Nome da Empresa",
        TO_CHAR(last_updated, 'DD/MM/YYYY HH24:MI') as "Última Atualização"
      FROM sellers_cache
      ORDER BY seller_name
    `);
    
    console.table(sellers.rows);

    console.log('\n✅ Banco de dados atualizado com sucesso!');
    console.log('📌 A empresa "Connect Brands" está identificada em todos os produtos com Buy Box.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }

  process.exit(0);
}

updateConnectBrands();