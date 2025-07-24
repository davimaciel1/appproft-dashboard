const { Pool } = require('pg');
require('dotenv').config();

// Configuração do pool de conexões
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk',
  database: process.env.DB_NAME || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Função para executar queries SQL
async function executeSQL(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

// Função para obter todas as tabelas
async function getAllTables() {
  const query = `
    SELECT 
      schemaname, 
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables 
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename
  `;
  return executeSQL(query);
}

// Função para contar registros de uma tabela
async function getTableRowCount(tableName, schemaName = 'public') {
  const query = `SELECT COUNT(*) FROM ${schemaName}.${tableName}`;
  return executeSQL(query);
}

// Verificar conexão
async function ensureConnection() {
  try {
    await executeSQL('SELECT 1');
    return true;
  } catch (error) {
    console.error('❌ ERRO: Túnel SSH não está ativo!');
    console.log('👉 Execute start-tunnel.bat primeiro');
    return false;
  }
}

module.exports = {
  pool,
  executeSQL,
  getAllTables,
  getTableRowCount,
  ensureConnection
};