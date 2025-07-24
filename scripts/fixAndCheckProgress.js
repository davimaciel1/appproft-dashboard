const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
});

(async () => {
  try {
    // Adicionar coluna cost em order_items
    await pool.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0');
    console.log('✅ Coluna cost adicionada em order_items');
    
    // Verificar quantos pedidos foram salvos
    const orders = await pool.query("SELECT COUNT(*) FROM orders WHERE marketplace = 'amazon'");
    console.log(`📊 Pedidos Amazon salvos: ${orders.rows[0].count}`);
    
    // Verificar produtos salvos
    const products = await pool.query("SELECT COUNT(*) FROM products WHERE marketplace = 'amazon'");
    console.log(`📦 Produtos Amazon salvos: ${products.rows[0].count}`);
    
    // Ver últimos pedidos
    const recentOrders = await pool.query(`
      SELECT marketplace_order_id, order_date, total 
      FROM orders 
      WHERE marketplace = 'amazon' 
      ORDER BY order_date DESC 
      LIMIT 5
    `);
    
    console.log('\n🕰️ Últimos 5 pedidos:');
    recentOrders.rows.forEach(order => {
      console.log(`- ${order.marketplace_order_id}: $${order.total} (${new Date(order.order_date).toLocaleDateString()})`);
    });
    
    // Ver produtos com mais vendas
    const topProducts = await pool.query(`
      SELECT p.name, p.asin, p.image_url, COUNT(oi.id) as sales
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      WHERE p.marketplace = 'amazon'
      GROUP BY p.id
      ORDER BY sales DESC
      LIMIT 5
    `);
    
    console.log('\n🏆 Top 5 produtos mais vendidos:');
    topProducts.rows.forEach((product, i) => {
      console.log(`${i+1}. ${product.name?.substring(0, 50)}... (${product.sales} vendas)`);
      console.log(`   ASIN: ${product.asin} | Imagem: ${product.image_url ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await pool.end();
  }
})();