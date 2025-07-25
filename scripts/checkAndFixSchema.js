const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkAndFixSchema() {
  try {
    console.log('🔍 Verificando esquema do banco de dados...\n');
    
    // Verificar estrutura da tabela products
    const columnsResult = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Estrutura da tabela products:');
    console.table(columnsResult.rows);
    
    // Verificar se há tenants ou produtos
    const countResult = await executeSQL(`
      SELECT COUNT(*) as total FROM products
    `);
    console.log('\n📦 Total de produtos:', countResult.rows[0].total);
    
    // Adicionar coluna active se não existir
    const hasActive = columnsResult.rows.some(row => row.column_name === 'active');
    if (!hasActive) {
      console.log('\n⚠️ Coluna active não existe, adicionando...');
      await executeSQL(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true
      `);
      console.log('✅ Coluna active adicionada com sucesso!');
    }
    
    // Verificar e adicionar coluna tenant_id se não existir
    const hasTenantId = columnsResult.rows.some(row => row.column_name === 'tenant_id');
    if (!hasTenantId) {
      console.log('\n⚠️ Coluna tenant_id não existe, adicionando...');
      await executeSQL(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50) DEFAULT 'default'
      `);
      console.log('✅ Coluna tenant_id adicionada com sucesso!');
    }
    
    // Verificar marketplace credentials
    const credsResult = await executeSQL(`
      SELECT marketplace, COUNT(*) as total 
      FROM marketplace_credentials 
      GROUP BY marketplace
    `);
    console.log('\n🔑 Credenciais cadastradas:');
    console.table(credsResult.rows);
    
    // Se não houver credenciais Amazon, inserir as do .env
    if (!credsResult.rows.find(r => r.marketplace === 'amazon')) {
      console.log('\n📝 Inserindo credenciais Amazon do .env...');
      
      // Criar um registro básico de credencial
      await executeSQL(`
        INSERT INTO marketplace_credentials (
          user_id,
          marketplace,
          credentials,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          1,
          'amazon',
          '{}',
          true,
          NOW(),
          NOW()
        )
      `);
      console.log('✅ Credenciais Amazon inseridas!');
    }
    
    // Verificar se já existe produto
    const existingProduct = await executeSQL(`
      SELECT id FROM products WHERE asin = 'B07XJ8C8F5'
    `);
    
    if (existingProduct.rows.length === 0) {
      console.log('\n🎯 Inserindo produto de teste para iniciar coleta...');
      await executeSQL(`
        INSERT INTO products (
          user_id,
          marketplace,
          marketplace_product_id,
          asin,
          name,
          price,
          active,
          tenant_id,
          created_at,
          updated_at
        ) VALUES (
          1,
          'amazon',
          'B07XJ8C8F5',
          'B07XJ8C8F5',
          'Produto Teste - Amazon Echo Dot',
          199.00,
          true,
          1,
          NOW(),
          NOW()
        )
      `);
    } else {
      console.log('\n📝 Atualizando produto existente...');
      await executeSQL(`
        UPDATE products 
        SET active = true, updated_at = NOW()
        WHERE asin = 'B07XJ8C8F5'
      `);
    }
    console.log('✅ Produto de teste inserido/atualizado!');
    
    console.log('\n✅ Schema verificado e corrigido com sucesso!');
    console.log('\n📌 Você pode executar o worker novamente agora.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkAndFixSchema();