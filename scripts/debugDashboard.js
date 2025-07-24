const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
});

(async () => {
  try {
    console.log('🔍 Debugando dashboard...\n');
    
    // 1. Verificar se há dados no banco
    const orders = await pool.query("SELECT COUNT(*) FROM orders WHERE marketplace = 'amazon'");
    console.log('✅ Total de pedidos Amazon:', orders.rows[0].count);
    
    const products = await pool.query("SELECT COUNT(*) FROM products WHERE marketplace = 'amazon'");
    console.log('✅ Total de produtos Amazon:', products.rows[0].count);
    
    const items = await pool.query('SELECT COUNT(*) FROM order_items');
    console.log('✅ Total de itens vendidos:', items.rows[0].count);
    
    // 2. Verificar se order_items está ligado corretamente aos produtos
    const linkedItems = await pool.query(`
      SELECT COUNT(*) 
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE p.marketplace = 'amazon'
    `);
    console.log('✅ Itens ligados a produtos Amazon:', linkedItems.rows[0].count);
    
    // 3. Testar a mesma query que o dashboard usa
    console.log('\n🔍 Testando query do dashboard:');
    const dashboardQuery = await pool.query(`
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
      WHERE p.marketplace = 'amazon'
        AND p.user_id = 1
      GROUP BY p.id
      ORDER BY revenue DESC
      LIMIT 10
    `);
    
    console.log('\n📊 Produtos encontrados:', dashboardQuery.rows.length);
    
    if (dashboardQuery.rows.length === 0) {
      console.log('⚠️  PROBLEMA: Nenhum produto retornado!\n');
      
      // Verificar se é problema de user_id
      const allProducts = await pool.query(`
        SELECT DISTINCT user_id, COUNT(*) as count 
        FROM products 
        WHERE marketplace = 'amazon' 
        GROUP BY user_id
      `);
      console.log('User IDs dos produtos:');
      allProducts.rows.forEach(row => {
        console.log(`  User ${row.user_id}: ${row.count} produtos`);
      });
      
      // Verificar produtos sem LEFT JOIN
      const simpleQuery = await pool.query(`
        SELECT id, name, marketplace, user_id 
        FROM products 
        WHERE marketplace = 'amazon' 
        LIMIT 5
      `);
      console.log('\nPrimeiros 5 produtos:');
      simpleQuery.rows.forEach(p => {
        console.log(`  [${p.id}] ${p.name?.substring(0, 40)}... (user_id: ${p.user_id})`);
      });
      
    } else {
      console.log('\n🏆 Top produtos com vendas:');
      dashboardQuery.rows.forEach((p, i) => {
        console.log(`${i+1}. ${p.name?.substring(0, 40)}...`);
        console.log(`   Units: ${p.units} | Revenue: $${parseFloat(p.revenue).toFixed(2)} | Profit: $${parseFloat(p.profit).toFixed(2)}`);
        console.log(`   Imagem: ${p.image_url ? '✅' : '❌'}`);
      });
    }
    
    // 4. Testar endpoint da API
    console.log('\n🌐 Testando endpoint /api/dashboard/products...');
    const axios = require('axios');
    try {
      const response = await axios.get('http://localhost:5000/api/dashboard/products', {
        params: {
          period: '30d',
          marketplace: 'all'
        }
      });
      console.log('✅ API respondeu com', response.data.products?.length || 0, 'produtos');
    } catch (error) {
      console.log('❌ Erro ao chamar API:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
})();