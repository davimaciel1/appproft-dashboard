import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface SyncStatus {
  totalAsins: number;
  totalRecords: number;
  lastSync: string | null;
  isActive: boolean;
}

interface SyncLog {
  id: string;
  sync_type: string;
  records_synced: number;
  status: string;
  created_at: string;
  details: any;
}

const BuyBoxSyncStatus: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastAutoSync, setLastAutoSync] = useState<string | null>(null);

  useEffect(() => {
    fetchSyncStatus();
    // Atualizar status a cada 30 segundos
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await api.get('/api/buybox/sync/status');
      if (response.data.status === 'success') {
        setSyncStatus(response.data.data);
      }
      
      // Buscar última sincronização automática
      const historyResponse = await api.get('/api/buybox/sync/history');
      if (historyResponse.data.status === 'success') {
        const autoSyncs = historyResponse.data.data.filter(
          (log: SyncLog) => log.sync_type === 'buy_box_auto' && log.status === 'success'
        );
        if (autoSyncs.length > 0) {
          setLastAutoSync(autoSyncs[0].created_at);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar status de sincronização:', error);
    }
  };

  const startSync = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const response = await api.post('/api/buybox/sync/start');
      if (response.data.status === 'success') {
        toast.success('Sincronização iniciada! Isso pode levar alguns minutos.');
        // Atualizar status após 5 segundos
        setTimeout(fetchSyncStatus, 5000);
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('Já existe uma sincronização em andamento');
      } else {
        toast.error('Erro ao iniciar sincronização');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (date: string | null) => {
    if (!date) return 'Nunca';
    
    const lastSyncDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - lastSyncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `Há ${diffMins} minutos`;
    if (diffMins < 1440) return `Há ${Math.floor(diffMins / 60)} horas`;
    return lastSyncDate.toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Status de Sincronização Buy Box
          </h3>
          {syncStatus && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{syncStatus.totalAsins}</span> produtos monitorados
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{syncStatus.totalRecords}</span> registros coletados hoje
              </p>
              <p className="text-sm text-gray-600">
                Última sincronização: <span className="font-medium">{formatLastSync(syncStatus.lastSync)}</span>
              </p>
              <p className="text-sm text-green-600 font-medium">
                ✅ Sincronização automática ativa (a cada 15 minutos)
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {syncStatus?.isActive && (
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-sm text-green-600">Sincronização ativa</span>
            </div>
          )}
          
          <button
            onClick={startSync}
            disabled={isSyncing}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${isSyncing 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-orange-500 text-white hover:bg-orange-600'
              }
            `}
          >
            {isSyncing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sincronizando...
              </span>
            ) : (
              'Sincronizar Agora'
            )}
          </button>
        </div>
      </div>
      
      {!syncStatus?.lastSync && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Atenção:</strong> Nenhuma sincronização foi realizada ainda. 
            Clique em "Sincronizar Agora" para começar a coletar dados reais da Amazon.
          </p>
        </div>
      )}
    </div>
  );
};

export default BuyBoxSyncStatus;