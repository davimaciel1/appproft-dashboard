// Script para corrigir a tabela de tokens

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function fixTokensTable() {
  console.log('🔧 CORRIGINDO TABELA DE TOKENS');
  console.log('='.repeat(50));
  
  try {
    // 1. Verificar se a tabela existe
    console.log('1️⃣ Verificando tabela marketplace_tokens...');
    const tableExists = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'marketplace_tokens'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('⚠️ Tabela não existe. Criando...');
      
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
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(marketplace, tenant_id)
        )
      `);
      
      console.log('✅ Tabela marketplace_tokens criada');
    } else {
      console.log('✅ Tabela já existe');
      
      // Verificar se a constraint única existe
      const constraintExists = await executeSQL(`
        SELECT EXISTS (
          SELECT 1 
          FROM pg_constraint 
          WHERE conname = 'marketplace_tokens_marketplace_tenant_id_key'
        )
      `);
      
      if (!constraintExists.rows[0].exists) {
        console.log('⚠️ Constraint única não existe. Criando...');
        
        // Remover duplicatas antes de criar a constraint
        await executeSQL(`
          DELETE FROM marketplace_tokens a
          USING marketplace_tokens b
          WHERE a.id < b.id 
          AND a.marketplace = b.marketplace 
          AND a.tenant_id = b.tenant_id
        `);
        
        // Criar constraint única
        await executeSQL(`
          ALTER TABLE marketplace_tokens 
          ADD CONSTRAINT marketplace_tokens_marketplace_tenant_id_key 
          UNIQUE (marketplace, tenant_id)
        `);
        
        console.log('✅ Constraint única criada');
      }
    }

    // 2. Verificar tabela tokens_storage (usada pelo advertising)
    console.log('\n2️⃣ Verificando tabela tokens_storage...');
    const tokensStorageExists = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tokens_storage'
      )
    `);

    if (!tokensStorageExists.rows[0].exists) {
      console.log('⚠️ Tabela tokens_storage não existe. Criando...');
      
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
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(service, tenant_id)
        )
      `);
      
      console.log('✅ Tabela tokens_storage criada');
    } else {
      console.log('✅ Tabela tokens_storage já existe');
      
      // Verificar constraint
      const tokensConstraintExists = await executeSQL(`
        SELECT EXISTS (
          SELECT 1 
          FROM pg_constraint 
          WHERE conname = 'tokens_storage_service_tenant_id_key'
        )
      `);
      
      if (!tokensConstraintExists.rows[0].exists) {
        console.log('⚠️ Constraint única não existe em tokens_storage. Criando...');
        
        // Verificar se coluna tenant_id existe
        const tenantIdExists = await executeSQL(`
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'tokens_storage' 
            AND column_name = 'tenant_id'
          )
        `);
        
        if (!tenantIdExists.rows[0].exists) {
          console.log('⚠️ Coluna tenant_id não existe. Adicionando...');
          await executeSQL(`
            ALTER TABLE tokens_storage 
            ADD COLUMN tenant_id VARCHAR(50) NOT NULL DEFAULT 'default'
          `);
        }
        
        // Remover duplicatas
        await executeSQL(`
          DELETE FROM tokens_storage a
          USING tokens_storage b
          WHERE a.id < b.id 
          AND a.service = b.service 
          AND a.tenant_id = b.tenant_id
        `);
        
        // Criar constraint
        await executeSQL(`
          ALTER TABLE tokens_storage 
          ADD CONSTRAINT tokens_storage_service_tenant_id_key 
          UNIQUE (service, tenant_id)
        `);
        
        console.log('✅ Constraint única criada em tokens_storage');
      }
    }

    // 3. Criar índices para performance
    console.log('\n3️⃣ Criando índices...');
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_tokens_lookup 
      ON marketplace_tokens(marketplace, tenant_id);
      
      CREATE INDEX IF NOT EXISTS idx_tokens_storage_lookup 
      ON tokens_storage(service, tenant_id);
    `);
    console.log('✅ Índices criados');

    console.log('\n✅ Correção das tabelas de tokens concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixTokensTable();
}

module.exports = fixTokensTable;