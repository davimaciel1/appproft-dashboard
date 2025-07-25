// Script para definir variáveis de ambiente temporariamente
process.env.JWT_SECRET = 'your-secret-key-here-change-in-production';
process.env.NODE_ENV = 'development';

console.log('✅ Variáveis de ambiente definidas:');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '***' : 'não definido');
console.log('   NODE_ENV:', process.env.NODE_ENV);

// Exportar para uso em outros scripts
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV
};