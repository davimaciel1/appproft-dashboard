const { spawn } = require('child_process');
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('=== SOLUÇÃO FINAL PARA O DASHBOARD ===\n');

// 1. Matar processos node existentes
console.log('1. Encerrando processos existentes...');
require('child_process').execSync('taskkill /F /IM node.exe 2>nul', { stdio: 'ignore' });

// Aguardar
setTimeout(() => {
  console.log('2. Iniciando servidor com configurações corretas...\n');
  
  // 2. Iniciar servidor com variáveis corretas
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    USE_MOCK_DATA: 'false',
    ENCRYPTION_KEY: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
    JWT_SECRET: process.env.JWT_SECRET || 'your-very-secret-jwt-key-that-should-be-long-and-random',
    PORT: '3000'
  };
  
  const server = spawn('node', ['server/index.js'], {
    env,
    stdio: 'pipe'
  });
  
  let serverReady = false;
  
  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    
    if (output.includes('Servidor rodando') || output.includes('Server running')) {
      serverReady = true;
      setTimeout(testDashboard, 2000);
    }
  });
  
  server.stderr.on('data', (data) => {
    console.error('Erro:', data.toString());
  });
  
  async function testDashboard() {
    if (!serverReady) return;
    
    console.log('\n3. Testando dashboard...\n');
    
    const token = jwt.sign(
      { userId: 1, email: 'admin@appproft.com' },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Testar credenciais
    const credsData = await makeRequest('/api/credentials', token);
    console.log('📋 Status das credenciais:');
    console.log('- Amazon:', credsData.amazon.configured ? '✅ Configurado' : '❌ Não configurado');
    console.log('- Seller ID:', credsData.amazon.sellerId);
    console.log('- Marketplace ID:', credsData.amazon.marketplaceId);
    
    // Testar métricas
    const metricsData = await makeRequest('/api/dashboard/metrics', token);
    console.log('\n📊 Métricas do dashboard:');
    console.log('- Vendas hoje: $' + metricsData.todaysSales);
    console.log('- Pedidos:', metricsData.ordersCount);
    console.log('- Produtos:', metricsData.unitsSold);
    
    // Testar produtos
    const productsData = await makeRequest('/api/dashboard/products', token);
    console.log('\n📦 Produtos no dashboard:', productsData.products.length);
    
    if (productsData.products.length > 0) {
      console.log('\nPrimeiros 3 produtos:');
      productsData.products.slice(0, 3).forEach((p, i) => {
        console.log(`${i+1}. ${p.name} (${p.sku})`);
      });
    }
    
    console.log('\n✅ DASHBOARD ESTÁ FUNCIONANDO!');
    console.log('\n📱 ACESSE AGORA:');
    console.log('1. Abra: http://localhost:3000');
    console.log('2. Login: admin@appproft.com / admin123');
    console.log('3. Você verá seus produtos Amazon no dashboard!');
    console.log('\n(Servidor continuará rodando. Pressione Ctrl+C para parar)');
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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  }
}, 2000);