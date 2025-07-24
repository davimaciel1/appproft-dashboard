import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface Product {
  product_id: string;
  name: string;
  sku: string;
  asin: string;
  units_ordered: number;
  revenue: number;
  page_views: number;
  sessions: number;
  conversion_rate: number;
  image_url?: string;
  marketplace: string;
}

interface AggregatedData {
  data: Product[];
  totals: {
    total_units: number;
    total_revenue: number;
    total_products: number;
    avg_conversion_rate: number;
    avg_ticket: number;
  };
}

const AggregatedMetrics: React.FC = () => {
  const [data, setData] = useState<AggregatedData | null>(null);
  const [filteredData, setFilteredData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Product>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // today
    marketplace: 'all',
    asinLevel: 'all'
  });

  const itemsPerPage = 50;

  useEffect(() => {
    fetchAggregatedMetrics();
  }, [filters]);

  useEffect(() => {
    if (data) {
      filterAndSortData();
    }
  }, [data, searchTerm, sortField, sortDirection]);

  const fetchAggregatedMetrics = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        aggregationType: 'byAsin',
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      if (filters.marketplace !== 'all') {
        params.append('marketplace', filters.marketplace);
      }

      if (filters.asinLevel !== 'all') {
        params.append('asinLevel', filters.asinLevel);
      }

      const response = await api.get(`/api/dashboard/aggregated-metrics?${params}`);
      
      if (response.data && Array.isArray(response.data.data)) {
        const processedData: AggregatedData = {
          data: response.data.data.map((item: any) => ({
            product_id: item.product_id || item.asin,
            name: item.name || item.title || 'Produto sem nome',
            sku: item.sku || item.seller_sku || '-',
            asin: item.asin,
            units_ordered: Number(item.units_ordered) || 0,
            revenue: Number(item.revenue) || 0,
            page_views: Number(item.page_views) || 0,
            sessions: Number(item.sessions) || 0,
            conversion_rate: Number(item.conversion_rate) || 0,
            image_url: item.image_url,
            marketplace: item.marketplace || 'Amazon'
          })),
          totals: {
            total_units: response.data.data.reduce((sum: number, item: any) => sum + (Number(item.units_ordered) || 0), 0),
            total_revenue: response.data.data.reduce((sum: number, item: any) => sum + (Number(item.revenue) || 0), 0),
            total_products: response.data.data.length,
            avg_conversion_rate: response.data.data.reduce((sum: number, item: any) => sum + (Number(item.conversion_rate) || 0), 0) / response.data.data.length,
            avg_ticket: 0
          }
        };
        
        // Calculate average ticket
        processedData.totals.avg_ticket = processedData.totals.total_units > 0 
          ? processedData.totals.total_revenue / processedData.totals.total_units 
          : 0;

        setData(processedData);
      } else {
        setData({ data: [], totals: { total_units: 0, total_revenue: 0, total_products: 0, avg_conversion_rate: 0, avg_ticket: 0 } });
      }
      
    } catch (error) {
      console.error('Error fetching aggregated metrics:', error);
      toast.error('Erro ao carregar métricas agregadas');
      setData({ data: [], totals: { total_units: 0, total_revenue: 0, total_products: 0, avg_conversion_rate: 0, avg_ticket: 0 } });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortData = () => {
    if (!data) return;

    let filtered = data.data.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.asin.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });

    // Sort data
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      }
    });

    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleSort = (field: keyof Product) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleFiltersSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(filters.endDate) < new Date(filters.startDate)) {
      toast.error('Data final não pode ser anterior à data inicial');
      return;
    }
    fetchAggregatedMetrics();
  };

  const exportToCSV = () => {
    if (!filteredData.length) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = ['Produto', 'SKU', 'ASIN', 'Unidades', 'Receita', 'Visualizações', 'Sessões', 'Conversão (%)'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(product => [
        `"${product.name}"`,
        product.sku,
        product.asin,
        product.units_ordered,
        product.revenue.toFixed(2),
        product.page_views,
        product.sessions,
        product.conversion_rate.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `metricas-agregadas-${filters.startDate}-${filters.endDate}.csv`;
    link.click();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const showPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);

    if (endPage - startPage + 1 < showPages) {
      startPage = Math.max(1, endPage - showPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`px-3 py-1 mx-1 rounded ${
            currentPage === i
              ? 'bg-orange-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex justify-center items-center mt-6 space-x-2">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ‹
        </button>
        {pages}
        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ›
        </button>
      </div>
    );
  };

  const SortIcon = ({ field }: { field: keyof Product }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return sortDirection === 'asc' ? <span className="text-white">↑</span> : <span className="text-white">↓</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Métricas Agregadas</h1>
          <p className="mt-2 text-gray-600">Análise detalhada de performance por produto</p>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <form onSubmit={handleFiltersSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Marketplace</label>
              <select
                value={filters.marketplace}
                onChange={(e) => setFilters({...filters, marketplace: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Todos</option>
                <option value="Amazon">Amazon</option>
                <option value="MercadoLivre">Mercado Livre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nível ASIN</label>
              <select
                value={filters.asinLevel}
                onChange={(e) => setFilters({...filters, asinLevel: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Todos</option>
                <option value="PARENT">Parent</option>
                <option value="CHILD">Child</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <button
                type="submit"
                className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700 transition-colors"
              >
                Aplicar Filtros
              </button>
            </div>
          </form>
        </div>

        {/* Summary Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-sm font-medium text-gray-500">Receita Total</h3>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totals.total_revenue)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-sm font-medium text-gray-500">Unidades Vendidas</h3>
              <p className="text-2xl font-bold text-blue-600">{formatNumber(data.totals.total_units)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-sm font-medium text-gray-500">Produtos Ativos</h3>
              <p className="text-2xl font-bold text-purple-600">{formatNumber(data.totals.total_products)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-sm font-medium text-gray-500">Ticket Médio</h3>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.totals.avg_ticket)}</p>
            </div>
          </div>
        )}

        {/* Search and Export */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar por produto, SKU ou ASIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <button
              onClick={exportToCSV}
              className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Produto
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                    onClick={() => handleSort('sku')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>SKU</span>
                      <SortIcon field="sku" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                    onClick={() => handleSort('asin')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>ASIN</span>
                      <SortIcon field="asin" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                    onClick={() => handleSort('units_ordered')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Unidades</span>
                      <SortIcon field="units_ordered" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                    onClick={() => handleSort('revenue')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Receita</span>
                      <SortIcon field="revenue" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                    onClick={() => handleSort('page_views')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Views</span>
                      <SortIcon field="page_views" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                    onClick={() => handleSort('sessions')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Sessões</span>
                      <SortIcon field="sessions" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                    onClick={() => handleSort('conversion_rate')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Conversão</span>
                      <SortIcon field="conversion_rate" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.length > 0 ? (
                  paginatedData.map((product, index) => (
                    <tr
                      key={product.product_id || index}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img
                              className="h-10 w-10 rounded-md object-cover"
                              src={product.image_url || '/placeholder-product.png'}
                              alt={product.name}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-product.png';
                              }}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                              {product.name}
                            </div>
                            <div className="text-sm text-gray-500">{product.marketplace}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.asin}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                        {formatNumber(product.units_ordered)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                        {formatCurrency(product.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(product.page_views)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(product.sessions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {product.conversion_rate.toFixed(2)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <p className="text-lg font-medium">Nenhum produto encontrado</p>
                        <p className="text-sm">Ajuste os filtros ou período para ver dados</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {paginatedData.length > 0 && data && (
                <tfoot className="bg-gray-100 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-sm text-gray-900">
                      <strong>Totais ({filteredData.length} produtos)</strong>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      <strong>{formatNumber(filteredData.reduce((sum, p) => sum + p.units_ordered, 0))}</strong>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      <strong>{formatCurrency(filteredData.reduce((sum, p) => sum + p.revenue, 0))}</strong>
                    </td>
                    <td colSpan={3} className="px-6 py-4 text-sm text-gray-500 text-right">
                      Ticket médio: <strong>{formatCurrency(
                        filteredData.reduce((sum, p) => sum + p.units_ordered, 0) > 0
                          ? filteredData.reduce((sum, p) => sum + p.revenue, 0) / filteredData.reduce((sum, p) => sum + p.units_ordered, 0)
                          : 0
                      )}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          {renderPagination()}
        </div>
      </div>
    </div>
  );
};

export default AggregatedMetrics;