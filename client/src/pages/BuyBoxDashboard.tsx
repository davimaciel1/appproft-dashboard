import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import BuyBoxSyncStatus from '../components/BuyBoxSyncStatus';

interface BuyBoxStatus {
  asin: string;
  product_name: string;
  product_image: string;
  buy_box_owner: string;
  buy_box_price: number;
  is_fba: boolean;
  feedback_rating: number;
  last_checked: string;
  our_price: number;
  price_difference_pct: number;
  status_message: string;
}

interface CompetitorRanking {
  competitor: string;
  products_disputed: number;
  times_with_buy_box: number;
  rating: number;
  avg_price: number;
  fba_sales: number;
}

interface RecentChange {
  product: string;
  lost_buy_box: string;
  won_buy_box: string;
  previous_price: number;
  current_price: number;
  price_reduction: number;
  time: string;
}

interface BuyBoxSummary {
  won_count: number;
  total_products: number;
  buy_box_percentage: number;
  active_competitors: number;
  changes_today: number;
}

interface TabConfig {
  id: string;
  name: string;
  query: string;
  description: string;
  columns: { key: string; label: string; type?: string }[];
}

const BuyBoxDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('status');
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<BuyBoxSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    timeRange: '24h',
    competitorType: 'all',
    priceRange: 'all',
    listingStatus: 'all'
  });

  const tabs: TabConfig[] = [
    {
      id: 'status',
      name: 'Status Buy Box',
      query: `
        SELECT 
          bs.asin,
          bs.product_name,
          p.image_url as product_image,
          bs.buy_box_owner,
          bs.buy_box_price,
          bs.is_fba,
          bs.feedback_rating,
          bs.last_checked,
          bs.our_price,
          bs.price_difference_pct,
          bs.status_message
        FROM buy_box_status bs
        LEFT JOIN products p ON bs.asin = p.asin
        WHERE 1=1
        {{FILTERS}}
        ORDER BY bs.price_difference_pct DESC
      `,
      description: 'Visualize quem possui a Buy Box de cada produto em tempo real',
      columns: [
        { key: 'product_image', label: 'Imagem', type: 'image' },
        { key: 'product_name', label: 'Produto' },
        { key: 'buy_box_owner', label: 'Dono da Buy Box' },
        { key: 'buy_box_price', label: 'Preço Buy Box', type: 'currency' },
        { key: 'our_price', label: 'Nosso Preço', type: 'currency' },
        { key: 'price_difference_pct', label: '% Diferença', type: 'percentage' },
        { key: 'status_message', label: 'Status' }
      ]
    },
    {
      id: 'competitors',
      name: 'Ranking Competidores',
      query: `
        SELECT 
          seller_name as competitor,
          COUNT(DISTINCT asin) as products_disputed,
          COUNT(*) FILTER (WHERE is_buy_box_winner) as times_with_buy_box,
          ROUND(AVG(feedback_rating), 1) as rating,
          ROUND(AVG(price), 2) as avg_price,
          COUNT(*) FILTER (WHERE is_fba) as fba_sales
        FROM competitor_tracking
        WHERE timestamp >= NOW() - INTERVAL '{{TIME_RANGE}}'
        AND seller_name != 'Sua Loja'
        {{FILTERS}}
        GROUP BY seller_name
        ORDER BY times_with_buy_box DESC
        LIMIT 50
      `,
      description: 'Veja os competidores mais agressivos no mercado',
      columns: [
        { key: 'competitor', label: 'Competidor' },
        { key: 'products_disputed', label: 'Produtos Disputados' },
        { key: 'times_with_buy_box', label: 'Vezes com Buy Box' },
        { key: 'rating', label: 'Avaliação' },
        { key: 'avg_price', label: 'Preço Médio', type: 'currency' },
        { key: 'fba_sales', label: 'Vendas FBA' }
      ]
    },
    {
      id: 'changes',
      name: 'Mudanças Recentes',
      query: `
        WITH recent_changes AS (
          SELECT 
            asin,
            seller_name,
            timestamp,
            LAG(seller_name) OVER (PARTITION BY asin ORDER BY timestamp) as previous_owner,
            price,
            LAG(price) OVER (PARTITION BY asin ORDER BY timestamp) as previous_price
          FROM competitor_tracking
          WHERE is_buy_box_winner = true
          AND timestamp >= NOW() - INTERVAL '{{TIME_RANGE}}'
        )
        SELECT 
          p.name as product,
          rc.previous_owner as lost_buy_box,
          rc.seller_name as won_buy_box,
          rc.previous_price,
          rc.price as current_price,
          ROUND(((rc.previous_price - rc.price) / rc.previous_price * 100), 2) as price_reduction,
          TO_CHAR(rc.timestamp, 'HH24:MI') as time
        FROM recent_changes rc
        JOIN products p ON rc.asin = p.asin
        WHERE rc.seller_name != rc.previous_owner
        AND rc.previous_owner IS NOT NULL
        {{FILTERS}}
        ORDER BY rc.timestamp DESC
        LIMIT 100
      `,
      description: 'Acompanhe as mudanças de Buy Box em tempo real',
      columns: [
        { key: 'product', label: 'Produto' },
        { key: 'lost_buy_box', label: 'Perdeu Buy Box' },
        { key: 'won_buy_box', label: 'Ganhou Buy Box' },
        { key: 'previous_price', label: 'Preço Anterior', type: 'currency' },
        { key: 'current_price', label: 'Preço Atual', type: 'currency' },
        { key: 'price_reduction', label: '% Redução', type: 'percentage' },
        { key: 'time', label: 'Horário' }
      ]
    },
    {
      id: 'lost',
      name: 'Produtos Perdidos',
      query: `
        SELECT 
          p.asin,
          p.name as product,
          p.current_price as our_price,
          COUNT(DISTINCT ct.seller_name) as competitor_count,
          STRING_AGG(DISTINCT ct.seller_name, ', ') as main_competitors,
          ROUND(AVG(ct.price), 2) as avg_competitor_price,
          p.buy_box_percentage
        FROM products p
        JOIN competitor_tracking ct ON p.asin = ct.asin
        WHERE ct.is_buy_box_winner = true
        AND ct.seller_name != 'Sua Loja'
        AND ct.timestamp >= NOW() - INTERVAL '{{TIME_RANGE}}'
        {{FILTERS}}
        GROUP BY p.asin, p.name, p.current_price, p.buy_box_percentage
        HAVING p.buy_box_percentage < 50
        ORDER BY p.buy_box_percentage ASC
      `,
      description: 'Produtos onde estamos perdendo a Buy Box com frequência',
      columns: [
        { key: 'product', label: 'Produto' },
        { key: 'our_price', label: 'Nosso Preço', type: 'currency' },
        { key: 'competitor_count', label: 'Qtd Competidores' },
        { key: 'main_competitors', label: 'Principais Competidores' },
        { key: 'avg_competitor_price', label: 'Preço Médio Competidores', type: 'currency' },
        { key: 'buy_box_percentage', label: '% Buy Box (30d)', type: 'percentage' }
      ]
    },
    {
      id: 'new',
      name: 'Novos Competidores',
      query: `
        SELECT 
          seller_name as new_seller,
          MIN(timestamp) as first_seen,
          COUNT(DISTINCT asin) as products,
          ROUND(AVG(price), 2) as avg_price,
          ROUND(AVG(feedback_rating), 1) as rating,
          COUNT(*) FILTER (WHERE is_buy_box_winner) as buy_boxes_won
        FROM competitor_tracking
        WHERE seller_id NOT IN (
          SELECT DISTINCT seller_id 
          FROM competitor_tracking 
          WHERE timestamp < NOW() - INTERVAL '7 days'
        )
        AND timestamp >= NOW() - INTERVAL '7 days'
        {{FILTERS}}
        GROUP BY seller_name
        ORDER BY buy_boxes_won DESC
      `,
      description: 'Vendedores que entraram no mercado recentemente',
      columns: [
        { key: 'new_seller', label: 'Novo Vendedor' },
        { key: 'first_seen', label: 'Primeira Aparição' },
        { key: 'products', label: 'Produtos' },
        { key: 'avg_price', label: 'Preço Médio', type: 'currency' },
        { key: 'rating', label: 'Avaliação' },
        { key: 'buy_boxes_won', label: 'Buy Boxes Ganhas' }
      ]
    }
  ];

  const timeRangeOptions = [
    { value: '2h', label: 'Últimas 2 horas' },
    { value: '24h', label: 'Últimas 24 horas' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' }
  ];

  const competitorTypeOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'fba', label: 'Apenas FBA' },
    { value: 'fbm', label: 'Apenas FBM' },
    { value: 'high_rating', label: 'Alta Avaliação (>95%)' }
  ];

  const priceRangeOptions = [
    { value: 'all', label: 'Todos os Preços' },
    { value: 'lower', label: 'Preço Menor que o Nosso' },
    { value: 'higher', label: 'Preço Maior que o Nosso' },
    { value: 'aggressive', label: 'Muito Agressivo (>10% menor)' }
  ];

  const listingStatusOptions = [
    { value: 'all', label: 'Todos os Listings' },
    { value: 'active', label: 'Apenas Ativos' },
    { value: 'inactive', label: 'Apenas Inativos' },
    { value: 'with_buybox', label: 'Com Buy Box' },
    { value: 'without_buybox', label: 'Sem Buy Box' }
  ];

  useEffect(() => {
    fetchData();
    fetchSummary();
    
    // Atualizar a cada 60 segundos
    const interval = setInterval(() => {
      fetchData();
      fetchSummary();
    }, 60000);

    return () => clearInterval(interval);
  }, [activeTab, filters]);

  const buildFilters = () => {
    let filterClauses = [];

    if (filters.search) {
      filterClauses.push(`(LOWER(seller_name) LIKE LOWER('%${filters.search}%') OR LOWER(p.name) LIKE LOWER('%${filters.search}%'))`);
    }

    if (filters.competitorType === 'fba') {
      filterClauses.push('is_fba = true');
    } else if (filters.competitorType === 'fbm') {
      filterClauses.push('is_fba = false');
    } else if (filters.competitorType === 'high_rating') {
      filterClauses.push('feedback_rating > 95');
    }

    if (filters.priceRange === 'lower') {
      filterClauses.push('ct.price < p.current_price');
    } else if (filters.priceRange === 'higher') {
      filterClauses.push('ct.price > p.current_price');
    } else if (filters.priceRange === 'aggressive') {
      filterClauses.push('ct.price < p.current_price * 0.9');
    }

    if (filters.listingStatus === 'active') {
      filterClauses.push('p.active = true');
    } else if (filters.listingStatus === 'inactive') {
      filterClauses.push('p.active = false');
    } else if (filters.listingStatus === 'with_buybox') {
      filterClauses.push("bs.buy_box_owner != 'Sem Buy Box'");
    } else if (filters.listingStatus === 'without_buybox') {
      filterClauses.push("bs.buy_box_owner = 'Sem Buy Box'");
    }

    return filterClauses.length > 0 ? `AND ${filterClauses.join(' AND ')}` : '';
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const currentTab = tabs.find(t => t.id === activeTab);
      if (!currentTab) return;

      let query = currentTab.query
        .replace(/{{TIME_RANGE}}/g, `'${filters.timeRange}'`)
        .replace(/{{FILTERS}}/g, buildFilters());

      const response = await api.post('/api/buybox/query', { query });

      if (response.data.status === 'success') {
        setData(response.data.data.rows || []);
      } else {
        throw new Error(response.data.message || 'Erro ao buscar dados');
      }
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/api/buybox/summary');
      if (response.data.status === 'success') {
        setSummary(response.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar resumo:', err);
    }
  };

  const formatValue = (value: any, type?: string) => {
    if (value === null || value === undefined) return '-';
    
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(parseFloat(value));
      case 'percentage':
        return `${parseFloat(value).toFixed(1)}%`;
      default:
        return value;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status.includes('Você tem')) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">✅ Ativa</span>;
    } else {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm">❌ Perdida</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Buy Box Dashboard</h1>
          <p className="text-gray-600">
            Monitore a Buy Box em tempo real e acompanhe seus competidores
          </p>
        </div>

        {/* Sync Status */}
        <BuyBoxSyncStatus />

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-sm text-gray-600">Buy Box Ativa</div>
              <div className="text-3xl font-bold text-green-600">{summary.won_count}</div>
              <div className="text-sm text-gray-500">de {summary.total_products} produtos</div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-sm text-gray-600">Taxa de Buy Box</div>
              <div className="text-3xl font-bold">{summary.buy_box_percentage}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-orange-500 h-2 rounded-full" 
                  style={{ width: `${summary.buy_box_percentage}%` }}
                />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-sm text-gray-600">Competidores Ativos</div>
              <div className="text-3xl font-bold text-orange-600">{summary.active_competitors}</div>
              <div className="text-sm text-gray-500">últimas 24h</div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-sm text-gray-600">Mudanças Hoje</div>
              <div className="text-3xl font-bold text-blue-600">{summary.changes_today}</div>
              <div className="text-sm text-gray-500">trocas de Buy Box</div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-sm text-gray-600">Última Atualização</div>
              <div className="text-lg font-bold text-gray-900">
                {new Date().toLocaleTimeString('pt-BR')}
              </div>
              <div className="text-sm text-green-500">● Atualização automática</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Nome do competidor ou produto..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Período
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters({ ...filters, timeRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {timeRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Competidor
              </label>
              <select
                value={filters.competitorType}
                onChange={(e) => setFilters({ ...filters, competitorType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {competitorTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Faixa de Preço
              </label>
              <select
                value={filters.priceRange}
                onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {priceRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status do Listing
              </label>
              <select
                value={filters.listingStatus}
                onChange={(e) => setFilters({ ...filters, listingStatus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {listingStatusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-4 px-6 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-600 mb-4">
              {tabs.find(t => t.id === activeTab)?.description}
            </p>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
                <button
                  onClick={fetchData}
                  className="mt-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum dado encontrado para os filtros selecionados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      {tabs.find(t => t.id === activeTab)?.columns.map(col => (
                        <th key={col.key} className="text-left py-3 px-4 font-medium text-gray-700">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        {tabs.find(t => t.id === activeTab)?.columns.map(col => (
                          <td key={col.key} className="py-4 px-4">
                            {col.type === 'image' ? (
                              <img 
                                src={row[col.key] || 'https://via.placeholder.com/60x60?text=No+Image'} 
                                alt={row.product_name}
                                className="w-16 h-16 object-cover rounded-lg"
                                onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/60x60?text=No+Image' }}
                              />
                            ) : col.key === 'status_message' ? (
                              getStatusBadge(row[col.key])
                            ) : col.key === 'buy_box_owner' && row.buy_box_owner === 'Sua Loja' ? (
                              <span className="font-bold text-green-600">{row[col.key]}</span>
                            ) : (
                              <span className={col.type === 'percentage' && parseFloat(row[col.key]) < 0 ? 'text-red-600' : ''}>
                                {formatValue(row[col.key], col.type)}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyBoxDashboard;