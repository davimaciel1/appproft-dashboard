import React from 'react';

interface ProductData {
  id: string;
  imageUrl: string;
  marketplaceLogo: 'amazon' | 'mercadolivre';
  countryFlag: string;
  name: string;
  sku: string;
  units: number;
  unitsVariation: number;
  revenue: number;
  profit: number;
  roi: number;
  margin: number;
  acos: number;
  breakEven: number;
}

interface ProductRowProps {
  product: ProductData;
  isEven: boolean;
}

const ProductRow: React.FC<ProductRowProps> = ({ product, isEven }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getMarketplaceLogo = (marketplace: string) => {
    if (marketplace === 'amazon') {
      return (
        <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center text-white text-xs font-bold">
          A
        </div>
      );
    }
    return (
      <div className="w-5 h-5 bg-yellow-500 rounded flex items-center justify-center text-white text-xs font-bold">
        ML
      </div>
    );
  };

  const getCountryFlag = (country: string) => {
    const flags: { [key: string]: string } = {
      'US': '🇺🇸',
      'BR': '🇧🇷',
      'MX': '🇲🇽'
    };
    return flags[country] || '🌎';
  };

  return (
    <div className={`flex items-center px-4 py-3 hover:bg-gray-100 transition-colors ${isEven ? 'bg-gray-50' : 'bg-white'}`}>
      {/* Product Column - 350px */}
      <div className="w-[350px] flex items-center">
        <div className="relative">
          <img 
            src={product.imageUrl || '/placeholder-product.svg'} 
            alt={product.name}
            className="w-[60px] h-[60px] rounded-lg object-cover"
            onError={(e) => {
              e.currentTarget.src = '/placeholder-product.svg';
            }}
          />
          {/* Marketplace logo */}
          <div className="absolute bottom-0 right-0 bg-white rounded-full p-0.5">
            {getMarketplaceLogo(product.marketplaceLogo)}
          </div>
          {/* Country flag */}
          <div className="absolute top-0 left-0">
            <span className="text-base">{getCountryFlag(product.countryFlag)}</span>
          </div>
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{product.name}</h4>
          <p className="text-sm text-gray-500">{product.sku}</p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button className="p-1 hover:bg-gray-200 rounded">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button className="p-1 hover:bg-gray-200 rounded">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          <button className="p-1 hover:bg-gray-200 rounded">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Units Column - 120px */}
      <div className="w-[120px] text-center">
        <div className="flex items-center justify-center">
          <span className="text-lg font-medium">{product.units.toLocaleString()}</span>
          {product.unitsVariation > 0 && (
            <span className="text-orange-500 text-sm ml-1">+{product.unitsVariation}</span>
          )}
        </div>
        <button className="mt-1 p-1 hover:bg-gray-200 rounded">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Revenue Column - 150px */}
      <div className="w-[150px] text-right">
        <div className="text-blue-500 font-medium">{formatCurrency(product.revenue)}</div>
        <button className="mt-1 p-1 hover:bg-gray-200 rounded">
          <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      </div>

      {/* Profit Column - 150px */}
      <div className="w-[150px] text-right">
        <div className={`font-medium flex items-center justify-end ${product.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatCurrency(product.profit)}
          {product.profit >= 0 ? (
            <span className="ml-1">▲</span>
          ) : (
            <span className="ml-1">▼</span>
          )}
        </div>
        <button className="mt-1 p-1 hover:bg-gray-200 rounded">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* ROI Column - 120px */}
      <div className="w-[120px] text-center">
        <div className="font-medium">{formatPercentage(product.roi)}</div>
        <div className="text-xs text-gray-500">Margin: {formatPercentage(product.margin)}</div>
      </div>

      {/* ACOS Column - 120px */}
      <div className="w-[120px] text-center">
        <div className="font-medium">{formatPercentage(product.acos)}</div>
        <div className="text-xs text-gray-500">B/E: {formatPercentage(product.breakEven)}</div>
        <button className="mt-1 p-1 hover:bg-gray-200 rounded">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ProductRow;