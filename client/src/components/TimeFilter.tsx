import React from 'react';

interface TimeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const TimeFilter: React.FC<TimeFilterProps> = ({ value, onChange }) => {
  const timeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'dayBeforeYesterday', label: 'Day Before Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'last7Days', label: 'Last 7 Days' },
    { value: 'last14Days', label: 'Last 14 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'monthBeforeLast', label: 'Month Before Last' },
    { value: 'last30Days', label: 'Last 30 Days' },
    { value: 'last3Months', label: 'Last 3 Months' },
    { value: 'last6Months', label: 'Last 6 Months' },
    { value: 'last12Months', label: 'Last 12 Months' },
    { value: 'yearToDate', label: 'Year to Date' },
    { value: 'lastYear', label: 'Last Year' },
    { value: 'allTime', label: 'All Time' },
    { value: 'custom', label: 'Custom' }
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-[150px] px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
    >
      {timeOptions.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default TimeFilter;