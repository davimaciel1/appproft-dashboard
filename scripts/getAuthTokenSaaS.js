const axios = require('axios');

// Configuração do SaaS
const API_BASE_URL = 'https://appproft.com/api';

async function loginAndGetToken() {
  try {
    console.log('🔐 Fazendo login no SaaS AppProft...\n');

    // Dados de login (ajuste conforme necessário)
    const loginData = {
      email: 'admin@appproft.com', // Email do usuário
      password: 'admin123'         // Senha do usuário
    };

    // Fazer login no SaaS
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, loginData);
    
    if (loginResponse.data && loginResponse.data.token) {
      const token = loginResponse.data.token;
      const user = loginResponse.data.user;
      
      console.log('✅ Login realizado com sucesso!');
      console.log('👤 Usuário:', user.name || user.email);
      console.log('🎟️ Token JWT:', token.substring(0, 50) + '...');
      console.log('\n📋 Agora você pode usar este token para acessar as métricas agregadas:\n');
      
      // Testar acesso à API de métricas agregadas
      console.log('🧪 Testando acesso às métricas agregadas por ASIN CHILD...\n');
      
      const metricsResponse = await axios.get(`${API_BASE_URL}/dashboard/aggregated-metrics`, {
        params: {
          aggregationType: 'byAsin',
          marketplace: 'amazon',
          asinLevel: 'CHILD',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (metricsResponse.data && metricsResponse.data.salesAndTrafficByAsin) {
        const data = metricsResponse.data.salesAndTrafficByAsin;
        
        console.log('📊 Métricas Agregadas por ASIN CHILD - Sucesso!');
        console.log(`📅 Período: ${data.startDate} até ${data.endDate}`);
        console.log(`🏪 Marketplace: ${data.marketplaceId}`);
        console.log(`📦 Nível ASIN: ${data.asinLevel}`);
        console.log(`📈 Produtos encontrados: ${data.data?.length || 0}`);
        
        if (data.data && data.data.length > 0) {
          console.log('\n🎯 Primeiros 3 produtos:');
          data.data.slice(0, 3).forEach((product, index) => {
            console.log(`${index + 1}. ${product.productName || product.childAsin}`);
            console.log(`   💰 Vendas: R$ ${product.sales.orderedProductSales.amount.toFixed(2)}`);
            console.log(`   📦 Unidades: ${product.sales.unitsOrdered}`);
          });
        }
      }
      
      console.log('\n🔗 URLs Autenticadas para uso:');
      console.log('\n📦 ASIN CHILD:');
      console.log(`curl -H "Authorization: Bearer ${token}" "https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byAsin&marketplace=amazon&asinLevel=CHILD&startDate=2024-01-01&endDate=2024-12-31"`);
      
      console.log('\n🔹 ASIN PARENT:');
      console.log(`curl -H "Authorization: Bearer ${token}" "https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byAsin&marketplace=amazon&asinLevel=PARENT&startDate=2024-01-01&endDate=2024-12-31"`);
      
      return token;
      
    } else {
      console.error('❌ Erro: Token não recebido na resposta de login');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o login:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n💡 Dicas para resolver:');
        console.log('1. Verifique se o usuário está cadastrado no sistema');
        console.log('2. Confirme se a senha está correta');
        console.log('3. Teste criar uma conta nova se necessário');
      }
    }
    
    return null;
  }
}

// Executar o login
loginAndGetToken();

/* 
  COMO USAR ESTE SCRIPT:
  
  1. Ajuste os dados de login (email/senha) no código acima
  
  2. Execute o script:
     node scripts/getAuthTokenSaaS.js
  
  3. O script irá:
     - Fazer login no SaaS
     - Obter o token JWT
     - Testar o acesso às métricas agregadas
     - Mostrar exemplos de uso com curl
  
  SEGURANÇA DO SAAS:
  ✅ Autenticação obrigatória
  ✅ Tokens JWT com expiração
  ✅ Isolamento por usuário/tenant
  ✅ Rate limiting ativo
  ✅ HTTPS obrigatório
  
  NUNCA USE ROTAS PÚBLICAS EM PRODUÇÃO!
*/