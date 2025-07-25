const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkAutoSync() {
  try {
    console.log('🔍 Verificando sincronização automática de Buy Box...\n');
    
    // Verificar últimas sincronizações
    const recentSyncs = await executeSQL(`
      SELECT 
        id,
        sync_type,
        records_synced,
        status,
        started_at,
        completed_at
      FROM sync_logs
      WHERE marketplace = 'amazon'
      AND sync_type IN ('buy_box_auto', 'buy_box', 'buy_box_worker')
      ORDER BY completed_at DESC NULLS LAST
      LIMIT 10
    `);
    
    if (recentSyncs.rows.length === 0) {
      console.log('❌ Nenhuma sincronização encontrada');
      console.log('💡 Certifique-se de que o servidor está rodando');
      return;
    }
    
    console.log('📋 Últimas sincronizações:');
    console.log('=' .repeat(80));
    
    recentSyncs.rows.forEach((sync, idx) => {
      const automatic = sync.sync_type.includes('auto') ? '🤖 AUTO' : '👤 MANUAL';
      const date = new Date(sync.completed_at || sync.started_at);
      
      console.log(`\n${idx + 1}. ${automatic} ${sync.sync_type}`);
      console.log(`   📅 Data: ${date.toLocaleString('pt-BR')}`);
      console.log(`   📊 Status: ${sync.status === 'success' ? '✅' : '❌'} ${sync.status}`);
      console.log(`   📦 Registros: ${sync.records_synced || 0}`);
    });
    
    // Verificar dados coletados
    console.log('\n\n📊 Dados coletados:');
    console.log('=' .repeat(80));
    
    const stats = await executeSQL(`
      SELECT 
        COUNT(DISTINCT asin) as unique_asins,
        COUNT(*) as total_records,
        COUNT(DISTINCT DATE(timestamp)) as days_with_data,
        MIN(timestamp) as oldest_record,
        MAX(timestamp) as newest_record
      FROM competitor_tracking_advanced
    `);
    
    const stat = stats.rows[0];
    console.log(`   📦 ASINs únicos: ${stat.unique_asins}`);
    console.log(`   📈 Total de registros: ${stat.total_records}`);
    console.log(`   📅 Dias com dados: ${stat.days_with_data}`);
    console.log(`   🕐 Registro mais antigo: ${stat.oldest_record ? new Date(stat.oldest_record).toLocaleString('pt-BR') : 'N/A'}`);
    console.log(`   🕐 Registro mais recente: ${stat.newest_record ? new Date(stat.newest_record).toLocaleString('pt-BR') : 'N/A'}`);
    
    // Verificar intervalo entre sincronizações
    const intervals = await executeSQL(`
      WITH sync_times AS (
        SELECT 
          completed_at,
          LAG(completed_at) OVER (ORDER BY completed_at) as prev_sync
        FROM sync_logs
        WHERE marketplace = 'amazon'
        AND sync_type = 'buy_box_auto'
        AND status IN ('success', 'partial')
        ORDER BY completed_at DESC
        LIMIT 5
      )
      SELECT 
        completed_at,
        prev_sync,
        EXTRACT(EPOCH FROM (completed_at - prev_sync))/60 as minutes_between
      FROM sync_times
      WHERE prev_sync IS NOT NULL
    `);
    
    if (intervals.rows.length > 0) {
      console.log('\n\n⏰ Intervalos entre sincronizações automáticas:');
      console.log('=' .repeat(80));
      
      intervals.rows.forEach(interval => {
        console.log(`   ${new Date(interval.completed_at).toLocaleTimeString('pt-BR')} - ${interval.minutes_between.toFixed(1)} minutos desde a anterior`);
      });
      
      const avgInterval = intervals.rows.reduce((sum, i) => sum + parseFloat(i.minutes_between), 0) / intervals.rows.length;
      console.log(`\n   📊 Intervalo médio: ${avgInterval.toFixed(1)} minutos`);
      
      if (avgInterval < 20 && avgInterval > 10) {
        console.log('   ✅ Sincronização automática funcionando corretamente (15 min)');
      } else {
        console.log('   ⚠️  Intervalo fora do esperado (deveria ser ~15 min)');
      }
    }
    
    // Verificar se há sincronização recente
    const lastSync = recentSyncs.rows[0];
    if (lastSync) {
      const minutesSinceSync = (Date.now() - new Date(lastSync.completed_at || lastSync.started_at).getTime()) / (1000 * 60);
      
      console.log('\n\n🔍 Status atual:');
      console.log('=' .repeat(80));
      
      if (minutesSinceSync < 20) {
        console.log('   ✅ Sincronização está ativa');
        console.log(`   ⏱️  Última sincronização há ${minutesSinceSync.toFixed(1)} minutos`);
        console.log('   ⏰ Próxima sincronização em aproximadamente ' + (15 - (minutesSinceSync % 15)).toFixed(1) + ' minutos');
      } else {
        console.log('   ⚠️  Possível problema com sincronização');
        console.log(`   ⏱️  Última sincronização há ${minutesSinceSync.toFixed(1)} minutos`);
        console.log('   💡 Verifique se o servidor está rodando');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkAutoSync();