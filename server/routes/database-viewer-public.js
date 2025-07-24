const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// Página HTML para visualizar banco de dados
router.get('/', async (req, res) => {
  try {
    // Buscar todas as tabelas
    const tablesQuery = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    
    // Para cada tabela, buscar contagem e alguns dados
    const tablesData = await Promise.all(
      tablesResult.rows.map(async (table) => {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table.table_name}`);
          const sampleResult = await pool.query(`SELECT * FROM ${table.table_name} LIMIT 10`);
          
          return {
            name: table.table_name,
            columns: table.column_count,
            count: countResult.rows[0].total,
            sample: sampleResult.rows
          };
        } catch (error) {
          return {
            name: table.table_name,
            columns: table.column_count,
            count: 0,
            sample: [],
            error: error.message
          };
        }
      })
    );
    
    // Gerar HTML
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Viewer - AppProft</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            color: #FF8C00;
            margin-bottom: 10px;
        }
        .info {
            color: #666;
            margin-bottom: 30px;
        }
        .table-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .table-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        .table-name {
            font-size: 20px;
            font-weight: bold;
            color: #333;
        }
        .table-stats {
            display: flex;
            gap: 20px;
            color: #666;
            font-size: 14px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        .data-table th {
            background: #f8f9fa;
            padding: 8px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #dee2e6;
            color: #495057;
        }
        .data-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #f0f0f0;
        }
        .data-table tr:hover {
            background: #f8f9fa;
        }
        .no-data {
            color: #999;
            font-style: italic;
            padding: 20px;
            text-align: center;
        }
        .timestamp {
            color: #999;
            font-size: 12px;
            margin-top: 30px;
            text-align: center;
        }
        details {
            margin-top: 15px;
        }
        summary {
            cursor: pointer;
            color: #FF8C00;
            font-weight: 500;
            padding: 5px 0;
        }
        .json-data {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🗄️ Database Viewer - AppProft</h1>
        <div class="info">
            Visualização completa do banco de dados PostgreSQL em produção
        </div>
        
        ${tablesData.map(table => `
            <div class="table-card">
                <div class="table-header">
                    <div class="table-name">📋 ${table.name}</div>
                    <div class="table-stats">
                        <span>📊 ${table.count} registros</span>
                        <span>📐 ${table.columns} colunas</span>
                    </div>
                </div>
                
                ${table.count > 0 ? `
                    <details ${['users', 'products', 'orders'].includes(table.name) ? 'open' : ''}>
                        <summary>Ver dados (${Math.min(10, table.count)} primeiros registros)</summary>
                        <div style="overflow-x: auto; margin-top: 10px;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        ${Object.keys(table.sample[0] || {}).map(key => 
                                            `<th>${key}</th>`
                                        ).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${table.sample.map(row => `
                                        <tr>
                                            ${Object.values(row).map(value => {
                                                let displayValue = value;
                                                if (value === null) displayValue = '<span style="color:#999">NULL</span>';
                                                else if (value === true) displayValue = '✅';
                                                else if (value === false) displayValue = '❌';
                                                else if (typeof value === 'object') {
                                                    displayValue = `<div class="json-data">${JSON.stringify(value, null, 2)}</div>`;
                                                }
                                                else if (String(value).length > 100) {
                                                    displayValue = String(value).substring(0, 100) + '...';
                                                }
                                                return `<td>${displayValue}</td>`;
                                            }).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </details>
                ` : `
                    <div class="no-data">Tabela vazia</div>
                `}
                
                ${table.error ? `
                    <div style="color: red; margin-top: 10px;">
                        Erro: ${table.error}
                    </div>
                ` : ''}
            </div>
        `).join('')}
        
        <div class="timestamp">
            Gerado em: ${new Date().toLocaleString('pt-BR')}
        </div>
    </div>
</body>
</html>
    `;
    
    res.type('html').send(html);
    
  } catch (error) {
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: red;">Erro ao carregar banco de dados</h1>
          <pre>${error.message}</pre>
          <p><a href="/">Voltar</a></p>
        </body>
      </html>
    `);
  }
});

module.exports = router;