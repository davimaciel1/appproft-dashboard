const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function investigateMockData() {
  console.log('🔍 Investigando dados mockados no banco de dados...\n');
  
  try {
    // 1. Verificar competitor_tracking_advanced
    console.log('📊 Tabela: competitor_tracking_advanced');
    const competitors = await executeSQL(`
      SELECT DISTINCT competitor_name, COUNT(*) as count 
      FROM competitor_tracking_advanced 
      GROUP BY competitor_name 
      ORDER BY competitor_name
    `);
    console.log('Competidores encontrados:');
    console.table(competitors.rows);
    
    // 2. Verificar buy_box_history
    console.log('\n📊 Tabela: buy_box_history');
    const buyBoxSellers = await executeSQL(`
      SELECT DISTINCT seller_name, COUNT(*) as count 
      FROM buy_box_history 
      WHERE seller_name IS NOT NULL
      GROUP BY seller_name 
      ORDER BY seller_name
    `);
    console.log('Vendedores no Buy Box:');
    console.table(buyBoxSellers.rows);
    
    // 3. Verificar products - nomes genéricos
    console.log('\n📊 Tabela: products');
    const products = await executeSQL(`
      SELECT id, name, asin, sku 
      FROM products 
      WHERE name LIKE '%Test%' 
         OR name LIKE '%Teste%' 
         OR name LIKE '%Example%' 
         OR name LIKE '%Demo%'
         OR name LIKE '%Sample%'
      LIMIT 20
    `);
    console.log('Produtos com nomes suspeitos:');
    if (products.rows.length > 0) {
      console.table(products.rows);
    } else {
      console.log('✅ Nenhum produto com nome suspeito encontrado');
    }
    
    // 4. Verificar orders
    console.log('\n📊 Tabela: orders');
    const ordersCheck = await executeSQL(`
      SELECT COUNT(*) as total_orders,
             MIN(created_at) as oldest_order,
             MAX(created_at) as newest_order
      FROM orders
    `);
    console.log('Resumo de pedidos:');
    console.table(ordersCheck.rows);
    
    // 5. Verificar ai_insights_advanced
    console.log('\n📊 Tabela: ai_insights_advanced');
    const insights = await executeSQL(`
      SELECT DISTINCT insight_type, COUNT(*) as count 
      FROM ai_insights_advanced 
      GROUP BY insight_type
    `);
    console.log('Tipos de insights:');
    if (insights.rows.length > 0) {
      console.table(insights.rows);
    } else {
      console.log('✅ Nenhum insight encontrado');
    }
    
    // 6. Buscar por nomes específicos de empresas falsas
    console.log('\n🚨 Buscando por empresas falsas conhecidas...');
    const fakeCompanies = ['Super Deals', 'Top Produtos BR', 'Prime Vendas', 'MegaStore Brasil', 'Fast Commerce BR'];
    
    for (const company of fakeCompanies) {
      // Buscar em competitor_tracking_advanced
      const compResult = await executeSQL(`
        SELECT COUNT(*) as count 
        FROM competitor_tracking_advanced 
        WHERE competitor_name = $1
      `, [company]);
      
      // Buscar em buy_box_history
      const buyBoxResult = await executeSQL(`
        SELECT COUNT(*) as count 
        FROM buy_box_history 
        WHERE seller_name = $1
      `, [company]);
      
      const compCount = parseInt(compResult.rows[0].count);
      const buyBoxCount = parseInt(buyBoxResult.rows[0].count);
      
      if (compCount > 0 || buyBoxCount > 0) {
        console.log(`❌ Encontrado '${company}': ${compCount} em competitor_tracking, ${buyBoxCount} em buy_box`);
      }
    }
    
    // 7. Verificar padrões de ASINs
    console.log('\n📊 Verificando padrões de ASINs...');
    const asinPatterns = await executeSQL(`
      SELECT DISTINCT p.asin, p.name, COUNT(ct.id) as competitor_count
      FROM products p
      LEFT JOIN competitor_tracking_advanced ct ON p.asin = ct.asin
      GROUP BY p.asin, p.name
      ORDER BY competitor_count DESC
      LIMIT 10
    `);
    console.log('ASINs com mais dados de competidores:');
    if (asinPatterns.rows.length > 0) {
      console.table(asinPatterns.rows);
    }
    
    // 8. Verificar datas suspeitas (todas muito próximas)
    console.log('\n📊 Verificando distribuição de datas...');
    const dateDistribution = await executeSQL(`
      SELECT 
        DATE(tracked_at) as date,
        COUNT(*) as records
      FROM competitor_tracking_advanced
      GROUP BY DATE(tracked_at)
      ORDER BY date DESC
      LIMIT 10
    `);
    console.log('Distribuição de datas em competitor_tracking:');
    if (dateDistribution.rows.length > 0) {
      console.table(dateDistribution.rows);
    }
    
    // 9. Verificar preços suspeitos (muito redondos ou padrões)
    console.log('\n📊 Verificando preços suspeitos...');
    const suspiciousPrices = await executeSQL(`
      SELECT 
        competitor_name,
        price,
        COUNT(*) as occurrences
      FROM competitor_tracking_advanced
      WHERE price::numeric % 10 = 0 OR price::numeric % 100 = 0
      GROUP BY competitor_name, price
      HAVING COUNT(*) > 5
      ORDER BY occurrences DESC
      LIMIT 20
    `);
    console.log('Preços suspeitos (muito redondos):');
    if (suspiciousPrices.rows.length > 0) {
      console.table(suspiciousPrices.rows);
    }
    
    // 10. Verificar dados de produtos mais recentes
    console.log('\n📊 Últimos produtos adicionados:');
    const recentProducts = await executeSQL(`
      SELECT id, name, asin, sku, created_at
      FROM products
      ORDER BY created_at DESC
      LIMIT 10
    `);
    if (recentProducts.rows.length > 0) {
      console.table(recentProducts.rows);
    }
    
    // 11. Estatísticas gerais
    console.log('\n📊 Estatísticas gerais de dados mockados:');
    const stats = await executeSQL(`
      SELECT 
        'competitor_tracking_advanced' as table_name,
        COUNT(DISTINCT competitor_name) as unique_competitors,
        COUNT(*) as total_records
      FROM competitor_tracking_advanced
      UNION ALL
      SELECT 
        'buy_box_history' as table_name,
        COUNT(DISTINCT seller_name) as unique_sellers,
        COUNT(*) as total_records
      FROM buy_box_history
      UNION ALL
      SELECT 
        'products' as table_name,
        COUNT(DISTINCT name) as unique_products,
        COUNT(*) as total_records
      FROM products
    `);
    console.table(stats.rows);
    
  } catch (error) {
    console.error('❌ Erro ao investigar dados:', error.message);
  }
}

// Executar investigação
investigateMockData().then(() => {
  console.log('\n✅ Investigação concluída!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});