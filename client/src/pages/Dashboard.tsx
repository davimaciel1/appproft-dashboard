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
      const params = new URLSearchParams();
      if (currentFilters.period) params.append('period', currentFilters.period);
      if (currentFilters.marketplace !== 'all') params.append('marketplace', currentFilters.marketplace);
      if (currentFilters.orderStatus !== 'all') params.append('orderStatus', currentFilters.orderStatus);
      if (currentFilters.brand !== 'all') params.append('brand', currentFilters.brand);
      if (currentFilters.search) params.append('search', currentFilters.search);
      
      const productsRes = await api.get(`/api/dashboard/products?${params.toString()}`);
      
      setProducts(productsRes.data.products);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
    fetchDashboardData(newFilters);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-green-600 h-[60px] flex items-center justify-between px-6">
        <h1 className="text-white text-2xl font-semibold">Sales</h1>
        <button className="bg-white text-green-600 px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors">
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