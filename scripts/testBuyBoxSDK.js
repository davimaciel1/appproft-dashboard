require('dotenv').config();
const buyBoxService = require('../server/services/amazon/buyBoxServiceSDK');

async function testBuyBoxSDK() {
  console.log('🚀 Testando Buy Box com SDK oficial da Amazon...\n');
  
  console.log('📋 Configuração:');
  console.log(`   CLIENT_ID: ${process.env.AMAZON_CLIENT_ID?.substring(0, 20)}...`);
  console.log(`   SELLER_ID: ${process.env.AMAZON_SELLER_ID}`);
  console.log(`   MARKETPLACE_ID: ${process.env.SP_API_MARKETPLACE_ID}`);
  console.log(`   REGION: ${process.env.AMAZON_REGION || 'us-east-1'}\n`);
  
  try {
    // Primeiro testar obtenção do token
    console.log('🔐 Obtendo token de acesso...');
    const token = await buyBoxService.getAccessToken();
    console.log('✅ Token obtido com sucesso!\n');
    
    // Testar com um ASIN
    const testAsin = 'B0C5BJ2P4F';
    console.log(`🔍 Buscando dados para ASIN: ${testAsin}`);
    
    const result = await buyBoxService.getBuyBoxDataForASIN(testAsin);
    
    if (result) {
      console.log('\n✅ Dados recebidos com sucesso!');
      console.log('Competitive Pricing:', JSON.stringify(result.competitivePricing, null, 2));
      console.log('\nOfertas:', result.offers?.Offers?.length || 0, 'ofertas encontradas');
      
      // Salvar no banco
      console.log('\n💾 Salvando no banco de dados...');
      await buyBoxService.saveBuyBoxData(result);
      console.log('✅ Dados salvos com sucesso!');
      
      // Verificar no banco
      const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
      const check = await executeSQL(`
        SELECT * FROM buy_box_winners 
        WHERE product_asin = $1
      `, [testAsin]);
      
      console.log('\n📊 Dados no banco:');
      console.table(check.rows);
      
    } else {
      console.log('❌ Nenhum dado retornado');
    }
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
  
  process.exit(0);
}

testBuyBoxSDK();