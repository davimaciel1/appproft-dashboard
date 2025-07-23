import React, { useState } from 'react';

const FiltersBar: React.FC = () => {
  const [selectedMarketplace, setSelectedMarketplace] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedCountry, setSelectedCountry] = useState('BR');

  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
      <div className="relative">
        <select
          value={selectedMarketplace}
          onChange={(e) => setSelectedMarketplace(e.target.value)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:border-primary-orange hover:bg-gray-50"
        >
          <option value="all">Todos Marketplaces</option>
          <option value="amazon">Amazon</option>
          <option value="mercadolivre">Mercado Livre</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>

      <div className="relative">
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:border-primary-orange hover:bg-gray-50"
        >
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="last7days">Últimos 7 dias</option>
          <option value="last30days">Últimos 30 dias</option>
          <option value="thisMonth">Este mês</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>

      <div className="relative">
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:border-primary-orange hover:bg-gray-50"
        >
          <option value="BR">Brasil</option>
          <option value="US">Estados Unidos</option>
          <option value="MX">México</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>

      <button className="bg-primary-orange text-white px-4 py-2 rounded-lg hover:shadow-hover font-medium">
        Aplicar Filtros
      </button>

      <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium">
        Limpar Filtros
      </button>
    </div>
  );
};

export default FiltersBar;