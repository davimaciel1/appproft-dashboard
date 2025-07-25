const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkUsers() {
  try {
    const result = await executeSQL('SELECT id, email, created_at FROM users ORDER BY id LIMIT 5');
    
    console.log('👥 Usuários no banco:');
    if (result.rows.length === 0) {
      console.log('   ❌ Nenhum usuário encontrado!');
      console.log('   O middleware autoAuth precisa de pelo menos um usuário no banco.');
    } else {
      result.rows.forEach((user, i) => {
        console.log(`   ${i + 1}. ID: ${user.id}, Email: ${user.email}, Criado em: ${user.created_at}`);
      });
    }
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Erro ao verificar usuários:', error.message);
    return false;
  }
}

checkUsers();