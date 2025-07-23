const { executeSQL } = require('./DATABASE_ACCESS_CONFIG');

async function checkUsersV2() {
  console.log('=== VERIFICANDO USUÁRIOS NO BANCO DE DADOS ===\n');
  
  try {
    // 1. Listar todos os usuários
    console.log('👥 USUÁRIOS CADASTRADOS:');
    const users = await executeSQL('SELECT id, name, email, created_at FROM users');
    console.table(users.rows);
    
    // 2. Ver detalhes de autenticação
    console.log('\n🔐 INFORMAÇÕES DE SENHA:');
    const authDetails = await executeSQL(`
      SELECT 
        id,
        email,
        CASE 
          WHEN password IS NOT NULL AND password != '' THEN 
            'Hash presente: ' || LENGTH(password) || ' caracteres, início: ' || LEFT(password, 10) || '...'
          ELSE 'SEM SENHA'
        END as password_info
      FROM users
    `);
    console.table(authDetails.rows);
    
    // 3. Verificar tipo de hash usado
    console.log('\n🔍 ANALISANDO TIPO DE HASH:');
    const hashAnalysis = await executeSQL(`
      SELECT 
        email,
        password,
        CASE
          WHEN password LIKE '$2b$%' THEN 'bcrypt'
          WHEN password LIKE '$2a$%' THEN 'bcrypt (antiga)'
          WHEN password LIKE '$2y$%' THEN 'bcrypt (PHP)'
          WHEN LENGTH(password) = 32 THEN 'Possível MD5'
          WHEN LENGTH(password) = 40 THEN 'Possível SHA1'
          WHEN LENGTH(password) = 64 THEN 'Possível SHA256'
          WHEN LENGTH(password) = 128 THEN 'Possível SHA512'
          ELSE 'Tipo desconhecido'
        END as hash_type
      FROM users
      WHERE password IS NOT NULL
    `);
    
    for (const user of hashAnalysis.rows) {
      console.log(`\nEmail: ${user.email}`);
      console.log(`Tipo de hash detectado: ${user.hash_type}`);
      console.log(`Hash completo: ${user.password}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkUsersV2();