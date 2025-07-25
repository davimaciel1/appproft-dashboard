require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createMissingTables() {
  console.log('🔧 Criando tabelas faltantes...\n');
  
  try {
    // Verificar conexão
    await executeSQL('SELECT 1');
    console.log('✅ Conexão com PostgreSQL OK\n');
    
    // Criar tabela inventory_snapshots
    console.log('📦 Criando tabela inventory_snapshots...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS inventory_snapshots (
        id SERIAL PRIMARY KEY,
        asin VARCHAR(10) NOT NULL,
        snapshot_date TIMESTAMPTZ DEFAULT NOW(),
        available_quantity INTEGER DEFAULT 0,
        reserved_quantity INTEGER DEFAULT 0,
        inbound_quantity INTEGER DEFAULT 0,
        total_quantity INTEGER GENERATED ALWAYS AS (available_quantity + reserved_quantity + inbound_quantity) STORED,
        tenant_id VARCHAR(50) DEFAULT 'default',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_inventory_asin ON inventory_snapshots(asin);
      CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_snapshots(snapshot_date DESC);
    `);
    console.log('✅ Tabela inventory_snapshots criada\n');
    
    // Criar tabela products_ml se não existir
    console.log('🤖 Criando tabela products_ml...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS products_ml (
        asin VARCHAR(10) PRIMARY KEY,
        sku VARCHAR(100),
        title TEXT,
        brand VARCHAR(100),
        category VARCHAR(100),
        subcategory VARCHAR(100),
        price DECIMAL(10,2),
        weight_kg DECIMAL(6,3),
        volume_cm3 INTEGER,
        is_fba BOOLEAN DEFAULT false,
        is_prime BOOLEAN DEFAULT false,
        has_variations BOOLEAN DEFAULT false,
        variation_count INTEGER DEFAULT 0,
        main_image_url TEXT,
        image_count INTEGER DEFAULT 1,
        bullet_points TEXT[],
        description_length INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela products_ml criada\n');
    
    // Criar tabela campaign_metrics
    console.log('📣 Criando tabela campaign_metrics...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS campaign_metrics (
        campaign_id VARCHAR(50),
        campaign_name VARCHAR(200),
        campaign_type VARCHAR(50),
        date DATE,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        cost DECIMAL(10,2) DEFAULT 0,
        attributed_conversions_7d INTEGER DEFAULT 0,
        attributed_sales_7d DECIMAL(10,2) DEFAULT 0,
        ctr DECIMAL(5,2),
        acos DECIMAL(5,2),
        roas DECIMAL(5,2),
        tenant_id VARCHAR(50) DEFAULT 'default',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (campaign_id, date)
      );
      
      CREATE INDEX IF NOT EXISTS idx_campaign_date ON campaign_metrics(date DESC);
    `);
    console.log('✅ Tabela campaign_metrics criada\n');
    
    // Criar tabela keywords_performance
    console.log('🎯 Criando tabela keywords_performance...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS keywords_performance (
        keyword_id VARCHAR(50),
        keyword_text VARCHAR(200),
        campaign_id VARCHAR(50),
        asin VARCHAR(10),
        date DATE,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        cost DECIMAL(10,2) DEFAULT 0,
        attributed_sales_7d DECIMAL(10,2) DEFAULT 0,
        ctr DECIMAL(5,2),
        acos DECIMAL(5,2),
        tenant_id VARCHAR(50) DEFAULT 'default',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (keyword_id, date)
      );
    `);
    console.log('✅ Tabela keywords_performance criada\n');
    
    // Verificar tabelas criadas
    const tables = await executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'inventory_snapshots',
          'products_ml',
          'campaign_metrics',
          'keywords_performance'
        )
      ORDER BY table_name
    `);
    
    console.log('📊 Tabelas verificadas:');
    tables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    console.log('\n✅ Todas as tabelas necessárias foram criadas!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.detail) console.error('Detalhes:', error.detail);
  }
}

createMissingTables();