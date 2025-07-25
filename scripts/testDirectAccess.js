const axios = require('axios');

async function testDirectAccess() {
  try {
    // Primeiro testar se o frontend está servindo corretamente
    console.log('🌐 Testando acesso ao frontend...');
    
    try {
      const response = await axios.get('http://localhost:5000/insights');
      console.log('✅ Página /insights acessível');
      console.log('   Status:', response.status);
      console.log('   Content-Type:', response.headers['content-type']);
      console.log('   Tamanho:', response.data.length, 'bytes');
    } catch (error) {
      console.log('❌ Erro ao acessar /insights:', error.message);
    }
    
    // Testar rota de health
    console.log('\n🏥 Testando rota de health...');
    try {
      const health = await axios.get('http://localhost:5000/api/health');
      console.log('✅ Health check:', health.data);
    } catch (error) {
      console.log('❌ Erro no health check:', error.message);
    }
    
  } catch (error) {
    console.error('Erro geral:', error.message);
  }
}

testDirectAccess();