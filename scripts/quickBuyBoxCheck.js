require('dotenv').config();
const axios = require('axios');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function quickBuyBoxCheck() {
  console.log('🔍 Verificação rápida de Buy Box\n');
  
  // Verificar marketplace
  console.log('📍 Marketplace configurado:', process.env.SP_API_MARKETPLACE_ID);
  console.log('   ATVPDKIKX0DER = USA');
  console.log('   A2Q3Y263D00KWC = Brasil\n');
  
  // Buscar alguns produtos para teste
  const result = await executeSQL(`
    SELECT asin, name, marketplace
    FROM products 
    WHERE marketplace = 'amazon'
    ORDER BY asin
    LIMIT 3
  `);
  
  console.log('📦 Produtos de teste:');
  result.rows.forEach(p => {
    console.log(`   ${p.asin}: ${p.name.substring(0, 50)}...`);
  });
  
  // Obter token
  console.log('\n🔐 Obtendo token...');
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
  
  // Testar com diferentes marketplaces
  const marketplaces = [
    { id: 'ATVPDKIKX0DER', name: 'USA' },
    { id: 'A2Q3Y263D00KWC', name: 'Brasil' }
  ];
  
  for (const marketplace of marketplaces) {
    console.log(`\n🌎 Testando marketplace: ${marketplace.name} (${marketplace.id})`);
    
    const testAsin = result.rows[0].asin;
    
    try {
      const response = await axios.get(
        `https://sellingpartnerapi-na.amazon.com/products/pricing/v0/items/${testAsin}/offers`,
        {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json'
          },
          params: {
            MarketplaceId: marketplace.id,
            ItemCondition: 'New',
            CustomerType: 'Consumer'
          }
        }
      );
      
      const offers = response.data.payload?.Offers || [];
      console.log(`   ✅ Ofertas encontradas: ${offers.length}`);
      
      if (offers.length > 0) {
        const buyBoxWinner = offers.find(o => o.IsBuyBoxWinner);
        if (buyBoxWinner) {
          console.log(`   🏆 Buy Box Winner: ${buyBoxWinner.SellerId}`);
          console.log(`   💰 Preço: $${buyBoxWinner.ListingPrice?.Amount}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }
  
  // Verificar dados salvos
  console.log('\n📊 Dados no banco:');
  const savedData = await executeSQL(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_winner THEN 1 ELSE 0 END) as com_buy_box,
      MAX(checked_at) as ultima_verificacao
    FROM buy_box_winners
  `);
  
  console.table(savedData.rows);
  
  process.exit(0);
}

quickBuyBoxCheck();