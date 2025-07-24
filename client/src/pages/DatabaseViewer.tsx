import React, { useState, useEffect } from 'react';
import api from '../services/api';
import SQLFilters from '../components/SQLFilters';
import QueryResults from '../components/QueryResults';

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

interface CustomView {
  name: string;
  tables: string[];
  columns: { table: string; column: string; alias?: string }[];
  joins?: { from: string; to: string; on: string }[];
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
  const [showCreateView, setShowCreateView] = useState(false);
  const [viewBuilder, setViewBuilder] = useState<CustomView>({
    name: '',
    tables: [],
    columns: []
  });
  const [allColumns, setAllColumns] = useState<{[table: string]: Column[]}>({});
  
  // Estados para o sistema de filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filterResults, setFilterResults] = useState<any[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string>('');

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
      setAllColumns(prev => ({ ...prev, [tableName]: structureResponse.data.columns }));
      
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

  // Função para executar queries dos filtros
  const executeFilterQuery = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      setFilterLoading(true);
      setFilterError('');
      const response = await api.post('/api/database/query', { query });
      setFilterResults(response.data.rows);
      setQueryResult(null);
      setTableData(null);
    } catch (error: any) {
      setFilterError(error.response?.data?.error || error.message);
      setFilterResults([]);
    } finally {
      setFilterLoading(false);
    }
  };

  // Função para atualizar a query dos filtros
  const handleFilterQueryGenerated = (query: string) => {
    setCustomQuery(query);
  };

  const formatValue = (value: any, columnName?: string): React.ReactNode => {
    if (value === null) return <span className="text-gray-400 italic">NULL</span>;
    if (value === true) return <span className="text-green-600">✓</span>;
    if (value === false) return <span className="text-red-600">✗</span>;
    
    // Detectar URLs de imagem
    if (columnName && (columnName.includes('image') || columnName.includes('img') || columnName.includes('photo'))) {
      if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('//'))) {
        return (
          <img 
            src={value} 
            alt="Product" 
            className="h-16 w-16 object-cover rounded cursor-pointer hover:scale-150 transition-transform"
            onClick={() => window.open(value, '_blank')}
          />
        );
      }
    }
    
    // JSON objects
    if (typeof value === 'object') {
      return (
        <details className="cursor-pointer">
          <summary className="text-blue-600 hover:text-blue-800">JSON</summary>
          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-w-xs">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      );
    }
    
    // Long text
    if (String(value).length > 100) {
      return (
        <details className="cursor-pointer">
          <summary className="text-blue-600 hover:text-blue-800">
            {String(value).substring(0, 50)}...
          </summary>
          <div className="text-sm mt-1 whitespace-pre-wrap">{value}</div>
        </details>
      );
    }
    
    return String(value);
  };

  const handleAddTable = (tableName: string) => {
    if (!viewBuilder.tables.includes(tableName)) {
      setViewBuilder(prev => ({
        ...prev,
        tables: [...prev.tables, tableName]
      }));
      
      // Load columns for this table if not loaded
      if (!allColumns[tableName]) {
        api.get(`/api/database/table/${tableName}/structure`).then(response => {
          setAllColumns(prev => ({ ...prev, [tableName]: response.data.columns }));
        });
      }
    }
  };

  const handleAddColumn = (table: string, column: string) => {
    const exists = viewBuilder.columns.some(c => c.table === table && c.column === column);
    if (!exists) {
      setViewBuilder(prev => ({
        ...prev,
        columns: [...prev.columns, { table, column }]
      }));
    }
  };

  const handleRemoveColumn = (index: number) => {
    setViewBuilder(prev => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index)
    }));
  };

  const generateViewQuery = () => {
    if (viewBuilder.columns.length === 0) return '';
    
    const selectClauses = viewBuilder.columns.map(col => 
      `${col.table}.${col.column}${col.alias ? ` AS "${col.alias}"` : ''}`
    );
    
    const fromClause = viewBuilder.tables[0];
    const joinClauses = viewBuilder.tables.slice(1).map(table => 
      `LEFT JOIN ${table} ON ${viewBuilder.tables[0]}.id = ${table}.${viewBuilder.tables[0]}_id`
    );
    
    const query = `SELECT ${selectClauses.join(', ')}
FROM ${fromClause}
${joinClauses.join('\n')}
LIMIT 100`;
    
    setCustomQuery(query);
    setShowCreateView(false);
  };

  const totalPages = tableData ? Math.ceil(tableData.total / itemsPerPage) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-4xl">🗄️</span>
                Database Viewer
              </h1>
              <p className="text-gray-600 mt-1">Explore e visualize os dados do PostgreSQL com filtros inteligentes</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  showFilters 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                <span>🔽</span>
                {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
              </button>
              <button
                onClick={() => setShowCreateView(!showCreateView)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                Criar View Customizada
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-88px)]">
        {/* Sidebar com lista de tabelas */}
        <div className="w-80 bg-white shadow-xl overflow-y-auto border-r border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <span>📋</span>
              Tabelas Disponíveis
            </h2>
            {loading && !tables.length ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              <ul className="space-y-2">
                {tables.map((table) => (
                  <li
                    key={table.table_name}
                    onClick={() => loadTableData(table.table_name)}
                    className={`cursor-pointer p-4 rounded-lg transition-all duration-200 ${
                      selectedTable === table.table_name 
                        ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 shadow-md' 
                        : 'hover:bg-gray-50 hover:shadow-sm border-l-4 border-transparent'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{table.table_name}</div>
                    <div className="text-sm text-gray-600 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="text-orange-500">📊</span>
                        {table.row_count.toLocaleString()} registros
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-blue-500">📐</span>
                        {table.column_count} colunas
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Área principal */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Filtros SQL Inteligentes */}
          {showFilters && (
            <SQLFilters 
              onQueryGenerated={handleFilterQueryGenerated}
              onExecuteQuery={executeFilterQuery}
            />
          )}

          {/* Resultados dos Filtros */}
          {showFilters && (filterResults.length > 0 || filterLoading || filterError) && (
            <QueryResults 
              results={filterResults}
              loading={filterLoading}
              error={filterError}
            />
          )}

          {/* Create View Modal */}
          {showCreateView && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
              <h3 className="text-xl font-bold mb-4 text-gray-800">🔧 Criar View Customizada</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da View</label>
                <input
                  type="text"
                  value={viewBuilder.name}
                  onChange={(e) => setViewBuilder(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="minha_view_customizada"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Selecione as Tabelas</label>
                <div className="flex flex-wrap gap-2">
                  {tables.map(table => (
                    <button
                      key={table.table_name}
                      onClick={() => handleAddTable(table.table_name)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        viewBuilder.tables.includes(table.table_name)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      {table.table_name}
                    </button>
                  ))}
                </div>
              </div>

              {viewBuilder.tables.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecione as Colunas</label>
                  <div className="max-h-60 overflow-y-auto border rounded-lg p-3">
                    {viewBuilder.tables.map(table => (
                      <div key={table} className="mb-3">
                        <h4 className="font-medium text-gray-800 mb-2">{table}</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {allColumns[table]?.map(col => (
                            <label key={col.column_name} className="flex items-center gap-1 text-sm">
                              <input
                                type="checkbox"
                                checked={viewBuilder.columns.some(c => c.table === table && c.column === col.column_name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    handleAddColumn(table, col.column_name);
                                  } else {
                                    const idx = viewBuilder.columns.findIndex(c => c.table === table && c.column === col.column_name);
                                    if (idx >= 0) handleRemoveColumn(idx);
                                  }
                                }}
                                className="text-orange-500 focus:ring-orange-500"
                              />
                              <span>{col.column_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={generateViewQuery}
                  disabled={viewBuilder.columns.length === 0}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Gerar Query
                </button>
                <button
                  onClick={() => setShowCreateView(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Query customizada */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <span>🔍</span>
              Query SQL
            </h3>
            <div className="flex gap-3">
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM products LIMIT 10"
                className="flex-1 p-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                rows={4}
              />
              <button
                onClick={executeQuery}
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
              >
                <span>▶️</span>
                Executar
              </button>
            </div>
          </div>

          {/* Resultados */}
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando dados...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Resultado de query customizada */}
              {queryResult && !showFilters && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                    <h3 className="font-bold text-lg text-gray-800">📊 Resultado da Query</h3>
                    <p className="text-sm text-gray-600 mt-1">{queryResult.rowCount} registros encontrados</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {queryResult.fields.map((field: any) => (
                            <th key={field.name} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {field.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {queryResult.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            {queryResult.fields.map((field: any) => (
                              <td key={field.name} className="px-6 py-4 text-sm text-gray-900">
                                {formatValue(row[field.name], field.name)}
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
              {tableData && !queryResult && !showFilters && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                    <h3 className="font-bold text-xl text-gray-800">📋 {tableData.tableName}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Mostrando {tableData.offset + 1} - {Math.min(tableData.offset + tableData.limit, tableData.total)} de {tableData.total.toLocaleString()} registros
                    </p>
                  </div>
                  
                  {/* Estrutura da tabela */}
                  <details className="px-6 py-4 border-b bg-gray-50">
                    <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                      🔧 Estrutura da Tabela
                    </summary>
                    <div className="mt-4 overflow-x-auto">
                      <table className="text-sm">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="pb-2 pr-6 font-medium text-gray-700">Coluna</th>
                            <th className="pb-2 pr-6 font-medium text-gray-700">Tipo</th>
                            <th className="pb-2 pr-6 font-medium text-gray-700">Nullable</th>
                            <th className="pb-2 font-medium text-gray-700">Default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {columns.map((col) => (
                            <tr key={col.column_name}>
                              <td className="py-2 pr-6 font-mono text-blue-600">{col.column_name}</td>
                              <td className="py-2 pr-6 text-gray-700">{col.data_type}</td>
                              <td className="py-2 pr-6">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  col.is_nullable === 'YES' 
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {col.is_nullable}
                                </span>
                              </td>
                              <td className="py-2 text-gray-600">{col.column_default || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>

                  {/* Dados */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {tableData.data.length > 0 && Object.keys(tableData.data[0]).map((key) => (
                            <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableData.data.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            {Object.entries(row).map(([key, value]) => (
                              <td key={key} className="px-6 py-4 text-sm text-gray-900">
                                {formatValue(value, key)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
                      <button
                        onClick={() => loadTableData(selectedTable, currentPage - 1)}
                        disabled={currentPage === 0}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        ← Anterior
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">
                          Página
                        </span>
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">
                          {currentPage + 1}
                        </span>
                        <span className="text-sm text-gray-700">
                          de {totalPages}
                        </span>
                      </div>
                      <button
                        onClick={() => loadTableData(selectedTable, currentPage + 1)}
                        disabled={currentPage >= totalPages - 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Próxima →
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