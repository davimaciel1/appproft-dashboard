const { executeSQL } = require('./DATABASE_ACCESS_CONFIG');

async function checkUsers() {
  console.log('=== VERIFICANDO USUÁRIOS NO BANCO DE DADOS ===\n');
  
  try {
    // 1. Verificar estrutura da tabela users
    console.log('📋 ESTRUTURA DA TABELA USERS:');
    const structure = await executeSQL(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.table(structure.rows);
    
    // 2. Listar todos os usuários
    console.log('\n👥 USUÁRIOS CADASTRADOS:');
    const users = await executeSQL('SELECT id, name, email, role, created_at FROM users');
    console.table(users.rows);
    
    // 3. Ver detalhes completos (sem mostrar senha completa)
    console.log('\n🔐 DETALHES DE AUTENTICAÇÃO:');
    const authDetails = await executeSQL(`
      SELECT 
        id,
        email,
        CASE 
          WHEN password IS NOT NULL THEN 'Tem senha hash: ' || LEFT(password, 20) || '...'
          ELSE 'SEM SENHA'
        END as password_info,
        role,
        created_at
      FROM users
    `);
    console.table(authDetails.rows);
    
    // 4. Verificar se existem credenciais de teste
    console.log('\n🔍 VERIFICANDO CREDENCIAIS DE TESTE PADRÃO:');
    const testCredentials = [
      { email: 'admin@appproft.com', desc: 'Admin padrão' },
      { email: 'teste@teste.com', desc: 'Teste genérico' },
      { email: 'user@example.com', desc: 'Exemplo padrão' }
    ];
    
    for (const cred of testCredentials) {
      const result = await executeSQL('SELECT email FROM users WHERE email = $1', [cred.email]);
      console.log(`${cred.desc} (${cred.email}): ${result.rows.length > 0 ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar usuários:', error.message);
  }
}

checkUsers();