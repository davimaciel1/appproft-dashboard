const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const buyBoxService = require('../server/services/amazon/buyBoxServiceSimple');

async function syncSingleBuyBox() {
  console.log('🔄 Sincronizando Buy Box de um produto específico...\n');
  
  const service = buyBoxService;
  
  try {
    // ASIN que sabemos que tem Buy Box
    const asin = 'B0CLBHB46K'; // Cutting Boards
    
    console.log(`🔍 Sincronizando ASIN: ${asin}`);
    
    // Buscar dados do Buy Box
    const buyBoxData = await service.getBuyBoxDataForASIN(asin);
    
    if (buyBoxData) {
      console.log('\n📊 Dados do Buy Box:');
      console.log(`   Status: ${buyBoxData.isWinner ? '✅ Temos o Buy Box!' : '❌ Não temos o Buy Box'}`);
      console.log(`   Preço Buy Box: $${buyBoxData.buyBoxPrice || 'N/A'}`);
      console.log(`   ID do Winner: ${buyBoxData.buyBoxWinnerId || 'N/A'}`);
      console.log(`   Nome do Winner: ${buyBoxData.buyBoxWinnerName || 'N/A'}`);
      console.log(`   Competidores: ${buyBoxData.competitorCount || 0}`);
      console.log(`   Nosso preço: $${buyBoxData.ourPrice || 'N/A'}`);
      
      // Salvar no banco
      await service.saveBuyBoxData(asin, buyBoxData);
      console.log('\n✅ Dados salvos no banco!');
      
      // Verificar se foi salvo corretamente
      const saved = await executeSQL(`
        SELECT * FROM buy_box_winners WHERE product_asin = $1
      `, [asin]);
      
      if (saved.rows.length > 0) {
        console.log('\n📋 Dados no banco:');
        const data = saved.rows[0];
        console.log(`   ASIN: ${data.product_asin}`);
        console.log(`   Nome do produto: ${data.product_name?.substring(0, 50)}...`);
        console.log(`   Buy Box Winner: ${data.buy_box_winner_name}`);
        console.log(`   É nosso?: ${data.is_winner ? '✅ Sim' : '❌ Não'}`);
        console.log(`   Preço: $${data.buy_box_price}`);
        console.log(`   Última verificação: ${new Date(data.checked_at).toLocaleString('pt-BR')}`);
      }
      
    } else {
      console.log('❌ Não foi possível obter dados do Buy Box');
    }
    
    // Verificar logs de erro
    console.log('\n📋 Verificando logs de erro recentes...');
    const errors = await executeSQL(`
      SELECT 
        created_at,
        error_type,
        error_message,
        details
      FROM error_logs
      WHERE created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
      LIMIT 5
    `).catch(() => ({ rows: [] }));
    
    if (errors.rows.length > 0) {
      console.log('\n❌ Erros recentes:');
      errors.rows.forEach(err => {
        console.log(`   ${new Date(err.created_at).toLocaleTimeString()}: ${err.error_message}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    
    // Tentar entender o erro
    if (error.message.includes('400')) {
      console.log('\n💡 Erro 400 pode indicar:');
      console.log('   - ASIN inválido para o marketplace');
      console.log('   - Produto não está ativo');
      console.log('   - Marketplace incorreto nas configurações');
      console.log('   - Token expirado ou inválido');
    }
  }
  
  process.exit(0);
}

syncSingleBuyBox();