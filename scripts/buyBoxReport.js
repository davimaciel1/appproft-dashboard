const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function generateBuyBoxReport() {
  console.log('📊 RELATÓRIO DE BUY BOX - TODOS OS PRODUTOS\n');
  console.log('='.repeat(80));
  
  // 1. Estatísticas gerais
  const stats = await executeSQL(`
    SELECT 
      COUNT(*) as total_produtos,
      SUM(CASE WHEN is_winner THEN 1 ELSE 0 END) as com_buy_box,
      SUM(CASE WHEN NOT is_winner THEN 1 ELSE 0 END) as sem_buy_box,
      MAX(checked_at) as ultima_atualizacao
    FROM buy_box_winners
  `);
  
  const stat = stats.rows[0];
  console.log('📈 RESUMO GERAL:');
  console.log(`   Total de produtos verificados: ${stat.total_produtos}`);
  console.log(`   Produtos COM Buy Box: ${stat.com_buy_box} (${((stat.com_buy_box/stat.total_produtos)*100).toFixed(1)}%)`);
  console.log(`   Produtos SEM Buy Box: ${stat.sem_buy_box} (${((stat.sem_buy_box/stat.total_produtos)*100).toFixed(1)}%)`);
  console.log(`   Última atualização: ${new Date(stat.ultima_atualizacao).toLocaleString('pt-BR')}\n`);
  
  // 2. Produtos com Buy Box
  const withBuyBox = await executeSQL(`
    SELECT 
      bw.product_asin,
      p.name as product_name,
      bw.our_price,
      bw.buy_box_price,
      bw.competitor_count,
      bw.checked_at
    FROM buy_box_winners bw
    LEFT JOIN products p ON bw.product_asin = p.asin
    WHERE bw.is_winner = true
    ORDER BY bw.our_price DESC
  `);
  
  if (withBuyBox.rows.length > 0) {
    console.log('✅ PRODUTOS ONDE TEMOS O BUY BOX:');
    console.log('-'.repeat(80));
    withBuyBox.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.product_asin} - ${row.product_name?.substring(0, 40) || 'N/A'}...`);
      console.log(`   Nosso preço: $${row.our_price || 'N/A'} | Competidores: ${row.competitor_count}`);
    });
  } else {
    console.log('❌ Nenhum produto com Buy Box no momento.');
  }
  
  // 3. Histórico de mudanças recentes
  const recentChanges = await executeSQL(`
    SELECT 
      bh.product_asin,
      p.name as product_name,
      bh.change_type,
      bh.old_winner,
      bh.new_winner,
      bh.old_price,
      bh.new_price,
      bh.changed_at
    FROM buy_box_history bh
    LEFT JOIN products p ON bh.product_asin = p.asin
    ORDER BY bh.changed_at DESC
    LIMIT 10
  `);
  
  if (recentChanges.rows.length > 0) {
    console.log('\n\n🔄 MUDANÇAS RECENTES NO BUY BOX:');
    console.log('-'.repeat(80));
    recentChanges.rows.forEach(row => {
      const icon = row.change_type === 'won' ? '🏆' : '😢';
      console.log(`${icon} ${row.product_asin} - ${row.change_type.toUpperCase()}`);
      console.log(`   ${row.old_winner} → ${row.new_winner} | Preço: $${row.new_price}`);
      console.log(`   ${new Date(row.changed_at).toLocaleString('pt-BR')}`);
    });
  }
  
  // 4. Competidores mais frequentes
  const topCompetitors = await executeSQL(`
    SELECT 
      cp.seller_id,
      COUNT(DISTINCT cp.product_asin) as produtos_competindo,
      COUNT(CASE WHEN cp.is_buy_box THEN 1 END) as vezes_com_buy_box,
      AVG(cp.price) as preco_medio
    FROM competitor_pricing cp
    WHERE cp.seller_id != $1
    GROUP BY cp.seller_id
    HAVING COUNT(DISTINCT cp.product_asin) > 0
    ORDER BY vezes_com_buy_box DESC, produtos_competindo DESC
    LIMIT 10
  `, [process.env.AMAZON_SELLER_ID]);
  
  if (topCompetitors.rows.length > 0) {
    console.log('\n\n🏢 TOP COMPETIDORES:');
    console.log('-'.repeat(80));
    topCompetitors.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.seller_id}`);
      console.log(`   Competindo em: ${row.produtos_competindo} produtos`);
      console.log(`   Buy Box ganhos: ${row.vezes_com_buy_box}`);
      console.log(`   Preço médio: $${parseFloat(row.preco_medio).toFixed(2)}`);
    });
  }
  
  // 5. Produtos sem ofertas
  const noOffers = await executeSQL(`
    SELECT 
      bw.product_asin,
      p.name as product_name,
      bw.checked_at
    FROM buy_box_winners bw
    LEFT JOIN products p ON bw.product_asin = p.asin
    WHERE bw.our_price IS NULL 
    AND bw.buy_box_price IS NULL
    AND bw.competitor_count = -1
    ORDER BY bw.product_asin
  `);
  
  console.log(`\n\n⚠️ PRODUTOS SEM OFERTAS ATIVAS: ${noOffers.rows.length}`);
  if (noOffers.rows.length > 0 && noOffers.rows.length <= 10) {
    console.log('-'.repeat(80));
    noOffers.rows.forEach(row => {
      console.log(`   ${row.product_asin} - ${row.product_name?.substring(0, 50) || 'N/A'}...`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📌 FIM DO RELATÓRIO');
  console.log('='.repeat(80));
  
  process.exit(0);
}

generateBuyBoxReport();