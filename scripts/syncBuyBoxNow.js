const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const buyBoxService = require('../server/services/amazon/buyBoxServiceSimple');

async function syncBuyBoxNow() {
  console.log('🔄 Sincronizando Buy Box com a Amazon...\n');
  
  try {
    // 1. Buscar todos os produtos
    console.log('📦 Buscando produtos para sincronizar...');
    const products = await executeSQL(`
      SELECT DISTINCT p.asin, p.name, p.price
      FROM products p
      WHERE p.asin IS NOT NULL
      AND p.asin != ''
      ORDER BY p.price DESC NULLS LAST
    `);
    
    console.log(`   Encontrados ${products.rows.length} produtos ativos\n`);
    
    if (products.rows.length === 0) {
      console.log('❌ Nenhum produto ativo encontrado');
      process.exit(1);
    }
    
    // 2. Inicializar serviço
    const service = buyBoxService;
    
    // 3. Sincronizar em lotes de 20 (limite da API)
    const batchSize = 20;
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (let i = 0; i < products.rows.length; i += batchSize) {
      const batch = products.rows.slice(i, i + batchSize);
      const asins = batch.map(p => p.asin);
      
      console.log(`\n📊 Processando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(products.rows.length/batchSize)}`);
      console.log(`   ASINs: ${asins.slice(0, 3).join(', ')}${asins.length > 3 ? '...' : ''}`);
      
      try {
        // Buscar Buy Box para o lote
        const results = await service.getBuyBoxBatch(asins);
        
        for (const result of results) {
          if (result.success) {
            totalSuccess++;
            
            // Atualizar banco de dados
            await executeSQL(`
              UPDATE buy_box_winners
              SET 
                is_winner = $2,
                buy_box_price = $3,
                buy_box_winner_id = $4,
                buy_box_winner_name = $5,
                competitor_count = $6,
                our_price = $7,
                checked_at = NOW()
              WHERE product_asin = $1
            `, [
              result.asin,
              result.data.isWinner,
              result.data.buyBoxPrice,
              result.data.buyBoxWinnerId,
              result.data.buyBoxWinnerName || (result.data.isWinner ? 'Connect Brands' : null),
              result.data.competitorCount,
              result.data.ourPrice
            ]);
            
            if (result.data.isWinner) {
              console.log(`   ✅ ${result.asin}: Temos o Buy Box! ($${result.data.buyBoxPrice})`);
            } else if (result.data.buyBoxWinnerId) {
              console.log(`   ❌ ${result.asin}: ${result.data.buyBoxWinnerName || result.data.buyBoxWinnerId} tem o Buy Box ($${result.data.buyBoxPrice})`);
            } else {
              console.log(`   ⚠️ ${result.asin}: Sem ofertas ativas`);
            }
          } else {
            totalErrors++;
            console.log(`   ❌ ${result.asin}: ${result.error}`);
          }
        }
        
        // Aguardar um pouco entre lotes para respeitar rate limits
        if (i + batchSize < products.rows.length) {
          console.log('\n⏳ Aguardando 2 segundos antes do próximo lote...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Erro no lote: ${error.message}`);
        totalErrors += batch.length;
      }
    }
    
    // 4. Estatísticas finais
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO DA SINCRONIZAÇÃO:\n');
    
    const stats = await executeSQL(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_winner = true THEN 1 END) as com_buy_box,
        COUNT(CASE WHEN is_winner = false AND buy_box_winner_id IS NOT NULL THEN 1 END) as competidor_tem,
        COUNT(CASE WHEN buy_box_price IS NULL THEN 1 END) as sem_ofertas,
        COUNT(CASE WHEN checked_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as atualizados_agora
      FROM buy_box_winners
    `);
    
    const s = stats.rows[0];
    console.log(`Total de produtos: ${s.total}`);
    console.log(`✅ Com Buy Box: ${s.com_buy_box} produtos`);
    console.log(`❌ Competidor tem: ${s.competidor_tem} produtos`);
    console.log(`⚠️ Sem ofertas: ${s.sem_ofertas} produtos`);
    console.log(`🔄 Atualizados agora: ${s.atualizados_agora} produtos`);
    
    console.log(`\n✅ Sincronização concluída: ${totalSuccess} sucessos, ${totalErrors} erros`);
    
    // 5. Verificar hijackers
    const hijackers = await executeSQL(`
      SELECT COUNT(*) as count
      FROM hijacker_alerts
      WHERE is_active = true
    `);
    
    if (hijackers.rows[0].count > 0) {
      console.log(`\n🚨 ATENÇÃO: ${hijackers.rows[0].count} hijackers ativos detectados!`);
      console.log('   Execute: node scripts/hijackerReport.js para ver detalhes');
    }
    
  } catch (error) {
    console.error('❌ Erro na sincronização:', error.message);
  }
  
  process.exit(0);
}

syncBuyBoxNow();