const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function showBuyBoxDetails() {
  try {
    // Mostrar detalhes do Buy Box por ASIN
    const result = await executeSQL(`
      SELECT 
        bbh.asin,
        p.name as product_name,
        bbh.seller_name,
        bbh.started_at,
        bbh.ended_at,
        bbh.duration_minutes,
        bbh.avg_price,
        CASE 
          WHEN bbh.ended_at IS NULL THEN 'ATIVO'
          ELSE 'FINALIZADO'
        END as status
      FROM buy_box_history bbh
      LEFT JOIN products p ON bbh.asin = p.asin
      ORDER BY bbh.asin, bbh.started_at DESC
      LIMIT 20
    `);
    
    console.log('🏷️ DETALHES DO BUY BOX POR ASIN:\n');
    console.log('=' .repeat(100));
    
    let currentAsin = null;
    
    result.rows.forEach(row => {
      if (currentAsin !== row.asin) {
        console.log('\n' + '─'.repeat(100));
        console.log(`\n📦 ASIN: ${row.asin}`);
        console.log(`   Produto: ${row.product_name ? row.product_name.substring(0, 80) + '...' : 'Nome não encontrado'}`);
        console.log('   ' + '─'.repeat(80));
        currentAsin = row.asin;
      }
      
      const startDate = new Date(row.started_at).toLocaleString('pt-BR');
      const endDate = row.ended_at ? new Date(row.ended_at).toLocaleString('pt-BR') : 'Ainda ativo';
      const hours = Math.floor(row.duration_minutes / 60);
      const minutes = row.duration_minutes % 60;
      
      console.log(`\n   🏪 Vendedor: ${row.seller_name}`);
      console.log(`      Status: ${row.status}`);
      console.log(`      Início: ${startDate}`);
      console.log(`      Fim: ${endDate}`);
      console.log(`      Duração: ${hours}h ${minutes}min`);
      console.log(`      Preço médio: R$ ${row.avg_price}`);
    });
    
    // Resumo por ASIN
    console.log('\n\n📊 RESUMO - QUEM MAIS TEVE O BUY BOX POR PRODUTO:\n');
    
    const summary = await executeSQL(`
      SELECT 
        bbh.asin,
        p.name as product_name,
        bbh.seller_name,
        COUNT(*) as vezes_ganhou,
        SUM(bbh.duration_minutes) as tempo_total_minutos,
        AVG(bbh.avg_price) as preco_medio
      FROM buy_box_history bbh
      LEFT JOIN products p ON bbh.asin = p.asin
      GROUP BY bbh.asin, p.name, bbh.seller_name
      ORDER BY bbh.asin, tempo_total_minutos DESC
    `);
    
    currentAsin = null;
    summary.rows.forEach(row => {
      if (currentAsin !== row.asin) {
        console.log('\n' + '─'.repeat(80));
        console.log(`ASIN: ${row.asin}`);
        console.log(`Produto: ${row.product_name ? row.product_name.substring(0, 60) + '...' : 'Nome não encontrado'}`);
        currentAsin = row.asin;
      }
      
      const hours = Math.floor(row.tempo_total_minutos / 60);
      const minutes = row.tempo_total_minutos % 60;
      
      console.log(`  → ${row.seller_name}: ${hours}h ${minutes}min (${row.vezes_ganhou}x) - Preço médio: R$ ${parseFloat(row.preco_medio).toFixed(2)}`);
    });
    
    // Estatísticas gerais
    const stats = await executeSQL(`
      SELECT 
        COUNT(DISTINCT asin) as total_asins,
        COUNT(DISTINCT seller_name) as total_vendedores,
        COUNT(*) as total_periodos
      FROM buy_box_history
    `);
    
    console.log('\n\n📈 ESTATÍSTICAS GERAIS:');
    console.log(`   • Total de ASINs monitorados: ${stats.rows[0].total_asins}`);
    console.log(`   • Total de vendedores diferentes: ${stats.rows[0].total_vendedores}`);
    console.log(`   • Total de períodos registrados: ${stats.rows[0].total_periodos}`);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

showBuyBoxDetails();