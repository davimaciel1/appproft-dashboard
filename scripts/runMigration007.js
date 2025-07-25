/**
 * Executar Migration 007: Advertising e Notificações
 */

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const fs = require('fs').promises;
const path = require('path');

async function runMigration007() {
  console.log('🚀 Executando Migration 007: Advertising e Notificações\n');
  
  try {
    // Ler arquivo de migration
    const migrationPath = path.join(__dirname, '../server/db/migrations/007_create_advertising_and_notifications.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('📄 Migration carregada:', migrationPath);
    console.log('📊 Tamanho:', migrationSQL.length, 'caracteres\n');
    
    console.log('⏳ Executando migration...');
    
    // Executar migration
    await executeSQL(migrationSQL);
    
    console.log('✅ Migration executada com sucesso!\n');
    
    // Verificar tabelas criadas
    console.log('🔍 Verificando tabelas criadas:');
    
    const advertisingTables = await executeSQL(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_name LIKE 'advertising_%'
      ORDER BY table_name
    `);
    
    console.log('\n📈 Tabelas Advertising:');
    advertisingTables.rows.forEach(table => {
      console.log(`   ✅ ${table.table_name} (${table.column_count} colunas)`);
    });
    
    const notificationTables = await executeSQL(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND (table_name LIKE 'notification%' OR table_name = 'tokens_storage' OR table_name = 'buy_box_history')
      ORDER BY table_name
    `);
    
    console.log('\n🔔 Tabelas Notificações:');
    notificationTables.rows.forEach(table => {
      console.log(`   ✅ ${table.table_name} (${table.column_count} colunas)`);
    });
    
    // Verificar configurações padrão
    const defaultSettings = await executeSQL(`
      SELECT notification_type, channels 
      FROM notification_settings 
      WHERE tenant_id = 'default' AND user_id IS NULL
    `);
    
    console.log(`\n⚙️  Configurações padrão: ${defaultSettings.rows.length} tipos de notificação`);
    
    console.log('\n🎉 MIGRATION 007 CONCLUÍDA COM SUCESSO!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Configure credenciais Advertising API no .env:');
    console.log('   - ADVERTISING_CLIENT_ID');
    console.log('   - ADVERTISING_CLIENT_SECRET');
    console.log('   - ADVERTISING_REFRESH_TOKEN (após autorização)');
    console.log('2. Configure webhooks de notificação:');
    console.log('   - SLACK_WEBHOOK_URL');
    console.log('   - SENDGRID_API_KEY');
    console.log('3. Execute o teste completo: node scripts/testCompleteImplementation.js');
    
  } catch (error) {
    console.error('❌ Erro na migration:', error.message);
    console.log('\n🔧 Possíveis soluções:');
    console.log('1. Verificar se PostgreSQL está rodando');
    console.log('2. Verificar credenciais de banco no .env');
    console.log('3. Verificar se não há problemas de sintaxe SQL');
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  runMigration007();
}

module.exports = { runMigration007 };