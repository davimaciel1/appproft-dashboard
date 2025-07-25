// Script de Status Completo do Sistema AppProft

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function generateSystemStatus() {
  console.log('📊 STATUS COMPLETO DO SISTEMA APPPROFT');
  console.log('='.repeat(60));
  console.log(`Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

  try {
    // 1. Status do Banco de Dados
    console.log('🗄️ STATUS DO BANCO DE DADOS:');
    const dbInfo = await executeSQL(`
      SELECT 
        COUNT(*) as total_tables,
        NOW() as current_time,
        version() as pg_version
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const info = dbInfo.rows[0];
    console.log(`   PostgreSQL: ${info.pg_version.split(' ')[0]}`);
    console.log(`   Tabelas: ${info.total_tables} tabelas públicas`);
    console.log(`   Conectividade: ✅ OK\n`);

    // 2. Status da Fila de Sincronização  
    console.log('🔄 FILA DE SINCRONIZAÇÃO:');
    const queueStatus = await executeSQL(`
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_queue
      WHERE created_at > NOW() - INTERVAL '6 hours'
      GROUP BY status
      ORDER BY 
        CASE status 
          WHEN 'processing' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'completed' THEN 3
          WHEN 'failed' THEN 4
        END
    `);

    const statusEmojis = {
      'processing': '⏳',
      'pending': '📋',
      'completed': '✅',
      'failed': '❌'
    };

    for (const row of queueStatus.rows) {
      const emoji = statusEmojis[row.status] || '❓';
      console.log(`   ${emoji} ${row.status.toUpperCase()}: ${row.count} tarefas`);
    }
    console.log('');

    // 3. Dados Coletados
    console.log('📦 DADOS COLETADOS:');
    const tables = [
      { name: 'products', desc: 'Produtos Amazon' },
      { name: 'orders', desc: 'Pedidos' },
      { name: 'buy_box_winners', desc: 'Buy Box Status' },
      { name: 'traffic_metrics', desc: 'Métricas de Tráfego' },
      { name: 'daily_metrics', desc: 'Métricas Diárias' },
      { name: 'advertising_campaigns', desc: 'Campanhas Advertising' },
      { name: 'notifications', desc: 'Notificações' }
    ];

    for (const table of tables) {
      try {
        const result = await executeSQL(`
          SELECT 
            COUNT(*) as total,
            MAX(created_at) as latest
          FROM ${table.name}
        `);
        
        const data = result.rows[0];
        const latest = data.latest ? 
          new Date(data.latest).toLocaleDateString('pt-BR') : 'Nunca';
          
        console.log(`   📊 ${table.desc}: ${data.total} registros (último: ${latest})`);
      } catch (error) {
        console.log(`   ❌ ${table.desc}: Tabela não encontrada`);
      }
    }
    console.log('');

    // 4. Sistema Data Kiosk
    console.log('📈 DATA KIOSK:');
    try {
      const dataKioskTables = ['daily_metrics', 'traffic_metrics'];
      let hasDataKioskData = false;
      
      for (const table of dataKioskTables) {
        const result = await executeSQL(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result.rows[0].count;
        console.log(`   📊 ${table}: ${count} registros`);
        if (count > 0) hasDataKioskData = true;
      }
      
      console.log(`   Status: ${hasDataKioskData ? '✅ Ativo' : '⏳ Aguardando primeira sincronização'}`);
    } catch (error) {
      console.log('   ❌ Data Kiosk: Tabelas não encontradas');
    }
    console.log('');

    // 5. Rate Limiting
    console.log('⚡ RATE LIMITING:');
    try {
      const rateLimitStatus = await executeSQL(`
        SELECT 
          api_name,
          COUNT(*) as endpoints,
          AVG(tokens_available) as avg_tokens
        FROM api_rate_limits
        GROUP BY api_name
      `);
      
      for (const row of rateLimitStatus.rows) {
        console.log(`   🔧 ${row.api_name}: ${row.endpoints} endpoints, ${parseFloat(row.avg_tokens).toFixed(1)} tokens médios`);
      }
      
      if (rateLimitStatus.rows.length === 0) {
        console.log('   📋 Nenhuma configuração ativa');
      }
    } catch (error) {
      console.log('   ❌ Rate Limiting: Tabela não encontrada');
    }
    console.log('');

    // 6. Comandos Úteis
    console.log('🛠️ COMANDOS ÚTEIS:');
    console.log('   Iniciar processamento:');
    console.log('   → node scripts/startPersistentSync.js');
    console.log('');
    console.log('   Verificar progresso:');
    console.log('   → node scripts/checkQueueStatus.js');
    console.log('   → node scripts/checkDataProgress.js');
    console.log('');
    console.log('   Adicionar mais dados:');
    console.log('   → node scripts/populateAllData.js');
    console.log('');
    console.log('   Testar sistema completo:');
    console.log('   → node scripts/testCompleteSystem.js');
    console.log('');

    // 7. URLs de Acesso
    console.log('🌐 URLS DE ACESSO:');
    console.log('   Database Viewer: https://appproft.com/database');
    console.log('   Amazon Data: https://appproft.com/amazon-data');
    console.log('   Insights: https://appproft.com/insights');
    console.log('');

    console.log('✅ Status completo gerado com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao gerar status:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  generateSystemStatus();
}

module.exports = generateSystemStatus;