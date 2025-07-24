require('dotenv').config();
const pool = require('../server/db/pool');

console.log('=== TESTANDO CONEXÃO COM POSTGRESQL ===\n');

async function testConnection() {
  try {
    // 1. Testar conexão básica
    console.log('1. Testando conexão com o banco...');
    const testQuery = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Conexão OK:', testQuery.rows[0].current_time);
    
    // 2. Verificar tabelas existentes
    console.log('\n2. Verificando tabelas existentes...');
    const tablesQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tabelas encontradas:');
    tablesQuery.rows.forEach(row => console.log('  -', row.table_name));
    
    // 3. Verificar dados em tabelas específicas
    console.log('\n3. Verificando dados nas tabelas principais...');
    
    // Users
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`  - users: ${usersCount.rows[0].count} registros`);
    
    // Products
    const productsCount = await pool.query('SELECT COUNT(*) as count FROM products');
    console.log(`  - products: ${productsCount.rows[0].count} registros`);
    
    // Orders
    const ordersCount = await pool.query('SELECT COUNT(*) as count FROM orders');
    console.log(`  - orders: ${ordersCount.rows[0].count} registros`);
    
    // Order Items
    const orderItemsCount = await pool.query('SELECT COUNT(*) as count FROM order_items');
    console.log(`  - order_items: ${orderItemsCount.rows[0].count} registros`);
    
    // 4. Testar query do dashboard
    console.log('\n4. Testando query do dashboard (produtos com vendas)...');
    const dashboardQuery = `
      SELECT 
        p.id,
        p.marketplace,
        p.marketplace_product_id as asin,
        p.sku,
        p.name,
        p.image_url,
        p.price,
        COALESCE(SUM(oi.quantity), 0) as units,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
        COALESCE(SUM(oi.quantity * (oi.unit_price - COALESCE(oi.cost, oi.unit_price * 0.6))), 0) as profit
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.user_id = 1
      GROUP BY p.id
      HAVING SUM(oi.quantity) > 0 OR SUM(oi.quantity) IS NULL
      ORDER BY revenue DESC
      LIMIT 5
    `;
    
    const dashboardResult = await pool.query(dashboardQuery);
    console.log(`Produtos encontrados: ${dashboardResult.rows.length}`);
    
    if (dashboardResult.rows.length > 0) {
      console.log('\nPrimeiros produtos:');
      dashboardResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. ${row.name || 'Sem nome'}`);
        console.log(`   SKU: ${row.sku || 'N/A'}`);
        console.log(`   Marketplace: ${row.marketplace || 'N/A'}`);
        console.log(`   Units: ${row.units}`);
        console.log(`   Revenue: R$ ${parseFloat(row.revenue).toFixed(2)}`);
      });
    }
    
    // 5. Testar query de métricas
    console.log('\n5. Testando query de métricas...');
    const metricsQuery = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.quantity), 0) as total_units,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_revenue,
        COALESCE(SUM(oi.quantity * (oi.unit_price - COALESCE(oi.cost, oi.unit_price * 0.6))), 0) as total_profit,
        COUNT(DISTINCT CASE WHEN o.order_date >= CURRENT_DATE THEN o.id END) as today_orders
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = 1 AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    const metricsResult = await pool.query(metricsQuery);
    const metrics = metricsResult.rows[0];
    
    console.log('\nMétricas do dashboard:');
    console.log(`  - Total de pedidos: ${metrics.total_orders}`);
    console.log(`  - Total de unidades: ${metrics.total_units}`);
    console.log(`  - Receita total: R$ ${parseFloat(metrics.total_revenue).toFixed(2)}`);
    console.log(`  - Lucro total: R$ ${parseFloat(metrics.total_profit).toFixed(2)}`);
    console.log(`  - Pedidos hoje: ${metrics.today_orders}`);
    
    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('Detalhes:', error);
  } finally {
    await pool.end();
  }
}

// Executar teste
testConnection();