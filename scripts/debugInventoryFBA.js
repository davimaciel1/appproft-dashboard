require('dotenv').config();
const axios = require('axios');

class AmazonInventoryDebugger {
  constructor() {
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: 'ATVPDKIKX0DER' // US Marketplace
    };
    
    console.log('🔍 DEBUG - Configurações:');
    console.log('Seller ID:', this.credentials.sellerId);
    console.log('Marketplace:', this.credentials.marketplaceId);
    console.log('Client ID:', this.credentials.clientId ? '✅ Configurado' : '❌ Faltando');
    console.log('Refresh Token:', this.credentials.refreshToken ? '✅ Configurado' : '❌ Faltando');
    console.log('');
  }

  async getAccessToken() {
    console.log('🔑 Obtendo access token...');
    
    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken,
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('✅ Token obtido com sucesso!');
      return response.data.access_token;
    } catch (error) {
      console.error('❌ Erro ao obter token:', error.response?.data || error.message);
      throw error;
    }
  }

  async testFBAInventory() {
    console.log('\n📦 TESTE 1: FBA Inventory API v1');
    console.log('━'.repeat(50));
    
    const accessToken = await this.getAccessToken();
    
    try {
      console.log('Endpoint: /fba/inventory/v1/summaries');
      console.log('Parâmetros:');
      console.log('  - marketplaceIds:', this.credentials.marketplaceId);
      console.log('  - details: true');
      console.log('  - granularityType: Marketplace');
      
      const response = await axios.get('https://sellingpartnerapi-na.amazon.com/fba/inventory/v1/summaries', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken
        },
        params: {
          marketplaceIds: this.credentials.marketplaceId,
          details: true,
          granularityType: 'Marketplace',
          granularityId: this.credentials.marketplaceId
        }
      });

      console.log('\n✅ Resposta recebida!');
      console.log('Total de itens:', response.data.payload?.inventorySummaries?.length || 0);
      
      // Mostrar alguns exemplos
      const items = response.data.payload?.inventorySummaries || [];
      if (items.length > 0) {
        console.log('\nPrimeiros 5 itens com estoque:');
        items.slice(0, 5).forEach(item => {
          console.log(`\n📦 ${item.productName || item.asin}`);
          console.log(`   ASIN: ${item.asin}`);
          console.log(`   SKU: ${item.sellerSku}`);
          console.log(`   Estoque Total: ${item.totalQuantity || 0}`);
          console.log(`   Disponível: ${item.inventoryDetails?.fulfillableQuantity || 0}`);
          console.log(`   Reservado: ${item.inventoryDetails?.reservedQuantity?.totalReservedQuantity || 0}`);
        });
      }
      
      return items;
    } catch (error) {
      console.error('❌ Erro:', error.response?.status, error.response?.data || error.message);
      return [];
    }
  }

  async testInventoryAPI() {
    console.log('\n📦 TESTE 2: Inventory API v1 (Novo)');
    console.log('━'.repeat(50));
    
    const accessToken = await this.getAccessToken();
    
    try {
      console.log('Endpoint: /inventory/v1/items');
      console.log('Marketplace:', this.credentials.marketplaceId);
      
      const response = await axios.get('https://sellingpartnerapi-na.amazon.com/inventory/v1/items', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken
        },
        params: {
          marketplaceIds: this.credentials.marketplaceId,
          pageSize: 10
        }
      });

      console.log('\n✅ Resposta recebida!');
      const items = response.data.inventoryItems || [];
      console.log('Total de itens:', items.length);
      
      items.forEach(item => {
        console.log(`\n📦 ASIN: ${item.asin}`);
        console.log(`   Disponível para venda: ${item.summaries?.[0]?.inventoryAvailableQuantity || 0}`);
      });
      
      return items;
    } catch (error) {
      console.error('❌ Erro:', error.response?.status, error.response?.data || error.message);
      return [];
    }
  }

  async testListingsAPI() {
    console.log('\n📦 TESTE 3: Listings API com fulfillmentAvailability');
    console.log('━'.repeat(50));
    
    const accessToken = await this.getAccessToken();
    
    // Pegar um SKU do banco para testar
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    const result = await pool.query(`
      SELECT sku, asin, name 
      FROM products 
      WHERE marketplace = 'amazon' AND sku IS NOT NULL 
      LIMIT 3
    `);
    
    for (const product of result.rows) {
      try {
        console.log(`\nTestando produto: ${product.name}`);
        console.log(`SKU: ${product.sku}`);
        
        const response = await axios.get(
          `https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/${this.credentials.sellerId}/${product.sku}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'x-amz-access-token': accessToken
            },
            params: {
              marketplaceIds: this.credentials.marketplaceId,
              includedData: 'fulfillmentAvailability,attributes'
            }
          }
        );
        
        const listing = response.data;
        console.log('\n✅ Dados do produto:');
        
        // Verificar fulfillmentAvailability
        if (listing.fulfillmentAvailability) {
          listing.fulfillmentAvailability.forEach(fa => {
            console.log(`\n   Canal: ${fa.fulfillmentChannelCode}`);
            console.log(`   Quantidade disponível: ${fa.quantity || 0}`);
          });
        } else {
          console.log('   ❌ Sem dados de fulfillmentAvailability');
        }
        
      } catch (error) {
        console.error(`❌ Erro para SKU ${product.sku}:`, error.response?.status);
      }
    }
    
    await pool.end();
  }

  async testSellerCentralData() {
    console.log('\n📦 TESTE 4: Verificar dados do Seller');
    console.log('━'.repeat(50));
    
    const accessToken = await this.getAccessToken();
    
    try {
      // Testar se o seller ID está correto
      const response = await axios.get('https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken
        }
      });
      
      console.log('\n✅ Marketplaces do vendedor:');
      response.data.payload.forEach(mp => {
        console.log(`\n📍 Marketplace: ${mp.marketplace.name} (${mp.marketplace.id})`);
        console.log(`   País: ${mp.marketplace.countryCode}`);
        console.log(`   Moeda: ${mp.marketplace.defaultCurrencyCode}`);
        console.log(`   Participação ativa: ${mp.participation.isParticipating ? '✅' : '❌'}`);
      });
      
    } catch (error) {
      console.error('❌ Erro:', error.response?.data || error.message);
    }
  }
}

// Executar todos os testes
async function main() {
  console.log('🚀 DEBUG DE INVENTÁRIO FBA AMAZON US\n');
  
  const inventoryDebugger = new AmazonInventoryDebugger();
  
  try {
    // Verificar participação no marketplace
    await inventoryDebugger.testSellerCentralData();
    
    // Testar diferentes APIs
    await inventoryDebugger.testFBAInventory();
    await inventoryDebugger.testInventoryAPI();
    await inventoryDebugger.testListingsAPI();
    
    console.log('\n\n✅ Debug concluído!');
    console.log('\n💡 Se o estoque está retornando 0, verifique:');
    console.log('1. Os produtos estão realmente no FBA US?');
    console.log('2. O Seller ID está correto?');
    console.log('3. As permissões da API incluem acesso ao inventário?');
    console.log('4. Os produtos estão ativos e disponíveis para venda?');
    
  } catch (error) {
    console.error('\n❌ Erro geral:', error.message);
  }
}

main();