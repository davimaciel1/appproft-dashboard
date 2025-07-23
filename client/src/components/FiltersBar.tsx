import React, { useState, useEffect } from 'react';
import TimeFilter from './TimeFilter';

interface FiltersBarProps {
  onFiltersChange: (filters: {
    period: string;
    marketplace: string;
    orderStatus: string;
    brand: string;
    search: string;
  }) => void;
}

const FiltersBar: React.FC<FiltersBarProps> = ({ onFiltersChange }) => {
  const [period, setPeriod] = useState('today');
  const [marketplace, setMarketplace] = useState('all');
  const [orderStatus, setOrderStatus] = useState('all');
  const [brand, setBrand] = useState('all');
  const [search, setSearch] = useState('');

  // Auto-aplicar filtros quando mudam
  useEffect(() => {
    onFiltersChange({
      period,
      marketplace,
      orderStatus,
      brand,
      search
    });
  }, [period, marketplace, orderStatus, brand, search]);

  return (
    <div className="bg-white p-4 border-b border-gray-200">
      <div className="flex items-center gap-3">
        {/* Time Period Filter */}
        <TimeFilter value={period} onChange={setPeriod} />

        {/* Markets Filter */}
        <select
          value={marketplace}
          onChange={(e) => setMarketplace(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="all">All Markets</option>
          <option value="amazon">Amazon</option>
          <option value="mercadolivre">Mercado Livre</option>
        </select>

        {/* Order Status Filter */}
        <select
          value={orderStatus}
          onChange={(e) => setOrderStatus(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="all">All Orders</option>
          <option value="pending">Pending</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Brands Filter */}
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="all">All Brands & Seller IDs</option>
          {/* Brands serão populados dinamicamente */}
        </select>

        {/* Search Field */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Enter ASIN, SKU, Order or Keyword"
            className="w-full px-3 py-2 pl-3 pr-10 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiltersBar;