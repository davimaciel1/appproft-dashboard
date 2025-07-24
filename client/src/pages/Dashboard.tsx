import React, { useState, useEffect } from 'react';
import api from '../services/api';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import FiltersBar from '../components/FiltersBar';
import ProductsTable from '../components/ProductsTable';

const Dashboard: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    period: 'today',
    marketplace: 'all',
    orderStatus: 'all',
    brand: 'all',
    search: ''
  });

  useEffect(() => {
    fetchDashboardData();
    
    const socket = io(window.location.origin);
    
    socket.on('new-order', (order) => {
      // Show toast notification
      import('../components/NotificationToast').then(({ showOrderNotification }) => {
        showOrderNotification(order);
      });
      
      // Refresh dashboard data
      fetchDashboardData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchDashboardData = async (currentFilters = filters) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (currentFilters.period) params.append('dateRange', currentFilters.period);
      if (currentFilters.marketplace !== 'all') params.append('marketplace', currentFilters.marketplace);
      if (currentFilters.orderStatus !== 'all') params.append('orderType', currentFilters.orderStatus);
      if (currentFilters.search) params.append('search', currentFilters.search);
      
      // Usar novo endpoint de products/summary
      const response = await api.get(`/api/products/summary?${params.toString()}`);
      
      if (response.data.message === 'sync_needed') {
        // Primeira sincronização em andamento
        toast.loading('Sincronizando dados das APIs... Aguarde alguns minutos.', {
          duration: 8000
        });
        
        // Tentar novamente em 30 segundos
        setTimeout(() => fetchDashboardData(currentFilters), 30000);
        return;
      }
      
      setProducts(response.data.products || []);
      
      // Se não houver produtos e não está sincronizando, mostrar opção manual
      if (response.data.products.length === 0) {
        toast.error('Nenhum produto encontrado. Clique para sincronizar manualmente.', {
          action: {
            label: 'Sincronizar',
            onClick: () => triggerManualSync()
          }
        });
      }
      
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const triggerManualSync = async () => {
    try {
      toast.loading('Iniciando sincronização...', { duration: 2000 });
      
      await api.post('/api/sync/trigger');
      
      toast.success('Sincronização iniciada! Os dados aparecerão em alguns minutos.');
      
      // Verificar novamente em 60 segundos
      setTimeout(() => fetchDashboardData(), 60000);
      
    } catch (error) {
      console.error('Erro ao iniciar sincronização:', error);
      toast.error('Erro ao iniciar sincronização');
    }
  };

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
    fetchDashboardData(newFilters);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="h-[60px] flex items-center justify-between px-6" style={{ backgroundColor: '#FF8C00' }}>
        <h1 className="text-white text-2xl font-semibold">Sales</h1>
        <button className="bg-white px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors" style={{ color: '#FF8C00' }}>
          <span>🇺🇸</span>
          Get a discount!
        </button>
      </div>

      {/* Filters Bar */}
      <FiltersBar onFiltersChange={handleFiltersChange} />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white rounded-lg p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-100 rounded"></div>
            </div>
          </div>
        ) : (
          <ProductsTable products={products} />
        )}
      </div>
    </div>
  );
};

export default Dashboard;