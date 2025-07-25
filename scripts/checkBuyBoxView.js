const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkBuyBoxView() {
  try {
    // Verificar se a view existe
    const viewExists = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_name = 'buy_box_status'
      )
    `);
    
    console.log('🔍 Verificando view buy_box_status...\n');
    
    if (viewExists.rows[0].exists) {
      console.log('✅ View buy_box_status existe!');
      
      // Verificar colunas da view
      const columns = await executeSQL(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'buy_box_status'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Colunas da view:');
      columns.rows.forEach(col => {
        console.log(`   • ${col.column_name}: ${col.data_type}`);
      });
      
      // Contar registros
      const count = await executeSQL(`SELECT COUNT(*) FROM buy_box_status`);
      console.log(`\n📊 Total de registros: ${count.rows[0].count}`);
      
      // Ver amostra de dados
      const sample = await executeSQL(`
        SELECT * FROM buy_box_status LIMIT 3
      `);
      
      if (sample.rows.length > 0) {
        console.log('\n📸 Amostra de dados:');
        sample.rows.forEach((row, idx) => {
          console.log(`\n${idx + 1}. ASIN: ${row.asin}`);
          Object.keys(row).forEach(key => {
            if (key !== 'asin') {
              console.log(`   ${key}: ${row[key]}`);
            }
          });
        });
      }
    } else {
      console.log('❌ View buy_box_status não existe!');
      
      // Criar a view com todas as colunas necessárias
      console.log('\nCriando view buy_box_status...');
      
      await executeSQL(`
        CREATE OR REPLACE VIEW buy_box_status AS
        SELECT 
          p.asin,
          p.name as product_name,
          COALESCE(ct.seller_name, 'Sem Buy Box') as buy_box_owner,
          COALESCE(ct.price, p.current_price) as buy_box_price,
          COALESCE(ct.is_fba, false) as is_fba,
          COALESCE(ct.feedback_rating, 0) as feedback_rating,
          COALESCE(ct.timestamp, NOW()) as last_checked,
          p.current_price as our_price,
          CASE 
            WHEN ct.price IS NULL THEN 0
            ELSE ROUND(((ct.price - p.current_price) / p.current_price * 100), 2)
          END as price_difference_pct,
          CASE 
            WHEN ct.seller_name = 'Sua Loja' THEN 'Você tem a Buy Box!'
            WHEN ct.seller_name IS NULL THEN 'Produto sem Buy Box ativa'
            ELSE CONCAT('Buy Box com ', ct.seller_name)
          END as status_message
        FROM products p
        LEFT JOIN LATERAL (
          SELECT * FROM competitor_tracking 
          WHERE asin = p.asin 
          AND is_buy_box_winner = true
          ORDER BY timestamp DESC 
          LIMIT 1
        ) ct ON true
      `);
      
      console.log('✅ View criada com sucesso!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkBuyBoxView();