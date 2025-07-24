const MainSyncWorker = require('../workers/mainSyncWorker');
const pool = require('../server/db/pool');

async function forceSyncAll() {
  console.log('🔄 Forçando sincronização completa para todos os tenants...\n');
  
  try {
    // Buscar todos os tenants
    const result = await pool.query(`
      SELECT DISTINCT user_id as tenant_id 
      FROM marketplace_credentials 
      WHERE refresh_token IS NOT NULL
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nenhum tenant com credenciais válidas encontrado');
      console.log('   Configure as credenciais no banco ou através da interface');
      process.exit(1);
    }
    
    console.log(`👥 Encontrados ${result.rows.length} tenant(s) para sincronizar\n`);
    
    const syncWorker = new MainSyncWorker();
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const tenant of result.rows) {
      console.log(`🔄 Sincronizando tenant: ${tenant.tenant_id}`);
      
      try {
        await syncWorker.triggerSync(tenant.tenant_id);
        console.log(`✅ Tenant ${tenant.tenant_id} sincronizado com sucesso`);
        totalSuccess++;
      } catch (error) {
        console.error(`❌ Erro ao sincronizar tenant ${tenant.tenant_id}:`, error.message);
        totalErrors++;
      }
      
      console.log(''); // Linha em branco
    }
    
    console.log('📊 Resumo da sincronização:');
    console.log(`✅ Sucessos: ${totalSuccess}`);
    console.log(`❌ Erros: ${totalErrors}`);
    console.log(`📊 Total: ${result.rows.length}`);
    
    if (totalSuccess > 0) {
      console.log('\n🎉 Sincronização concluída! Verifique o dashboard em:');
      console.log('   http://localhost:3000/dashboard');
    }
    
  } catch (error) {
    console.error('❌ Erro durante sincronização forçada:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Executar
forceSyncAll();