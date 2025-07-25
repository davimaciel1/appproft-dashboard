#!/usr/bin/env node

/**
 * Script para verificar status da fila de sincronização
 */

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkQueueStatus() {
  console.log('📊 STATUS DA FILA DE SINCRONIZAÇÃO');
  console.log('='.repeat(50));
  console.log(`Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

  try {
    // 1. Status geral da fila
    console.log('🔄 Status Geral:');
    const statusResult = await executeSQL(`
      SELECT 
        status,
        COUNT(*) as count,
        MIN(created_at) as oldest_task,
        MAX(updated_at) as latest_update
      FROM sync_queue
      WHERE created_at > NOW() - INTERVAL '6 hours'
      GROUP BY status
      ORDER BY 
        CASE status 
          WHEN 'processing' THEN 1
          WHEN 'pending' THEN 2 
          WHEN 'retry' THEN 3
          WHEN 'completed' THEN 4
          WHEN 'failed' THEN 5
        END
    `);

    for (const row of statusResult.rows) {
      const oldestTime = row.oldest_task ? new Date(row.oldest_task).toLocaleTimeString('pt-BR') : 'N/A';
      const latestTime = row.latest_update ? new Date(row.latest_update).toLocaleTimeString('pt-BR') : 'N/A';
      
      const statusIcon = {
        'processing': '⏳',
        'pending': '📋',
        'retry': '🔄',
        'completed': '✅',
        'failed': '❌'
      }[row.status] || '❓';
      
      console.log(`   ${statusIcon} ${row.status.toUpperCase()}: ${row.count} tarefas`);
      console.log(`      Mais antiga: ${oldestTime} | Última atualização: ${latestTime}`);
    }

    // 2. Tarefas por tipo
    console.log('\n📋 Tarefas por Tipo:');
    const typeResult = await executeSQL(`
      SELECT 
        task_type,
        status,
        COUNT(*) as count
      FROM sync_queue
      WHERE created_at > NOW() - INTERVAL '6 hours'
      GROUP BY task_type, status
      ORDER BY task_type, status
    `);

    const taskTypes = {};
    for (const row of typeResult.rows) {
      if (!taskTypes[row.task_type]) {
        taskTypes[row.task_type] = {};
      }
      taskTypes[row.task_type][row.status] = row.count;
    }

    for (const [taskType, statuses] of Object.entries(taskTypes)) {
      console.log(`\n   📦 ${taskType}:`);
      for (const [status, count] of Object.entries(statuses)) {
        const icon = {
          'processing': '⏳',
          'pending': '📋',
          'completed': '✅',
          'failed': '❌',
          'retry': '🔄'
        }[status] || '❓';
        console.log(`      ${icon} ${status}: ${count}`);
      }
    }

    // 3. Tarefas com erro
    console.log('\n❌ Últimos Erros:');
    const errorResult = await executeSQL(`
      SELECT 
        task_type,
        last_error,
        attempt_count,
        updated_at
      FROM sync_queue
      WHERE status IN ('failed', 'retry')
        AND last_error IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    if (errorResult.rows.length === 0) {
      console.log('   🎉 Nenhum erro recente!');
    } else {
      for (const row of errorResult.rows) {
        const time = new Date(row.updated_at).toLocaleTimeString('pt-BR');
        console.log(`   ${time} | ${row.task_type} (tentativa ${row.attempt_count})`);
        console.log(`      Erro: ${row.last_error.substring(0, 100)}...`);
      }
    }

    // 4. Performance recente
    console.log('\n⚡ Performance (última hora):');
    const perfResult = await executeSQL(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
      FROM sync_queue
      WHERE created_at > NOW() - INTERVAL '1 hour'
        AND completed_at IS NOT NULL
    `);

    const perf = perfResult.rows[0];
    if (perf.total_tasks > 0) {
      const successRate = ((perf.completed / perf.total_tasks) * 100).toFixed(1);
      const avgDuration = perf.avg_duration_seconds ? perf.avg_duration_seconds.toFixed(1) : 'N/A';
      
      console.log(`   📊 Taxa de sucesso: ${successRate}%`);
      console.log(`   ⏱️ Duração média: ${avgDuration}s`);
      console.log(`   📈 Total processado: ${perf.total_tasks} tarefas`);
    } else {
      console.log('   📊 Nenhuma tarefa completada na última hora');
    }

    // 5. Próximas tarefas agendadas
    console.log('\n📅 Próximas Tarefas:');
    const nextResult = await executeSQL(`
      SELECT 
        task_type,
        next_retry_at,
        attempt_count
      FROM sync_queue
      WHERE status = 'retry'
        AND next_retry_at > NOW()
      ORDER BY next_retry_at
      LIMIT 5
    `);

    if (nextResult.rows.length === 0) {
      console.log('   📭 Nenhuma tarefa agendada para retry');
    } else {
      for (const row of nextResult.rows) {
        const retryTime = new Date(row.next_retry_at).toLocaleTimeString('pt-BR');
        console.log(`   ${retryTime} | ${row.task_type} (tentativa ${row.attempt_count})`);
      }
    }

    // 6. Comandos úteis
    console.log('\n🛠️ COMANDOS ÚTEIS:');
    console.log('   Limpar tarefas antigas:');
    console.log('   node -e "require(\'./DATABASE_ACCESS_CONFIG\').executeSQL(\'DELETE FROM sync_queue WHERE created_at < NOW() - INTERVAL \\\'24 hours\\\'\')"');
    console.log('');
    console.log('   Reprocessar tarefas falhadas:');
    console.log('   node -e "require(\'./DATABASE_ACCESS_CONFIG\').executeSQL(\'UPDATE sync_queue SET status = \\\'pending\\\', attempt_count = 0 WHERE status = \\\'failed\\\'\')"');
    console.log('');
    console.log('   Popular mais dados:');
    console.log('   node scripts/populateAllData.js');

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  checkQueueStatus();
}

module.exports = checkQueueStatus;