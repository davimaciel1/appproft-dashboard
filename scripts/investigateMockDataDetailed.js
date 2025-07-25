const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function investigateMockDataDetailed() {
  console.log('🔍 INVESTIGAÇÃO DETALHADA DE DADOS MOCKADOS\n');
  console.log('=' .repeat(80));
  
  try {
    // 1. EMPRESAS FALSAS CONHECIDAS
    console.log('\n🚨 1. BUSCANDO POR EMPRESAS FALSAS CONHECIDAS:');
    const fakeCompanies = ['Super Deals', 'Top Produtos BR', 'Prime Vendas', 'MegaStore Brasil', 'Fast Commerce BR'];
    
    for (const company of fakeCompanies) {
      // Buscar em competitor_tracking_advanced (campo buy_box_seller)
      const compResult = await executeSQL(`
        SELECT COUNT(*) as count, 
               MIN(timestamp) as first_seen,
               MAX(timestamp) as last_seen,
               COUNT(DISTINCT asin) as products_count
        FROM competitor_tracking_advanced 
        WHERE buy_box_seller = $1
      `, [company]);
      
      // Buscar em buy_box_history
      const buyBoxResult = await executeSQL(`
        SELECT COUNT(*) as count,
               MIN(started_at) as first_seen,
               MAX(started_at) as last_seen,
               COUNT(DISTINCT asin) as products_count
        FROM buy_box_history 
        WHERE seller_name = $1
      `, [company]);
      
      // Buscar no campo competitors JSONB
      const jsonCompResult = await executeSQL(`
        SELECT COUNT(*) as count
        FROM competitor_tracking_advanced 
        WHERE competitors::text LIKE $1
      `, [`%${company}%`]);
      
      const compCount = parseInt(compResult.rows[0].count);
      const buyBoxCount = parseInt(buyBoxResult.rows[0].count);
      const jsonCount = parseInt(jsonCompResult.rows[0].count);
      
      if (compCount > 0 || buyBoxCount > 0 || jsonCount > 0) {
        console.log(`\n❌ ENCONTRADO: "${company}"`);
        console.log(`   - competitor_tracking_advanced (buy_box_seller): ${compCount} registros`);
        if (compCount > 0) {
          console.log(`     • Primeira aparição: ${compResult.rows[0].first_seen}`);
          console.log(`     • Última aparição: ${compResult.rows[0].last_seen}`);
          console.log(`     • Produtos distintos: ${compResult.rows[0].products_count}`);
        }
        console.log(`   - buy_box_history: ${buyBoxCount} registros`);
        if (buyBoxCount > 0) {
          console.log(`     • Primeira aparição: ${buyBoxResult.rows[0].first_seen}`);
          console.log(`     • Última aparição: ${buyBoxResult.rows[0].last_seen}`);
          console.log(`     • Produtos distintos: ${buyBoxResult.rows[0].products_count}`);
        }
        console.log(`   - competitors JSONB: ${jsonCount} registros`);
      }
    }
    
    // 2. ANÁLISE DE TODOS OS VENDEDORES
    console.log('\n📊 2. ANÁLISE DE TODOS OS VENDEDORES/COMPETIDORES:');
    
    // Vendedores em competitor_tracking_advanced
    const allSellers = await executeSQL(`
      SELECT buy_box_seller as seller_name, 
             COUNT(*) as occurrences,
             COUNT(DISTINCT asin) as products,
             MIN(timestamp) as first_seen,
             MAX(timestamp) as last_seen
      FROM competitor_tracking_advanced 
      WHERE buy_box_seller IS NOT NULL
      GROUP BY buy_box_seller
      ORDER BY occurrences DESC
      LIMIT 20
    `);
    
    console.log('\nTop 20 vendedores em competitor_tracking_advanced:');
    console.table(allSellers.rows);
    
    // Vendedores em buy_box_history
    const buyBoxSellers = await executeSQL(`
      SELECT seller_name, 
             COUNT(*) as periods,
             COUNT(DISTINCT asin) as products,
             MIN(started_at) as first_seen,
             MAX(started_at) as last_seen,
             AVG(duration_minutes) as avg_duration_min
      FROM buy_box_history 
      WHERE seller_name IS NOT NULL
      GROUP BY seller_name
      ORDER BY periods DESC
      LIMIT 20
    `);
    
    console.log('\nTop 20 vendedores em buy_box_history:');
    console.table(buyBoxSellers.rows);
    
    // 3. PADRÕES SUSPEITOS
    console.log('\n🔍 3. PADRÕES SUSPEITOS NOS DADOS:');
    
    // Verificar se todos os registros têm a mesma data
    const datePattern = await executeSQL(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as records,
        COUNT(DISTINCT buy_box_seller) as unique_sellers
      FROM competitor_tracking_advanced
      GROUP BY DATE(timestamp)
      ORDER BY records DESC
    `);
    
    console.log('\nDistribuição de datas em competitor_tracking_advanced:');
    console.table(datePattern.rows);
    
    // Verificar padrões de preços
    const pricePatterns = await executeSQL(`
      SELECT 
        CASE 
          WHEN buy_box_price::numeric % 1 = 0 THEN 'Preço inteiro (ex: 10.00)'
          WHEN buy_box_price::numeric % 0.99 = 0 THEN 'Preço .99 (ex: 9.99)'
          WHEN buy_box_price::numeric % 0.95 = 0 THEN 'Preço .95 (ex: 9.95)'
          WHEN buy_box_price::numeric % 0.90 = 0 THEN 'Preço .90 (ex: 9.90)'
          ELSE 'Outros'
        END as price_pattern,
        COUNT(*) as count,
        COUNT(DISTINCT buy_box_seller) as unique_sellers
      FROM competitor_tracking_advanced
      WHERE buy_box_price IS NOT NULL
      GROUP BY price_pattern
      ORDER BY count DESC
    `);
    
    console.log('\nPadrões de preços:');
    console.table(pricePatterns.rows);
    
    // 4. ANÁLISE DE PRODUTOS
    console.log('\n📦 4. ANÁLISE DE PRODUTOS:');
    
    // Produtos com nomes genéricos ou suspeitos
    const suspiciousProducts = await executeSQL(`
      SELECT id, name, asin, sku, marketplace
      FROM products
      WHERE name ILIKE '%test%' 
         OR name ILIKE '%demo%'
         OR name ILIKE '%example%'
         OR name ILIKE '%sample%'
         OR name ILIKE '%fake%'
         OR name ILIKE '%mock%'
      LIMIT 20
    `);
    
    if (suspiciousProducts.rows.length > 0) {
      console.log('\n❌ Produtos com nomes suspeitos:');
      console.table(suspiciousProducts.rows);
    } else {
      console.log('\n✅ Nenhum produto com nome suspeito encontrado');
    }
    
    // 5. ANÁLISE DO CAMPO COMPETITORS JSONB
    console.log('\n🔍 5. ANÁLISE DO CAMPO COMPETITORS (JSONB):');
    
    const competitorsData = await executeSQL(`
      SELECT 
        id,
        asin,
        timestamp,
        buy_box_seller,
        competitors
      FROM competitor_tracking_advanced
      WHERE competitors IS NOT NULL
      LIMIT 5
    `);
    
    if (competitorsData.rows.length > 0) {
      console.log('\nExemplo de dados no campo competitors:');
      competitorsData.rows.forEach((row, index) => {
        console.log(`\nRegistro ${index + 1}:`);
        console.log(`  ASIN: ${row.asin}`);
        console.log(`  Buy Box Seller: ${row.buy_box_seller}`);
        console.log(`  Competitors:`, JSON.stringify(row.competitors, null, 2));
      });
    }
    
    // 6. ESTATÍSTICAS GERAIS
    console.log('\n📊 6. ESTATÍSTICAS GERAIS:');
    
    const generalStats = await executeSQL(`
      SELECT 
        (SELECT COUNT(DISTINCT buy_box_seller) FROM competitor_tracking_advanced WHERE buy_box_seller IS NOT NULL) as unique_sellers_tracking,
        (SELECT COUNT(DISTINCT seller_name) FROM buy_box_history WHERE seller_name IS NOT NULL) as unique_sellers_buybox,
        (SELECT COUNT(DISTINCT asin) FROM competitor_tracking_advanced) as unique_asins_tracking,
        (SELECT COUNT(DISTINCT asin) FROM buy_box_history) as unique_asins_buybox,
        (SELECT COUNT(*) FROM competitor_tracking_advanced) as total_tracking_records,
        (SELECT COUNT(*) FROM buy_box_history) as total_buybox_records,
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM orders) as total_orders
    `);
    
    console.log('\nEstatísticas do banco de dados:');
    console.table(generalStats.rows);
    
    // 7. VERIFICAR DADOS RECENTES
    console.log('\n⏰ 7. DADOS MAIS RECENTES:');
    
    const recentData = await executeSQL(`
      SELECT 
        'competitor_tracking_advanced' as table_name,
        MAX(timestamp) as most_recent,
        MIN(timestamp) as oldest
      FROM competitor_tracking_advanced
      UNION ALL
      SELECT 
        'buy_box_history' as table_name,
        MAX(started_at) as most_recent,
        MIN(started_at) as oldest
      FROM buy_box_history
      UNION ALL
      SELECT 
        'orders' as table_name,
        MAX(order_date) as most_recent,
        MIN(order_date) as oldest
      FROM orders
    `);
    
    console.log('\nDatas mais recentes e antigas por tabela:');
    console.table(recentData.rows);
    
  } catch (error) {
    console.error('❌ Erro na investigação:', error.message);
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log('🏁 CONCLUSÃO DA INVESTIGAÇÃO');
  console.log('=' .repeat(80));
}

// Executar investigação
investigateMockDataDetailed().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});