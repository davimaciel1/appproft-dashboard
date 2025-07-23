import React from 'react';

interface Product {
  id: number;
  name: string;
  sku: string;
  marketplace: string;
  country: string;
  image: string;
  units: number;
  revenue: number;
  profit: number;
  roi: number;
  acos: number;
  inventory: number;
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Produto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              SKU
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unidades
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
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              ACOS
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estoque
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="relative">
                    <img 
                      src={product.image || `https://via.placeholder.com/40/FF8C00/FFFFFF?text=${product.name.charAt(0)}`} 
                      alt={product.name}
                      className="h-10 w-10 rounded-lg object-cover"
                      onError={(e) => {
                        e.currentTarget.src = `https://via.placeholder.com/40/FF8C00/FFFFFF?text=${product.name.charAt(0)}`;
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
                    <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {product.name}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                {product.sku}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                {product.units}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {formatCurrency(product.revenue)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-right">
                <span className={product.profit > 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(product.profit)}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white ${getRoiBadgeColor(product.roi)}`}>
                  {product.roi}%
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {product.acos}%
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {product.inventory}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;