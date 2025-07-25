const { executeSQL, ensureConnection } = require('../DATABASE_ACCESS_CONFIG');

async function recreateBuyBoxTables() {
  console.log('🔧 Recriando tabelas de Buy Box...\n');

  if (!await ensureConnection()) {
    console.error('❌ Não foi possível conectar ao banco de dados');
    process.exit(1);
  }

  try {
    // Primeiro, remover tabelas existentes
    console.log('🗑️ Removendo tabelas antigas (se existirem)...');
    
    await executeSQL(`DROP TABLE IF EXISTS buy_box_history CASCADE`);
    await executeSQL(`DROP TABLE IF EXISTS buy_box_winners CASCADE`);
    await executeSQL(`DROP TABLE IF EXISTS competitor_pricing CASCADE`);
    
    console.log('✅ Tabelas antigas removidas!\n');

    // 1. Criar tabela buy_box_winners
    console.log('📋 Criando tabela buy_box_winners...');
    await executeSQL(`
      CREATE TABLE buy_box_winners (
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
    
    await executeSQL(`CREATE INDEX idx_buy_box_winners_asin ON buy_box_winners(product_asin)`);
    await executeSQL(`CREATE INDEX idx_buy_box_winners_checked ON buy_box_winners(checked_at)`);
    
    console.log('✅ Tabela buy_box_winners criada!');

    // 2. Criar tabela buy_box_history
    console.log('\n📋 Criando tabela buy_box_history...');
    await executeSQL(`
      CREATE TABLE buy_box_history (
        id SERIAL PRIMARY KEY,
        product_asin VARCHAR(20) NOT NULL,
        change_type VARCHAR(10) NOT NULL,
        old_winner VARCHAR(50),
        new_winner VARCHAR(50),
        old_price DECIMAL(10,2),
        new_price DECIMAL(10,2),
        changed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    await executeSQL(`CREATE INDEX idx_buy_box_history_asin ON buy_box_history(product_asin)`);
    await executeSQL(`CREATE INDEX idx_buy_box_history_changed ON buy_box_history(changed_at)`);
    
    console.log('✅ Tabela buy_box_history criada!');

    // 3. Criar tabela competitor_pricing
    console.log('\n📋 Criando tabela competitor_pricing...');
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
        collected_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    await executeSQL(`CREATE INDEX idx_competitor_pricing_asin ON competitor_pricing(product_asin)`);
    await executeSQL(`CREATE INDEX idx_competitor_pricing_collected ON competitor_pricing(collected_at)`);
    await executeSQL(`CREATE INDEX idx_competitor_pricing_seller ON competitor_pricing(seller_id)`);
    
    console.log('✅ Tabela competitor_pricing criada!');

    // Verificar estrutura
    console.log('\n📊 Verificando estrutura das tabelas criadas:');
    
    const checkQuery = `
      SELECT 
        t.table_name,
        COUNT(c.column_name) as column_count,
        STRING_AGG(c.column_name, ', ' ORDER BY c.ordinal_position) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public' 
      AND t.table_name IN ('buy_box_winners', 'buy_box_history', 'competitor_pricing')
      GROUP BY t.table_name
      ORDER BY t.table_name
    `;
    
    const result = await executeSQL(checkQuery);
    console.table(result.rows);

    console.log('\n✅ Todas as tabelas de Buy Box foram recriadas com sucesso!');
    console.log('📌 Agora você pode executar a sincronização novamente.');

  } catch (error) {
    console.error('❌ Erro ao recriar tabelas:', error.message);
    console.error(error);
  }

  process.exit(0);
}

recreateBuyBoxTables();