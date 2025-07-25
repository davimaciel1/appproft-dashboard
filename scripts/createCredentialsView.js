// Script para criar view de compatibilidade com marketplace_credentials

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createCredentialsView() {
  console.log('🔧 CRIANDO VIEW DE COMPATIBILIDADE');
  console.log('='.repeat(50));
  
  try {
    // 1. Verificar se a tabela marketplace_credentials existe
    console.log('1️⃣ Verificando se marketplace_credentials existe...');
    const tableExists = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'marketplace_credentials'
      )
    `);

    if (tableExists.rows[0].exists) {
      console.log('   ✅ Tabela marketplace_credentials já existe');
      
      // Verificar se tem a estrutura correta
      const columns = await executeSQL(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'marketplace_credentials'
        ORDER BY ordinal_position
      `);
      
      console.log('   Colunas:', columns.rows.map(r => r.column_name).join(', '));
      
    } else {
      console.log('   ⚠️ Tabela não existe. Criando tabela real...');
      
      // Criar tabela marketplace_credentials que o sistema espera
      await executeSQL(`
        CREATE TABLE marketplace_credentials (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL DEFAULT 1,
          marketplace VARCHAR(50) NOT NULL,
          client_id VARCHAR(255),
          client_secret VARCHAR(255),
          access_token TEXT,
          refresh_token TEXT,
          expires_at TIMESTAMP,
          seller_id VARCHAR(100),
          marketplace_id VARCHAR(100),
          store_name VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, marketplace)
        );
        
        -- Criar índice
        CREATE INDEX idx_marketplace_credentials_lookup 
        ON marketplace_credentials(user_id, marketplace);
      `);
      
      console.log('   ✅ Tabela marketplace_credentials criada');
    }

    // 2. Copiar dados da marketplace_tokens se existirem
    console.log('\n2️⃣ Sincronizando dados com marketplace_tokens...');
    
    const tokensData = await executeSQL(`
      SELECT * FROM marketplace_tokens WHERE tenant_id = 'default'
    `);
    
    if (tokensData.rows.length > 0) {
      console.log(`   Encontrados ${tokensData.rows.length} tokens para sincronizar`);
      
      for (const token of tokensData.rows) {
        await executeSQL(`
          INSERT INTO marketplace_credentials (
            user_id, marketplace, access_token, refresh_token, expires_at
          ) VALUES (1, $1, $2, $3, $4)
          ON CONFLICT (user_id, marketplace) 
          DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()
        `, [token.marketplace, token.access_token, token.refresh_token, token.expires_at]);
      }
      
      console.log('   ✅ Dados sincronizados');
    } else {
      console.log('   ℹ️ Nenhum token para sincronizar');
    }

    // 3. Adicionar credenciais do .env se não existirem
    console.log('\n3️⃣ Verificando credenciais do ambiente...');
    
    // Amazon
    if (process.env.AMAZON_CLIENT_ID && process.env.AMAZON_REFRESH_TOKEN) {
      const amazonExists = await executeSQL(`
        SELECT id FROM marketplace_credentials 
        WHERE user_id = 1 AND marketplace = 'amazon'
      `);
      
      if (amazonExists.rows.length === 0) {
        console.log('   Adicionando credenciais da Amazon...');
        await executeSQL(`
          INSERT INTO marketplace_credentials (
            user_id, marketplace, client_id, client_secret, 
            refresh_token, seller_id, marketplace_id
          ) VALUES (1, 'amazon', $1, $2, $3, $4, $5)
        `, [
          process.env.AMAZON_CLIENT_ID,
          process.env.AMAZON_CLIENT_SECRET,
          process.env.AMAZON_REFRESH_TOKEN,
          process.env.AMAZON_SELLER_ID,
          process.env.SP_API_MARKETPLACE_ID
        ]);
        console.log('   ✅ Credenciais Amazon adicionadas');
      } else {
        console.log('   ✅ Credenciais Amazon já existem');
      }
    }

    // Mercado Livre
    if (process.env.ML_CLIENT_ID && process.env.ML_REFRESH_TOKEN) {
      const mlExists = await executeSQL(`
        SELECT id FROM marketplace_credentials 
        WHERE user_id = 1 AND marketplace = 'mercadolivre'
      `);
      
      if (mlExists.rows.length === 0) {
        console.log('   Adicionando credenciais do Mercado Livre...');
        await executeSQL(`
          INSERT INTO marketplace_credentials (
            user_id, marketplace, client_id, client_secret, 
            refresh_token, seller_id
          ) VALUES (1, 'mercadolivre', $1, $2, $3, $4)
        `, [
          process.env.ML_CLIENT_ID,
          process.env.ML_CLIENT_SECRET,
          process.env.ML_REFRESH_TOKEN,
          process.env.ML_SELLER_ID
        ]);
        console.log('   ✅ Credenciais Mercado Livre adicionadas');
      } else {
        console.log('   ✅ Credenciais Mercado Livre já existem');
      }
    }

    // 4. Verificar resultado final
    console.log('\n4️⃣ Verificando dados finais...');
    const finalData = await executeSQL(`
      SELECT 
        marketplace,
        CASE WHEN client_id IS NOT NULL THEN '✓' ELSE '✗' END as has_client_id,
        CASE WHEN refresh_token IS NOT NULL THEN '✓' ELSE '✗' END as has_refresh_token,
        CASE WHEN access_token IS NOT NULL THEN '✓' ELSE '✗' END as has_access_token
      FROM marketplace_credentials
      WHERE user_id = 1
    `);
    
    console.log('\n📊 Status das credenciais:');
    console.log('Marketplace | Client ID | Refresh Token | Access Token');
    console.log('-'.repeat(55));
    for (const row of finalData.rows) {
      console.log(`${row.marketplace.padEnd(15)} | ${row.has_client_id.padEnd(9)} | ${row.has_refresh_token.padEnd(13)} | ${row.has_access_token}`);
    }

    console.log('\n✅ Configuração de credenciais concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createCredentialsView();
}

module.exports = createCredentialsView;