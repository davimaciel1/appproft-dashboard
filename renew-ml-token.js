require('dotenv').config();
const axios = require('axios');

async function renewMercadoLivreToken() {
  console.log('🔄 Renovando token do Mercado Livre...');
  console.log('Client ID:', process.env.ML_CLIENT_ID);
  console.log('Refresh Token:', process.env.ML_REFRESH_TOKEN ? '✅ Presente' : '❌ Ausente');
  
  try {
    const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: process.env.ML_REFRESH_TOKEN
    });

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    console.log('✅ Token renovado com sucesso!');
    console.log('🔑 Novo Access Token:', access_token.substring(0, 20) + '...');
    console.log('🔄 Novo Refresh Token:', refresh_token ? refresh_token.substring(0, 20) + '...' : 'Não fornecido');
    console.log('⏰ Expira em:', expiresAt.toLocaleString('pt-BR'));
    
    console.log('\n📝 ATUALIZE O ARQUIVO .env COM:');
    console.log(`ML_ACCESS_TOKEN=${access_token}`);
    if (refresh_token) {
      console.log(`ML_REFRESH_TOKEN=${refresh_token}`);
    }
    
    return { access_token, refresh_token, expires_at: expiresAt };
    
  } catch (error) {
    console.error('❌ Erro ao renovar token:');
    
    if (error.response?.status === 400) {
      console.error('🔑 Refresh token expirado ou inválido');
      console.error('💡 Solução: Você precisa reautorizar a aplicação');
      
      const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI || 'https://appproft.com/api/marketplace/mercadolivre/callback';
      const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${redirectUri}`;
      console.log('\n🌐 ACESSE ESTA URL PARA REAUTORIZAR:');
      console.log(authUrl);
      console.log('\n⚠️  IMPORTANTE: O callback está configurado para:', redirectUri);
      
    } else {
      console.error('Erro:', error.response?.data || error.message);
    }
    
    throw error;
  }
}

// Se executado diretamente
if (require.main === module) {
  renewMercadoLivreToken().catch(console.error);
}

module.exports = renewMercadoLivreToken;