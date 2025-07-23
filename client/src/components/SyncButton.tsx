import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncButtonProps {
  onSync: () => void;
  marketplace?: 'all' | 'amazon' | 'mercadolivre';
}

const SyncButton: React.FC<SyncButtonProps> = ({ onSync, marketplace = 'all' }) => {
  const [isSyncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = marketplace === 'all' 
        ? '/api/sync/all'
        : `/api/sync/${marketplace}`;
        
      const response = await fetch(`http://localhost:3004${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Sincronização concluída:', data);
        onSync();
      } else {
        console.error('❌ Erro na sincronização:', data.error);
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getButtonText = () => {
    if (isSyncing) return 'Sincronizando...';
    
    switch (marketplace) {
      case 'amazon':
        return 'Sincronizar Amazon';
      case 'mercadolivre':
        return 'Sincronizar ML';
      default:
        return 'Sincronizar Tudo';
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-all duration-200 transform
        ${isSyncing 
          ? 'bg-gray-300 cursor-not-allowed' 
          : 'bg-orange-500 hover:bg-orange-600 hover:shadow-lg hover:-translate-y-0.5 text-white'
        }
      `}
    >
      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
      {getButtonText()}
    </button>
  );
};

export default SyncButton;