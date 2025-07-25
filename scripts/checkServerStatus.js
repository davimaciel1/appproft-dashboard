const axios = require('axios');

async function checkServerStatus() {
  console.log('🔍 Verificando status do servidor...\n');
  
  const endpoints = [
    { url: 'http://localhost:5000/api/health', name: 'Health Check' },
    { url: 'http://localhost:5000/api/buybox/sync/status', name: 'Buy Box Sync Status' },
    { url: 'http://localhost:5000/api/buybox/sync/scheduler', name: 'Scheduler Status' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint.url, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log(`✅ ${endpoint.name}: ${response.status} OK`);
      console.log(`   Resposta:`, JSON.stringify(response.data, null, 2));
      console.log('');
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
      console.log('');
    }
  }
  
  // Verificar se o servidor está rodando
  try {
    await axios.get('http://localhost:5000');
    console.log('🌐 Servidor está rodando na porta 5000');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Servidor não está rodando na porta 5000!');
      console.log('💡 Execute: cd server && node index.js');
    }
  }
}

checkServerStatus();