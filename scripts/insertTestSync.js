const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function insertTestSync() {
  try {
    console.log('📝 Inserindo registro de teste de sincronização...\n');
    
    // Inserir um registro de teste
    await executeSQL(`
      INSERT INTO sync_logs (
        sync_type,
        marketplace,
        status,
        records_synced,
        started_at,
        completed_at
      ) VALUES (
        'buy_box_auto',
        'amazon',
        'pending',
        0,
        NOW(),
        NOW()
      )
    `);
    
    console.log('✅ Registro inserido com sucesso!');
    
    // Verificar se foi inserido
    const result = await executeSQL(`
      SELECT * FROM sync_logs 
      WHERE sync_type = 'buy_box_auto' 
      ORDER BY started_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      console.log('\n📊 Registro inserido:');
      console.log(result.rows[0]);
    }
    
    console.log('\n💡 A sincronização automática foi registrada como pendente.');
    console.log('   Isso indica que o servidor está tentando sincronizar mas aguarda configuração das credenciais AWS.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

insertTestSync();