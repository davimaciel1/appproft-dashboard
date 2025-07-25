require('dotenv').config();
const buyBoxService = require('../server/services/amazon/buyBoxService');

async function forceBuyBoxSync() {
  console.log('🚀 Forçando sincronização de Buy Box...\n');
  
  try {
    // Mostrar configuração atual
    console.log('📋 Configuração:');
    console.log(`   Marketplace ID: ${process.env.SP_API_MARKETPLACE_ID}`);
    console.log(`   Seller ID: ${process.env.AMAZON_SELLER_ID}`);
    console.log(`   Region: ${process.env.AMAZON_REGION || 'us-east-1'}\n`);
    
    // Executar sincronização
    console.log('🔄 Iniciando sincronização...');
    const result = await buyBoxService.syncAllBuyBoxData();
    
    console.log('\n✅ Sincronização concluída!');
    console.log(`   Total de produtos: ${result.total}`);
    console.log(`   Sucessos: ${result.success}`);
    console.log(`   Erros: ${result.errors}`);
    
    if (result.details && result.details.length > 0) {
      console.log('\n📊 Detalhes:');
      result.details.slice(0, 5).forEach(detail => {
        console.log(`   ${detail.asin}: ${detail.success ? '✅' : '❌'} ${detail.message || ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro na sincronização:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

forceBuyBoxSync();