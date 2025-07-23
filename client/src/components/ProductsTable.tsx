import React from 'react';
import ProductRow from './ProductRow';
import TotalsRow from './TotalsRow';

interface Product {
  id: string;
  imageUrl: string;
  marketplace: 'amazon' | 'mercadolivre';
  country: string;
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

interface ProductsTableProps {
  products: Product[];
}

const ProductsTable: React.FC<ProductsTableProps> = ({ products }) => {
  // Calcular totais
  const totals = products.reduce((acc, product) => ({
    units: acc.units + product.units,
    unitsVariation: acc.unitsVariation + product.unitsVariation,
    revenue: acc.revenue + product.revenue,
    profit: acc.profit + product.profit,
    roi: acc.revenue > 0 ? ((acc.profit / acc.revenue) * 100) : 0,
    margin: acc.revenue > 0 ? ((acc.profit / acc.revenue) * 100) : 0,
    acos: 0, // Será calculado com dados de advertising
    breakEven: 0 // Será calculado com dados de advertising
  }), {
    units: 0,
    unitsVariation: 0,
    revenue: 0,
    profit: 0,
    roi: 0,
    margin: 0,
    acos: 0,
    breakEven: 0
  });

  // Converter produtos para o formato esperado pelo ProductRow
  const formattedProducts = products.map(product => ({
    ...product,
    imageUrl: product.imageUrl || '/placeholder.png',
    marketplaceLogo: product.marketplace as 'amazon' | 'mercadolivre',
    countryFlag: product.country
  }));

  return (
    <div className="w-full">
      {/* Totals Row */}
      <TotalsRow data={totals} />
      
      {/* Products */}
      <div className="bg-white">
        {formattedProducts.map((product, index) => (
          <ProductRow 
            key={product.id} 
            product={product} 
            isEven={index % 2 === 1}
          />
        ))}
        
        {/* Empty state */}
        {products.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum produto encontrado
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsTable;