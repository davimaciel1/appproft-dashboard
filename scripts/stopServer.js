const axios = require('axios');

async function stopServer() {
  try {
    console.log('🛑 Tentando parar o servidor...');
    
    // Tentar fazer uma requisição para verificar se está rodando
    try {
      await axios.get('http://localhost:5000/api/health');
      console.log('Servidor está rodando. Para parar o servidor:');
      console.log('1. Pressione Ctrl+C na janela onde o servidor está rodando');
      console.log('2. Ou feche a janela do terminal');
    } catch (error) {
      console.log('❌ Servidor não está respondendo na porta 5000');
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

stopServer();