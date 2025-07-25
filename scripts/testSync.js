const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function testSync() {
  try {
    console.log('🚀 Testando sincronização manual da Amazon...\n');
    
    // Verificar produtos ativos
    const products = await executeSQL(`
      SELECT * FROM products 
      WHERE marketplace = 'amazon' 
      AND active = true 
      LIMIT 5
    `);
    
    console.log('📦 Produtos encontrados:', products.rows.length);
    
    if (products.rows.length > 0) {
      console.log('\nPrimeiro produto:');
      console.log('- ASIN:', products.rows[0].asin);
      console.log('- Nome:', products.rows[0].name);
      console.log('- Preço:', products.rows[0].price);
      console.log('- Tenant ID:', products.rows[0].tenant_id);
    }
    
    // Verificar se as tabelas de sincronização existem
    const tables = await executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sales_metrics', 'inventory_snapshots', 'competitor_tracking_advanced', 'sync_jobs')
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tabelas de sincronização encontradas:');
    tables.rows.forEach(t => console.log('- ' + t.table_name));
    
    // Verificar se a tabela sync_jobs existe
    const hasSyncJobs = tables.rows.some(t => t.table_name === 'sync_jobs');
    
    if (!hasSyncJobs) {
      console.log('\n⚠️ Tabela sync_jobs não existe, criando...');
      await executeSQL(`
        CREATE TABLE IF NOT EXISTS sync_jobs (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER,
          job_type VARCHAR(50),
          status VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Tabela sync_jobs criada!');
    }
    
    // Inserir um job de sincronização para teste
    const jobResult = await executeSQL(`
      INSERT INTO sync_jobs (tenant_id, job_type, status, created_at)
      VALUES (1, 'amazon_full_sync', 'pending', NOW())
      RETURNING id
    `);
    
    console.log('\n✅ Job de sincronização criado com ID:', jobResult.rows[0].id);
    
    // Verificar jobs pendentes
    const pendingJobs = await executeSQL(`
      SELECT * FROM sync_jobs 
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('\n📋 Jobs pendentes:', pendingJobs.rows.length);
    
    console.log('\n📌 O worker processará estes jobs quando executar a coleta.');
    console.log('\n💡 Para iniciar a coleta imediata, execute:');
    console.log('   node workers/competitorDataWorker.js');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testSync();