require('dotenv').config();
const axios = require('axios');

async function processTempCode(tempCode) {
  console.log('🔄 Processando código temporário do Mercado Livre...');
  console.log('Código temporário:', tempCode);
  
  try {
    // Trocar código temporário por access_token e refresh_token
    const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      code: tempCode,
      redirect_uri: process.env.MERCADOLIVRE_REDIRECT_URI || 'https://appproft.com/api/marketplace/mercadolivre/callback'
    });

    const { access_token, refresh_token, expires_in, token_type } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    console.log('✅ Tokens obtidos com sucesso!');
    console.log('\n📋 INFORMAÇÕES DOS TOKENS:');
    console.log('- Access Token:', access_token.substring(0, 30) + '...');
    console.log('- Refresh Token:', refresh_token ? refresh_token.substring(0, 30) + '...' : 'Não fornecido');
    console.log('- Token Type:', token_type);
    console.log('- Expira em:', expiresAt.toLocaleString('pt-BR'));
    console.log('- Duração:', Math.floor(expires_in / 3600), 'horas');
    
    console.log('\n📝 ATUALIZE O ARQUIVO .env COM:');
    console.log(`ML_ACCESS_TOKEN=${access_token}`);
    if (refresh_token) {
      console.log(`ML_REFRESH_TOKEN=${refresh_token}`);
    }
    
    console.log('\n🤖 TESTANDO NOVA CONFIGURAÇÃO...');
    
    // Testar com o novo access token
    const testResponse = await axios.get('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    console.log('✅ Teste bem-sucedido!');
    console.log('- User ID:', testResponse.data.id);
    console.log('- Nickname:', testResponse.data.nickname);
    console.log('- Site ID:', testResponse.data.site_id);
    
    // Retornar tokens para uso
    return {
      access_token,
      refresh_token,
      expires_at: expiresAt,
      user_info: testResponse.data
    };
    
  } catch (error) {
    console.error('❌ Erro ao processar código temporário:');
    
    if (error.response?.status === 400) {
      console.error('🔑 Código temporário inválido ou expirado');
      console.error('Detalhes:', error.response.data);
      console.error('\n💡 SOLUÇÕES:');
      console.error('1. O código pode ter expirado (são válidos por poucos minutos)');
      console.error('2. Pode ter sido usado anteriormente');
      console.error('3. Gere um novo código através da URL de autorização');
      
      const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${process.env.MERCADOLIVRE_REDIRECT_URI || 'https://appproft.com/api/marketplace/mercadolivre/callback'}`;
      console.error('\n🌐 URL para novo código:');
      console.error(authUrl);
      
    } else {
      console.error('Erro:', error.response?.data || error.message);
    }
    
    throw error;
  }
}

// Se executado diretamente com um código como argumento
if (require.main === module) {
  const tempCode = process.argv[2];
  
  if (!tempCode) {
    console.log('❌ Uso: node process-temp-code.js TG-seu-codigo-temporario');
    console.log('\n💡 Exemplo:');
    console.log('node process-temp-code.js TG-6880252413d9e60001693d2e-1594689639');
    process.exit(1);
  }
  
  processTempCode(tempCode).catch(console.error);
}

module.exports = processTempCode;