const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function showBuyBoxWinners() {
  console.log('🏆 RELATÓRIO COMPLETO - QUEM TEM O BUY BOX\n');
  console.log('='.repeat(100));
  
  try {
    // 1. Buscar todos os produtos com dados de Buy Box
    const result = await executeSQL(`
      SELECT 
        bw.product_asin,
        p.name as product_name,
        bw.is_winner,
        bw.buy_box_winner_id,
        bw.buy_box_winner_name,
        bw.our_price,
        bw.buy_box_price,
        bw.competitor_count,
        bw.checked_at,
        CASE 
          WHEN bw.buy_box_price IS NULL THEN 'SEM OFERTAS'
          WHEN bw.is_winner = true THEN 'VOCÊ TEM O BUY BOX'
          WHEN bw.buy_box_winner_name IS NOT NULL THEN bw.buy_box_winner_name
          WHEN bw.buy_box_winner_id IS NOT NULL THEN bw.buy_box_winner_id
          ELSE 'NINGUÉM (sem Buy Box)'
        END as status_buy_box
      FROM buy_box_winners bw
      LEFT JOIN products p ON bw.product_asin = p.asin
      ORDER BY 
        CASE WHEN bw.buy_box_price IS NOT NULL THEN 0 ELSE 1 END,
        bw.is_winner DESC,
        bw.product_asin
    `);

    // 2. Separar produtos por categoria
    const comBuyBox = result.rows.filter(r => r.is_winner === true);
    const semBuyBox = result.rows.filter(r => r.is_winner === false && r.buy_box_price !== null);
    const semOfertas = result.rows.filter(r => r.buy_box_price === null);

    // 3. Mostrar produtos onde VOCÊ tem o Buy Box
    if (comBuyBox.length > 0) {
      console.log('\n✅ PRODUTOS ONDE VOCÊ TEM O BUY BOX:');
      console.log('-'.repeat(100));
      console.log('ASIN            | Produto                                      | Seu Preço | Competidores');
      console.log('-'.repeat(100));
      
      comBuyBox.forEach(row => {
        const productName = (row.product_name || 'N/A').substring(0, 40).padEnd(40);
        const price = `$${row.our_price || 'N/A'}`.padEnd(9);
        console.log(`${row.product_asin} | ${productName} | ${price} | ${row.competitor_count || 0}`);
      });
    }

    // 4. Mostrar produtos onde COMPETIDORES têm o Buy Box
    if (semBuyBox.length > 0) {
      console.log('\n\n❌ PRODUTOS ONDE COMPETIDORES TÊM O BUY BOX:');
      console.log('-'.repeat(100));
      console.log('ASIN            | Produto                    | Quem tem Buy Box           | Preço BB  | Seu Preço');
      console.log('-'.repeat(100));
      
      semBuyBox.forEach(row => {
        const productName = (row.product_name || 'N/A').substring(0, 25).padEnd(25);
        const winner = (row.buy_box_winner_name || row.buy_box_winner_id || 'Desconhecido').substring(0, 25).padEnd(25);
        const bbPrice = `$${row.buy_box_price || 'N/A'}`.padEnd(9);
        const ourPrice = `$${row.our_price || 'N/A'}`.padEnd(9);
        console.log(`${row.product_asin} | ${productName} | ${winner} | ${bbPrice} | ${ourPrice}`);
      });
    }

    // 5. Resumo de produtos sem ofertas
    if (semOfertas.length > 0) {
      console.log(`\n\n⚠️ PRODUTOS SEM OFERTAS ATIVAS: ${semOfertas.length} produtos`);
      if (semOfertas.length <= 10) {
        console.log('-'.repeat(100));
        semOfertas.forEach(row => {
          console.log(`${row.product_asin} - ${(row.product_name || 'N/A').substring(0, 60)}`);
        });
      }
    }

    // 6. Estatísticas finais
    console.log('\n\n📊 RESUMO ESTATÍSTICO:');
    console.log('='.repeat(100));
    console.log(`Total de produtos analisados: ${result.rows.length}`);
    console.log(`Produtos onde VOCÊ tem o Buy Box: ${comBuyBox.length} (${((comBuyBox.length/result.rows.length)*100).toFixed(1)}%)`);
    console.log(`Produtos onde COMPETIDORES têm o Buy Box: ${semBuyBox.length} (${((semBuyBox.length/result.rows.length)*100).toFixed(1)}%)`);
    console.log(`Produtos sem ofertas ativas: ${semOfertas.length} (${((semOfertas.length/result.rows.length)*100).toFixed(1)}%)`);

    // 7. Top competidores (se houver)
    if (semBuyBox.length > 0) {
      const competitorCount = {};
      semBuyBox.forEach(row => {
        const competitor = row.buy_box_winner_name || row.buy_box_winner_id || 'Desconhecido';
        competitorCount[competitor] = (competitorCount[competitor] || 0) + 1;
      });

      const topCompetitors = Object.entries(competitorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      console.log('\n🏢 TOP COMPETIDORES COM MAIS BUY BOXES:');
      console.log('-'.repeat(50));
      topCompetitors.forEach(([name, count], index) => {
        console.log(`${index + 1}. ${name}: ${count} produtos`);
      });
    }

    console.log('\n' + '='.repeat(100));
    console.log(`📅 Última atualização: ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }

  process.exit(0);
}

showBuyBoxWinners();