const { Pool } = require('pg');
require('dotenv').config();

async function fixProductsData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
  });

  try {
    console.log('=== CORRIGINDO DADOS DOS PRODUTOS ===\n');
    
    // 1. Verificar produtos existentes
    console.log('1. Verificando produtos existentes:');
    const products = await pool.query(`
      SELECT 
        id,
        marketplace,
        marketplace_product_id,
        sku,
        name,
        price,
        image_url
      FROM products
      WHERE user_id = 1
      LIMIT 10
    `);
    
    console.table(products.rows);
    
    // 2. Adicionar campo cost se não existir
    console.log('\n2. Verificando/adicionando campo cost:');
    try {
      await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0');
      console.log('✅ Campo cost verificado');
    } catch (error) {
      console.log('Campo cost já existe ou erro:', error.message);
    }
    
    // 3. Adicionar campo tenant_id se não existir
    console.log('\n3. Verificando/adicionando campo tenant_id:');
    try {
      await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER');
      await pool.query('UPDATE products SET tenant_id = user_id WHERE tenant_id IS NULL');
      console.log('✅ Campo tenant_id verificado');
    } catch (error) {
      console.log('Campo tenant_id já existe ou erro:', error.message);
    }
    
    // 4. Adicionar campo country_code se não existir
    console.log('\n4. Verificando/adicionando campo country_code:');
    try {
      await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT \'BR\'');
      console.log('✅ Campo country_code verificado');
    } catch (error) {
      console.log('Campo country_code já existe ou erro:', error.message);
    }
    
    // 5. Adicionar campo asin se não existir
    console.log('\n5. Verificando/adicionando campo asin:');
    try {
      await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS asin VARCHAR(50)');
      await pool.query('UPDATE products SET asin = marketplace_product_id WHERE asin IS NULL AND marketplace = \'amazon\'');
      console.log('✅ Campo asin verificado');
    } catch (error) {
      console.log('Campo asin já existe ou erro:', error.message);
    }
    
    // 6. Atualizar produtos com valores padrão
    console.log('\n6. Atualizando produtos com valores padrão:');
    const updateResult = await pool.query(`
      UPDATE products 
      SET 
        price = CASE WHEN price IS NULL OR price = 0 THEN 99.90 ELSE price END,
        cost = CASE WHEN cost IS NULL OR cost = 0 THEN 50.00 ELSE cost END,
        image_url = CASE 
          WHEN image_url IS NULL OR image_url = '' 
          THEN 'https://via.placeholder.com/200x200?text=Produto'
          ELSE image_url 
        END,
        name = CASE 
          WHEN name IS NULL OR name = '' 
          THEN CONCAT('Produto ', marketplace, ' ', marketplace_product_id)
          ELSE name 
        END
      WHERE user_id = 1
      RETURNING id, name, price, cost, image_url
    `);
    
    console.log(`✅ ${updateResult.rowCount} produtos atualizados`);
    if (updateResult.rows.length > 0) {
      console.table(updateResult.rows.slice(0, 5));
    }
    
    // 7. Inserir alguns dados de teste se não houver vendas
    console.log('\n7. Verificando se há vendas:');
    const salesCount = await pool.query('SELECT COUNT(*) FROM orders WHERE tenant_id = 1');
    
    if (salesCount.rows[0].count == 0) {
      console.log('⚠️  Nenhuma venda encontrada. Inserindo dados de exemplo...');
      
      // Criar pedido de exemplo
      const order = await pool.query(`
        INSERT INTO orders (tenant_id, marketplace, order_id, status, total_amount, order_date, created_at)
        VALUES (1, 'amazon', 'TEST-001', 'completed', 299.70, CURRENT_DATE, NOW())
        RETURNING id
      `);
      
      // Adicionar itens ao pedido
      const productIds = products.rows.slice(0, 3).map(p => p.id);
      for (let i = 0; i < productIds.length; i++) {
        await pool.query(`
          INSERT INTO order_items (order_id, product_id, quantity, price, cost)
          VALUES ($1, $2, $3, $4, $5)
        `, [order.rows[0].id, productIds[i], i + 1, 99.90, 50.00]);
      }
      
      console.log('✅ Dados de exemplo inseridos');
    }
    
    console.log('\n✅ Correções concluídas!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

fixProductsData();