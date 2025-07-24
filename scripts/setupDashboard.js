const pool = require('../server/db/pool');
const fs = require('fs').promises;
const path = require('path');
const MainSyncWorker = require('../workers/mainSyncWorker');

async function setupDashboard() {
  console.log('🚀 Configurando AppProft Dashboard v3.0...\n');
  
  try {
    // 1. Verificar conexão com banco
    console.log('📊 Testando conexão com PostgreSQL...');
    const dbOk = await testDatabase();
    if (!dbOk) {
      console.error('❌ Configure DATABASE_URL no .env');
      console.error('   Exemplo: DATABASE_URL=postgresql://user:password@localhost:5432/database');
      process.exit(1);
    }
    console.log('✅ PostgreSQL conectado com sucesso');
    
    // 2. Criar estrutura do banco
    console.log('\n🏗️  Criando estrutura do banco de dados...');
    await createTables();
    console.log('✅ Tabelas criadas/atualizadas');
    
    // 3. Verificar APIs
    console.log('\n🔑 Verificando credenciais das APIs...');
    const apiResults = await checkAPICredentials();
    
    if (!apiResults.hasAnyCredentials) {
      console.error('❌ Configure as credenciais das APIs no .env ou banco de dados');
      console.error('   Pelo menos uma API (Amazon ou Mercado Livre) deve estar configurada');
      process.exit(1);
    }
    
    if (apiResults.amazon) {
      console.log('✅ Amazon SP-API configurada');
    }
    if (apiResults.mercadolivre) {
      console.log('✅ Mercado Livre API configurada');
    }
    
    // 4. Verificar se há tenants
    const tenants = await getTenants();
    if (tenants.length === 0) {
      console.log('\n⚠️  Nenhum tenant encontrado');
      console.log('   Cadastre suas credenciais através da interface ou configure no banco');
      console.log('   O worker aguardará até que credenciais sejam adicionadas');
    } else {
      console.log(`\n👥 Encontrados ${tenants.length} tenant(s) configurado(s)`);
    }
    
    // 5. Iniciar sincronização
    console.log('\n🔄 Preparando sistema de sincronização...');
    console.log('⏳ Isso pode levar alguns minutos na primeira execução...\n');
    
    // Executar setup em background para não bloquear
    setupSync().catch(error => {
      console.error('❌ Erro no setup de sincronização:', error.message);
    });
    
    console.log('✅ Setup do AppProft Dashboard concluído!');
    console.log('\n📊 URLs importantes:');
    console.log('🎯 Dashboard: http://localhost:3000/dashboard');
    console.log('📈 API Status: http://localhost:3000/api/status');
    console.log('🔄 Sync Status: http://localhost:3000/api/sync/status');
    console.log('\n💡 Para monitorar a sincronização:');
    console.log('   npm run sync:status');
    console.log('   npm run sync:force (para forçar sincronização)');
    
  } catch (error) {
    console.error('\n❌ Erro durante setup:', error.message);
    process.exit(1);
  }
}

async function testDatabase() {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Erro de conexão DB:', error.message);
    return false;
  }
}

async function createTables() {
  try {
    const schemaPath = path.join(__dirname, '../server/db/schema-v3.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    
    // Executar schema em partes para evitar problemas de transação
    const statements = schemaSql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
        } catch (error) {
          // Ignorar erros de "already exists"
          if (!error.message.includes('already exists')) {
            console.warn('Warning ao executar statement:', error.message);
          }
        }
      }
    }
    
  } catch (error) {
    throw new Error(`Erro ao criar tabelas: ${error.message}`);
  }
}

async function checkAPICredentials() {
  const results = {
    amazon: false,
    mercadolivre: false,
    hasAnyCredentials: false
  };
  
  try {
    // Verificar credenciais Amazon
    const amazonCreds = await pool.query(`
      SELECT COUNT(*) as count 
      FROM marketplace_credentials 
      WHERE marketplace = 'amazon' 
      AND refresh_token IS NOT NULL
    `);
    results.amazon = amazonCreds.rows[0].count > 0;
    
    // Verificar credenciais Mercado Livre
    const mlCreds = await pool.query(`
      SELECT COUNT(*) as count 
      FROM marketplace_credentials 
      WHERE marketplace = 'mercadolivre' 
      AND refresh_token IS NOT NULL
    `);
    results.mercadolivre = mlCreds.rows[0].count > 0;
    
    results.hasAnyCredentials = results.amazon || results.mercadolivre;
    
  } catch (error) {
    console.warn('Erro ao verificar credenciais:', error.message);
  }
  
  return results;
}

async function getTenants() {
  try {
    const result = await pool.query(`
      SELECT DISTINCT user_id 
      FROM marketplace_credentials 
      WHERE refresh_token IS NOT NULL
    `);
    return result.rows;
  } catch (error) {
    return [];
  }
}

async function setupSync() {
  try {
    // Inicializar worker de sincronização
    const syncWorker = new MainSyncWorker();
    
    // Verificar se há dados para sincronizar
    const tenants = await getTenants();
    
    if (tenants.length > 0) {
      console.log('🔄 Iniciando sincronização inicial para todos os tenants...');
      
      for (const tenant of tenants) {
        console.log(`\n📊 Sincronizando tenant: ${tenant.user_id}`);
        try {
          await syncWorker.triggerSync(tenant.user_id);
          console.log(`✅ Tenant ${tenant.user_id} sincronizado`);
        } catch (error) {
          console.error(`❌ Erro ao sincronizar tenant ${tenant.user_id}:`, error.message);
        }
      }
      
      console.log('\n🎉 Sincronização inicial concluída!');
      console.log('🔄 Worker de sincronização contínua ativo (60s intervalo)');
    } else {
      console.log('⏳ Aguardando configuração de credenciais...');
    }
    
    // Iniciar worker em modo contínuo
    await syncWorker.start();
    
  } catch (error) {
    console.error('Erro no setup de sincronização:', error.message);
  }
}

// Adicionar comandos úteis
async function showStatus() {
  try {
    const tenants = await getTenants();
    console.log(`\n📊 Status do AppProft Dashboard:`);
    console.log(`👥 Tenants configurados: ${tenants.length}`);
    
    for (const tenant of tenants) {
      const products = await pool.query(
        'SELECT COUNT(*) as count FROM products WHERE tenant_id = $1',
        [tenant.user_id]
      );
      
      const orders = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE tenant_id = $1',
        [tenant.user_id]
      );
      
      const lastSync = await pool.query(
        `SELECT MAX(completed_at) as last_sync 
         FROM sync_logs 
         WHERE tenant_id = $1 AND status = 'completed'`,
        [tenant.user_id]
      );
      
      console.log(`\n🏢 Tenant: ${tenant.user_id}`);
      console.log(`   📦 Produtos: ${products.rows[0].count}`);
      console.log(`   🛒 Pedidos: ${orders.rows[0].count}`);
      console.log(`   🔄 Última sincronização: ${lastSync.rows[0].last_sync || 'Nunca'}`);
    }
    
  } catch (error) {
    console.error('Erro ao mostrar status:', error.message);
  }
}

// Executar baseado em argumentos
const command = process.argv[2];

switch (command) {
  case 'status':
    showStatus();
    break;
  case 'setup':
  default:
    setupDashboard();
    break;
}

module.exports = {
  setupDashboard,
  showStatus,
  testDatabase,
  createTables
};