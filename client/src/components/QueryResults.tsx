import React from 'react';

interface QueryResult {
  asin: string;
  image_url?: string;
  product_name: string;
  total_vendas: number;
  total_pedidos: number;
  total_revenue: number;
  marketplace: string;
  country_code?: string;
}

interface QueryResultsProps {
  results: QueryResult[];
  loading: boolean;
  error?: string;
  executionTime?: number;
}

const QueryResults: React.FC<QueryResultsProps> = ({ 
  results, 
  loading, 
  error, 
  executionTime 
}) => {
  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Executando consulta...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              ❌
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Erro na Consulta
            </h3>
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg font-mono">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!results || results.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            📭
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Nenhum resultado encontrado
          </h3>
          <p className="text-gray-600">
            Tente ajustar os filtros para ver mais dados.
          </p>
        </div>
      </div>
    );
  }

  // Função para formatar marketplace
  const getMarketplaceBadge = (marketplace: string) => {
    const badges = {
      amazon: {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        label: 'Amazon'
      },
      mercadolivre: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800', 
        label: 'Mercado Livre'
      }
    };

    const badge = badges[marketplace as keyof typeof badges] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: marketplace
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Função para formatar números
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 text-white px-6 py-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            📊 Resultados da Consulta
          </h3>
          <div className="flex items-center space-x-4 text-sm">
            <span className="text-gray-300">
              {formatNumber(results.length)} produtos encontrados
            </span>
            {executionTime && (
              <span className="text-gray-300">
                ⚡ {executionTime}ms
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ASIN
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendas
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pedidos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receita
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marketplace
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((produto, index) => (
                <tr 
                  key={`${produto.asin}-${index}`}
                  className="hover:bg-orange-50 transition-colors duration-150"
                >
                  {/* Produto */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <img
                          src={produto.image_url || '/placeholder-product.png'}
                          alt={produto.product_name}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/placeholder-product.png';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p 
                          className="text-sm font-medium text-gray-900 truncate max-w-xs"
                          title={produto.product_name}
                        >
                          {produto.product_name}
                        </p>
                        {produto.country_code && (
                          <p className="text-xs text-gray-500">
                            🌍 {produto.country_code}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* ASIN */}
                  <td className="px-6 py-4">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                      {produto.asin}
                    </code>
                  </td>

                  {/* Vendas */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-bold text-gray-900">
                      {formatNumber(produto.total_vendas)}
                    </span>
                  </td>

                  {/* Pedidos */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-bold text-gray-900">
                      {formatNumber(produto.total_pedidos)}
                    </span>
                  </td>

                  {/* Receita */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(produto.total_revenue)}
                    </span>
                  </td>

                  {/* Marketplace */}
                  <td className="px-6 py-4 text-center">
                    {getMarketplaceBadge(produto.marketplace)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer com estatísticas */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div className="flex space-x-6">
            <span>
              📦 <strong>{formatNumber(results.reduce((sum, p) => sum + p.total_vendas, 0))}</strong> unidades vendidas
            </span>
            <span>
              🛒 <strong>{formatNumber(results.reduce((sum, p) => sum + p.total_pedidos, 0))}</strong> pedidos totais
            </span>
            <span>
              💰 <strong>{formatCurrency(results.reduce((sum, p) => sum + p.total_revenue, 0))}</strong> receita total
            </span>
          </div>
          <div>
            Mostrando {Math.min(50, results.length)} de {results.length} produtos
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryResults;