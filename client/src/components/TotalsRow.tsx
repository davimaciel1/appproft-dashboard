import React from 'react';

interface TotalsData {
  units: number;
  unitsVariation: number;
  revenue: number;
  profit: number;
  roi: number;
  margin: number;
  acos: number;
  breakEven: number;
}

interface TotalsRowProps {
  data: TotalsData;
}

const TotalsRow: React.FC<TotalsRowProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="flex items-center bg-gray-700 text-white h-[50px] px-4">
      {/* Totals Label */}
      <div className="w-[350px] font-medium">
        Totals
      </div>

      {/* Units */}
      <div className="w-[120px] text-center">
        <span className="font-medium">{data.units.toLocaleString()}</span>
        {data.unitsVariation > 0 && (
          <span className="text-orange-400 text-sm ml-1">+{data.unitsVariation}</span>
        )}
      </div>

      {/* Revenue */}
      <div className="w-[150px] text-right">
        <span className="text-blue-400 font-medium">{formatCurrency(data.revenue)}</span>
      </div>

      {/* Profit */}
      <div className="w-[150px] text-right">
        <span className="text-green-400 font-medium">{formatCurrency(data.profit)}</span>
      </div>

      {/* ROI */}
      <div className="w-[120px] text-center">
        <div className="font-medium">{formatPercentage(data.roi)}</div>
        <div className="text-gray-400 text-xs">Margin: {formatPercentage(data.margin)}</div>
      </div>

      {/* ACOS */}
      <div className="w-[120px] text-center">
        <div className="font-medium">{formatPercentage(data.acos)}</div>
        <div className="text-gray-400 text-xs">B/E: {formatPercentage(data.breakEven)}</div>
      </div>
    </div>
  );
};

export default TotalsRow;