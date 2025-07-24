require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function runSync() {
  console.log('=== INICIANDO SINCRONIZAÇÃO MANUAL ===\n');
  
  try {
    // Verificar se há credenciais configuradas
    const credentials = await executeSQL(`
      SELECT 
        id,
        user_id,
        marketplace,
        refresh_token,
        created_at
      FROM marketplace_credentials 
      WHERE refresh_token IS NOT NULL
    `);
    
    if (credentials.rows.length === 0) {
      console.log('❌ Nenhuma credencial configurada com refresh_token!');
      console.log('Configure as credenciais da Amazon/ML primeiro.');
      return;
    }
    
    console.log('📋 Credenciais encontradas:');
    credentials.rows.forEach(cred => {
      console.log(`- ${cred.marketplace}: User ${cred.user_id} (${cred.refresh_token ? 'Token OK' : 'Sem token'})`);
    });
    
    // Verificar se as credenciais do .env estão configuradas
    console.log('\n🔑 Verificando credenciais do .env:');
    const amazonConfigured = !!(process.env.LWA_CLIENT_ID && process.env.LWA_CLIENT_SECRET);
    const mlConfigured = !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET);
    
    console.log(`Amazon LWA: ${amazonConfigured ? '✅ Configurado' : '❌ Faltando'}`);
    console.log(`Mercado Livre: ${mlConfigured ? '✅ Configurado' : '❌ Faltando'}`);
    
    if (!amazonConfigured && !mlConfigured) {
      console.log('\n❌ Configure as credenciais das APIs no .env!');
      return;
    }
    
    // Tentar executar sincronização via API
    console.log('\n🚀 Tentando executar sincronização...');
    
    try {
      const response = await fetch('http://localhost:3000/api/sync/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token' // Ajustar conforme necessário
        },
        body: JSON.stringify({
          marketplace: 'all',
          force: true
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Sincronização iniciada:', result);
      } else {
        console.log('❌ Erro na API:', response.status, response.statusText);
        
        // Tentar método alternativo
        console.log('\n🔄 Tentando método alternativo...');
        await runDirectSync();
      }
    } catch (error) {
      console.log('❌ API não está respondendo:', error.message);
      console.log('\n🔄 Executando sincronização direta...');
      await runDirectSync();
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function runDirectSync() {
  // Verificar se há scripts de sincronização específicos
  const fs = require('fs');
  const path = require('path');
  
  const syncScripts = [
    'syncAmazonFullData.js',
    'syncAmazonUSOptimized.js',
    'syncAmazonUS.js',
    'syncAmazonCatalog.js'
  ];
  
  console.log('\n📂 Procurando scripts de sincronização...');
  
  for (const script of syncScripts) {
    const scriptPath = path.join(__dirname, script);
    if (fs.existsSync(scriptPath)) {
      console.log(`\n✅ Encontrado: ${script}`);
      console.log('Executando...');
      
      try {
        // Executar o script
        require(scriptPath);
        break;
      } catch (error) {
        console.log(`❌ Erro ao executar ${script}:`, error.message);
      }
    }
  }
  
  console.log('\n💡 DICA: Para sincronização contínua, execute:');
  console.log('   npm run sync:worker');
  console.log('\n   Ou em duas janelas separadas:');
  console.log('   npm run server');
  console.log('   npm run sync:worker');
}

// Executar
runSync();