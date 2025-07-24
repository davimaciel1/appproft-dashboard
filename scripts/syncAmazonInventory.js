require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

class AmazonInventorySyncService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: 'ATVPDKIKX0DER' // US Marketplace
    };
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('🔑 Renovando access token da Amazon...');
    
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

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000) - 60000);
      
      console.log('✅ Token renovado com sucesso!');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Erro ao renovar token:', error.response?.data || error.message);
      throw error;
    }
  }

  async syncInventory() {
    console.log('\n📦 Sincronizando inventário FBA...');
    
    const accessToken = await this.getAccessToken();
    let totalUpdated = 0;
    let nextToken = null;
    
    do {
      try {
        const params = {
          marketplaceIds: this.credentials.marketplaceId,
          details: true,
          granularityType: 'Marketplace',
          granularityId: this.credentials.marketplaceId
        };
        
        if (nextToken) {
          params.nextToken = nextToken;
        }
        
        const response = await axios.get('https://sellingpartnerapi-na.amazon.com/fba/inventory/v1/summaries', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken
          },
          params
        });

        const inventories = response.data.payload?.inventorySummaries || [];
        console.log(`  📊 ${inventories.length} produtos com inventário encontrados`);

        // Atualizar inventário no banco
        for (const inventory of inventories) {
          const updated = await this.updateProductInventory(inventory);
          if (updated) totalUpdated++;
        }

        nextToken = response.data.payload?.nextToken;
      } catch (error) {
        console.error('❌ Erro ao buscar inventário:', error.response?.data || error.message);
        
        // Se falhar, tentar método alternativo
        if (!totalUpdated) {
          console.log('\n🔄 Tentando método alternativo via Listings API...');
          return await this.syncViaListings();
        }
        break;
      }
    } while (nextToken);

    console.log(`\n✅ Inventário atualizado para ${totalUpdated} produtos`);
    return { success: true, updated: totalUpdated };
  }

  async updateProductInventory(inventory) {
    try {
      // Atualizar por ASIN ou SKU
      const result = await this.pool.query(`
        UPDATE products 
        SET 
          inventory = $1,
          updated_at = NOW()
        WHERE 
          (asin = $2 OR sku = $3) 
          AND marketplace = 'amazon'
        RETURNING id, name, sku
      `, [
        inventory.totalQuantity || 0,
        inventory.asin,
        inventory.sellerSku
      ]);

      if (result.rows.length > 0) {
        const product = result.rows[0];
        console.log(`    ✅ ${product.name || product.sku}: ${inventory.totalQuantity} unidades`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Erro ao atualizar inventário ${inventory.asin}:`, error.message);
      return false;
    }
  }

  async syncViaListings() {
    console.log('\n📋 Buscando inventário via Listings API...');
    
    const accessToken = await this.getAccessToken();
    let totalUpdated = 0;
    
    // Buscar todos os SKUs do banco
    const products = await this.pool.query(`
      SELECT DISTINCT sku, asin 
      FROM products 
      WHERE marketplace = 'amazon' AND (sku IS NOT NULL OR asin IS NOT NULL)
    `);
    
    console.log(`  📊 ${products.rows.length} produtos para verificar`);
    
    for (const product of products.rows) {
      try {
        // Tentar buscar por SKU primeiro
        const identifier = product.sku || product.asin;
        
        const response = await axios.get(`https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/${this.credentials.sellerId}/${identifier}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken
          },
          params: {
            marketplaceIds: this.credentials.marketplaceId,
            includedData: 'attributes,fulfillmentAvailability'
          }
        });
        
        const listing = response.data;
        const fulfillment = listing.fulfillmentAvailability?.[0];
        
        if (fulfillment?.quantity !== undefined) {
          // Atualizar inventário
          const result = await this.pool.query(`
            UPDATE products 
            SET 
              inventory = $1,
              updated_at = NOW()
            WHERE 
              (sku = $2 OR asin = $3) 
              AND marketplace = 'amazon'
            RETURNING name
          `, [
            fulfillment.quantity,
            product.sku,
            product.asin
          ]);
          
          if (result.rows.length > 0) {
            console.log(`    ✅ ${result.rows[0].name}: ${fulfillment.quantity} unidades`);
            totalUpdated++;
          }
        }
        
        // Delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        // Ignorar erros individuais e continuar
        if (error.response?.status !== 404) {
          console.log(`    ⚠️  Erro ao buscar ${product.sku || product.asin}: ${error.response?.status}`);
        }
      }
    }
    
    console.log(`\n✅ Inventário atualizado para ${totalUpdated} produtos via Listings API`);
    return { success: true, updated: totalUpdated };
  }

  async close() {
    await this.pool.end();
  }
}

// Executar sincronização
async function main() {
  console.log('🚀 Iniciando sincronização de inventário Amazon US...\n');
  
  const sync = new AmazonInventorySyncService();
  
  try {
    const result = await sync.syncInventory();
    
    if (result.updated > 0) {
      console.log('\n📊 Verificando produtos com estoque > 0:');
      
      const stockCheck = await sync.pool.query(`
        SELECT 
          name,
          sku,
          inventory,
          price
        FROM products 
        WHERE inventory > 0 AND marketplace = 'amazon'
        ORDER BY inventory DESC
        LIMIT 10
      `);
      
      if (stockCheck.rows.length > 0) {
        console.log('\nProdutos com estoque:');
        stockCheck.rows.forEach(p => {
          console.log(`- ${p.name}: ${p.inventory} unidades (R$ ${p.price})`);
        });
      }
    }
    
    console.log('\n✅ Sincronização de inventário concluída!');
    
  } catch (error) {
    console.error('\n❌ Erro geral:', error.message);
  } finally {
    await sync.close();
  }
}

main();