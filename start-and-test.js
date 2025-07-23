const { spawn } = require('child_process');
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('=== INICIANDO SERVIDOR E TESTANDO DASHBOARD ===\n');

// Iniciar o servidor
console.log('1. Iniciando servidor backend...');
const server = spawn('node', ['server/index.js'], {
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'pipe'
});

server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Servidor rodando')) {
    console.log('✅ Servidor iniciado!');
    setTimeout(testDashboard, 2000);
  }
});

server.stderr.on('data', (data) => {
  console.error('Erro no servidor:', data.toString());
});

async function testDashboard() {
  console.log('\n2. Testando dashboard...\n');
  
  // Gerar token JWT
  const token = jwt.sign(
    { userId: 1, email: 'admin@appproft.com' },
    process.env.JWT_SECRET || 'default-secret-key',
    { expiresIn: '24h' }
  );
  
  try {
    // Testar métricas
    const metricsData = await makeRequest('/api/dashboard/metrics', token);
    console.log('📊 MÉTRICAS DO DASHBOARD:');
    console.log('- Vendas hoje: $' + metricsData.todaysSales);
    console.log('- Pedidos:', metricsData.ordersCount);
    console.log('- Unidades vendidas:', metricsData.unitsSold);
    console.log('- Lucro líquido: $' + metricsData.netProfit);
    console.log('- Margem de lucro:', metricsData.profitMargin + '%');
    
    // Testar produtos
    const productsData = await makeRequest('/api/dashboard/products', token);
    console.log('\n📦 PRODUTOS:');
    console.log('Total de produtos:', productsData.products.length);
    
    if (productsData.products.length > 0) {
      console.log('\nPrimeiros 3 produtos:');
      productsData.products.slice(0, 3).forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.name}`);
        console.log('   SKU:', product.sku);
        console.log('   Marketplace:', product.marketplace);
        console.log('   Estoque:', product.inventory, 'unidades');
        console.log('   Receita: $' + product.revenue);
      });
    }
    
    console.log('\n✅ DASHBOARD FUNCIONANDO COM DADOS REAIS!');
    console.log('\n📱 PARA VER NO NAVEGADOR:');
    console.log('1. Acesse: http://localhost:3000');
    console.log('2. Faça login com: admin@appproft.com / admin123');
    console.log('3. O dashboard mostrará os dados da sua conta Amazon');
    console.log('\n🚀 Após o deploy em https://appproft.com/dashboard, ');
    console.log('   os mesmos dados aparecerão lá automaticamente!');
    
  } catch (error) {
    console.error('❌ Erro ao testar dashboard:', error.message);
  }
  
  // Manter servidor rodando por 30 segundos para permitir acesso manual
  console.log('\n⏳ Servidor ficará ativo por 30 segundos...');
  setTimeout(() => {
    console.log('\n🛑 Encerrando servidor...');
    server.kill();
    process.exit(0);
  }, 30000);
}

function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}