const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkAdminUser() {
  try {
    const result = await executeSQL(`
      SELECT id, email, name, created_at 
      FROM users 
      WHERE email = 'admin@appproft.com'
    `);
    
    if (result.rows.length > 0) {
      console.log('Usuário admin encontrado:', result.rows[0]);
      console.log('\nNOTA: A senha está criptografada no banco.');
      console.log('A senha padrão geralmente é: senha123 ou admin123');
      console.log('\nPara resetar a senha, use o script resetPassword.js');
    } else {
      console.log('Usuário admin não encontrado!');
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkAdminUser();