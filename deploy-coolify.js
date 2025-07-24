const https = require('https');
const http = require('http');

async function forceDeploy() {
  const COOLIFY_API_TOKEN = '2|Mx6BY1W5vq3cZT6cUFdfOtTCV7HJ4R10Su813x9m6fefe487';
  const COOLIFY_BASE_URL = 'http://49.12.191.119:8000';
  
  console.log('🚀 Iniciando deploy forçado da aplicação AppProft...');
  console.log('🔗 API Base URL:', COOLIFY_BASE_URL);
  
  try {
    // Função para fazer requisições HTTP
    const makeRequest = (url, options = {}) => {
      return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestModule = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: options.method || 'GET',
          headers: {
            'Authorization': `Bearer ${COOLIFY_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
          }
        };
        
        const req = requestModule.request(requestOptions, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const jsonData = data ? JSON.parse(data) : {};
              resolve({ status: res.statusCode, data: jsonData, raw: data });
            } catch (e) {
              resolve({ status: res.statusCode, data: null, raw: data });
            }
          });
        });
        
        req.on('error', reject);
        
        if (options.body) {
          req.write(JSON.stringify(options.body));
        }
        
        req.end();
      });
    };
    
    // Tentar diferentes endpoints da API
    console.log('📋 Testando conectividade com a API do Coolify...');
    
    // Tentar endpoint de health check primeiro
    let healthResponse;
    try {
      healthResponse = await makeRequest(`${COOLIFY_BASE_URL}/api/health`);
      console.log(`🔍 Health check: ${healthResponse.status} - ${healthResponse.raw}`);
    } catch (e) {
      console.log('⚠️  Endpoint /api/health não disponível');
    }
    
    // Tentar diferentes versões da API
    const apiEndpoints = [
      '/api/v1/applications',
      '/api/applications', 
      '/applications',
      '/api/v1/resources',
      '/api/resources'
    ];
    
    let appsResponse = null;
    let workingEndpoint = null;
    
    for (const endpoint of apiEndpoints) {
      try {
        console.log(`🔍 Testando endpoint: ${endpoint}`);
        appsResponse = await makeRequest(`${COOLIFY_BASE_URL}${endpoint}`);
        if (appsResponse.status === 200) {
          workingEndpoint = endpoint;
          console.log(`✅ Endpoint funcionando: ${endpoint}`);
          break;
        } else {
          console.log(`❌ Endpoint ${endpoint}: ${appsResponse.status} - ${appsResponse.raw}`);
        }
      } catch (e) {
        console.log(`❌ Erro no endpoint ${endpoint}: ${e.message}`);
      }
    }
    
    if (!workingEndpoint) {
      console.log('❌ Nenhum endpoint da API encontrado. Vou tentar fazer deploy direto por UUID conhecido.');
      
      // Tentar deploy direto com container conhecido
      const knownContainerName = 'davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc';
      console.log(`🎯 Tentando deploy direto do container: ${knownContainerName}`);
      
      // Tentar diferentes endpoints de deploy
      const deployEndpoints = [
        '/api/v1/deploy',
        '/api/deploy',
        '/deploy'
      ];
      
      for (const deployEndpoint of deployEndpoints) {
        try {
          console.log(`🚀 Tentando deploy via: ${deployEndpoint}`);
          const deployResponse = await makeRequest(
            `${COOLIFY_BASE_URL}${deployEndpoint}`,
            {
              method: 'POST',
              body: {
                container: knownContainerName,
                force_rebuild: true
              }
            }
          );
          
          if (deployResponse.status === 200 || deployResponse.status === 201 || deployResponse.status === 202) {
            console.log('✅ Deploy iniciado com sucesso!');
            console.log('📊 Resposta:', deployResponse.raw);
            return;
          } else {
            console.log(`❌ Deploy falhou via ${deployEndpoint}: ${deployResponse.status} - ${deployResponse.raw}`);
          }
        } catch (e) {
          console.log(`❌ Erro no deploy via ${deployEndpoint}: ${e.message}`);
        }
      }
      
      throw new Error('Nenhum endpoint de deploy funcionou');
    }
    
    if (appsResponse.status !== 200) {
      throw new Error(`Erro ao listar aplicações: ${appsResponse.status} - ${appsResponse.raw}`);
    }
    
    const apps = Array.isArray(appsResponse.data) ? appsResponse.data : [];
    console.log(`✅ Encontradas ${apps.length} aplicações`);
    
    if (apps.length === 0) {
      console.log('❌ Nenhuma aplicação encontrada');
      return;
    }
    
    // Mostrar todas as aplicações disponíveis
    console.log('📝 Aplicações disponíveis:');
    apps.forEach((app, index) => {
      console.log(`  ${index + 1}. ${app.name || 'N/A'} (UUID: ${app.uuid || 'N/A'})`);
      if (app.fqdn) console.log(`     Domínio: ${app.fqdn}`);
      if (app.git_repository) console.log(`     Repo: ${app.git_repository}`);
    });
    
    // Procurar pela aplicação AppProft
    let appProft = apps.find(app => 
      (app.name && app.name.toLowerCase().includes('appproft')) || 
      (app.name && app.name.toLowerCase().includes('proft')) ||
      (app.git_repository && app.git_repository.includes('appproft')) ||
      (app.fqdn && app.fqdn.includes('appproft.com'))
    );
    
    // Se não encontrou, usar a primeira aplicação disponível
    if (!appProft && apps.length > 0) {
      console.log('⚠️  Aplicação específica AppProft não encontrada, usando a primeira aplicação disponível');
      appProft = apps[0];
    }
    
    if (!appProft) {
      console.log('❌ Nenhuma aplicação disponível para deploy');
      return;
    }
    
    console.log(`🎯 Aplicação selecionada: ${appProft.name || 'N/A'} (UUID: ${appProft.uuid})`);
    if (appProft.fqdn) console.log(`🌐 Domínio: ${appProft.fqdn}`);
    
    // Forçar deploy
    console.log('🚀 Iniciando deploy forçado...');
    const deployResponse = await makeRequest(
      `${COOLIFY_BASE_URL}/api/v1/applications/${appProft.uuid}/deploy`,
      {
        method: 'POST',
        body: {
          force_rebuild: true
        }
      }
    );
    
    if (deployResponse.status === 200 || deployResponse.status === 201 || deployResponse.status === 202) {
      console.log('✅ Deploy iniciado com sucesso!');
      console.log('📊 Resposta do servidor:', deployResponse.raw);
      console.log('🌐 Acompanhe o deploy em: https://appproft.com');
      console.log('🔧 Panel do Coolify:', COOLIFY_BASE_URL);
    } else {
      console.log(`⚠️  Deploy pode ter sido iniciado (Status: ${deployResponse.status})`);
      console.log('📊 Resposta:', deployResponse.raw);
    }
    
  } catch (error) {
    console.error('❌ Erro ao executar deploy:', error.message);
    process.exit(1);
  }
}

// Executar o deploy
forceDeploy().catch(console.error);