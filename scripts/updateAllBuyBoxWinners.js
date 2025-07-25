const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function updateAllBuyBoxWinners() {
  console.log('🔄 Atualizando todos os registros de Buy Box Winners...\n');

  try {
    // 1. Atualizar todos onde somos o winner
    console.log('📝 Atualizando produtos onde temos o Buy Box...');
    const result1 = await executeSQL(`
      UPDATE buy_box_winners
      SET buy_box_winner_name = 'Connect Brands'
      WHERE is_winner = true
      AND (buy_box_winner_name IS NULL OR buy_box_winner_name != 'Connect Brands')
    `);
    
    console.log(`  ✅ ${result1.rowCount} registros atualizados para Connect Brands`);
    
    // 2. Para produtos sem Buy Box ativo, marcar apropriadamente
    console.log('\n📝 Atualizando produtos sem ofertas ativas...');
    const result2 = await executeSQL(`
      UPDATE buy_box_winners
      SET 
        buy_box_winner_name = 'Sem ofertas ativas',
        buy_box_winner_id = NULL
      WHERE buy_box_price IS NULL
      AND buy_box_winner_name IS NULL
    `);
    
    console.log(`  ✅ ${result2.rowCount} registros marcados como sem ofertas`);
    
    // 3. Verificar se há algum registro com winner_id mas sem nome
    console.log('\n🔍 Verificando registros com ID mas sem nome...');
    const unnamed = await executeSQL(`
      SELECT 
        product_asin,
        buy_box_winner_id,
        is_winner
      FROM buy_box_winners
      WHERE buy_box_winner_id IS NOT NULL
      AND buy_box_winner_name IS NULL
    `);
    
    if (unnamed.rows.length > 0) {
      console.log(`  ⚠️ ${unnamed.rows.length} registros com ID mas sem nome`);
      
      // Tentar buscar nomes do cache
      for (const row of unnamed.rows) {
        const cached = await executeSQL(`
          SELECT seller_name 
          FROM sellers_cache 
          WHERE seller_id = $1
        `, [row.buy_box_winner_id]);
        
        if (cached.rows.length > 0) {
          await executeSQL(`
            UPDATE buy_box_winners
            SET buy_box_winner_name = $1
            WHERE product_asin = $2
          `, [cached.rows[0].seller_name, row.product_asin]);
          
          console.log(`    ✅ ${row.product_asin}: ${cached.rows[0].seller_name}`);
        }
      }
    } else {
      console.log('  ✅ Todos os registros com ID têm nome');
    }
    
    // 4. Mostrar estatísticas finais
    console.log('\n📊 ESTATÍSTICAS FINAIS:\n');
    
    const stats = await executeSQL(`
      SELECT 
        CASE 
          WHEN is_winner = true THEN '✅ Temos o Buy Box'
          WHEN buy_box_price IS NULL THEN '⚠️ Sem ofertas ativas'
          WHEN buy_box_winner_name = 'Hijacker Test Company' THEN '🧪 Teste de Hijacker'
          WHEN buy_box_winner_name IS NOT NULL THEN '❌ Competidor tem Buy Box'
          ELSE '❓ Status desconhecido'
        END as status,
        COUNT(*) as total,
        STRING_AGG(DISTINCT buy_box_winner_name, ', ') as vendedores
      FROM buy_box_winners
      GROUP BY 
        CASE 
          WHEN is_winner = true THEN '✅ Temos o Buy Box'
          WHEN buy_box_price IS NULL THEN '⚠️ Sem ofertas ativas'
          WHEN buy_box_winner_name = 'Hijacker Test Company' THEN '🧪 Teste de Hijacker'
          WHEN buy_box_winner_name IS NOT NULL THEN '❌ Competidor tem Buy Box'
          ELSE '❓ Status desconhecido'
        END
      ORDER BY total DESC
    `);
    
    console.table(stats.rows);
    
    // 5. Mostrar alguns exemplos com imagens
    console.log('\n🖼️ EXEMPLOS COM DADOS COMPLETOS:\n');
    
    const examples = await executeSQL(`
      SELECT 
        product_asin as "ASIN",
        SUBSTRING(product_name, 1, 50) || '...' as "Produto",
        CASE 
          WHEN product_image_url IS NOT NULL THEN '✅' 
          ELSE '❌' 
        END as "Img",
        COALESCE(buy_box_winner_name, 'N/A') as "Vendedor Buy Box",
        CASE 
          WHEN is_winner THEN '✅'
          ELSE '❌'
        END as "Nosso?",
        COALESCE('$' || buy_box_price::text, 'N/A') as "Preço"
      FROM buy_box_winners
      WHERE product_name IS NOT NULL
      ORDER BY 
        is_winner DESC,
        buy_box_price DESC NULLS LAST
      LIMIT 10
    `);
    
    console.table(examples.rows);
    
    console.log('\n✅ Atualização concluída!');
    console.log('💡 Agora a tabela buy_box_winners tem:');
    console.log('   - Nome do produto (product_name)');
    console.log('   - URL da imagem (product_image_url)');
    console.log('   - Nome do vendedor com Buy Box (buy_box_winner_name)');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

updateAllBuyBoxWinners();