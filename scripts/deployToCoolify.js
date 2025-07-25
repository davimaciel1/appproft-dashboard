// Script para fazer deploy no Coolify

require('dotenv').config();
const fetch = require('node-fetch');

async function deployToCoolify() {
  console.log('🚀 DEPLOY NO COOLIFY');
  console.log('='.repeat(50));
  
  const baseUrl = process.env.COOLIFY_BASE_URL;
  const token = process.env.COOLIFY_API_TOKEN;
  
  if (!baseUrl || !token) {
    console.error('❌ COOLIFY_BASE_URL ou COOLIFY_API_TOKEN não configurados no .env');
    process.exit(1);
  }
  
  try {
    // 1. Verificar conexão
    console.log('1️⃣ Verificando conexão com Coolify...');
    const healthResponse = await fetch(`${baseUrl}/api/v1/health`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!healthResponse.ok) {
      throw new Error(`Falha na conexão: ${healthResponse.status}`);
    }
    
    console.log('✅ Coolify conectado com sucesso');
    
    // 2. Buscar aplicação AppProft
    console.log('\n2️⃣ Buscando aplicação AppProft...');
    const appsResponse = await fetch(`${baseUrl}/api/v1/applications`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!appsResponse.ok) {
      throw new Error('Falha ao buscar aplicações');
    }
    
    const apps = await appsResponse.json();
    const appProft = apps.find(app => 
      app.name?.toLowerCase().includes('appproft') || 
      app.fqdn?.includes('appproft.com')
    );
    
    if (!appProft) {
      console.error('❌ Aplicação AppProft não encontrada');
      console.log('Aplicações disponíveis:');
      apps.forEach(app => {
        console.log(`   - ${app.name} (${app.uuid})`);
      });
      process.exit(1);
    }
    
    console.log(`✅ Aplicação encontrada: ${appProft.name}`);
    console.log(`   UUID: ${appProft.uuid}`);
    console.log(`   Domínio: ${appProft.fqdn || 'Não configurado'}`);
    
    // 3. Acionar deploy
    console.log('\n3️⃣ Acionando deploy...');
    const deployResponse = await fetch(`${baseUrl}/api/v1/applications/${appProft.uuid}/deploy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        force_rebuild: true,
        pull_latest: true
      })
    });
    
    if (!deployResponse.ok) {
      const error = await deployResponse.text();
      throw new Error(`Falha no deploy: ${deployResponse.status} - ${error}`);
    }
    
    const deployResult = await deployResponse.json();
    console.log('✅ Deploy iniciado com sucesso!');
    console.log(`   Deploy ID: ${deployResult.deployment_id || deployResult.id || 'N/A'}`);
    
    // 4. Informações finais
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('   1. Aguarde alguns minutos para o deploy completar');
    console.log('   2. Acesse: https://appproft.com');
    console.log('   3. Verifique os logs no Coolify se necessário');
    console.log('\n🌐 URLS IMPORTANTES:');
    console.log('   Aplicação: https://appproft.com');
    console.log('   Database Viewer: https://appproft.com/database');
    console.log('   Coolify Dashboard: ' + baseUrl);
    
    console.log('\n✅ Deploy em andamento!');
    
  } catch (error) {
    console.error('❌ Erro no deploy:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  deployToCoolify();
}

module.exports = deployToCoolify;