require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

class NewProductsSyncer {
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
    
    // Produtos com estoque encontrados anteriormente
    this.productsWithStock = [
      {
        asin: 'B0CLBFSQH1',
        sku: '8K-9V3K-V4JT',
        name: 'Cutting Boards for Kitchen - Bamboo Cutting Board Set of 4',
        inventory: 8
      },
      {
        asin: 'B0CHXHY4F4',
        sku: 'CTR-501',
        name: 'Cuttero Professional Kitchen Knife Sharpener',
        inventory: 2
      },
      {
        asin: 'B0CMYYZY2Q',
        sku: 'FIB-50',
        name: 'Cuttero Signature 7-Inch Chef Knife',
        inventory: 30
      },
      {
        asin: 'B0CHXHY4F4',
        sku: 'FJ-XCP1-GU3G',
        name: 'Cuttero Professional Kitchen Knife Sharpener',
        inventory: 2
      }
    ];
  }

  async syncNewProducts() {
    console.log('🔄 Sincronizando produtos novos com estoque...\n');
    
    for (const product of this.productsWithStock) {
      try {
        // Verificar se já existe
        const exists = await this.pool.query(
          'SELECT id, inventory FROM products WHERE asin = $1 AND sku = $2',
          [product.asin, product.sku]
        );
        
        if (exists.rows.length > 0) {
          // Atualizar existente
          await this.pool.query(
            'UPDATE products SET inventory = $1, updated_at = NOW() WHERE id = $2',
            [product.inventory, exists.rows[0].id]
          );
          console.log(`✅ Atualizado: ${product.name} - ${product.inventory} unidades`);
        } else {
          // Inserir novo
          await this.pool.query(`
            INSERT INTO products (
              user_id,
              marketplace,
              marketplace_product_id,
              asin,
              sku,
              name,
              inventory,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          `, [
            1, // user_id
            'amazon',
            product.asin,
            product.asin,
            product.sku,
            product.name,
            product.inventory
          ]);
          console.log(`✅ Novo produto adicionado: ${product.name} - ${product.inventory} unidades`);
        }
      } catch (error) {
        console.error(`❌ Erro com ${product.asin}:`, error.message);
      }
    }
    
    // Verificar resultado final
    console.log('\n📊 RESUMO FINAL:');
    const summary = await this.pool.query(`
      SELECT 
        COUNT(*) as total_produtos,
        COUNT(CASE WHEN inventory > 0 THEN 1 END) as com_estoque,
        SUM(inventory) as estoque_total
      FROM products 
      WHERE marketplace = 'amazon'
    `);
    
    const stats = summary.rows[0];
    console.log(`Total de produtos: ${stats.total_produtos}`);
    console.log(`Produtos com estoque: ${stats.com_estoque}`);
    console.log(`Estoque total: ${stats.estoque_total} unidades`);
    
    // Listar todos com estoque
    console.log('\n📦 PRODUTOS COM ESTOQUE NO BANCO:');
    const withStock = await this.pool.query(`
      SELECT asin, sku, name, inventory 
      FROM products 
      WHERE inventory > 0 AND marketplace = 'amazon'
      ORDER BY inventory DESC
    `);
    
    withStock.rows.forEach(p => {
      console.log(`\n${p.asin} (${p.sku}): ${p.inventory} unidades`);
      console.log(`  ${p.name}`);
    });
  }

  async close() {
    await this.pool.end();
  }
}

// Executar
async function main() {
  const syncer = new NewProductsSyncer();
  
  try {
    await syncer.syncNewProducts();
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await syncer.close();
  }
}

main();