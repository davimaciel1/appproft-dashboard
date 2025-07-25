// Script para popular tabela competitor_pricing com dados de competidores

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function populateCompetitorPricing() {
  console.log('🏪 POPULANDO DADOS DE COMPETIDORES');
  console.log('='.repeat(50));
  
  try {
    // 1. Buscar produtos existentes
    console.log('1️⃣ Buscando produtos para monitorar competidores...');
    const products = await executeSQL(`
      SELECT DISTINCT asin, name 
      FROM products 
      WHERE asin IS NOT NULL 
      LIMIT 10
    `);
    
    console.log(`✅ ${products.rows.length} produtos encontrados`);

    // 2. Gerar dados de competidores para cada produto
    console.log('\n2️⃣ Gerando dados de competidores...');
    
    const competitorNames = [
      'Premium Kitchen Supplies',
      'Home Essentials Store',
      'Quick Ship Depot',
      'Value Mart Online',
      'Pro Seller Hub',
      'Kitchen Pro Store',
      'FastDeals Direct',
      'MegaSave Marketplace',
      'Quality Goods Co',
      'BestPrice Outlet'
    ];

    let insertedCount = 0;
    
    for (const product of products.rows) {
      // Gerar 3-5 competidores por produto
      const numCompetitors = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < numCompetitors; i++) {
        const basePrice = Math.random() * 100 + 10; // Preço base entre $10-$110
        const priceVariation = (Math.random() - 0.5) * 10; // Variação de ±$5
        const price = (basePrice + priceVariation).toFixed(2);
        
        const isFBA = Math.random() > 0.3; // 70% chance de ser FBA
        const shippingCost = isFBA ? 0 : (Math.random() * 10).toFixed(2);
        const isBuyBox = i === 0 && Math.random() > 0.5; // Primeiro tem 50% chance de Buy Box
        
        const sellerName = competitorNames[Math.floor(Math.random() * competitorNames.length)];
        const sellerId = `A${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
        
        try {
          await executeSQL(`
            INSERT INTO competitor_pricing (
              product_asin, seller_id, seller_name, price, 
              shipping_cost, is_fba, is_buy_box, condition, collected_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            product.asin,
            sellerId,
            sellerName,
            price,
            shippingCost,
            isFBA,
            isBuyBox,
            'new'
          ]);
          
          insertedCount++;
        } catch (error) {
          console.error(`❌ Erro ao inserir competidor: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ ${insertedCount} registros de competidores inseridos`);

    // 3. Mostrar estatísticas
    console.log('\n3️⃣ Estatísticas da tabela competitor_pricing:');
    
    const stats = await executeSQL(`
      SELECT 
        COUNT(*) as total_registros,
        COUNT(DISTINCT product_asin) as produtos_monitorados,
        COUNT(DISTINCT seller_id) as competidores_unicos,
        ROUND(AVG(price::numeric), 2) as preco_medio,
        SUM(CASE WHEN is_buy_box THEN 1 ELSE 0 END) as total_buy_box,
        SUM(CASE WHEN is_fba THEN 1 ELSE 0 END) as total_fba
      FROM competitor_pricing
    `);
    
    console.table(stats.rows[0]);

    // 4. Top 5 competidores por número de produtos
    console.log('\n4️⃣ Top 5 competidores:');
    const topCompetitors = await executeSQL(`
      SELECT 
        seller_name,
        COUNT(DISTINCT product_asin) as produtos,
        ROUND(AVG(price::numeric), 2) as preco_medio,
        SUM(CASE WHEN is_buy_box THEN 1 ELSE 0 END) as buy_boxes
      FROM competitor_pricing
      WHERE seller_name IS NOT NULL
      GROUP BY seller_name
      ORDER BY produtos DESC
      LIMIT 5
    `);
    
    console.table(topCompetitors.rows);

    console.log('\n✅ População de competitor_pricing concluída!');
    
  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  populateCompetitorPricing();
}

module.exports = populateCompetitorPricing;