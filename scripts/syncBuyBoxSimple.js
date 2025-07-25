const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const buyBoxService = require('../server/services/amazon/buyBoxServiceSimple');

async function syncBuyBoxSimple() {
  console.log('🔄 Sincronizando Buy Box com a Amazon (método simples)...\n');
  
  const service = buyBoxService;
  let totalSuccess = 0;
  let totalErrors = 0;
  
  try {
    // 1. Buscar produtos
    console.log('📦 Buscando produtos para sincronizar...');
    const products = await executeSQL(`
      SELECT DISTINCT p.asin, p.name, p.price
      FROM products p
      WHERE p.asin IS NOT NULL
      AND p.asin != ''
      ORDER BY p.price DESC NULLS LAST
      LIMIT 10  -- Limitar para teste inicial
    `);
    
    console.log(`   Processando ${products.rows.length} produtos (teste limitado)\n`);
    
    // 2. Processar um por um
    for (const product of products.rows) {
      try {
        console.log(`🔍 Sincronizando ${product.asin} - ${product.name?.substring(0, 30)}...`);
        
        const buyBoxData = await service.getBuyBoxDataForASIN(product.asin);
        
        if (buyBoxData) {
          // Salvar dados no banco
          await service.saveBuyBoxData(product.asin, buyBoxData);
          totalSuccess++;
          
          // Mostrar resultado
          if (buyBoxData.isWinner) {
            console.log(`   ✅ Temos o Buy Box! Preço: $${buyBoxData.buyBoxPrice}`);
          } else if (buyBoxData.buyBoxWinnerId) {
            const winnerName = buyBoxData.buyBoxWinnerName || buyBoxData.buyBoxWinnerId;
            console.log(`   ❌ ${winnerName} tem o Buy Box ($${buyBoxData.buyBoxPrice})`);
          } else {
            console.log(`   ⚠️ Sem ofertas ativas`);
          }
        } else {
          totalErrors++;
          console.log(`   ❌ Sem dados de Buy Box disponíveis`);
        }
        
        // Aguardar entre requisições para respeitar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        totalErrors++;
        console.log(`   ❌ Erro: ${error.message}`);
      }
    }
    
    // 3. Estatísticas finais
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
    console.log(`Total de produtos no banco: ${s.total}`);
    console.log(`✅ Com Buy Box: ${s.com_buy_box} produtos`);
    console.log(`❌ Competidor tem: ${s.competidor_tem} produtos`);
    console.log(`⚠️ Sem ofertas: ${s.sem_ofertas} produtos`);
    console.log(`🔄 Atualizados agora: ${s.atualizados_agora} produtos`);
    
    console.log(`\n✅ Processados nesta execução: ${totalSuccess} sucessos, ${totalErrors} erros`);
    
    // 4. Mostrar alguns exemplos
    console.log('\n📋 EXEMPLOS DE PRODUTOS ATUALIZADOS:\n');
    
    const examples = await executeSQL(`
      SELECT 
        product_asin as "ASIN",
        SUBSTRING(product_name, 1, 40) || '...' as "Produto",
        COALESCE(buy_box_winner_name, 'N/A') as "Buy Box Winner",
        CASE WHEN is_winner THEN '✅' ELSE '❌' END as "Nosso?",
        COALESCE('$' || buy_box_price::text, 'N/A') as "Preço",
        TO_CHAR(checked_at, 'HH24:MI:SS') as "Atualizado"
      FROM buy_box_winners
      WHERE checked_at > NOW() - INTERVAL '10 minutes'
      ORDER BY checked_at DESC
      LIMIT 5
    `);
    
    if (examples.rows.length > 0) {
      console.table(examples.rows);
    }
    
    console.log('\n💡 Para sincronizar TODOS os produtos, remova o LIMIT na query');
    
  } catch (error) {
    console.error('❌ Erro na sincronização:', error.message);
  }
  
  process.exit(0);
}

syncBuyBoxSimple();