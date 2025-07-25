const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createMigrationsTable() {
  console.log('🔧 Creating migrations table...');

  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS migrations (
        version VARCHAR(10) PRIMARY KEY,
        description TEXT,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    console.log('✅ Migrations table created successfully!');
  } catch (error) {
    console.error('❌ Error creating migrations table:', error);
    process.exit(1);
  }
}

createMigrationsTable();