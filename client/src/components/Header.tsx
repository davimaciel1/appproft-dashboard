import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-primary-orange">AppProft</h1>
        </div>
        
        <nav className="flex items-center space-x-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Dashboard
          </button>
          <button 
            onClick={() => navigate('/credentials')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Credenciais
          </button>
          <button 
            onClick={() => navigate('/aggregated-metrics')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Métricas Agregadas
          </button>
          <button 
            onClick={() => navigate('/buy-box-dashboard')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Buy Box
          </button>
          <button 
            onClick={() => navigate('/amazon-data')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Dados Amazon
          </button>
          <button 
            onClick={() => navigate('/insights')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Insights IA
          </button>
          <button 
            onClick={() => navigate('/database')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            SQL Viewer
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Sair
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;