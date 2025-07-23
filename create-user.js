const bcrypt = require('bcryptjs');

// Configurações do usuário
const email = 'admin@appproft.com';
const password = 'admin123';
const name = 'Admin';

// Gerar hash da senha
const saltRounds = 10;
const passwordHash = bcrypt.hashSync(password, saltRounds);

// SQL para criar usuário
console.log(`
-- Execute este SQL no PostgreSQL do Coolify:
INSERT INTO users (email, password_hash, name) 
VALUES (
  '${email}',
  '${passwordHash}',
  '${name}'
);
`);

console.log('\nCredenciais:');
console.log(`Email: ${email}`);
console.log(`Senha: ${password}`);