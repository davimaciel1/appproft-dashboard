const { executeSQL, ensureConnection } = require('../DATABASE_ACCESS_CONFIG');

async function createBuyBoxTables() {
  console.log('🏗️ Criando tabelas de Buy Box...\n');

  if (!await ensureConnection()) {
    console.error('❌ Não foi possível conectar ao banco de dados');
    process.exit(1);
  }

  try {
    // 1. Criar tabela buy_box_winners
    console.log('📋 Criando tabela buy_box_winners...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS buy_box_winners (
        id SERIAL PRIMARY KEY,
        product_asin VARCHAR(20) NOT NULL UNIQUE,
        is_winner BOOLEAN NOT NULL DEFAULT false,
        our_price DECIMAL(10,2),
        buy_box_price DECIMAL(10,2),
        competitor_count INTEGER DEFAULT 0,
        checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Criar índices
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_buy_box_winners_asin ON buy_box_winners(product_asin)`);
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_buy_box_winners_checked ON buy_box_winners(checked_at)`);
    
    console.log('✅ Tabela buy_box_winners criada!');

    // 2. Criar tabela buy_box_history
    console.log('\n📋 Criando tabela buy_box_history...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS buy_box_history (
        id SERIAL PRIMARY KEY,
        product_asin VARCHAR(20) NOT NULL,
        change_type VARCHAR(10) NOT NULL, -- 'won' ou 'lost'
        old_winner VARCHAR(50),
        new_winner VARCHAR(50),
        old_price DECIMAL(10,2),
        new_price DECIMAL(10,2),
        changed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Criar índices
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_buy_box_history_asin ON buy_box_history(product_asin)`);
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_buy_box_history_changed ON buy_box_history(changed_at)`);
    
    console.log('✅ Tabela buy_box_history criada!');

    // 3. Verificar se competitor_pricing existe
    console.log('\n📋 Verificando tabela competitor_pricing...');
    const competitorCheck = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'competitor_pricing'
      )
    `);
    
    if (!competitorCheck.rows[0].exists) {
      console.log('📋 Criando tabela competitor_pricing...');
      await executeSQL(`
        CREATE TABLE competitor_pricing (
          id SERIAL PRIMARY KEY,
          product_asin VARCHAR(20) NOT NULL,
          seller_id VARCHAR(50) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          shipping_cost DECIMAL(10,2) DEFAULT 0,
          is_fba BOOLEAN DEFAULT false,
          is_buy_box BOOLEAN DEFAULT false,
          condition VARCHAR(20) DEFAULT 'New',
          collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(product_asin, seller_id, collected_at)
        )
      `);
      
      await executeSQL(`CREATE INDEX IF NOT EXISTS idx_competitor_pricing_asin ON competitor_pricing(product_asin)`);
      await executeSQL(`CREATE INDEX IF NOT EXISTS idx_competitor_pricing_collected ON competitor_pricing(collected_at)`);
      
      console.log('✅ Tabela competitor_pricing criada!');
    } else {
      console.log('✅ Tabela competitor_pricing já existe!');
    }

    // 4. Verificar estrutura
    console.log('\n📊 Verificando estrutura das tabelas criadas:');
    
    const tables = ['buy_box_winners', 'buy_box_history', 'competitor_pricing'];
    
    for (const table of tables) {
      const columns = await executeSQL(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`\n📋 Tabela ${table}:`);
      console.table(columns.rows);
    }

    console.log('\n✅ Todas as tabelas de Buy Box foram criadas com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
    console.error(error);
  }

  process.exit(0);
}

createBuyBoxTables();