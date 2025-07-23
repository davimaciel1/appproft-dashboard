import React, { useState, useEffect } from 'react';
import api from '../services/api';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import MetricsCards from '../components/MetricsCards';
import FiltersBar from '../components/FiltersBar';
import ProductsTable from '../components/ProductsTable';
import HeroSection from '../components/HeroSection';
import SyncButton from '../components/SyncButton';
import RealtimeOrdersSidebar from '../components/RealtimeOrdersSidebar';

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState({
    todaysSales: 0,
    ordersCount: 0,
    unitsSold: 0,
    avgUnitsPerOrder: '0',
    netProfit: 0,
    profitMargin: '0',
    acos: '0',
    yesterdayComparison: 0,
    newOrders: 0
  });
  
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realtimeOrders, setRealtimeOrders] = useState([]);
  const [filters, setFilters] = useState({
    marketplace: 'all',
    period: 'today',
    country: 'all'
  });

  useEffect(() => {
    fetchDashboardData();
    
    const socket = io(window.location.origin);
    
    socket.on('new-order', (order) => {
      // Add to realtime orders list
      setRealtimeOrders(prev => [{
        ...order,
        id: `${order.marketplace}_${order.orderId}_${Date.now()}`,
        timestamp: new Date()
      }, ...prev].slice(0, 10));
      
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
      if (currentFilters.country !== 'all') params.append('country', currentFilters.country);
      
      const [metricsRes, productsRes] = await Promise.all([
        api.get(`/api/dashboard/metrics?${params.toString()}`),
        api.get(`/api/dashboard/products?${params.toString()}`)
      ]);
      
      setMetrics(metricsRes.data);
      setProducts(productsRes.data.products);
      applyFilters(productsRes.data.products, currentFilters);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (productsData: any[], currentFilters: any) => {
    let filtered = [...productsData];
    
    // Filtrar por marketplace
    if (currentFilters.marketplace !== 'all') {
      filtered = filtered.filter(p => p.marketplace === currentFilters.marketplace);
    }
    
    // Filtrar por país
    if (currentFilters.country !== 'all') {
      filtered = filtered.filter(p => p.country === currentFilters.country);
    }
    
    setFilteredProducts(filtered);
  };

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
    fetchDashboardData(newFilters);
  };

  return (
    <>
      <HeroSection />
      
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-card">
          <div className="bg-primary-dark text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex space-x-2 mr-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <h2 className="text-xl font-semibold">Dashboard de Vendas Consolidadas</h2>
            </div>
            <SyncButton onSync={fetchDashboardData} />
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="skeleton h-32 w-full mb-6"></div>
            ) : (
              <>
                <MetricsCards metrics={metrics} />
                <FiltersBar onFiltersChange={handleFiltersChange} />
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                  <div className="lg:col-span-3">
                    <ProductsTable products={filteredProducts.length > 0 ? filteredProducts : products} />
                  </div>
                  <div className="lg:col-span-1">
                    <RealtimeOrdersSidebar orders={realtimeOrders} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;