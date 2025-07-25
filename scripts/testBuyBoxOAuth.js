require('dotenv').config();
const buyBoxService = require('../server/services/amazon/buyBoxServiceOAuth');

async function testBuyBoxOAuth() {
  console.log('🚀 Testando Buy Box com OAuth puro (sem AWS IAM)...\n');
  
  console.log('📋 Configuração OAuth:');
  console.log(`   CLIENT_ID: ${process.env.AMAZON_CLIENT_ID?.substring(0, 20)}...`);
  console.log(`   Tem CLIENT_SECRET: ${!!process.env.AMAZON_CLIENT_SECRET}`);
  console.log(`   Tem REFRESH_TOKEN: ${!!process.env.AMAZON_REFRESH_TOKEN}`);
  console.log(`   SELLER_ID: ${process.env.AMAZON_SELLER_ID}`);
  console.log(`   MARKETPLACE_ID: ${process.env.SP_API_MARKETPLACE_ID}\n`);
  
  // Testar com um ASIN específico
  const testAsin = 'B0C5BJ2P4F'; // Primeiro ASIN da lista
  
  try {
    console.log(`🔍 Testando com ASIN: ${testAsin}`);
    const result = await buyBoxService.getBuyBoxDataForASIN(testAsin);
    
    if (result) {
      console.log('\n✅ Sucesso! Dados recebidos:');
      console.log(JSON.stringify(result, null, 2));
      
      // Tentar salvar no banco
      console.log('\n💾 Salvando no banco de dados...');
      await buyBoxService.saveBuyBoxData(result);
      console.log('✅ Dados salvos com sucesso!');
    } else {
      console.log('❌ Nenhum dado retornado');
    }
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
  
  process.exit(0);
}

testBuyBoxOAuth();