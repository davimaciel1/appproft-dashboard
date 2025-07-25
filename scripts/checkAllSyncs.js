const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkAllSyncs() {
  try {
    console.log('🔍 Verificando todas as sincronizações...\n');
    
    // Buscar todas as sincronizações
    const allSyncs = await executeSQL(`
      SELECT 
        id,
        sync_type,
        marketplace,
        status,
        records_synced,
        started_at,
        completed_at,
        error_message
      FROM sync_logs
      ORDER BY started_at DESC
      LIMIT 20
    `);
    
    if (allSyncs.rows.length === 0) {
      console.log('❌ Nenhuma sincronização encontrada no banco');
      return;
    }
    
    console.log(`📋 Total de sincronizações encontradas: ${allSyncs.rows.length}\n`);
    console.log('=' .repeat(80));
    
    allSyncs.rows.forEach((sync, idx) => {
      const date = new Date(sync.started_at);
      const duration = sync.completed_at 
        ? ((new Date(sync.completed_at) - new Date(sync.started_at)) / 1000).toFixed(1) + 's'
        : 'Em andamento...';
      
      console.log(`\n${idx + 1}. ${sync.sync_type} - ${sync.marketplace}`);
      console.log(`   📅 Iniciado: ${date.toLocaleString('pt-BR')}`);
      console.log(`   📊 Status: ${sync.status === 'success' ? '✅' : sync.status === 'running' ? '🔄' : '❌'} ${sync.status}`);
      console.log(`   📦 Registros: ${sync.records_synced || 0}`);
      console.log(`   ⏱️  Duração: ${duration}`);
      
      if (sync.error_message) {
        console.log(`   ❌ Erro: ${sync.error_message}`);
      }
    });
    
    // Estatísticas por tipo
    console.log('\n\n📊 Estatísticas por tipo de sincronização:');
    console.log('=' .repeat(80));
    
    const stats = await executeSQL(`
      SELECT 
        sync_type,
        marketplace,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        SUM(records_synced) as total_records
      FROM sync_logs
      GROUP BY sync_type, marketplace
      ORDER BY total DESC
    `);
    
    stats.rows.forEach(stat => {
      console.log(`\n${stat.sync_type} (${stat.marketplace}):`);
      console.log(`   Total: ${stat.total} | Sucesso: ${stat.success} | Erros: ${stat.errors}`);
      console.log(`   Registros sincronizados: ${stat.total_records || 0}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkAllSyncs();