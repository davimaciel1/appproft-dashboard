import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ children, className = '' }) => {
  return (
    <div className={`rounded-lg bg-yellow-50 p-4 ${className}`}>
      <div className="flex">
        {children}
      </div>
    </div>
  );
};

export const AlertDescription: React.FC<AlertProps> = ({ children, className = '' }) => {
  return (
    <div className={`ml-3 text-sm text-yellow-700 ${className}`}>
      {children}
    </div>
  );
};

export const AlertTitle: React.FC<AlertProps> = ({ children, className = '' }) => {
  return (
    <h3 className={`text-base font-medium text-yellow-800 ${className}`}>
      {children}
    </h3>
  );
};