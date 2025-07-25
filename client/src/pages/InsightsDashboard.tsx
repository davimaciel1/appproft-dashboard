import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Insight {
  id: number;
  insight_type: string;
  priority: string;
  title: string;
  description: string;
  recommendation: string;
  confidence_score: number;
  potential_impact: number;
  status: string;
  created_at: string;
  asin?: string;
  metadata?: any;
}

const InsightsDashboard: React.FC = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('priority');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadInsights();
    loadStats();
  }, [filter, sortBy]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      
      let query = `
        SELECT 
          i.*,
          p.title as product_title
        FROM ai_insights_advanced i
        LEFT JOIN products p ON i.asin = p.asin
        WHERE 1=1
      `;
      
      if (filter !== 'all') {
        query += ` AND i.insight_type = '${filter}'`;
      }
      
      query += ` ORDER BY `;
      
      if (sortBy === 'priority') {
        query += `
          CASE i.priority 
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          i.potential_impact DESC
        `;
      } else if (sortBy === 'impact') {
        query += `i.potential_impact DESC`;
      } else if (sortBy === 'recent') {
        query += `i.created_at DESC`;
      }
      
      query += ` LIMIT 100`;
      
      let response: any;
      try {
        response = await api.post('/api/database/query', { query });
      } catch (authError: any) {
        if (authError.response?.status === 401) {
          response = await api.post('/api/dashboard/database/query', { query });
        } else {
          throw authError;
        }
      }
      setInsights(response.data.rows || []);
    } catch (error) {
      console.error('Erro ao carregar insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const query = `
        WITH stats AS (
          SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'applied') as applied,
            COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed,
            COUNT(*) FILTER (WHERE insight_type = 'restock') as restock,
            COUNT(*) FILTER (WHERE insight_type = 'pricing') as pricing,
            COUNT(*) FILTER (WHERE insight_type = 'competitor') as competitor,
            COUNT(*) FILTER (WHERE insight_type = 'campaign') as campaign,
            SUM(potential_impact) FILTER (WHERE status = 'pending') as total_impact
          FROM ai_insights_advanced
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        )
        SELECT * FROM stats
      `;
      
      let response: any;
      try {
        response = await api.post('/api/database/query', { query });
      } catch (authError: any) {
        if (authError.response?.status === 401) {
          response = await api.post('/api/dashboard/database/query', { query });
        } else {
          throw authError;
        }
      }
      setStats(response.data.rows?.[0] || {});
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const applyInsight = async (insightId: number) => {
    try {
      const query = `
        UPDATE ai_insights_advanced 
        SET status = 'applied', applied_at = NOW() 
        WHERE id = ${insightId}
      `;
      await api.post('/api/database/query', { query });
      
      // Recarregar insights
      loadInsights();
      loadStats();
      
      // Aqui você pode adicionar lógica adicional para aplicar a recomendação
      alert('Insight aplicado com sucesso!');
    } catch (error) {
      console.error('Erro ao aplicar insight:', error);
      alert('Erro ao aplicar insight');
    }
  };

  const dismissInsight = async (insightId: number) => {
    try {
      const query = `
        UPDATE ai_insights_advanced 
        SET status = 'dismissed', dismissed_at = NOW() 
        WHERE id = ${insightId}
      `;
      await api.post('/api/database/query', { query });
      
      loadInsights();
      loadStats();
    } catch (error) {
      console.error('Erro ao dispensar insight:', error);
    }
  };

  const getInsightIcon = (type: string) => {
    const icons: any = {
      restock: '📦',
      pricing: '💰',
      competitor: '🏆',
      campaign: '📣'
    };
    return icons[type] || '💡';
  };

  const getPriorityColor = (priority: string) => {
    const colors: any = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="px-6 py-4">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-4xl">🧠</span>
            Central de Insights com IA
          </h1>
          <p className="text-gray-600 mt-1">
            Recomendações inteligentes geradas automaticamente para otimizar suas vendas
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Insights Pendentes</p>
                  <p className="text-2xl font-semibold text-orange-600">{stats.pending || 0}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Impacto: {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(stats.total_impact || 0)}
                  </p>
                </div>
                <span className="text-3xl">⏳</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Aplicados</p>
                  <p className="text-2xl font-semibold text-green-600">{stats.applied || 0}</p>
                </div>
                <span className="text-3xl">✅</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Taxa de Aplicação</p>
                  <p className="text-2xl font-semibold text-blue-600">
                    {stats.applied && stats.pending ? 
                      Math.round((stats.applied / (stats.applied + stats.pending + stats.dismissed)) * 100) : 0}%
                  </p>
                </div>
                <span className="text-3xl">📊</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tipos de Insights</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      📦 {stats.restock || 0}
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      💰 {stats.pricing || 0}
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      🏆 {stats.competitor || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 pb-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filtrar por:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">Todos os tipos</option>
                <option value="restock">📦 Restock</option>
                <option value="pricing">💰 Pricing</option>
                <option value="competitor">🏆 Competidores</option>
                <option value="campaign">📣 Campanhas</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Ordenar por:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="priority">Prioridade</option>
                <option value="impact">Impacto Financeiro</option>
                <option value="recent">Mais Recentes</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Insights List */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 text-lg">Nenhum insight disponível</p>
                <p className="text-gray-400 text-sm mt-2">
                  Execute a análise com IA para gerar novos insights
                </p>
              </div>
            ) : (
              insights.map((insight) => (
                <div
                  key={insight.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <span className="text-4xl">{getInsightIcon(insight.insight_type)}</span>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {insight.title}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(insight.priority)}`}>
                              {insight.priority.toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-500">
                              Confiança: {(insight.confidence_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          
                          <p className="text-gray-600 mb-3">{insight.description}</p>
                          
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                            <p className="text-sm font-medium text-blue-900 mb-1">
                              💡 Recomendação:
                            </p>
                            <p className="text-sm text-blue-800">{insight.recommendation}</p>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>
                              Impacto potencial: <strong className="text-green-600">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                }).format(insight.potential_impact)}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Criado em: {new Date(insight.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => applyInsight(insight.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                        >
                          <span>✓</span>
                          Aplicar
                        </button>
                        <button
                          onClick={() => dismissInsight(insight.id)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          Dispensar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsDashboard;