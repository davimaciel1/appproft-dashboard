const { Pool } = require('pg');
require('dotenv').config();

async function fixDatabaseStructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
  });

  try {
    console.log('🔧 Corrigindo estrutura do banco de dados...\n');
    
    // 1. Verificar constraints existentes
    console.log('1. Verificando constraints existentes...');
    const constraints = await pool.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint 
      WHERE conrelid = 'products'::regclass
    `);
    
    console.log('Constraints encontradas:');
    constraints.rows.forEach(c => {
      console.log(`  - ${c.constraint_name}: ${c.constraint_definition}`);
    });
    
    // 2. Adicionar constraint única se não existir
    console.log('\n2. Adicionando constraint única...');
    try {
      await pool.query(`
        ALTER TABLE products 
        ADD CONSTRAINT products_marketplace_product_id_unique 
        UNIQUE (marketplace, marketplace_product_id)
      `);
      console.log('✅ Constraint única adicionada!');
    } catch (error) {
      if (error.code === '42710') { // already exists
        console.log('⚠️  Constraint já existe');
      } else {
        console.error('❌ Erro:', error.message);
      }
    }
    
    // 3. Adicionar campo tenant_id se não existir
    console.log('\n3. Verificando campos necessários...');
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    
    console.log('Campos existentes:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Adicionar campos faltantes
    const fieldsToAdd = [
      { name: 'tenant_id', type: 'INTEGER', default: null },
      { name: 'asin', type: 'VARCHAR(50)', default: null },
      { name: 'country_code', type: 'VARCHAR(2)', default: "'BR'" },
      { name: 'cost', type: 'DECIMAL(10,2)', default: '0' }
    ];
    
    for (const field of fieldsToAdd) {
      const exists = columns.rows.some(col => col.column_name === field.name);
      if (!exists) {
        const defaultClause = field.default ? `DEFAULT ${field.default}` : '';
        await pool.query(`ALTER TABLE products ADD COLUMN ${field.name} ${field.type} ${defaultClause}`);
        console.log(`✅ Campo ${field.name} adicionado`);
      }
    }
    
    // 4. Atualizar tenant_id com user_id onde estiver NULL
    console.log('\n4. Atualizando tenant_id...');
    const updateResult = await pool.query(`
      UPDATE products 
      SET tenant_id = user_id 
      WHERE tenant_id IS NULL
    `);
    console.log(`✅ ${updateResult.rowCount} registros atualizados`);
    
    // 5. Adicionar campo unit_price em order_items
    console.log('\n5. Verificando tabela order_items...');
    const orderItemsCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'order_items'
    `);
    
    const hasUnitPrice = orderItemsCols.rows.some(col => col.column_name === 'unit_price');
    if (!hasUnitPrice) {
      await pool.query(`
        ALTER TABLE order_items 
        ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0
      `);
      console.log('✅ Campo unit_price adicionado em order_items');
    }
    
    // 6. Limpar produtos duplicados
    console.log('\n6. Verificando produtos duplicados...');
    const duplicates = await pool.query(`
      SELECT marketplace, marketplace_product_id, COUNT(*) as count
      FROM products
      GROUP BY marketplace, marketplace_product_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows.length > 0) {
      console.log(`⚠️  Encontrados ${duplicates.rows.length} produtos duplicados`);
      
      // Manter apenas o mais recente
      for (const dup of duplicates.rows) {
        await pool.query(`
          DELETE FROM products 
          WHERE marketplace = $1 
            AND marketplace_product_id = $2
            AND id NOT IN (
              SELECT id FROM products 
              WHERE marketplace = $1 AND marketplace_product_id = $2
              ORDER BY updated_at DESC NULLS LAST, id DESC
              LIMIT 1
            )
        `, [dup.marketplace, dup.marketplace_product_id]);
        
        console.log(`  ✅ Removidas duplicatas de ${dup.marketplace}:${dup.marketplace_product_id}`);
      }
    }
    
    console.log('\n✅ Estrutura do banco corrigida com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  } finally {
    await pool.end();
  }
}

fixDatabaseStructure();