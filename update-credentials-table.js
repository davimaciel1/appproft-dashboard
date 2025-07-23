const { executeSQL } = require('./DATABASE_ACCESS_CONFIG');

async function updateCredentialsTable() {
  console.log('=== ATUALIZANDO TABELA DE CREDENCIAIS ===\n');
  
  try {
    // 1. Verificar se a tabela existe e sua estrutura
    const tableCheck = await executeSQL(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'marketplace_credentials'
      ORDER BY ordinal_position
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ Tabela marketplace_credentials não existe. Criando...');
      
      // Criar tabela com estrutura completa
      await executeSQL(`
        CREATE TABLE marketplace_credentials (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          marketplace VARCHAR(50) NOT NULL,
          client_id VARCHAR(255),
          client_secret TEXT,
          refresh_token TEXT,
          access_token TEXT,
          seller_id VARCHAR(255),
          marketplace_id VARCHAR(255),
          token_expires_at TIMESTAMP,
          credentials JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, marketplace)
        )
      `);
      
      console.log('✅ Tabela criada com sucesso!');
    } else {
      console.log('📋 Estrutura atual da tabela:');
      console.table(tableCheck.rows);
      
      // Adicionar colunas que podem estar faltando
      const columns = tableCheck.rows.map(r => r.column_name);
      
      if (!columns.includes('client_id')) {
        await executeSQL('ALTER TABLE marketplace_credentials ADD COLUMN client_id VARCHAR(255)');
        console.log('✅ Coluna client_id adicionada');
      }
      
      if (!columns.includes('client_secret')) {
        await executeSQL('ALTER TABLE marketplace_credentials ADD COLUMN client_secret TEXT');
        console.log('✅ Coluna client_secret adicionada');
      }
      
      if (!columns.includes('refresh_token')) {
        await executeSQL('ALTER TABLE marketplace_credentials ADD COLUMN refresh_token TEXT');
        console.log('✅ Coluna refresh_token adicionada');
      }
      
      if (!columns.includes('access_token')) {
        await executeSQL('ALTER TABLE marketplace_credentials ADD COLUMN access_token TEXT');
        console.log('✅ Coluna access_token adicionada');
      }
      
      if (!columns.includes('seller_id')) {
        await executeSQL('ALTER TABLE marketplace_credentials ADD COLUMN seller_id VARCHAR(255)');
        console.log('✅ Coluna seller_id adicionada');
      }
      
      if (!columns.includes('marketplace_id')) {
        await executeSQL('ALTER TABLE marketplace_credentials ADD COLUMN marketplace_id VARCHAR(255)');
        console.log('✅ Coluna marketplace_id adicionada');
      }
      
      if (!columns.includes('token_expires_at')) {
        await executeSQL('ALTER TABLE marketplace_credentials ADD COLUMN token_expires_at TIMESTAMP');
        console.log('✅ Coluna token_expires_at adicionada');
      }
    }
    
    // 2. Criar índices para melhor performance
    console.log('\n🔧 Criando índices...');
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_user_id 
      ON marketplace_credentials(user_id)
    `);
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_marketplace 
      ON marketplace_credentials(marketplace)
    `);
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_expires 
      ON marketplace_credentials(token_expires_at)
    `);
    
    console.log('✅ Índices criados!');
    
    // 3. Verificar dados existentes
    const existingData = await executeSQL('SELECT COUNT(*) FROM marketplace_credentials');
    console.log(`\n📊 Total de credenciais cadastradas: ${existingData.rows[0].count}`);
    
    if (existingData.rows[0].count > 0) {
      const credentials = await executeSQL(`
        SELECT 
          user_id,
          marketplace,
          CASE 
            WHEN client_id IS NOT NULL THEN 'Configurado'
            ELSE 'Não configurado'
          END as status
        FROM marketplace_credentials
      `);
      console.table(credentials.rows);
    }
    
    console.log('\n✅ Tabela marketplace_credentials pronta para uso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

updateCredentialsTable();