const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('=== VERIFICANDO DADOS DO DASHBOARD ===\n');
console.log('USE_MOCK_DATA no .env:', process.env.USE_MOCK_DATA);

const token = jwt.sign(
  { userId: 1, email: 'admin@appproft.com' },
  process.env.JWT_SECRET || 'default-secret-key',
  { expiresIn: '24h' }
);

// Verificar endpoint de métricas
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/dashboard/metrics',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('\nResposta do servidor:');
    console.log('Status:', res.statusCode);
    
    if (res.statusCode === 200) {
      const metrics = JSON.parse(data);
      console.log('\nDados recebidos:');
      console.log('- Vendas hoje: $' + metrics.todaysSales);
      console.log('- Pedidos:', metrics.ordersCount);
      
      // Verificar se são dados mockados
      if (metrics.todaysSales === 12847.32 && metrics.ordersCount === 142) {
        console.log('\n⚠️ ATENÇÃO: Estes parecem ser dados MOCKADOS!');
        console.log('O sistema está retornando dados de exemplo ao invés de dados reais.');
        console.log('\nPossíveis causas:');
        console.log('1. USE_MOCK_DATA=true no .env');
        console.log('2. Erro ao conectar com Amazon SP-API');
        console.log('3. Credenciais não configuradas corretamente');
      } else {
        console.log('\n✅ Dados parecem ser REAIS da API!');
      }
    } else {
      console.log('Erro:', data);
    }
  });
});

req.on('error', (e) => console.error('Erro:', e));
req.end();