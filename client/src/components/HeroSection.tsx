import React from 'react';

const HeroSection: React.FC = () => {
  return (
    <section className="bg-white py-12 border-b">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          O Painel de Controle Definitivo para Vendedores Amazon e Mercado Livre
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Monitore suas vendas em tempo real, acompanhe estoque e analise lucros em todos os marketplaces
        </p>
        <div className="flex justify-center items-center space-x-4">
          <button className="bg-primary-orange text-white font-semibold py-3 px-6 rounded-lg hover:shadow-hover flex items-center">
            Começar Teste Grátis
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="text-gray-600 font-medium hover:text-gray-800">
            Ver Demonstração
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          No credit card • 2 minute setup • Cancel anytime
        </p>
      </div>
    </section>
  );
};

export default HeroSection;