const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function recreateBuyBoxViewCorrect() {
  try {
    console.log('🔧 Recriando view buy_box_status com estrutura correta...\n');
    
    // Dropar view existente
    await executeSQL('DROP VIEW IF EXISTS buy_box_status');
    console.log('✅ View antiga removida');
    
    // Criar nova view com base na estrutura real das tabelas
    await executeSQL(`
      CREATE OR REPLACE VIEW buy_box_status AS
      SELECT 
        p.asin,
        p.name as product_name,
        COALESCE(cta.buy_box_seller, 'Sem Buy Box') as buy_box_owner,
        COALESCE(cta.buy_box_price, p.current_price) as buy_box_price,
        COALESCE(cta.fba_offers > 0, false) as is_fba,
        95.0 as feedback_rating, -- Placeholder até termos dados reais
        COALESCE(cta.timestamp, NOW()) as last_checked,
        p.current_price as our_price,
        CASE 
          WHEN cta.buy_box_price IS NULL THEN 0
          ELSE ROUND(((cta.buy_box_price - p.current_price) / p.current_price * 100), 2)
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
    
    // Contar produtos sem dados de competidores
    const noBuyBoxData = await executeSQL(`
      SELECT COUNT(*) as count
      FROM buy_box_status
      WHERE buy_box_owner = 'Sem Buy Box'
    `);
    
    console.log(`\n⚠️  Produtos sem dados de Buy Box: ${noBuyBoxData.rows[0].count}`);
    console.log('ℹ️  Nota: Como não há dados reais de competidores ainda, todos os produtos aparecem como "Sem Buy Box"');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

recreateBuyBoxViewCorrect();