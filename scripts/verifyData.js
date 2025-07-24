const { Pool } = require('pg');
require('dotenv').config();

async function verifyData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
  });

  try {
    console.log('🔍 Verificando dados no banco...\n');
    
    // 1. Produtos
    console.log('📦 PRODUTOS:');
    const products = await pool.query(`
      SELECT id, name, asin, price, image_url 
      FROM products 
      WHERE marketplace = 'amazon'
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log(`Total: ${products.rows.length} produtos`);
    products.rows.forEach(p => {
      console.log(`\n[${p.id}] ${p.name}`);
      console.log(`  ASIN: ${p.asin}`);
      console.log(`  Preço: R$ ${p.price}`);
      console.log(`  Imagem: ${p.image_url ? '✅ ' + p.image_url.substring(0, 50) + '...' : '❌ Sem imagem'}`);
    });
    
    // 2. Vendas
    console.log('\n\n💰 VENDAS:');
    const sales = await pool.query(`
      SELECT 
        COUNT(DISTINCT o.id) as total_pedidos,
        COUNT(DISTINCT p.id) as produtos_com_vendas,
        SUM(oi.quantity) as unidades_vendidas,
        SUM(oi.quantity * oi.unit_price) as revenue_total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.marketplace = 'amazon'
    `);
    
    const result = sales.rows[0];
    console.log(`Total de Pedidos: ${result.total_pedidos || 0}`);
    console.log(`Produtos com Vendas: ${result.produtos_com_vendas || 0}`);
    console.log(`Unidades Vendidas: ${result.unidades_vendidas || 0}`);
    console.log(`Revenue Total: R$ ${parseFloat(result.revenue_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    
    // 3. Top produtos
    console.log('\n\n🏆 TOP 5 PRODUTOS MAIS VENDIDOS:');
    const topProducts = await pool.query(`
      SELECT 
        p.name,
        p.asin,
        p.image_url,
        COUNT(DISTINCT o.id) as vendas,
        SUM(oi.quantity) as unidades
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.marketplace = 'amazon'
      GROUP BY p.id, p.name, p.asin, p.image_url
      ORDER BY unidades DESC
      LIMIT 5
    `);
    
    topProducts.rows.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name.substring(0, 60)}...`);
      console.log(`   ASIN: ${p.asin} | Vendas: ${p.vendas} | Unidades: ${p.unidades}`);
      console.log(`   Imagem: ${p.image_url ? '✅' : '❌'}`);
    });
    
    // 4. Verificar dashboard
    console.log('\n\n🖥️  DADOS PARA O DASHBOARD:');
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
        COALESCE(SUM(oi.quantity * (oi.unit_price - oi.cost)), 0) as profit
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.marketplace = 'amazon'
        AND p.user_id = 1
      GROUP BY p.id
      ORDER BY units DESC
      LIMIT 3
    `);
    
    console.log('Exemplo de dados que o dashboard deve mostrar:');
    dashboardQuery.rows.forEach(p => {
      console.log(`\n${p.name.substring(0, 50)}...`);
      console.log(`  Units: ${p.units} | Revenue: R$ ${parseFloat(p.revenue).toFixed(2)} | Profit: R$ ${parseFloat(p.profit).toFixed(2)}`);
      console.log(`  Imagem: ${p.image_url ? '✅' : '❌ FALTANDO'}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verifyData();