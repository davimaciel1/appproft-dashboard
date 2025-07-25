const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkBuyBoxColumns() {
  console.log('🔍 Verificando estrutura da tabela buy_box_winners...\n');

  try {
    // Verificar estrutura atual
    const columns = await executeSQL(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'buy_box_winners'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas atuais:');
    columns.rows.forEach(col => {
      const type = col.character_maximum_length 
        ? `${col.data_type}(${col.character_maximum_length})`
        : col.data_type;
      console.log(`  - ${col.column_name}: ${type}`);
    });
    
    // Verificar colunas importantes
    const columnNames = columns.rows.map(c => c.column_name);
    
    console.log('\n❓ Verificação de colunas importantes:');
    const requiredColumns = {
      'buy_box_winner_name': 'Nome do vendedor com Buy Box',
      'product_name': 'Nome do produto',
      'product_image_url': 'URL da imagem do produto'
    };
    
    const missingColumns = [];
    for (const [column, description] of Object.entries(requiredColumns)) {
      if (columnNames.includes(column)) {
        console.log(`  ✅ ${column} - ${description}`);
      } else {
        console.log(`  ❌ ${column} - ${description} (FALTANDO)`);
        missingColumns.push(column);
      }
    }
    
    // Se houver colunas faltando, adicionar
    if (missingColumns.length > 0) {
      console.log('\n🔧 Adicionando colunas faltantes...');
      
      for (const column of missingColumns) {
        try {
          if (column === 'buy_box_winner_name') {
            await executeSQL(`
              ALTER TABLE buy_box_winners 
              ADD COLUMN buy_box_winner_name VARCHAR(255)
            `);
            console.log(`  ✅ Adicionada: ${column}`);
          } else if (column === 'product_name') {
            await executeSQL(`
              ALTER TABLE buy_box_winners 
              ADD COLUMN product_name VARCHAR(500)
            `);
            console.log(`  ✅ Adicionada: ${column}`);
          } else if (column === 'product_image_url') {
            await executeSQL(`
              ALTER TABLE buy_box_winners 
              ADD COLUMN product_image_url TEXT
            `);
            console.log(`  ✅ Adicionada: ${column}`);
          }
        } catch (err) {
          console.log(`  ⚠️ Erro ao adicionar ${column}: ${err.message}`);
        }
      }
      
      console.log('\n📊 Atualizando dados existentes...');
      
      // Atualizar nomes e imagens dos produtos
      await executeSQL(`
        UPDATE buy_box_winners bw
        SET 
          product_name = p.name,
          product_image_url = p.image_url
        FROM products p
        WHERE bw.product_asin = p.asin
        AND (bw.product_name IS NULL OR bw.product_image_url IS NULL)
      `);
      
      console.log('  ✅ Dados dos produtos atualizados');
      
      // Atualizar nome do vendedor para Connect Brands onde aplicável
      await executeSQL(`
        UPDATE buy_box_winners
        SET buy_box_winner_name = 'Connect Brands'
        WHERE is_winner = true
        AND (buy_box_winner_name IS NULL OR buy_box_winner_name = 'A27IMS7TINM85N')
      `);
      
      console.log('  ✅ Nome do vendedor atualizado');
    }
    
    // Mostrar amostra dos dados
    console.log('\n📊 Amostra dos dados atualizados:');
    
    const sample = await executeSQL(`
      SELECT 
        product_asin,
        SUBSTRING(product_name, 1, 40) || '...' as product_name_short,
        CASE 
          WHEN product_image_url IS NOT NULL THEN '✅ Tem imagem'
          ELSE '❌ Sem imagem'
        END as has_image,
        COALESCE(buy_box_winner_name, buy_box_winner_id, 'N/A') as winner,
        is_winner,
        buy_box_price
      FROM buy_box_winners
      WHERE buy_box_price IS NOT NULL
      ORDER BY is_winner DESC, product_asin
      LIMIT 10
    `);
    
    console.table(sample.rows);
    
    // Estatísticas finais
    const stats = await executeSQL(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN product_name IS NOT NULL THEN 1 END) as with_name,
        COUNT(CASE WHEN product_image_url IS NOT NULL THEN 1 END) as with_image,
        COUNT(CASE WHEN buy_box_winner_name IS NOT NULL THEN 1 END) as with_winner_name
      FROM buy_box_winners
    `);
    
    console.log('\n📈 Estatísticas finais:');
    const s = stats.rows[0];
    console.log(`  Total de produtos: ${s.total_products}`);
    console.log(`  Com nome: ${s.with_name} (${Math.round(s.with_name/s.total_products*100)}%)`);
    console.log(`  Com imagem: ${s.with_image} (${Math.round(s.with_image/s.total_products*100)}%)`);
    console.log(`  Com nome do vendedor: ${s.with_winner_name} (${Math.round(s.with_winner_name/s.total_products*100)}%)`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

checkBuyBoxColumns();