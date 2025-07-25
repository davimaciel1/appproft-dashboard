const { executeSQL, ensureConnection } = require('../DATABASE_ACCESS_CONFIG');

async function addBuyBoxWinnerName() {
  console.log('🔧 Adicionando coluna para nome do Buy Box winner...\n');

  if (!await ensureConnection()) {
    console.error('❌ Não foi possível conectar ao banco de dados');
    process.exit(1);
  }

  try {
    // 1. Adicionar colunas nas tabelas
    console.log('📋 Adicionando colunas nas tabelas...');
    
    // Adicionar buy_box_winner_id e buy_box_winner_name em buy_box_winners
    await executeSQL(`
      ALTER TABLE buy_box_winners 
      ADD COLUMN IF NOT EXISTS buy_box_winner_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS buy_box_winner_name VARCHAR(255)
    `);
    console.log('✅ Colunas adicionadas em buy_box_winners');

    // Adicionar seller_name em competitor_pricing se não existir
    await executeSQL(`
      ALTER TABLE competitor_pricing 
      ADD COLUMN IF NOT EXISTS seller_name VARCHAR(255)
    `);
    console.log('✅ Coluna seller_name adicionada em competitor_pricing');

    // 2. Verificar estrutura atualizada
    console.log('\n📊 Estrutura atualizada das tabelas:');
    
    const columns = await executeSQL(`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name IN ('buy_box_winners', 'competitor_pricing')
      AND column_name IN ('buy_box_winner_id', 'buy_box_winner_name', 'seller_name')
      ORDER BY table_name, column_name
    `);
    
    console.table(columns.rows);

    // 3. Criar query para verificar Buy Box winners
    console.log('\n📋 Query para verificar Buy Box winners com nomes:\n');
    
    const query = `
-- PRODUTOS COM BUY BOX E QUEM ESTÁ GANHANDO
SELECT 
  bw.product_asin,
  p.name as product_name,
  CASE 
    WHEN bw.is_winner = true THEN 'VOCÊ'
    WHEN bw.buy_box_winner_name IS NOT NULL THEN bw.buy_box_winner_name
    WHEN bw.buy_box_winner_id IS NOT NULL THEN bw.buy_box_winner_id
    ELSE 'Sem Buy Box'
  END as quem_tem_buy_box,
  bw.our_price,
  bw.buy_box_price,
  bw.competitor_count,
  bw.checked_at
FROM buy_box_winners bw
LEFT JOIN products p ON bw.product_asin = p.asin
WHERE bw.buy_box_price IS NOT NULL
ORDER BY bw.checked_at DESC;
    `;
    
    console.log(query);
    
    console.log('\n✅ Estrutura atualizada com sucesso!');
    console.log('📌 Agora execute uma nova sincronização para capturar os nomes dos vendedores.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }

  process.exit(0);
}

addBuyBoxWinnerName();