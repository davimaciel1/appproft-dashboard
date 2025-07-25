// Script para verificar progresso da coleta de dados

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkDataCollection() {
  console.log('📊 VERIFICANDO COLETA DE DADOS EM PROGRESSO');
  console.log('='.repeat(50));
  
  try {
    // Verificar atualizações recentes em tabelas principais
    const tables = [
      'products', 'orders', 'traffic_metrics', 
      'daily_metrics', 'buy_box_winners'
    ];
    
    for (const table of tables) {
      try {
        const result = await executeSQL(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '10 minutes' THEN 1 END) as recent,
            MAX(created_at) as latest_record
          FROM ${table}
        `);
        
        const data = result.rows[0];
        const latestTime = data.latest_record ? 
          new Date(data.latest_record).toLocaleTimeString('pt-BR') : 'Nunca';
          
        console.log(`📦 ${table}:`);
        console.log(`   Total: ${data.total} registros`);
        console.log(`   Últimos 10min: ${data.recent} novos`);
        console.log(`   Último registro: ${latestTime}`);
        console.log('');
        
      } catch (error) {
        console.log(`❌ ${table}: ${error.message}`);
      }
    }
    
    // Verificar logs da sync_queue
    const queueResult = await executeSQL(`
      SELECT 
        task_type,
        status,
        last_error,
        updated_at
      FROM sync_queue 
      WHERE status = 'processing'
      ORDER BY updated_at DESC
      LIMIT 3
    `);
    
    console.log('🔄 TAREFAS EM PROCESSAMENTO:');
    if (queueResult.rows.length === 0) {
      console.log('   Nenhuma tarefa em processamento no momento');
    } else {
      for (const task of queueResult.rows) {
        console.log(`   ${task.task_type}: ${task.status}`);
        console.log(`   Atualizada: ${new Date(task.updated_at).toLocaleTimeString('pt-BR')}`);
        if (task.last_error) {
          console.log(`   Erro: ${task.last_error.substring(0, 80)}...`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

if (require.main === module) {
  checkDataCollection();
}

module.exports = checkDataCollection;