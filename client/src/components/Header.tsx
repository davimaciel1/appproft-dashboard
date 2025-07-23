import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-primary-orange">AppProft</h1>
        </div>
        
        <nav className="flex items-center space-x-6">
          <button className="text-gray-600 hover:text-gray-800 font-medium">
            Dashboard
          </button>
          <button className="text-gray-600 hover:text-gray-800 font-medium">
            Configurações
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