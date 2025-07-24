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
            onClick={() => navigate('/database')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Banco de Dados
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