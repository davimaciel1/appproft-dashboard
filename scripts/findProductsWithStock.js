require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

class StockFinder {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: 'ATVPDKIKX0DER'
    };
  }

  async getAccessToken() {
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

    return response.data.access_token;
  }

  async findProductsWithStock() {
    console.log('🔍 Procurando produtos com estoque > 0 no FBA...\n');
    
    const accessToken = await this.getAccessToken();
    let nextToken = null;
    let productsWithStock = [];
    let totalChecked = 0;
    
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
        totalChecked += inventories.length;
        
        // Filtrar produtos com estoque > 0
        const withStock = inventories.filter(item => 
          item.totalQuantity > 0 || 
          item.inventoryDetails?.fulfillableQuantity > 0
        );
        
        productsWithStock.push(...withStock);
        
        console.log(`Verificados: ${totalChecked} produtos | Com estoque: ${productsWithStock.length}`);
        
        nextToken = response.data.payload?.nextToken;
      } catch (error) {
        console.error('Erro:', error.response?.data || error.message);
        break;
      }
    } while (nextToken);
    
    console.log(`\n✅ Verificação completa!`);
    console.log(`Total verificado: ${totalChecked} produtos`);
    console.log(`Com estoque: ${productsWithStock.length} produtos`);
    
    if (productsWithStock.length > 0) {
      console.log('\n📦 PRODUTOS COM ESTOQUE ENCONTRADOS:');
      console.log('━'.repeat(50));
      
      for (const product of productsWithStock) {
        console.log(`\n📦 ${product.productName || product.asin}`);
        console.log(`   ASIN: ${product.asin}`);
        console.log(`   SKU: ${product.sellerSku}`);
        console.log(`   Estoque Total: ${product.totalQuantity}`);
        console.log(`   Disponível: ${product.inventoryDetails?.fulfillableQuantity || 0}`);
        console.log(`   Reservado: ${product.inventoryDetails?.reservedQuantity?.totalReservedQuantity || 0}`);
        
        // Atualizar no banco
        await this.updateInventory(product);
      }
    } else {
      console.log('\n❌ Nenhum produto com estoque foi encontrado no FBA!');
      console.log('\n💡 Possíveis ações:');
      console.log('1. Verificar no Seller Central se há produtos no FBA');
      console.log('2. Confirmar se os produtos estão em FBM ao invés de FBA');
      console.log('3. Verificar se há reposição pendente no FBA');
    }
    
    // Análise adicional
    await this.analyzeInventoryStatus();
  }

  async updateInventory(product) {
    try {
      await this.pool.query(`
        UPDATE products 
        SET 
          inventory = $1,
          updated_at = NOW()
        WHERE 
          (asin = $2 OR sku = $3) 
          AND marketplace = 'amazon'
      `, [
        product.totalQuantity,
        product.asin,
        product.sellerSku
      ]);
    } catch (error) {
      console.error(`Erro ao atualizar ${product.asin}:`, error.message);
    }
  }

  async analyzeInventoryStatus() {
    console.log('\n\n📊 ANÁLISE DO STATUS DO INVENTÁRIO:');
    console.log('━'.repeat(50));
    
    // Verificar produtos mais vendidos
    const topSellers = await this.pool.query(`
      SELECT 
        p.asin,
        p.sku,
        p.name,
        p.inventory,
        COUNT(oi.id) as total_vendas,
        SUM(oi.quantity) as unidades_vendidas
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.marketplace = 'amazon'
      GROUP BY p.id
      ORDER BY unidades_vendidas DESC NULLS LAST
      LIMIT 10
    `);
    
    console.log('\n🏆 Top 10 Produtos Mais Vendidos:');
    console.log('ASIN | SKU | Nome | Estoque Atual | Unidades Vendidas');
    console.log('-----|-----|------|---------------|------------------');
    
    topSellers.rows.forEach(product => {
      const nome = product.name ? product.name.substring(0, 20) + '...' : 'N/A';
      console.log(
        `${product.asin} | ${product.sku || 'N/A'} | ${nome} | ${product.inventory || 0} | ${product.unidades_vendidas || 0}`
      );
    });
    
    console.log('\n💡 Recomendação: Os produtos acima são seus best-sellers.');
    console.log('   Priorize a reposição de estoque destes itens no FBA.');
  }

  async close() {
    await this.pool.end();
  }
}

// Executar
async function main() {
  const finder = new StockFinder();
  
  try {
    await finder.findProductsWithStock();
  } catch (error) {
    console.error('Erro geral:', error.message);
  } finally {
    await finder.close();
  }
}

main();