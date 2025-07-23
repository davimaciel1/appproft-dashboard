const CredentialsService = require('./server/services/credentialsService');
require('dotenv').config();

async function saveCredentialsProperly() {
  console.log('=== SALVANDO CREDENCIAIS CORRETAMENTE ===\n');
  
  try {
    const credentialsService = new CredentialsService();
    
    // Credenciais Amazon do .env
    const amazonCredentials = {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: 'ATVPDKIKX0DER'
    };
    
    console.log('Salvando credenciais Amazon:');
    console.log('- Client ID:', amazonCredentials.clientId);
    console.log('- Client Secret:', amazonCredentials.clientSecret ? '✅ Configurado' : '❌');
    console.log('- Refresh Token:', amazonCredentials.refreshToken ? '✅ Configurado' : '❌');
    console.log('- Seller ID:', amazonCredentials.sellerId);
    console.log('- Marketplace ID:', amazonCredentials.marketplaceId);
    
    // Salvar usando o CredentialsService
    await credentialsService.saveCredentials(1, 'amazon', amazonCredentials);
    
    console.log('\n✅ Credenciais salvas com criptografia!');
    
    // Testar recuperação
    console.log('\nTestando recuperação...');
    const retrievedCreds = await credentialsService.getCredentials(1, 'amazon');
    
    if (retrievedCreds) {
      console.log('✅ Credenciais recuperadas com sucesso!');
      console.log('- clientId:', retrievedCreds.clientId);
      console.log('- refreshToken:', retrievedCreds.refreshToken ? '✅ Presente' : '❌ Ausente');
    } else {
      console.log('❌ Erro ao recuperar credenciais');
    }
    
    console.log('\n🎉 PROCESSO CONCLUÍDO!');
    console.log('\nAgora você pode:');
    console.log('1. Acessar http://localhost:3000');
    console.log('2. Fazer login com admin@appproft.com / admin123');
    console.log('3. O dashboard mostrará os dados reais da Amazon!');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  }
  
  process.exit(0);
}

saveCredentialsProperly();