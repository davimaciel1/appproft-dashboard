require('dotenv').config();
const buyBoxService = require('../server/services/amazon/buyBoxSimple');

async function runBuyBoxSync() {
  console.log('🚀 Iniciando sincronização simplificada de Buy Box...\n');
  
  console.log('📋 Configuração:');
  console.log(`   CLIENT_ID: ${process.env.AMAZON_CLIENT_ID?.substring(0, 30)}...`);
  console.log(`   SELLER_ID: ${process.env.AMAZON_SELLER_ID}`);
  console.log(`   MARKETPLACE: ${process.env.SP_API_MARKETPLACE_ID}\n`);
  
  try {
    // Executar sincronização
    const result = await buyBoxService.syncBuyBoxForProducts();
    
    // Verificar resultados no banco
    if (result.success > 0) {
      console.log('\n📊 Verificando dados salvos...');
      
      const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
      
      // Estatísticas gerais
      const stats = await executeSQL(`
        SELECT 
          COUNT(*) as total_produtos,
          SUM(CASE WHEN is_winner THEN 1 ELSE 0 END) as com_buy_box,
          SUM(CASE WHEN NOT is_winner THEN 1 ELSE 0 END) as sem_buy_box,
          MAX(checked_at) as ultima_verificacao
        FROM buy_box_winners
      `);
      
      console.log('\n📈 Estatísticas gerais:');
      console.table(stats.rows);
      
      // Últimas mudanças
      const changes = await executeSQL(`
        SELECT * FROM buy_box_history 
        ORDER BY changed_at DESC 
        LIMIT 5
      `);
      
      if (changes.rows.length > 0) {
        console.log('\n🔄 Últimas mudanças de Buy Box:');
        console.table(changes.rows);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  
  process.exit(0);
}

runBuyBoxSync();