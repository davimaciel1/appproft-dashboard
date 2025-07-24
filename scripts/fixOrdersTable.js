const { Pool } = require('pg');
require('dotenv').config();

async function fixOrdersTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
  });

  try {
    console.log('🔧 Fixing orders table...');
    
    // Add tenant_id column if it doesn't exist
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS tenant_id INTEGER
    `);
    console.log('✅ Added tenant_id column to orders table');
    
    // Update existing orders with user_id as tenant_id
    const result = await pool.query(`
      UPDATE orders 
      SET tenant_id = user_id 
      WHERE tenant_id IS NULL
    `);
    console.log(`✅ Updated ${result.rowCount} orders with tenant_id`);
    
    // Check order_items table has unit_price
    await pool.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0
    `);
    console.log('✅ Ensured unit_price column exists in order_items');
    
    // Migrate old price column to unit_price if needed
    const hasPriceColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' AND column_name = 'price'
    `);
    
    if (hasPriceColumn.rows.length > 0) {
      await pool.query(`
        UPDATE order_items 
        SET unit_price = price 
        WHERE unit_price = 0 AND price IS NOT NULL
      `);
      console.log('✅ Migrated price data to unit_price');
    }
    
    console.log('\n✅ Orders table fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixOrdersTable();