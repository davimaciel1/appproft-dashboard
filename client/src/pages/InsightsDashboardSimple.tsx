import React, { useState, useEffect } from 'react';
import api from '../services/api';

const InsightsDashboardSimple: React.FC = () => {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError('');
      
      const query = `
        SELECT 
          i.*,
          p.title as product_title
        FROM ai_insights_advanced i
        LEFT JOIN products p ON i.asin = p.asin
        ORDER BY 
          CASE i.priority 
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          i.potential_impact DESC
        LIMIT 50
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
      
      setInsights(response.data.rows || []);
    } catch (error: any) {
      console.error('Erro ao carregar insights:', error);
      setError(error.message || 'Erro ao carregar insights');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'restock': return '📦';
      case 'pricing': return '💰';
      case 'competitor': return '🏆';
      case 'campaign': return '📣';
      default: return '💡';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          🧠 Insights de IA - AppProft
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            Erro: {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <p className="text-gray-600">
                Total de insights: <span className="font-bold text-orange-600">{insights.length}</span>
              </p>
            </div>

            {insights.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">Nenhum insight encontrado.</p>
              </div>
            ) : (
              insights.map((insight, index) => (
                <div key={index} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getTypeIcon(insight.insight_type)}</span>
                        <h3 className="text-lg font-semibold text-gray-900">{insight.title}</h3>
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getPriorityColor(insight.priority)}`}>
                          {insight.priority}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-3">{insight.description}</p>
                      
                      {insight.recommendation && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                          <p className="text-sm text-blue-800">
                            <strong>Recomendação:</strong> {insight.recommendation}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Confiança: {Math.round((insight.confidence_score || 0) * 100)}%</span>
                        <span>Impacto: R$ {parseFloat(insight.potential_impact || 0).toFixed(2)}</span>
                        <span>Status: {insight.status}</span>
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

export default InsightsDashboardSimple;