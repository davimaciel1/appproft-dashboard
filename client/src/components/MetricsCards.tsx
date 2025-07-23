import React from 'react';

interface MetricsProps {
  metrics: {
    todaysSales: number;
    ordersCount: number;
    unitsSold: number;
    avgUnitsPerOrder: string;
    netProfit: number;
    profitMargin: string;
    acos: string;
    yesterdayComparison: number;
    newOrders: number;
  };
}

const MetricsCards: React.FC<MetricsProps> = ({ metrics }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Today's Sales</h3>
        <p className="metric-value text-gray-900">{formatCurrency(metrics.todaysSales)}</p>
        <p className="variation text-green-600 mt-2">
          ↑ {metrics.yesterdayComparison}% vs yesterday
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Orders</h3>
        <p className="metric-value text-gray-900">{metrics.ordersCount}</p>
        <span className="inline-block bg-green-100 text-green-800 text-sm px-2 py-1 rounded mt-2">
          +{metrics.newOrders} new
        </span>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Units Sold</h3>
        <p className="metric-value text-gray-900">{metrics.unitsSold}</p>
        <p className="text-sm text-gray-500 mt-2">{metrics.avgUnitsPerOrder} units/order</p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md">
        <h3 className="text-sm font-medium text-gray-600 mb-2">ACOS</h3>
        <p className="metric-value text-gray-900">{metrics.acos}%</p>
        <p className="variation text-orange-600 mt-2">Target: 15%</p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Net Profit</h3>
        <p className="metric-value text-green-600">{formatCurrency(metrics.netProfit)}</p>
        <p className="text-sm text-gray-500 mt-2">{metrics.profitMargin}% margin</p>
      </div>
    </div>
  );
};

export default MetricsCards;