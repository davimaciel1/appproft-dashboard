const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function analyzeCompetitorData() {
  try {
    // Verificar dados em competitor_tracking_advanced
    const result = await executeSQL(`
      SELECT 
        asin,
        seller_name,
        is_buy_box_winner,
        price,
        timestamp,
        tenant_id
      FROM competitor_tracking_advanced 
      ORDER BY timestamp DESC
      LIMIT 5
    `);
    
    console.log('🏆 Dados em competitor_tracking_advanced:');
    result.rows.forEach(r => {
      console.log(`   ASIN: ${r.asin}, Vendedor: ${r.seller_name}, Buy Box: ${r.is_buy_box_winner ? '✅' : '❌'}, Preço: ${r.price}`);
      console.log(`   Data: ${new Date(r.timestamp).toLocaleString()}, Tenant: ${r.tenant_id}`);
    });
    
    // Verificar quem ganhou Buy Box
    const buyBoxWinners = await executeSQL(`
      SELECT 
        asin,
        COUNT(*) as total_checks,
        SUM(CASE WHEN is_buy_box_winner THEN 1 ELSE 0 END) as buy_box_wins,
        MAX(timestamp) as last_check
      FROM competitor_tracking_advanced
      GROUP BY asin
      HAVING SUM(CASE WHEN is_buy_box_winner THEN 1 ELSE 0 END) > 0
      LIMIT 5
    `);
    
    console.log('\n📊 ASINs com Buy Box ganho:');
    if (buyBoxWinners.rows.length === 0) {
      console.log('   ❌ Nenhum registro de Buy Box ganho');
    } else {
      buyBoxWinners.rows.forEach(r => {
        console.log(`   ASIN: ${r.asin}, Checks: ${r.total_checks}, Wins: ${r.buy_box_wins}`);
      });
    }
    
    // Verificar se buy_box_history deveria ser populada
    console.log('\n🔍 Verificando processo de população do buy_box_history...');
    
    // Verificar estrutura da tabela
    const columns = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'buy_box_history'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estrutura da tabela buy_box_history:');
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

analyzeCompetitorData();