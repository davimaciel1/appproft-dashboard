// Script para adicionar e popular o campo buy_box_winner_name

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function fixBuyBoxWinnerNames() {
  console.log('🔧 CORRIGINDO NOMES DOS WINNERS NA TABELA BUY_BOX_WINNERS');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar se a coluna já existe
    console.log('1️⃣ Verificando estrutura da tabela...');
    const columnCheck = await executeSQL(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'buy_box_winners' 
      AND column_name = 'buy_box_winner_name'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('⚠️ Coluna buy_box_winner_name não existe. Criando...');
      
      // Adicionar a coluna se não existir
      await executeSQL(`
        ALTER TABLE buy_box_winners 
        ADD COLUMN IF NOT EXISTS buy_box_winner_name VARCHAR(255)
      `);
      
      console.log('✅ Coluna buy_box_winner_name adicionada');
    } else {
      console.log('✅ Coluna buy_box_winner_name já existe');
    }

    // 2. Verificar registros sem nome
    console.log('\n2️⃣ Verificando registros sem nome do winner...');
    const emptyNames = await executeSQL(`
      SELECT COUNT(*) as count 
      FROM buy_box_winners 
      WHERE buy_box_winner_name IS NULL OR buy_box_winner_name = ''
    `);
    
    console.log(`   Registros sem nome: ${emptyNames.rows[0].count}`);

    // 3. Atualizar com nomes baseados no winner_id e status
    console.log('\n3️⃣ Atualizando nomes dos winners...');
    
    // Para registros onde somos o winner
    const ourWins = await executeSQL(`
      UPDATE buy_box_winners 
      SET buy_box_winner_name = 'Nossa Loja'
      WHERE is_winner = true 
      AND (buy_box_winner_name IS NULL OR buy_box_winner_name = '')
      RETURNING id
    `);
    
    console.log(`   ✅ ${ourWins.rowCount} registros atualizados como "Nossa Loja"`);

    // Para registros onde não somos o winner
    const competitorWins = await executeSQL(`
      UPDATE buy_box_winners 
      SET buy_box_winner_name = CASE 
        WHEN buy_box_winner_id IS NOT NULL AND buy_box_winner_id != '' 
        THEN 'Vendedor ' || buy_box_winner_id
        ELSE 'Outro Vendedor'
      END
      WHERE is_winner = false 
      AND (buy_box_winner_name IS NULL OR buy_box_winner_name = '')
      RETURNING id
    `);
    
    console.log(`   ✅ ${competitorWins.rowCount} registros atualizados como competidores`);

    // 4. Criar índice para melhor performance
    console.log('\n4️⃣ Criando índice para melhor performance...');
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_buy_box_winner_name 
      ON buy_box_winners(buy_box_winner_name)
    `);
    console.log('✅ Índice criado');

    // 5. Mostrar estatísticas finais
    console.log('\n5️⃣ Estatísticas finais:');
    const stats = await executeSQL(`
      SELECT 
        buy_box_winner_name,
        COUNT(*) as total,
        COUNT(CASE WHEN is_winner = true THEN 1 END) as nossos_buy_box,
        COUNT(CASE WHEN is_winner = false THEN 1 END) as perdidos
      FROM buy_box_winners
      WHERE buy_box_winner_name IS NOT NULL
      GROUP BY buy_box_winner_name
      ORDER BY total DESC
      LIMIT 10
    `);

    console.log('\n📊 Top 10 Winners:');
    console.log('Nome do Vendedor | Total | Nossos | Perdidos');
    console.log('-'.repeat(50));
    
    for (const row of stats.rows) {
      console.log(`${row.buy_box_winner_name.padEnd(20)} | ${row.total.toString().padEnd(5)} | ${row.nossos_buy_box.toString().padEnd(6)} | ${row.perdidos}`);
    }

    // 6. Criar trigger para futuros registros
    console.log('\n6️⃣ Criando trigger para popular automaticamente...');
    await executeSQL(`
      CREATE OR REPLACE FUNCTION set_buy_box_winner_name()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.buy_box_winner_name IS NULL OR NEW.buy_box_winner_name = '' THEN
          IF NEW.is_winner = true THEN
            NEW.buy_box_winner_name := 'Nossa Loja';
          ELSIF NEW.buy_box_winner_id IS NOT NULL AND NEW.buy_box_winner_id != '' THEN
            NEW.buy_box_winner_name := 'Vendedor ' || NEW.buy_box_winner_id;
          ELSE
            NEW.buy_box_winner_name := 'Outro Vendedor';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await executeSQL(`
      DROP TRIGGER IF EXISTS set_winner_name_trigger ON buy_box_winners;
      
      CREATE TRIGGER set_winner_name_trigger
      BEFORE INSERT OR UPDATE ON buy_box_winners
      FOR EACH ROW
      EXECUTE FUNCTION set_buy_box_winner_name();
    `);
    
    console.log('✅ Trigger criado para popular automaticamente');

    console.log('\n✅ Correção concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixBuyBoxWinnerNames();
}

module.exports = fixBuyBoxWinnerNames;