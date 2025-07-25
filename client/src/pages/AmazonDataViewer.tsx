import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface TabConfig {
  id: string;
  name: string;
  icon: string;
  query: string;
  description: string;
}

const AmazonDataViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const tabs: TabConfig[] = [
    {
      id: 'overview',
      name: 'Visão Geral',
      icon: '📊',
      query: `
        WITH stats AS (
          SELECT 
            (SELECT COUNT(*) FROM products) as total_products,
            (SELECT COUNT(*) FROM orders) as total_orders,
            (SELECT COUNT(DISTINCT seller_id) FROM competitor_tracking_advanced) as total_competitors,
            (SELECT COUNT(*) FROM ai_insights_advanced WHERE status = 'pending') as pending_insights
        ),
        recent_orders AS (
          SELECT COUNT(*) as orders_today,
                 SUM(total_amount) as revenue_today
          FROM orders 
          WHERE created_at >= CURRENT_DATE
        ),
        inventory_alerts AS (
          SELECT COUNT(*) as low_stock_count
          FROM inventory_snapshots
          WHERE available_quantity < 50
            AND snapshot_date = (SELECT MAX(snapshot_date) FROM inventory_snapshots)
        )
        SELECT * FROM stats, recent_orders, inventory_alerts
      `,
      description: 'Dashboard principal com métricas consolidadas'
    },
    {
      id: 'products',
      name: 'Produtos',
      icon: '📦',
      query: `
        SELECT 
          p.asin,
          p.sku,
          p.title,
          p.brand,
          p.current_price,
          COALESCE(i.available_quantity, 0) as stock,
          COALESCE(sm.units_sold_30d, 0) as sales_30d,
          COALESCE(sm.revenue_30d, 0) as revenue_30d,
          CASE 
            WHEN i.available_quantity < 50 THEN 'critical'
            WHEN i.available_quantity < 100 THEN 'low'
            ELSE 'good'
          END as stock_status
        FROM products p
        LEFT JOIN (
          SELECT asin, available_quantity 
          FROM inventory_snapshots 
          WHERE (asin, snapshot_date) IN (
            SELECT asin, MAX(snapshot_date) 
            FROM inventory_snapshots 
            GROUP BY asin
          )
        ) i ON p.asin = i.asin
        LEFT JOIN sales_metrics sm ON p.asin = sm.asin
        ORDER BY sm.revenue_30d DESC NULLS LAST
        LIMIT 100
      `,
      description: 'Lista completa de produtos com estoque e vendas'
    },
    {
      id: 'competitors',
      name: 'Competidores',
      icon: '🏆',
      query: `
        WITH buy_box_stats AS (
          SELECT 
            ct.asin,
            p.title,
            ct.seller_id,
            ct.seller_name,
            ct.competitor_price,
            ct.has_buy_box,
            p.current_price as our_price,
            ROUND((p.current_price - ct.competitor_price)::numeric, 2) as price_diff,
            ROUND(((p.current_price - ct.competitor_price) / ct.competitor_price * 100)::numeric, 2) as price_diff_pct
          FROM competitor_tracking_advanced ct
          JOIN products p ON ct.asin = p.asin
          WHERE ct.tracking_date = (SELECT MAX(tracking_date) FROM competitor_tracking_advanced)
        )
        SELECT * FROM buy_box_stats
        ORDER BY has_buy_box DESC, ABS(price_diff_pct) DESC
        LIMIT 100
      `,
      description: 'Análise de competidores e Buy Box em tempo real'
    },
    {
      id: 'insights',
      name: 'Insights IA',
      icon: '🧠',
      query: `
        SELECT 
          insight_type,
          priority,
          title,
          description,
          recommendation,
          confidence_score,
          potential_impact,
          created_at,
          CASE insight_type
            WHEN 'restock' THEN '📦'
            WHEN 'pricing' THEN '💰'
            WHEN 'competitor' THEN '🏆'
            WHEN 'campaign' THEN '📣'
            ELSE '💡'
          END as icon
        FROM ai_insights_advanced
        WHERE status = 'pending'
        ORDER BY 
          CASE priority 
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          potential_impact DESC
        LIMIT 50
      `,
      description: 'Insights e recomendações geradas pela IA'
    },
    {
      id: 'forecast',
      name: 'Previsões',
      icon: '📈',
      query: `
        SELECT 
          df.asin,
          p.title,
          df.forecast_date,
          df.units_forecast,
          df.lower_bound,
          df.upper_bound,
          df.recommended_stock_level,
          df.reorder_point,
          df.confidence_score,
          CASE 
            WHEN df.units_forecast > df.recommended_stock_level THEN 'increase_stock'
            WHEN df.units_forecast < df.reorder_point THEN 'low_demand'
            ELSE 'normal'
          END as action_needed
        FROM demand_forecasts df
        JOIN products p ON df.asin = p.asin
        WHERE df.forecast_date >= CURRENT_DATE
          AND df.forecast_date <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY df.asin, df.forecast_date
        LIMIT 200
      `,
      description: 'Previsões de demanda para os próximos 30 dias'
    },
    {
      id: 'pricing',
      name: 'Otimização Preços',
      icon: '💰',
      query: `
        SELECT 
          po.asin,
          p.title,
          p.current_price,
          po.suggested_price,
          po.min_price,
          po.max_price,
          po.expected_profit_change,
          po.buy_box_probability,
          po.elasticity_coefficient,
          ROUND((po.suggested_price - p.current_price)::numeric, 2) as price_change,
          ROUND(((po.suggested_price - p.current_price) / p.current_price * 100)::numeric, 2) as price_change_pct
        FROM price_optimization po
        JOIN products p ON po.asin = p.asin
        WHERE po.status = 'pending'
          AND po.confidence_score > 0.7
        ORDER BY po.expected_profit_change DESC
        LIMIT 50
      `,
      description: 'Sugestões de otimização de preços pela IA'
    },
    {
      id: 'inventory',
      name: 'Estoque',
      icon: '📦',
      query: `
        WITH current_inventory AS (
          SELECT 
            i.asin,
            p.title,
            i.available_quantity,
            i.reserved_quantity,
            i.inbound_quantity,
            sm.units_sold_7d,
            sm.units_sold_30d,
            CASE 
              WHEN sm.units_sold_7d > 0 THEN 
                ROUND((i.available_quantity::numeric / (sm.units_sold_7d::numeric / 7)), 1)
              ELSE 999
            END as days_of_stock,
            i.snapshot_date
          FROM inventory_snapshots i
          JOIN products p ON i.asin = p.asin
          LEFT JOIN sales_metrics sm ON i.asin = sm.asin
          WHERE (i.asin, i.snapshot_date) IN (
            SELECT asin, MAX(snapshot_date) 
            FROM inventory_snapshots 
            GROUP BY asin
          )
        )
        SELECT *,
          CASE 
            WHEN days_of_stock < 7 THEN 'critical'
            WHEN days_of_stock < 14 THEN 'low'
            WHEN days_of_stock < 30 THEN 'normal'
            ELSE 'excess'
          END as stock_status
        FROM current_inventory
        ORDER BY days_of_stock ASC
        LIMIT 100
      `,
      description: 'Status do estoque e dias de cobertura'
    }
  ];

  const fetchData = async (query: string) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.post('/api/database/query', { query });
      setData(response.data);
      
      // Buscar última sincronização
      const syncResponse = await api.post('/api/database/query', {
        query: "SELECT MAX(synced_at) as last_sync FROM sync_logs WHERE status = 'completed'"
      });
      if (syncResponse.data.rows?.[0]?.last_sync) {
        setLastSync(new Date(syncResponse.data.rows[0].last_sync));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentTab = tabs.find(t => t.id === activeTab);
    if (currentTab) {
      fetchData(currentTab.query);
    }
  }, [activeTab]);

  const formatValue = (value: any, key: string): React.ReactNode => {
    if (value === null || value === undefined) return '-';
    
    // Formatação monetária
    if (key.includes('price') || key.includes('revenue') || key.includes('amount') || key.includes('impact')) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    }
    
    // Porcentagem
    if (key.includes('pct') || key.includes('probability') || key.includes('score')) {
      return `${Number(value).toFixed(1)}%`;
    }
    
    // Quantidades
    if (key.includes('quantity') || key.includes('units') || key.includes('count')) {
      return Number(value).toLocaleString('pt-BR');
    }
    
    // Datas
    if (key.includes('date') || key.includes('_at')) {
      return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Status especiais
    if (key === 'stock_status') {
      const statusMap: any = {
        critical: { text: 'Crítico', color: 'text-red-600 bg-red-100' },
        low: { text: 'Baixo', color: 'text-orange-600 bg-orange-100' },
        normal: { text: 'Normal', color: 'text-green-600 bg-green-100' },
        good: { text: 'Bom', color: 'text-green-600 bg-green-100' },
        excess: { text: 'Excesso', color: 'text-blue-600 bg-blue-100' }
      };
      const status = statusMap[value] || { text: value, color: 'text-gray-600 bg-gray-100' };
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
          {status.text}
        </span>
      );
    }
    
    if (key === 'priority') {
      const priorityMap: any = {
        critical: { text: 'Crítico', color: 'text-red-600' },
        high: { text: 'Alto', color: 'text-orange-600' },
        medium: { text: 'Médio', color: 'text-yellow-600' },
        low: { text: 'Baixo', color: 'text-green-600' }
      };
      const priority = priorityMap[value] || { text: value, color: 'text-gray-600' };
      return <span className={`font-semibold ${priority.color}`}>{priority.text}</span>;
    }
    
    // Booleanos
    if (typeof value === 'boolean') {
      return value ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗</span>;
    }
    
    // Texto longo
    if (typeof value === 'string' && value.length > 100) {
      return (
        <details className="cursor-pointer">
          <summary className="text-blue-600 hover:text-blue-800">
            {value.substring(0, 50)}...
          </summary>
          <div className="text-sm mt-1 whitespace-pre-wrap">{value}</div>
        </details>
      );
    }
    
    return String(value);
  };

  const renderOverview = () => {
    if (!data?.rows?.[0]) return null;
    const stats = data.rows[0];
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Produtos</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_products}</p>
            </div>
            <span className="text-4xl">📦</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Hoje</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.orders_today || 0}</p>
              <p className="text-sm text-green-600">
                {formatValue(stats.revenue_today || 0, 'revenue')}
              </p>
            </div>
            <span className="text-4xl">💰</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Competidores</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_competitors}</p>
            </div>
            <span className="text-4xl">🏆</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Insights Pendentes</p>
              <p className="text-2xl font-semibold text-orange-600">{stats.pending_insights}</p>
            </div>
            <span className="text-4xl">💡</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!data?.rows?.length) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Nenhum dado encontrado</p>
          <p className="text-sm mt-2">Execute a sincronização para obter dados da Amazon</p>
        </div>
      );
    }
    
    const columns = data.fields.map((f: any) => f.name);
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col: string) => (
                <th
                  key={col}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.rows.map((row: any, idx: number) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((col: string) => (
                  <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(row[col], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-4xl">🚀</span>
                Amazon Data Viewer
              </h1>
              <p className="text-gray-600 mt-1">
                Visualização inteligente dos dados coletados da Amazon SP-API
              </p>
            </div>
            <div className="text-right">
              {lastSync && (
                <p className="text-sm text-gray-500">
                  Última sincronização: {lastSync.toLocaleString('pt-BR')}
                </p>
              )}
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                🔄 Atualizar
              </button>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="px-6 pb-0">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Tab Description */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <p className="text-gray-600">
            {tabs.find(t => t.id === activeTab)?.description}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
            <p className="font-semibold">Erro ao carregar dados:</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Data Display */}
        {!loading && !error && data && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {activeTab === 'overview' ? renderOverview() : renderTable()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AmazonDataViewer;