// Script para recriar as tabelas de tokens com constraints corretas

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function recreateTokensTables() {
  console.log('🔄 RECRIANDO TABELAS DE TOKENS');
  console.log('='.repeat(50));
  
  try {
    // 1. Fazer backup dos dados existentes
    console.log('1️⃣ Fazendo backup dos dados...');
    
    const marketplaceTokensBackup = await executeSQL(`
      SELECT * FROM marketplace_tokens
    `);
    console.log(`   Backup marketplace_tokens: ${marketplaceTokensBackup.rows.length} registros`);
    
    const tokensStorageBackup = await executeSQL(`
      SELECT * FROM tokens_storage
    `);
    console.log(`   Backup tokens_storage: ${tokensStorageBackup.rows.length} registros`);

    // 2. Remover tabelas antigas
    console.log('\n2️⃣ Removendo tabelas antigas...');
    
    await executeSQL(`
      DROP TABLE IF EXISTS marketplace_tokens CASCADE;
      DROP TABLE IF EXISTS tokens_storage CASCADE;
    `);
    console.log('   ✅ Tabelas removidas');

    // 3. Criar tabelas com estrutura correta
    console.log('\n3️⃣ Criando novas tabelas...');
    
    // marketplace_tokens
    await executeSQL(`
      CREATE TABLE marketplace_tokens (
        id SERIAL PRIMARY KEY,
        marketplace VARCHAR(50) NOT NULL,
        tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMP,
        token_type VARCHAR(50) DEFAULT 'Bearer',
        scope TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Criar constraint única
      ALTER TABLE marketplace_tokens 
      ADD CONSTRAINT marketplace_tokens_marketplace_tenant_id_key 
      UNIQUE (marketplace, tenant_id);
      
      -- Criar índice
      CREATE INDEX idx_marketplace_tokens_lookup 
      ON marketplace_tokens(marketplace, tenant_id);
    `);
    console.log('   ✅ marketplace_tokens criada');

    // tokens_storage
    await executeSQL(`
      CREATE TABLE tokens_storage (
        id SERIAL PRIMARY KEY,
        service VARCHAR(50) NOT NULL,
        tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMP,
        profile_id VARCHAR(100),
        region VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Criar constraint única
      ALTER TABLE tokens_storage 
      ADD CONSTRAINT tokens_storage_service_tenant_id_key 
      UNIQUE (service, tenant_id);
      
      -- Criar índice
      CREATE INDEX idx_tokens_storage_lookup 
      ON tokens_storage(service, tenant_id);
    `);
    console.log('   ✅ tokens_storage criada');

    // 4. Restaurar dados únicos
    console.log('\n4️⃣ Restaurando dados únicos...');
    
    // Restaurar marketplace_tokens (apenas registros únicos)
    const uniqueMarketplaceTokens = {};
    for (const token of marketplaceTokensBackup.rows) {
      const key = `${token.marketplace}-${token.tenant_id || 'default'}`;
      if (!uniqueMarketplaceTokens[key] || 
          new Date(token.updated_at) > new Date(uniqueMarketplaceTokens[key].updated_at)) {
        uniqueMarketplaceTokens[key] = token;
      }
    }
    
    for (const token of Object.values(uniqueMarketplaceTokens)) {
      await executeSQL(`
        INSERT INTO marketplace_tokens (
          marketplace, tenant_id, access_token, refresh_token, 
          expires_at, token_type, scope, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        token.marketplace,
        token.tenant_id || 'default',
        token.access_token,
        token.refresh_token,
        token.expires_at,
        token.token_type || 'Bearer',
        token.scope,
        token.created_at,
        token.updated_at
      ]);
    }
    console.log(`   ✅ ${Object.keys(uniqueMarketplaceTokens).length} tokens restaurados em marketplace_tokens`);

    // Restaurar tokens_storage (apenas registros únicos)
    const uniqueTokensStorage = {};
    for (const token of tokensStorageBackup.rows) {
      const key = `${token.service}-${token.tenant_id || 'default'}`;
      if (!uniqueTokensStorage[key] || 
          new Date(token.updated_at) > new Date(uniqueTokensStorage[key].updated_at)) {
        uniqueTokensStorage[key] = token;
      }
    }
    
    for (const token of Object.values(uniqueTokensStorage)) {
      await executeSQL(`
        INSERT INTO tokens_storage (
          service, tenant_id, access_token, refresh_token,
          expires_at, profile_id, region, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        token.service,
        token.tenant_id || 'default',
        token.access_token,
        token.refresh_token,
        token.expires_at,
        token.profile_id,
        token.region,
        token.created_at,
        token.updated_at
      ]);
    }
    console.log(`   ✅ ${Object.keys(uniqueTokensStorage).length} tokens restaurados em tokens_storage`);

    // 5. Verificar estrutura final
    console.log('\n5️⃣ Verificando estrutura final...');
    
    const constraints = await executeSQL(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_name IN ('marketplace_tokens', 'tokens_storage')
      AND tc.constraint_type = 'UNIQUE'
      ORDER BY tc.table_name;
    `);
    
    console.log('\n📋 Constraints criadas:');
    for (const row of constraints.rows) {
      console.log(`   ${row.table_name}: ${row.constraint_name}`);
    }

    console.log('\n✅ Tabelas de tokens recriadas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  recreateTokensTables();
}

module.exports = recreateTokensTables;