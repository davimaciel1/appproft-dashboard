import React, { useState, useEffect, useCallback } from 'react';

interface Filtros {
  periodo: string;
  marketplace: string;
  ordenacao: string;
}

interface SQLFiltersProps {
  onQueryGenerated: (query: string) => void;
  onExecuteQuery: (query: string) => void;
}

// Configuração dos filtros (movido para fora do componente para evitar re-criação)
const FILTROS_CONFIG = {
    periodo: {
      'todos': { label: 'Todos os períodos', sql: '' },
      'hoje': { 
        label: 'Hoje', 
        sql: "AND DATE(o.order_date) = CURRENT_DATE" 
      },
      'ontem': { 
        label: 'Ontem', 
        sql: "AND DATE(o.order_date) = CURRENT_DATE - INTERVAL '1 day'" 
      },
      'ultimos_7': { label: 'Últimos 7 dias', sql: "AND o.order_date >= CURRENT_DATE - INTERVAL '7 days'" },
      'ultimos_30': { label: 'Últimos 30 dias', sql: "AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'" },
      'ultimos_90': { label: 'Últimos 90 dias', sql: "AND o.order_date >= CURRENT_DATE - INTERVAL '90 days'" },
      'este_mes': { 
        label: 'Este mês', 
        sql: `AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE)
              AND EXTRACT(MONTH FROM o.order_date) = EXTRACT(MONTH FROM CURRENT_DATE)` 
      },
      'mes_passado': { 
        label: 'Mês passado', 
        sql: `AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
              AND EXTRACT(MONTH FROM o.order_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')` 
      },
      'este_ano': { 
        label: 'Este ano', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE)" 
      },
      'ano_passado': { 
        label: 'Ano passado', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1" 
      },
      '2024': { label: '2024', sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024" },
      '2023': { label: '2023', sql: "AND EXTRACT(YEAR FROM o.order_date) = 2023" },
      'jan_2024': { 
        label: 'Janeiro 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 1" 
      },
      'fev_2024': { 
        label: 'Fevereiro 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 2" 
      },
      'mar_2024': { 
        label: 'Março 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 3" 
      },
      'abr_2024': { 
        label: 'Abril 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 4" 
      },
      'mai_2024': { 
        label: 'Maio 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 5" 
      },
      'jun_2024': { 
        label: 'Junho 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 6" 
      },
      'jul_2024': { 
        label: 'Julho 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 7" 
      },
      'ago_2024': { 
        label: 'Agosto 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 8" 
      },
      'set_2024': { 
        label: 'Setembro 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 9" 
      },
      'out_2024': { 
        label: 'Outubro 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 10" 
      },
      'nov_2024': { 
        label: 'Novembro 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 11" 
      },
      'dez_2024': { 
        label: 'Dezembro 2024', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 12" 
      },
      'q1_2024': { 
        label: 'Q1 2024 (Jan-Mar)', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 1" 
      },
      'q2_2024': { 
        label: 'Q2 2024 (Abr-Jun)', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 2" 
      },
      'q3_2024': { 
        label: 'Q3 2024 (Jul-Set)', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 3" 
      },
      'q4_2024': { 
        label: 'Q4 2024 (Out-Dez)', 
        sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 4" 
      }
    },
    marketplace: {
      'todos': { label: 'Todos', sql: '' },
      'amazon': { label: 'Amazon', sql: "AND p.marketplace = 'amazon'" },
      'mercadolivre': { label: 'Mercado Livre', sql: "AND p.marketplace = 'mercadolivre'" }
    },
    ordenacao: {
      'mais_vendidos': { label: 'Mais vendidos', sql: 'ORDER BY total_vendas DESC' },
      'mais_pedidos': { label: 'Mais pedidos', sql: 'ORDER BY total_pedidos DESC' },
      'maior_receita': { label: 'Maior receita', sql: 'ORDER BY total_revenue DESC' },
      'alfabetica_az': { label: 'Alfabética (A-Z)', sql: 'ORDER BY product_name ASC' },
      'alfabetica_za': { label: 'Alfabética (Z-A)', sql: 'ORDER BY product_name DESC' }
    }
};

const SQLFilters: React.FC<SQLFiltersProps> = ({ onQueryGenerated, onExecuteQuery }) => {
  const [filtros, setFiltros] = useState<Filtros>({
    periodo: 'todos',
    marketplace: 'todos',
    ordenacao: 'mais_vendidos'
  });

  const [sqlQuery, setSqlQuery] = useState('');

  // Gerar query SQL baseada nos filtros
  const gerarQuery = useCallback((filtrosAtivos: Filtros): string => {
    const filtrosPeriodo = FILTROS_CONFIG.periodo[filtrosAtivos.periodo as keyof typeof FILTROS_CONFIG.periodo]?.sql || '';
    const filtrosMarketplace = FILTROS_CONFIG.marketplace[filtrosAtivos.marketplace as keyof typeof FILTROS_CONFIG.marketplace]?.sql || '';
    const filtrosOrdenacao = FILTROS_CONFIG.ordenacao[filtrosAtivos.ordenacao as keyof typeof FILTROS_CONFIG.ordenacao]?.sql || 'ORDER BY total_vendas DESC';

    return `SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  ${filtrosPeriodo}
  ${filtrosMarketplace}
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
${filtrosOrdenacao}
LIMIT 50`;
  }, []);

  // Atualizar query quando filtros mudarem
  useEffect(() => {
    const novaQuery = gerarQuery(filtros);
    setSqlQuery(novaQuery);
    onQueryGenerated(novaQuery);
  }, [filtros, onQueryGenerated, gerarQuery]);

  // Atualizar filtro
  const atualizarFiltro = (tipo: keyof Filtros, valor: string) => {
    setFiltros(prev => ({
      ...prev,
      [tipo]: valor
    }));
  };

  // Copiar SQL para clipboard
  const copiarSQL = async () => {
    try {
      await navigator.clipboard.writeText(sqlQuery);
      // Aqui você pode adicionar um toast de sucesso
    } catch (err) {
      console.error('Erro ao copiar SQL:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          🔍 Filtros de Consulta
        </h3>
        <p className="text-gray-600">
          Selecione os filtros e clique em "Executar" para ver os resultados
        </p>
      </div>

      {/* Filtros Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {/* Período */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            📅 Período:
          </label>
          <select
            value={filtros.periodo}
            onChange={(e) => atualizarFiltro('periodo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
          >
            <option value="todos">Todos os períodos</option>
            <option value="hoje">Hoje</option>
            <option value="ontem">Ontem</option>
            <option value="ultimos_7">Últimos 7 dias</option>
            <option value="ultimos_30">Últimos 30 dias</option>
            <option value="ultimos_90">Últimos 90 dias</option>
            <option value="este_mes">Este mês</option>
            <option value="mes_passado">Mês passado</option>
            <option value="este_ano">Este ano</option>
            <option value="ano_passado">Ano passado</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <optgroup label="Meses de 2024">
              <option value="jan_2024">Janeiro 2024</option>
              <option value="fev_2024">Fevereiro 2024</option>
              <option value="mar_2024">Março 2024</option>
              <option value="abr_2024">Abril 2024</option>
              <option value="mai_2024">Maio 2024</option>
              <option value="jun_2024">Junho 2024</option>
              <option value="jul_2024">Julho 2024</option>
              <option value="ago_2024">Agosto 2024</option>
              <option value="set_2024">Setembro 2024</option>
              <option value="out_2024">Outubro 2024</option>
              <option value="nov_2024">Novembro 2024</option>
              <option value="dez_2024">Dezembro 2024</option>
            </optgroup>
            <optgroup label="Trimestres de 2024">
              <option value="q1_2024">Q1 2024 (Jan-Mar)</option>
              <option value="q2_2024">Q2 2024 (Abr-Jun)</option>
              <option value="q3_2024">Q3 2024 (Jul-Set)</option>
              <option value="q4_2024">Q4 2024 (Out-Dez)</option>
            </optgroup>
          </select>
        </div>

        {/* Marketplace */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            🏪 Marketplace:
          </label>
          <select
            value={filtros.marketplace}
            onChange={(e) => atualizarFiltro('marketplace', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
          >
            <option value="todos">Todos</option>
            <option value="amazon">Amazon</option>
            <option value="mercadolivre">Mercado Livre</option>
          </select>
        </div>

        {/* Ordenação */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            📊 Ordenar por:
          </label>
          <select
            value={filtros.ordenacao}
            onChange={(e) => atualizarFiltro('ordenacao', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
          >
            <option value="mais_vendidos">Mais vendidos</option>
            <option value="mais_pedidos">Mais pedidos</option>
            <option value="maior_receita">Maior receita</option>
            <option value="alfabetica_az">Alfabética (A-Z)</option>
            <option value="alfabetica_za">Alfabética (Z-A)</option>
          </select>
        </div>

        {/* Botão Executar */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700 opacity-0">
            Ação:
          </label>
          <button
            onClick={() => onExecuteQuery(sqlQuery)}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            🚀 Executar Consulta
          </button>
        </div>
      </div>

      {/* Preview da Query */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-semibold text-gray-700">
            📝 Query SQL (gerada automaticamente):
          </label>
          <button
            onClick={copiarSQL}
            className="px-3 py-1 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
          >
            📋 Copiar SQL
          </button>
        </div>
        <textarea
          value={sqlQuery}
          readOnly
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm resize-vertical"
        />
      </div>
    </div>
  );
};

export default SQLFilters;