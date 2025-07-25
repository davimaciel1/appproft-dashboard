const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function recreateBuyBoxViewFinal() {
  try {
    console.log('🔧 Recriando view buy_box_status com estrutura final...\n');
    
    // Dropar view existente
    await executeSQL('DROP VIEW IF EXISTS buy_box_status');
    console.log('✅ View antiga removida');
    
    // Criar nova view com a estrutura correta
    await executeSQL(`
      CREATE OR REPLACE VIEW buy_box_status AS
      SELECT 
        p.asin,
        p.name as product_name,
        COALESCE(cta.buy_box_seller, 'Sem Buy Box') as buy_box_owner,
        COALESCE(cta.buy_box_price, p.price) as buy_box_price,
        COALESCE(cta.fba_offers > 0, false) as is_fba,
        95.0 as feedback_rating,
        COALESCE(cta.timestamp, NOW()) as last_checked,
        p.price as our_price,
        CASE 
          WHEN cta.buy_box_price IS NULL THEN 0
          ELSE ROUND(((cta.buy_box_price - p.price) / p.price * 100), 2)
        END as price_difference_pct,
        CASE 
          WHEN cta.our_has_buy_box = true THEN 'Você tem a Buy Box!'
          WHEN cta.buy_box_seller IS NULL THEN 'Produto sem Buy Box ativa'
          ELSE CONCAT('Buy Box com ', cta.buy_box_seller)
        END as status_message
      FROM products p
      LEFT JOIN LATERAL (
        SELECT * FROM competitor_tracking_advanced
        WHERE asin = p.asin 
        ORDER BY timestamp DESC 
        LIMIT 1
      ) cta ON true
      WHERE p.asin IS NOT NULL
    `);
    
    console.log('✅ Nova view criada com sucesso!');
    
    // Testar a query do dashboard com imagens
    console.log('\n🔍 Testando query do dashboard com imagens...');
    
    const result = await executeSQL(`
      SELECT 
        bs.asin,
        bs.product_name,
        p.image_url as product_image,
        bs.buy_box_owner,
        bs.buy_box_price,
        bs.is_fba,
        bs.feedback_rating,
        bs.last_checked,
        bs.our_price,
        bs.price_difference_pct,
        bs.status_message
      FROM buy_box_status bs
      LEFT JOIN products p ON bs.asin = p.asin
      ORDER BY bs.price_difference_pct DESC
      LIMIT 10
    `);
    
    console.log(`\n📊 Encontrados ${result.rowCount} produtos com imagens:\n`);
    
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.product_name.substring(0, 60)}...`);
      console.log(`   📷 Imagem: ${row.product_image ? '✅ Disponível' : '❌ Sem imagem'}`);
      console.log(`   👑 Buy Box: ${row.buy_box_owner}`);
      console.log(`   💰 Preço Buy Box: $${row.buy_box_price}`);
      console.log(`   💵 Nosso Preço: $${row.our_price}`);
      console.log(`   📊 Diferença: ${row.price_difference_pct}%`);
      console.log(`   📝 Status: ${row.status_message}`);
      console.log('');
    });
    
    // Estatísticas de imagens
    const imageStats = await executeSQL(`
      SELECT 
        COUNT(*) as total,
        COUNT(p.image_url) as with_image,
        COUNT(*) - COUNT(p.image_url) as without_image
      FROM buy_box_status bs
      LEFT JOIN products p ON bs.asin = p.asin
    `);
    
    console.log('📸 Estatísticas de imagens:');
    console.log(`   Total de produtos: ${imageStats.rows[0].total}`);
    console.log(`   Com imagem: ${imageStats.rows[0].with_image}`);
    console.log(`   Sem imagem: ${imageStats.rows[0].without_image}`);
    
    console.log('\n✅ View buy_box_status recriada com sucesso!');
    console.log('✅ Imagens dos produtos agora aparecerão no dashboard!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

recreateBuyBoxViewFinal();