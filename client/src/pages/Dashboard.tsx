import React, { useState, useEffect } from 'react';
import api from '../services/api';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import MetricsCards from '../components/MetricsCards';
import FiltersBar from '../components/FiltersBar';
import ProductsTable from '../components/ProductsTable';
import HeroSection from '../components/HeroSection';
import SyncButton from '../components/SyncButton';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    
    const socket = io('http://localhost:3004');
    
    socket.on('newOrder', (notification) => {
      import('../components/NotificationToast').then(({ showOrderNotification }) => {
        showOrderNotification(notification);
      });
      fetchDashboardData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [metricsRes, productsRes] = await Promise.all([
        api.get('/api/dashboard/metrics'),
        api.get('/api/dashboard/products')
      ]);
      
      setMetrics(metricsRes.data);
      setProducts(productsRes.data.products);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
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
                <FiltersBar />
                <ProductsTable products={products} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;