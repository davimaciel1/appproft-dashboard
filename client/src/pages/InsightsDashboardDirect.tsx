import React, { useState, useEffect } from 'react';

// Componente temporário com dados estáticos para testar renderização
const InsightsDashboardDirect: React.FC = () => {
  const [loading, setLoading] = useState(false);
  
  // Dados de exemplo baseados no que existe no banco
  const insights = [
    {
      id: 1,
      insight_type: 'restock',
      priority: 'critical',
      title: 'Alerta de Estoque: Slipperland Genuine Pillow Slippers',
      description: 'Estoque acabará em breve. Lead time: 21 dias. Velocidade: 5.2 un/dia.',
      recommendation: 'Enviar 250 unidades para FBA imediatamente.',
      confidence_score: 0.85,
      potential_impact: 1999.00,
      status: 'pending'
    },
    {
      id: 2,
      insight_type: 'pricing',
      priority: 'high',
      title: 'Otimizar Preço: Petyz Pet Hair Remover',
      description: 'Buy Box em 65%. Seu preço está 8.5% acima do menor competidor.',
      recommendation: 'Reduzir preço de R$ 29.99 para R$ 27.49 para recuperar Buy Box.',
      confidence_score: 0.78,
      potential_impact: 1250.00,
      status: 'pending'
    },
    {
      id: 3,
      insight_type: 'competitor',
      priority: 'medium',
      title: 'Novo Competidor Detectado: FastSeller LLC',
      description: 'Competindo em 4 produtos. Ganhou Buy Box 3 vezes.',
      recommendation: 'Monitorar estratégia de preços e ajustar preventivamente.',
      confidence_score: 0.92,
      potential_impact: 800.00,
      status: 'pending'
    }
  ];

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

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            ⚠️ Modo de demonstração - Exibindo dados estáticos devido a problema temporário de conexão com a API.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <p className="text-gray-600">
              Total de insights: <span className="font-bold text-orange-600">{insights.length}</span>
            </p>
          </div>

          {insights.map((insight, index) => (
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
                    <span>Impacto: R$ {(insight.potential_impact || 0).toFixed(2)}</span>
                    <span>Status: {insight.status}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InsightsDashboardDirect;