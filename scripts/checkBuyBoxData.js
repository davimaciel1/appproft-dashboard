const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkBuyBoxData() {
  try {
    // Verificar alguns ASINs
    const result = await executeSQL(`
      SELECT asin, name, marketplace 
      FROM products 
      WHERE asin IS NOT NULL 
      LIMIT 5
    `);
    
    console.log('🏷️ Exemplos de ASINs no banco:');
    result.rows.forEach(p => {
      console.log(`   ASIN: ${p.asin} - ${p.name?.substring(0, 50)}... (${p.marketplace})`);
    });
    
    // Verificar sync logs
    const syncLogs = await executeSQL(`
      SELECT sync_type, status, COUNT(*) as count
      FROM sync_logs 
      WHERE sync_type LIKE '%competitor%' OR sync_type LIKE '%buy_box%'
      GROUP BY sync_type, status
    `);
    
    console.log('\n📊 Logs de sincronização relacionados:');
    if (syncLogs.rows.length === 0) {
      console.log('   ❌ Nenhum log de sincronização de competidores encontrado');
    } else {
      syncLogs.rows.forEach(log => {
        console.log(`   ${log.sync_type}: ${log.status} (${log.count} registros)`);
      });
    }
    
    // Verificar tabelas relacionadas
    const tables = [
      'buy_box_history',
      'competitor_tracking',
      'competitor_tracking_advanced'
    ];
    
    console.log('\n📊 Contagem de registros em tabelas relacionadas:');
    for (const table of tables) {
      const count = await executeSQL(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${count.rows[0].count} registros`);
    }
    
    // Verificar configuração do marketplace
    console.log('\n🌍 Configuração do Marketplace:');
    console.log('   SP_API_MARKETPLACE_ID:', process.env.SP_API_MARKETPLACE_ID || 'NÃO DEFINIDO');
    console.log('   A2Q3Y263D00KWC = Brasil');
    console.log('   ATVPDKIKX0DER = USA');
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkBuyBoxData();