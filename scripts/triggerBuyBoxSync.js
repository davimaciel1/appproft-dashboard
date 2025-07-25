const axios = require('axios');

async function triggerBuyBoxSync() {
  try {
    console.log('🚀 Disparando sincronização manual de Buy Box...\n');
    
    const response = await axios.post('http://localhost:5000/api/buybox/sync/start', {}, {
      headers: {
        'Content-Type': 'application/json',
        // Simular autenticação
        'Authorization': 'Bearer test-token'
      }
    });
    
    const data = response.data;
    
    console.log('✅ Resposta da API:', data);
    
    if (data.status === 'success') {
      console.log('\n🔄 Sincronização iniciada em background!');
      console.log('⏱️  Aguarde alguns segundos e execute checkAutoSync.js para ver o progresso');
    }
    
  } catch (error) {
    console.error('❌ Erro ao conectar com o servidor:', error.message);
    console.log('\n💡 Certifique-se de que o servidor está rodando na porta 5000');
  }
}

triggerBuyBoxSync();