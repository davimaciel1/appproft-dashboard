const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  console.log('🚀 Running Profit Detector migration...');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'server', 'db', 'migrations', '008_create_profit_detector_tables.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');

    // Execute migration
    await executeSQL(sql);
    
    console.log('✅ Profit Detector tables created successfully!');

    // Verify tables were created
    const result = await executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'products_master', 'sales_data', 'fba_fees', 'storage_fees', 
        'long_term_storage_fees', 'inventory_data', 'returns_data',
        'profit_analysis', 'profit_alerts', 'profit_actions', 'profit_reports_tracking'
      )
      ORDER BY table_name;
    `);

    console.log('\n📊 Created tables:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();