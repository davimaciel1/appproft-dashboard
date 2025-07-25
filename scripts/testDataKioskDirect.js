// Script para testar diretamente a API do Data Kiosk

require('dotenv').config();
const axios = require('axios');

async function testDataKioskDirect() {
  console.log('🧪 TESTE DIRETO DA API DATA KIOSK');
  console.log('='.repeat(50));
  
  try {
    // 1. Obter token
    console.log('1️⃣ Obtendo token de acesso...');
    
    const tokenResponse = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.AMAZON_REFRESH_TOKEN,
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Token obtido');

    // 2. Criar query mínima
    console.log('\n2️⃣ Criando query mínima...');
    
    const query = `
      query TestQuery {
        analytics_salesAndTraffic_2023_11_15 {
          salesAndTrafficByDate(
            startDate: "2025-07-24"
            endDate: "2025-07-25"
            aggregateBy: DAY
            marketplaceIds: ["A2Q3Y263D00KWC"]
          ) {
            startDate
            endDate
            marketplaceId
            sales {
              orderedProductSales { 
                amount 
              }
              unitsOrdered
            }
            traffic {
              pageViews
              sessions
            }
          }
        }
      }
    `;

    let queryId;
    try {
      const createResponse = await axios.post(
        'https://sellingpartnerapi-na.amazon.com/dataKiosk/2023-11-15/queries',
        { query },
        {
          headers: {
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );
      
      queryId = createResponse.data.queryId;
      console.log('✅ Query criada:', queryId);
      
    } catch (error) {
      console.error('❌ Erro ao criar query:');
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Headers:', error.response?.headers);
      return;
    }

    // 3. Verificar status
    console.log('\n3️⃣ Verificando status da query...');
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Aguardar 5s
    
    try {
      const statusResponse = await axios.get(
        `https://sellingpartnerapi-na.amazon.com/dataKiosk/2023-11-15/queries/${queryId}`,
        {
          headers: {
            'x-amz-access-token': accessToken,
            'Accept': 'application/json'
          }
        }
      );
      
      console.log('📊 Status:', JSON.stringify(statusResponse.data, null, 2));
      
    } catch (error) {
      console.error('❌ Erro ao verificar status:');
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }

    // 4. Testar endpoint de listagem
    console.log('\n4️⃣ Testando listagem de queries...');
    
    try {
      const listResponse = await axios.get(
        'https://sellingpartnerapi-na.amazon.com/dataKiosk/2023-11-15/queries',
        {
          headers: {
            'x-amz-access-token': accessToken,
            'Accept': 'application/json'
          },
          params: {
            pageSize: 10
          }
        }
      );
      
      console.log('📋 Queries recentes:', listResponse.data.queries?.length || 0);
      if (listResponse.data.queries?.length > 0) {
        console.log('Últimas 3 queries:');
        listResponse.data.queries.slice(0, 3).forEach(q => {
          console.log(`  - ${q.queryId}: ${q.status} (${q.createdTime})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Erro ao listar queries:');
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
  }
}

// Executar
testDataKioskDirect().catch(console.error);