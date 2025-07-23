import React, { useEffect, useRef } from 'react';

interface Order {
  id: string;
  marketplace: 'amazon' | 'mercadolivre';
  orderId: string;
  amount: number;
  timestamp: Date;
  product?: string;
}

interface RealtimeOrdersSidebarProps {
  orders: Order[];
}

const RealtimeOrdersSidebar: React.FC<RealtimeOrdersSidebarProps> = ({ orders }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Play notification sound when new order arrives
    if (orders.length > 0 && audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, [orders.length]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const orderDate = new Date(date);
    const diff = now.getTime() - orderDate.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return 'Agora mesmo';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes} min atrás`;
    } else {
      return orderDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getMarketplaceIcon = (marketplace: string) => {
    return marketplace === 'amazon' ? '🟠' : '💛';
  };

  const getMarketplaceName = (marketplace: string) => {
    return marketplace === 'amazon' ? 'Amazon' : 'Mercado Livre';
  };

  return (
    <div className="bg-white rounded-lg shadow-card p-4">
      <audio ref={audioRef} src="/notification.mp3" />
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Pedidos em Tempo Real</h3>
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
          <span className="text-xs text-gray-500">Ao vivo</span>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">Aguardando novos pedidos...</p>
          </div>
        ) : (
          orders.map((order, index) => (
            <div
              key={order.id}
              className={`p-3 rounded-lg border transition-all ${
                index === 0 ? 'border-primary-orange bg-orange-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <span className="text-lg mr-2">{getMarketplaceIcon(order.marketplace)}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Novo pedido!
                    </p>
                    <p className="text-xs text-gray-500">
                      {getMarketplaceName(order.marketplace)} • #{order.orderId.slice(-8)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600">
                    {formatCurrency(order.amount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTime(order.timestamp)}
                  </p>
                </div>
              </div>
              
              {order.product && (
                <p className="mt-2 text-xs text-gray-600 truncate">
                  {order.product}
                </p>
              )}
              
              {index === 0 && (
                <div className="mt-2 flex items-center text-xs text-primary-orange">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                  Pedido mais recente
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Total últimos 10 pedidos:</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(orders.reduce((sum, order) => sum + order.amount, 0))}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RealtimeOrdersSidebar;