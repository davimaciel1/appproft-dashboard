const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
});

async function createTrafficTables() {
  try {
    console.log('🔄 Criando tabelas de métricas de tráfego...\n');

    // Criar tabela traffic_metrics para métricas agregadas por data
    await pool.query(`
      CREATE TABLE IF NOT EXISTS traffic_metrics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        tenant_id INTEGER NOT NULL,
        marketplace VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        page_views INTEGER DEFAULT 0,
        sessions INTEGER DEFAULT 0,
        browser_page_views INTEGER DEFAULT 0,
        mobile_app_page_views INTEGER DEFAULT 0,
        buy_box_percentage DECIMAL(5,2) DEFAULT 0,
        unit_session_percentage DECIMAL(5,2) DEFAULT 0,
        feedback_received INTEGER DEFAULT 0,
        negative_feedback_received INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, marketplace, date)
      )
    `);
    console.log('✅ Tabela traffic_metrics criada');

    // Criar índices para performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_traffic_metrics_user_date 
      ON traffic_metrics(user_id, date DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_traffic_metrics_marketplace_date 
      ON traffic_metrics(marketplace, date DESC)
    `);

    // Criar tabela product_page_views para métricas por produto
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_page_views (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        session_id VARCHAR(100),
        page_views INTEGER DEFAULT 1,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id, session_id, date)
      )
    `);
    console.log('✅ Tabela product_page_views criada');

    // Criar índice para queries por produto
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_product_page_views_product_date 
      ON product_page_views(product_id, date DESC)
    `);

    // Adicionar colunas à tabela orders se não existirem
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS is_business_order BOOLEAN DEFAULT FALSE
    `);
    console.log('✅ Coluna is_business_order adicionada à tabela orders');

    // Adicionar colunas à tabela order_items se não existirem
    await pool.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT FALSE
    `);
    console.log('✅ Coluna is_refunded adicionada à tabela order_items');

    // Adicionar colunas à tabela products se não existirem
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS parent_asin VARCHAR(50),
      ADD COLUMN IF NOT EXISTS buy_box_percentage DECIMAL(5,2) DEFAULT 0
    `);
    console.log('✅ Colunas parent_asin e buy_box_percentage adicionadas à tabela products');

    // Popular com dados de exemplo para teste (opcional)
    const testData = await pool.query(`
      INSERT INTO traffic_metrics (
        user_id, tenant_id, marketplace, date, 
        page_views, sessions, browser_page_views, mobile_app_page_views,
        buy_box_percentage, unit_session_percentage, 
        feedback_received, negative_feedback_received
      ) VALUES 
      (1, 1, 'amazon', CURRENT_DATE, 1250, 450, 850, 400, 87.5, 25.3, 12, 1),
      (1, 1, 'amazon', CURRENT_DATE - INTERVAL '1 day', 1180, 420, 800, 380, 85.2, 24.8, 10, 0),
      (1, 1, 'amazon', CURRENT_DATE - INTERVAL '2 days', 1320, 480, 900, 420, 88.1, 26.5, 15, 2)
      ON CONFLICT (user_id, marketplace, date) DO NOTHING
      RETURNING id
    `);

    if (testData.rows.length > 0) {
      console.log('✅ Dados de teste inseridos nas métricas de tráfego');
    }

    console.log('\n✨ Todas as tabelas de tráfego foram criadas com sucesso!');
    
    // Verificar estrutura final
    const tables = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('traffic_metrics', 'product_page_views')
      ORDER BY table_name, ordinal_position
    `);

    console.log('\n📊 Estrutura das novas tabelas:');
    let currentTable = '';
    tables.rows.forEach(col => {
      if (col.table_name !== currentTable) {
        currentTable = col.table_name;
        console.log(`\n${currentTable}:`);
      }
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Executar
createTrafficTables();