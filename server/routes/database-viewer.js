const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Listar todas as tabelas
router.get('/tables', async (req, res) => {
  try {
    const query = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const result = await pool.query(query);
    
    // Para cada tabela, buscar contagem de registros
    const tablesWithCount = await Promise.all(
      result.rows.map(async (table) => {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as row_count FROM ${table.table_name}`);
          return {
            ...table,
            row_count: parseInt(countResult.rows[0].row_count)
          };
        } catch (error) {
          return {
            ...table,
            row_count: 0,
            error: error.message
          };
        }
      })
    );
    
    res.json({ tables: tablesWithCount });
  } catch (error) {
    console.error('Erro ao listar tabelas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter estrutura de uma tabela
router.get('/table/:tableName/structure', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Validar nome da tabela para evitar SQL injection
    const tableExists = await pool.query(
      'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)',
      [tableName]
    );
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({ error: 'Tabela não encontrada' });
    }
    
    const query = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;
    
    const result = await pool.query(query, [tableName]);
    
    res.json({ 
      tableName,
      columns: result.rows 
    });
  } catch (error) {
    console.error('Erro ao obter estrutura:', error);
    res.status(500).json({ error: error.message });
  }
});

// Visualizar dados de uma tabela
router.get('/table/:tableName/data', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 100, offset = 0, orderBy = 'id', order = 'DESC' } = req.query;
    
    // Validar nome da tabela
    const tableExists = await pool.query(
      'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)',
      [tableName]
    );
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({ error: 'Tabela não encontrada' });
    }
    
    // Validar se a coluna de ordenação existe
    const columnExists = await pool.query(
      'SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2)',
      [tableName, orderBy]
    );
    
    const orderColumn = columnExists.rows[0].exists ? orderBy : 'ctid';
    const orderDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Buscar dados
    const dataQuery = `
      SELECT * FROM ${tableName}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT $1 OFFSET $2
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
    
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [limit, offset]),
      pool.query(countQuery)
    ]);
    
    res.json({
      tableName,
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    res.status(500).json({ error: error.message });
  }
});

// Executar query customizada (apenas SELECT)
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Validação básica - apenas permitir SELECT
    if (!query || !query.trim().toUpperCase().startsWith('SELECT')) {
      return res.status(400).json({ 
        error: 'Apenas queries SELECT são permitidas' 
      });
    }
    
    // Adicionar limite se não tiver
    let safeQuery = query.trim();
    if (!safeQuery.toUpperCase().includes('LIMIT')) {
      safeQuery += ' LIMIT 100';
    }
    
    const result = await pool.query(safeQuery);
    
    res.json({
      query: safeQuery,
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({
        name: f.name,
        dataTypeID: f.dataTypeID
      }))
    });
  } catch (error) {
    console.error('Erro ao executar query:', error);
    res.status(500).json({ 
      error: error.message,
      hint: error.hint || 'Verifique a sintaxe da query'
    });
  }
});

module.exports = router;