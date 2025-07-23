const http = require('http');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

async function debugCredentials() {
  console.log('=== DEBUG DO ENDPOINT DE CREDENCIAIS ===\n');
  
  // 1. Verificar banco diretamente
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
  
  try {
    const dbResult = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = 1'
    );
    
    console.log('1. DADOS NO BANCO:');
    console.log('Total de registros:', dbResult.rows.length);
    
    if (dbResult.rows.length > 0) {
      dbResult.rows.forEach(row => {
        console.log(`\n- Marketplace: ${row.marketplace}`);
        console.log('  client_id:', row.client_id ? '✅' : '❌');
        console.log('  client_secret:', row.client_secret ? '✅' : '❌');
        console.log('  refresh_token:', row.refresh_token ? '✅' : '❌');
        console.log('  credentials (JSON):', row.credentials ? '✅' : '❌');
      });
    }
  } catch (error) {
    console.error('Erro no banco:', error.message);
  } finally {
    await pool.end();
  }
  
  // 2. Testar CredentialsService diretamente
  console.log('\n2. TESTANDO CREDENTIALSSERVICE:');
  try {
    const CredentialsService = require('./server/services/credentialsService');
    const credentialsService = new CredentialsService();
    
    const creds = await credentialsService.getCredentials(1, 'amazon');
    console.log('Resultado:', creds ? 'Credenciais recuperadas' : 'NULL retornado');
    
    if (creds) {
      console.log('- clientId:', creds.clientId || 'AUSENTE');
      console.log('- refreshToken:', creds.refreshToken ? '✅' : '❌');
    }
  } catch (error) {
    console.error('Erro no CredentialsService:', error.message);
  }
  
  // 3. Testar endpoint via HTTP
  console.log('\n3. TESTANDO ENDPOINT HTTP:');
  
  const token = jwt.sign(
    { userId: 1, email: 'admin@appproft.com' },
    process.env.JWT_SECRET || 'default-secret-key',
    { expiresIn: '24h' }
  );
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/credentials',
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
      console.log('Status HTTP:', res.statusCode);
      console.log('Resposta:', data);
      
      if (res.statusCode === 200) {
        const result = JSON.parse(data);
        console.log('\nResultado parseado:');
        console.log('- Amazon configurado:', result.amazon.configured);
        console.log('- ML configurado:', result.mercadolivre.configured);
      }
    });
  });
  
  req.on('error', (e) => console.error('Erro HTTP:', e));
  req.end();
}

debugCredentials();