const pool = require('../db/pool');

/**
 * Função utilitária para executar queries SQL
 * Mantém compatibilidade com código existente que usa executeSQL
 */
async function executeSQL(query, params) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error('Erro ao executar SQL:', error.message);
    throw error;
  }
}

module.exports = { executeSQL };