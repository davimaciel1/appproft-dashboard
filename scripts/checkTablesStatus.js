require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkTablesStatus() {
  try {
    console.log('🔍 Verificando estado das tabelas...\n');
    
    // Verificar tabelas principais
    const mainTables = ['products', 'orders', 'users', 'inventory_snapshots', 'sync_logs', 'advertising_campaigns'];
    
    for (const tableName of mainTables) {
      try {
        const result = await executeSQL(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = result.rows[0].count;
        console.log(`📋 ${tableName}: ${count} registros`);
      } catch (error) {
        console.log(`❌ ${tableName}: Erro - ${error.message}`);
      }
    }
    
    console.log('\n📝 Verificando logs de sincronização...');
    try {
      const syncLogs = await executeSQL(`
        SELECT sync_type, status, records_synced, created_at 
        FROM sync_logs 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      if (syncLogs.rows.length === 0) {
        console.log('❌ Nenhum log de sincronização encontrado!');
        console.log('   Isso indica que o sistema de sincronização nunca foi executado.');
      } else {
        console.log('✅ Logs encontrados:');
        syncLogs.rows.forEach(log => {
          console.log(`   ${log.sync_type}: ${log.status} (${log.records_synced || 0} registros) - ${log.created_at}`);
        });
      }
    } catch (error) {
      console.log(`❌ Erro ao verificar sync_logs: ${error.message}`);
    }
    
    console.log('\n🔧 Verificando se o sistema persistente está rodando...');
    try {
      const taskQueue = await executeSQL(`
        SELECT task_type, status, created_at 
        FROM task_queue 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      if (taskQueue.rows.length === 0) {
        console.log('❌ Nenhuma task na queue encontrada!');
        console.log('   O sistema persistente pode não estar rodando.');
      } else {
        console.log('✅ Tasks encontradas:');
        taskQueue.rows.forEach(task => {
          console.log(`   ${task.task_type}: ${task.status} - ${task.created_at}`);
        });
      }
    } catch (error) {
      console.log(`⚠️ Tabela task_queue não existe: ${error.message}`);
    }
    
    console.log('\n🎯 DIAGNÓSTICO:');
    console.log('1. Se sync_logs está vazio = Sistema nunca sincronizou');
    console.log('2. Se task_queue está vazio = Sistema persistente não está rodando');
    console.log('3. Execute: node scripts/startPersistentSync.js');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

checkTablesStatus();