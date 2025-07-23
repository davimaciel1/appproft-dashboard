const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('✅ Database schema created successfully');
    
    // Refresh materialized view
    await pool.query('SELECT refresh_product_sales_summary()');
    
    console.log('✅ Materialized view refreshed');
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrate();