const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createBuyBoxHistory() {
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS buy_box_history (
        id SERIAL PRIMARY KEY,
        asin VARCHAR(20) NOT NULL,
        product_name VARCHAR(255),
        change_type VARCHAR(20) NOT NULL,
        our_price DECIMAL(10,2),
        competitor_price DECIMAL(10,2),
        buy_box_winner VARCHAR(255),
        tenant_id VARCHAR(50) DEFAULT 'default',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_buy_box_history_asin ON buy_box_history(asin, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_buy_box_history_change ON buy_box_history(change_type, created_at DESC);
    `);
    console.log('✅ Tabela buy_box_history criada com sucesso');
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

createBuyBoxHistory();