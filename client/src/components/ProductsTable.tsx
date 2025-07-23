import React from 'react';

interface Product {
  id: string;
  name: string;
  sku: string;
  marketplace: string;
  country: string;
  image: string;
  units: number;
  todayUnits: number;
  revenue: number;
  profit: number;
  profitMargin: number;
  roi: number;
  acos: number;
  inventory: number;
  alertLevel: number;
  rank: number;
  totalOrders: number;
}

interface ProductsTableProps {
  products: Product[];
}

const ProductsTable: React.FC<ProductsTableProps> = ({ products }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getRoiBadgeColor = (roi: number) => {
    if (roi > 100) return 'bg-green-500';
    if (roi > 50) return 'bg-green-400';
    if (roi > 20) return 'bg-yellow-500';
    if (roi > 10) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getMarketplaceLogo = (marketplace: string) => {
    if (marketplace === 'amazon') {
      return '🟠';
    }
    return '💛';
  };

  const getCountryFlag = (country: string) => {
    const flags: { [key: string]: string } = {
      'BR': '🇧🇷',
      'US': '🇺🇸',
      'MX': '🇲🇽'
    };
    return flags[country] || '🌎';
  };

  const StockIndicator: React.FC<{ current: number; alert: number }> = ({ current, alert }) => {
    const status = current <= alert ? 'critical' : current <= alert * 2 ? 'warning' : 'good';
    const colors = {
      critical: 'text-red-600 bg-red-100',
      warning: 'text-yellow-600 bg-yellow-100',
      good: 'text-green-600 bg-green-100'
    };
    
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {current}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ranking
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Produto
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vendas Totais
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vendas Hoje
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Receita
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lucro
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              ROI
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estoque
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-4 whitespace-nowrap text-center">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm ${
                  product.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                  product.rank === 2 ? 'bg-gray-100 text-gray-800' :
                  product.rank === 3 ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  #{product.rank}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="relative">
                    <img 
                      src={product.image || `/placeholder.png`} 
                      alt={product.name}
                      className="h-10 w-10 rounded-lg object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.png';
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 text-xs">
                      {getMarketplaceLogo(product.marketplace)}
                    </span>
                    <span className="absolute -top-1 -right-1 text-xs">
                      {getCountryFlag(product.country)}
                    </span>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {product.name}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {product.sku} • {product.marketplace}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
                <div>
                  <strong className="text-sm font-semibold text-primary-dark">
                    {product.units.toLocaleString()}
                  </strong>
                  <br />
                  <small className="text-xs text-gray-500">
                    {product.totalOrders} pedidos
                  </small>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
                <span className="text-sm font-medium text-gray-900">
                  {product.todayUnits || 0}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {formatCurrency(product.revenue)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <div>
                  <span className={`text-sm font-medium ${product.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(product.profit)}
                  </span>
                  <br />
                  <small className="text-xs text-gray-500">
                    {product.profitMargin.toFixed(1)}% margem
                  </small>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white ${getRoiBadgeColor(product.roi)}`}>
                  {product.roi.toFixed(1)}%
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
                <StockIndicator current={product.inventory} alert={product.alertLevel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;