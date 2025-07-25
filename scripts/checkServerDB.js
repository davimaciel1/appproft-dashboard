// Script para testar conexão do servidor com banco
require('dotenv').config({ path: '../server/.env' });

console.log('🔍 Verificando configuração do banco no servidor:');
console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') || 'NÃO DEFINIDO');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

// Testar conexão
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Desabilitar SSL para conexão local
});

async function testConnection() {
  try {
    console.log('\n🔌 Testando conexão com PostgreSQL...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexão OK:', result.rows[0].now);
    
    // Testar query de usuários
    const users = await pool.query('SELECT COUNT(*) FROM users');
    console.log('👥 Usuários no banco:', users.rows[0].count);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
    console.error('Detalhes:', error);
  }
}

testConnection();