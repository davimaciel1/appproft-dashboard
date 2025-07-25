require('dotenv').config();
const axios = require('axios');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function getSellerDetails() {
  console.log('🔍 Buscando detalhes do vendedor...\n');

  try {
    // Obter token
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.AMAZON_REFRESH_TOKEN,
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const token = tokenResponse.data.access_token;
    console.log('✅ Token obtido!\n');

    // Tentar diferentes endpoints para obter informações do vendedor
    const endpoints = [
      {
        name: 'Marketplace Participations',
        url: 'https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations'
      },
      {
        name: 'Authorization Profile',
        url: 'https://sellingpartnerapi-na.amazon.com/authorization/v1/authorizationCode'
      }
    ];

    for (const endpoint of endpoints) {
      console.log(`\n📍 Testando: ${endpoint.name}`);
      console.log(`URL: ${endpoint.url}`);
      
      try {
        const response = await axios.get(endpoint.url, {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json'
          }
        });

        console.log('Resposta:', JSON.stringify(response.data, null, 2));
        
        // Processar resposta do marketplace participations
        if (endpoint.name === 'Marketplace Participations' && response.data.payload) {
          for (const participation of response.data.payload) {
            console.log('\n📊 Participação encontrada:');
            console.log(`Marketplace: ${participation.marketplace.name} (${participation.marketplace.id})`);
            console.log(`País: ${participation.marketplace.countryCode}`);
            console.log(`Moeda: ${participation.marketplace.defaultCurrencyCode}`);
            
            // Buscar nome nos dados de participação
            const sellerInfo = participation.participation;
            const storeName = participation.storeName; // AQUI ESTÁ O NOME!
            
            console.log('\n🏢 Informações do vendedor:');
            console.log(`Store Name: ${storeName}`);
            console.log('Participation:', JSON.stringify(sellerInfo, null, 2));
            
            // Salvar no banco
            if (storeName) {
              const sellerName = storeName;
              
              console.log(`\n✅ Nome identificado: ${sellerName}`);
              
              // Atualizar banco de dados
              await executeSQL(`
                UPDATE buy_box_winners
                SET buy_box_winner_name = $1
                WHERE buy_box_winner_id = $2
                OR (is_winner = true)
              `, [sellerName, process.env.AMAZON_SELLER_ID]);
              
              await executeSQL(`
                INSERT INTO sellers_cache (seller_id, seller_name, last_updated)
                VALUES ($1, $2, NOW())
                ON CONFLICT (seller_id) 
                DO UPDATE SET seller_name = EXCLUDED.seller_name, last_updated = NOW()
              `, [process.env.AMAZON_SELLER_ID, sellerName]);
              
              console.log('💾 Nome salvo no banco de dados!');
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erro: ${error.response?.data?.errors?.[0]?.message || error.message}`);
        if (error.response?.data) {
          console.log('Detalhes:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }

    // Verificar dados salvos
    console.log('\n📊 Dados no banco de dados:\n');
    
    const savedData = await executeSQL(`
      SELECT 
        product_asin,
        buy_box_winner_id,
        buy_box_winner_name,
        is_winner
      FROM buy_box_winners
      WHERE buy_box_price IS NOT NULL
    `);
    
    console.table(savedData.rows);
    
    // Verificar cache de vendedores
    console.log('\n🏢 Cache de vendedores:\n');
    const sellersCache = await executeSQL('SELECT * FROM sellers_cache');
    console.table(sellersCache.rows);

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }

  process.exit(0);
}

getSellerDetails();