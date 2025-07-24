import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Table {
  table_name: string;
  column_count: number;
  row_count: number;
}

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableData {
  tableName: string;
  data: any[];
  total: number;
  limit: number;
  offset: number;
}

const DatabaseViewer: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(50);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/database/tables');
      setTables(response.data.tables);
    } catch (error) {
      console.error('Erro ao carregar tabelas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string, page: number = 0) => {
    try {
      setLoading(true);
      setSelectedTable(tableName);
      setCurrentPage(page);
      
      // Buscar estrutura
      const structureResponse = await api.get(`/api/database/table/${tableName}/structure`);
      setColumns(structureResponse.data.columns);
      
      // Buscar dados
      const dataResponse = await api.get(`/api/database/table/${tableName}/data`, {
        params: {
          limit: itemsPerPage,
          offset: page * itemsPerPage
        }
      });
      setTableData(dataResponse.data);
      setQueryResult(null);
    } catch (error) {
      console.error('Erro ao carregar dados da tabela:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async () => {
    if (!customQuery.trim()) return;
    
    try {
      setLoading(true);
      const response = await api.post('/api/database/query', { query: customQuery });
      setQueryResult(response.data);
      setTableData(null);
    } catch (error: any) {
      alert(`Erro: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'NULL';
    if (value === true) return '✓';
    if (value === false) return '✗';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const totalPages = tableData ? Math.ceil(tableData.total / itemsPerPage) : 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Database Viewer</h1>
          <p className="text-gray-600">Visualize as tabelas e dados do PostgreSQL</p>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Sidebar com lista de tabelas */}
        <div className="w-64 bg-white shadow-md overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Tabelas</h2>
            {loading && !tables.length ? (
              <p>Carregando...</p>
            ) : (
              <ul className="space-y-2">
                {tables.map((table) => (
                  <li
                    key={table.table_name}
                    onClick={() => loadTableData(table.table_name)}
                    className={`cursor-pointer p-2 rounded hover:bg-gray-100 ${
                      selectedTable === table.table_name ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="font-medium">{table.table_name}</div>
                    <div className="text-sm text-gray-600">
                      {table.row_count} registros • {table.column_count} colunas
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Área principal */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Query customizada */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="text-lg font-semibold mb-2">Query SQL</h3>
            <div className="flex gap-2">
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM users LIMIT 10"
                className="flex-1 p-2 border rounded font-mono text-sm"
                rows={3}
              />
              <button
                onClick={executeQuery}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Executar
              </button>
            </div>
          </div>

          {/* Resultados */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : (
            <>
              {/* Resultado de query customizada */}
              {queryResult && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h3 className="font-semibold">Resultado da Query</h3>
                    <p className="text-sm text-gray-600">{queryResult.rowCount} registros</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {queryResult.fields.map((field: any) => (
                            <th key={field.name} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {field.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {queryResult.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {queryResult.fields.map((field: any) => (
                              <td key={field.name} className="px-4 py-2 text-sm text-gray-900">
                                {formatValue(row[field.name])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Dados da tabela selecionada */}
              {tableData && !queryResult && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h3 className="font-semibold">{tableData.tableName}</h3>
                    <p className="text-sm text-gray-600">
                      Mostrando {tableData.offset + 1} - {Math.min(tableData.offset + tableData.limit, tableData.total)} de {tableData.total} registros
                    </p>
                  </div>
                  
                  {/* Estrutura da tabela */}
                  <details className="px-4 py-3 border-b">
                    <summary className="cursor-pointer font-medium">Estrutura da Tabela</summary>
                    <table className="mt-2 text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="pr-4">Coluna</th>
                          <th className="pr-4">Tipo</th>
                          <th className="pr-4">Nullable</th>
                          <th>Default</th>
                        </tr>
                      </thead>
                      <tbody>
                        {columns.map((col) => (
                          <tr key={col.column_name}>
                            <td className="pr-4 font-mono">{col.column_name}</td>
                            <td className="pr-4">{col.data_type}</td>
                            <td className="pr-4">{col.is_nullable}</td>
                            <td>{col.column_default || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>

                  {/* Dados */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {tableData.data.length > 0 && Object.keys(tableData.data[0]).map((key) => (
                            <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableData.data.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {Object.entries(row).map(([key, value]) => (
                              <td key={key} className="px-4 py-2 text-sm text-gray-900">
                                {formatValue(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                      <button
                        onClick={() => loadTableData(selectedTable, currentPage - 1)}
                        disabled={currentPage === 0}
                        className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <span className="text-sm">
                        Página {currentPage + 1} de {totalPages}
                      </span>
                      <button
                        onClick={() => loadTableData(selectedTable, currentPage + 1)}
                        disabled={currentPage >= totalPages - 1}
                        className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseViewer;