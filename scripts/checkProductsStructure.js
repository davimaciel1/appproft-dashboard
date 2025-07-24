const { Pool } = require('pg');
require('dotenv').config();

async function checkProductsStructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
  });

  try {
    console.log('=== VERIFICANDO ESTRUTURA DA TABELA PRODUCTS ===\n');
    
    // 1. Verificar estrutura da tabela
    const columns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estrutura da tabela products:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // 2. Verificar produtos específicos mencionados
    console.log('\n🔍 Verificando produtos B0C5BG5T48 e B0C5BCDWTQ:');
    const problemProducts = await pool.query(`
      SELECT 
        id,
        sku,
        asin,
        name,
        price,
        cost,
        image_url,
        marketplace,
        tenant_id,
        created_at,
        CASE 
          WHEN price IS NULL OR price = 0 THEN 'CRÍTICO: Sem preço'
          WHEN image_url IS NULL THEN 'ALERTA: Sem imagem'
          WHEN cost IS NULL OR cost = 0 THEN 'ALERTA: Sem custo'
          ELSE 'OK'
        END as status_problema
      FROM products 
      WHERE sku IN ('B0C5BG5T48', 'B0C5BCDWTQ') 
         OR asin IN ('B0C5BG5T48', 'B0C5BCDWTQ')
    `);
    
    if (problemProducts.rows.length > 0) {
      console.table(problemProducts.rows);
    } else {
      console.log('  ❌ Produtos não encontrados!');
    }
    
    // 3. Verificar se há vendas para estes produtos
    console.log('\n📊 Verificando vendas destes produtos:');
    const sales = await pool.query(`
      SELECT 
        p.sku,
        p.name,
        COUNT(oi.id) as total_vendas,
        COALESCE(SUM(oi.quantity), 0) as unidades_vendidas,
        COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.sku IN ('B0C5BG5T48', 'B0C5BCDWTQ') 
         OR p.asin IN ('B0C5BG5T48', 'B0C5BCDWTQ')
      GROUP BY p.sku, p.name
    `);
    
    if (sales.rows.length > 0) {
      console.table(sales.rows);
    }
    
    // 4. Verificar campos ausentes críticos
    console.log('\n⚠️  Verificando campos críticos:');
    const hasImageUrl = columns.rows.some(col => col.column_name === 'image_url');
    const hasPrice = columns.rows.some(col => col.column_name === 'price');
    const hasCost = columns.rows.some(col => col.column_name === 'cost');
    
    console.log(`  - image_url: ${hasImageUrl ? '✅ Existe' : '❌ NÃO EXISTE'}`);
    console.log(`  - price: ${hasPrice ? '✅ Existe' : '❌ NÃO EXISTE'}`);
    console.log(`  - cost: ${hasCost ? '✅ Existe' : '❌ NÃO EXISTE'}`);
    
    if (!hasImageUrl) {
      console.log('\n🔧 SQL para adicionar campo image_url:');
      console.log('ALTER TABLE products ADD COLUMN image_url VARCHAR(500);');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkProductsStructure();