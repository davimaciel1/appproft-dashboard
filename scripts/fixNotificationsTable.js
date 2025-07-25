/**
 * Corrigir tabela notifications existente
 */

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function fixNotificationsTable() {
  console.log('🔧 Corrigindo tabela notifications existente\n');
  
  try {
    // Verificar estrutura atual
    console.log('🔍 Verificando estrutura atual da tabela notifications...');
    const currentColumns = await executeSQL(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'notifications' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas atuais:');
    currentColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
    // Verificar se tenant_id já existe
    const hasTenantId = currentColumns.rows.some(col => col.column_name === 'tenant_id');
    
    if (!hasTenantId) {
      console.log('\n➕ Adicionando coluna tenant_id...');
      await executeSQL(`
        ALTER TABLE notifications 
        ADD COLUMN tenant_id VARCHAR(50) DEFAULT 'default'
      `);
      console.log('✅ Coluna tenant_id adicionada');
    } else {
      console.log('✅ Coluna tenant_id já existe');
    }
    
    // Verificar se todas as colunas necessárias existem
    const requiredColumns = [
      'notification_type', 'title', 'message', 'priority', 'status', 
      'channels', 'metadata', 'scheduled_for', 'sent_at', 'read_at'
    ];
    
    const existingColumnNames = currentColumns.rows.map(col => col.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('\n➕ Adicionando colunas faltantes...');
      
      for (const col of missingColumns) {
        let columnDef = '';
        switch (col) {
          case 'notification_type':
            columnDef = 'VARCHAR(50) NOT NULL DEFAULT \'system\'';
            break;
          case 'title':
            columnDef = 'VARCHAR(255) NOT NULL DEFAULT \'Notificação\'';
            break;
          case 'message':
            columnDef = 'TEXT NOT NULL DEFAULT \'\'';
            break;
          case 'priority':
            columnDef = 'VARCHAR(20) DEFAULT \'medium\'';
            break;
          case 'status':
            columnDef = 'VARCHAR(20) DEFAULT \'pending\'';
            break;
          case 'channels':
            columnDef = 'TEXT[] DEFAULT \'{}\'';
            break;
          case 'metadata':
            columnDef = 'JSONB DEFAULT \'{}\'';
            break;
          case 'scheduled_for':
            columnDef = 'TIMESTAMPTZ DEFAULT NOW()';
            break;
          case 'sent_at':
            columnDef = 'TIMESTAMPTZ';
            break;
          case 'read_at':
            columnDef = 'TIMESTAMPTZ';
            break;
        }
        
        await executeSQL(`ALTER TABLE notifications ADD COLUMN ${col} ${columnDef}`);
        console.log(`   ✅ ${col} adicionada`);
      }
    }
    
    // Criar índices se não existirem
    console.log('\n📊 Criando índices...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notifications(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_type_priority ON notifications(notification_type, priority)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for, status)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read_at) WHERE read_at IS NULL'
    ];
    
    for (const indexSQL of indexes) {
      await executeSQL(indexSQL);
    }
    console.log('✅ Índices criados');
    
    // Verificar estrutura final
    const finalColumns = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notifications' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estrutura final da tabela notifications:');
    finalColumns.rows.forEach(col => {
      console.log(`   ✅ ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n🎉 Tabela notifications corrigida com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir tabela:', error.message);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  fixNotificationsTable();
}

module.exports = { fixNotificationsTable };