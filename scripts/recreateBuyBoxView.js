const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function recreateBuyBoxView() {
  try {
    console.log('🔧 Recriando view buy_box_status com estrutura atualizada...\n');
    
    // Dropar view existente
    await executeSQL('DROP VIEW IF EXISTS buy_box_status');
    console.log('✅ View antiga removida');
    
    // Criar nova view com todas as colunas necessárias
    await executeSQL(`
      CREATE OR REPLACE VIEW buy_box_status AS
      SELECT 
        p.asin,
        p.name as product_name,
        COALESCE(ct.seller_name, 'Sem Buy Box') as buy_box_owner,
        COALESCE(ct.price, p.current_price) as buy_box_price,
        COALESCE(ct.is_fba, false) as is_fba,
        COALESCE(ct.feedback_rating, 0) as feedback_rating,
        COALESCE(ct.timestamp, NOW()) as last_checked,
        p.current_price as our_price,
        CASE 
          WHEN ct.price IS NULL THEN 0
          ELSE ROUND(((ct.price - p.current_price) / p.current_price * 100), 2)
        END as price_difference_pct,
        CASE 
          WHEN ct.seller_name = 'Sua Loja' THEN 'Você tem a Buy Box!'
          WHEN ct.seller_name IS NULL THEN 'Produto sem Buy Box ativa'
          ELSE CONCAT('Buy Box com ', ct.seller_name)
        END as status_message
      FROM products p
      LEFT JOIN LATERAL (
        SELECT * FROM competitor_tracking_advanced cta
        WHERE cta.asin = p.asin 
        AND cta.is_buy_box_winner = true
        ORDER BY cta.timestamp DESC 
        LIMIT 1
      ) ct ON true
    `);
    
    console.log('✅ Nova view criada com sucesso!');
    
    // Verificar nova estrutura
    const columns = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'buy_box_status'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Colunas da nova view:');
    columns.rows.forEach(col => {
      console.log(`   • ${col.column_name}: ${col.data_type}`);
    });
    
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
      LIMIT 5
    `);
    
    console.log(`\n📊 Encontrados ${result.rowCount} produtos (mostrando top 5):\n`);
    
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.product_name}`);
      console.log(`   📷 Imagem: ${row.product_image ? '✅ ' + row.product_image.substring(0, 50) + '...' : '❌ Sem imagem'}`);
      console.log(`   👑 Buy Box: ${row.buy_box_owner}`);
      console.log(`   💰 Preço Buy Box: R$ ${row.buy_box_price}`);
      console.log(`   💵 Nosso Preço: R$ ${row.our_price}`);
      console.log(`   📊 Diferença: ${row.price_difference_pct}%`);
      console.log(`   📝 Status: ${row.status_message}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

recreateBuyBoxView();