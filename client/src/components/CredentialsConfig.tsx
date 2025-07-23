import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Credentials {
  amazon: { configured: boolean; sellerId?: string; marketplaceId?: string };
  mercadolivre: { configured: boolean; sellerId?: string };
}

interface AmazonForm {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplaceCode: string; // BR, US, UK, etc.
}

interface MlForm {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
}

interface Message {
  type: 'success' | 'error';
  text: string;
}

const CredentialsConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'amazon' | 'mercadolivre'>('amazon');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [credentials, setCredentials] = useState<Credentials>({
    amazon: { configured: false },
    mercadolivre: { configured: false }
  });
  
  const [amazonForm, setAmazonForm] = useState<AmazonForm>({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    marketplaceCode: 'BR' // Brasil como padrão
  });
  
  // Lista de marketplaces disponíveis
  const marketplaces = [
    { code: 'BR', name: 'Brasil' },
    { code: 'US', name: 'Estados Unidos' },
    { code: 'CA', name: 'Canadá' },
    { code: 'MX', name: 'México' },
    { code: 'UK', name: 'Reino Unido' },
    { code: 'DE', name: 'Alemanha' },
    { code: 'FR', name: 'França' },
    { code: 'IT', name: 'Itália' },
    { code: 'ES', name: 'Espanha' },
    { code: 'JP', name: 'Japão' },
    { code: 'AU', name: 'Austrália' },
    { code: 'SG', name: 'Singapura' }
  ];
  
  const [authorizationStep, setAuthorizationStep] = useState<'initial' | 'waiting' | 'completed'>('initial');
  const [authorizationUrl, setAuthorizationUrl] = useState<string>('');
  const [processingAuth, setProcessingAuth] = useState(false);
  
  const [mlForm, setMlForm] = useState<MlForm>({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    accessToken: ''
  });
  
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCredentialsStatus();
    // Carregar credenciais existentes se disponíveis
    loadExistingCredentials();
  }, []);

  const loadExistingCredentials = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/credentials/details', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.amazon) {
        setAmazonForm(prev => ({
          ...prev,
          clientId: response.data.amazon.clientId || '',
          sellerId: response.data.amazon.sellerId || '',
          marketplaceId: response.data.amazon.marketplaceId || prev.marketplaceId
        }));
      }
    } catch (error) {
      // Silenciosamente ignorar se não houver credenciais
      console.log('Nenhuma credencial existente encontrada');
    }
  };

  const fetchCredentialsStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/credentials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredentials(response.data);
    } catch (error) {
      console.error('Erro ao buscar status das credenciais:', error);
    }
  };

  const toggleShowSecret = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleAmazonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/credentials/amazon', amazonForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ type: 'success', text: response.data.message });
      fetchCredentialsStatus();
      
      // Manter o formulário preenchido para permitir atualizações
      // Apenas resetar o estado de autorização
      setAuthorizationStep('initial');
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Erro ao salvar credenciais' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/credentials/mercadolivre', mlForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage({ type: 'success', text: response.data.message });
      fetchCredentialsStatus();
      
      // Manter o formulário preenchido para permitir atualizações
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Erro ao salvar credenciais' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredentials = async (service: 'amazon' | 'mercadolivre') => {
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const formData = service === 'amazon' ? amazonForm : mlForm;
      
      const response = await axios.post(`/api/credentials/${service}/test`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Credenciais válidas!' });
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Credenciais inválidas' });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Erro ao testar credenciais' 
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAmazonAuthUrl = () => {
    if (!amazonForm.clientId) {
      setMessage({ type: 'error', text: 'Preencha o Client ID primeiro' });
      return;
    }

    // Mapeamento simplificado de URLs de autorização
    const authUrls: Record<string, string> = {
      'BR': 'https://sellercentral.amazon.com.br',
      'US': 'https://sellercentral.amazon.com',
      'CA': 'https://sellercentral.amazon.ca',
      'MX': 'https://sellercentral.amazon.com.mx',
      'UK': 'https://sellercentral.amazon.co.uk',
      'DE': 'https://sellercentral.amazon.de',
      'FR': 'https://sellercentral.amazon.fr',
      'IT': 'https://sellercentral.amazon.it',
      'ES': 'https://sellercentral.amazon.es',
      'JP': 'https://sellercentral.amazon.co.jp',
      'AU': 'https://sellercentral.amazon.com.au',
      'SG': 'https://sellercentral.amazon.sg'
    };

    const baseUrl = authUrls[amazonForm.marketplaceCode] || authUrls['BR'];
    const state = `appproft_${Date.now()}_${amazonForm.marketplaceCode}`;
    const url = `${baseUrl}/apps/authorize/consent?application_id=${amazonForm.clientId}&state=${state}&version=beta`;
    
    setAuthorizationUrl(url);
    setAuthorizationStep('waiting');
    
    // Salvar state e marketplace no localStorage
    localStorage.setItem('amazon_auth_state', state);
    localStorage.setItem('amazon_auth_marketplace', amazonForm.marketplaceCode);
    
    // Abrir URL em nova aba
    window.open(url, '_blank');
  };

  const checkAuthorizationCallback = async () => {
    setProcessingAuth(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/credentials/amazon/check-callback', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.hasCallback && response.data.refreshToken) {
        setAmazonForm({ ...amazonForm, refreshToken: response.data.refreshToken });
        setAuthorizationStep('completed');
        setMessage({ type: 'success', text: 'Refresh Token obtido com sucesso!' });
      } else {
        setMessage({ type: 'error', text: 'Ainda aguardando autorização...' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao verificar autorização' });
    } finally {
      setProcessingAuth(false);
    }
  };

  const SecretField: React.FC<{
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    field: string;
    required?: boolean;
  }> = ({ label, name, value, onChange, field, required = false }) => (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={showSecrets[field] ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-primary-orange pr-10"
        />
        <button
          type="button"
          onClick={() => toggleShowSecret(field)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          {showSecrets[field] ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Configuração de Credenciais
          </h2>
          
          {/* Status das credenciais */}
          <div className="flex gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${credentials.amazon.configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                Amazon {credentials.amazon.configured ? 'Configurado' : 'Não configurado'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${credentials.mercadolivre.configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                Mercado Livre {credentials.mercadolivre.configured ? 'Configurado' : 'Não configurado'}
              </span>
            </div>
          </div>

          {/* Mensagem */}
          {message && (
            <div className={`mb-4 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('amazon')}
              className={`px-4 py-2 font-medium text-sm border-b-2 ${
                activeTab === 'amazon'
                  ? 'border-primary-orange text-primary-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Amazon SP-API
            </button>
            <button
              onClick={() => setActiveTab('mercadolivre')}
              className={`px-4 py-2 font-medium text-sm border-b-2 ml-8 ${
                activeTab === 'mercadolivre'
                  ? 'border-primary-orange text-primary-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Mercado Livre API
            </button>
          </div>

          {/* Amazon Form */}
          {activeTab === 'amazon' && (
            <form onSubmit={handleAmazonSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={amazonForm.clientId}
                    onChange={(e) => setAmazonForm({ ...amazonForm, clientId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-primary-orange"
                  />
                </div>
                
                <SecretField
                  label="Client Secret"
                  name="clientSecret"
                  value={amazonForm.clientSecret}
                  onChange={(e) => setAmazonForm({ ...amazonForm, clientSecret: e.target.value })}
                  field="amazonClientSecret"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <SecretField
                  label="Refresh Token"
                  name="refreshToken"
                  value={amazonForm.refreshToken}
                  onChange={(e) => setAmazonForm({ ...amazonForm, refreshToken: e.target.value })}
                  field="amazonRefreshToken"
                  required={authorizationStep !== 'waiting'}
                />
                
                {/* Botão para gerar Refresh Token */}
                {amazonForm.clientId && amazonForm.clientSecret && !amazonForm.refreshToken && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
                    <p className="text-sm text-blue-800 mb-3">
                      Não tem um Refresh Token? Clique abaixo para gerar:
                    </p>
                    
                    {authorizationStep === 'initial' && (
                      <button
                        type="button"
                        onClick={generateAmazonAuthUrl}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        Gerar Refresh Token
                      </button>
                    )}
                    
                    {authorizationStep === 'waiting' && (
                      <div className="space-y-3">
                        <p className="text-sm text-blue-700">
                          ✅ Uma nova aba foi aberta. Complete a autorização na Amazon.
                        </p>
                        <button
                          type="button"
                          onClick={checkAuthorizationCallback}
                          disabled={processingAuth}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
                        >
                          {processingAuth ? 'Verificando...' : 'Verificar Autorização'}
                        </button>
                        <div className="text-xs text-gray-600">
                          <p>URL de autorização:</p>
                          <a href={authorizationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                            {authorizationUrl}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {authorizationStep === 'completed' && (
                      <div className="bg-green-100 border border-green-300 rounded p-3">
                        <p className="text-sm text-green-800">
                          ✅ Refresh Token obtido com sucesso! Agora você pode salvar as credenciais.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  País/Região do Marketplace
                </label>
                <select
                  value={amazonForm.marketplaceCode}
                  onChange={(e) => setAmazonForm({ ...amazonForm, marketplaceCode: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-primary-orange"
                >
                  {marketplaces.map(mp => (
                    <option key={mp.code} value={mp.code}>
                      {mp.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Selecione o país onde você vende na Amazon
                </p>
              </div>
              
              
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => handleTestCredentials('amazon')}
                  disabled={loading || !amazonForm.clientId || !amazonForm.clientSecret}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Testar Conexão
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-primary-orange text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    'Salvar Credenciais'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Mercado Livre Form */}
          {activeTab === 'mercadolivre' && (
            <form onSubmit={handleMlSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={mlForm.clientId}
                    onChange={(e) => setMlForm({ ...mlForm, clientId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-primary-orange"
                  />
                </div>
                
                <SecretField
                  label="Client Secret"
                  name="clientSecret"
                  value={mlForm.clientSecret}
                  onChange={(e) => setMlForm({ ...mlForm, clientSecret: e.target.value })}
                  field="mlClientSecret"
                  required
                />
              </div>
              
              <SecretField
                label="Access Token"
                name="accessToken"
                value={mlForm.accessToken}
                onChange={(e) => setMlForm({ ...mlForm, accessToken: e.target.value })}
                field="mlAccessToken"
                required
              />
              
              <SecretField
                label="Refresh Token"
                name="refreshToken"
                value={mlForm.refreshToken}
                onChange={(e) => setMlForm({ ...mlForm, refreshToken: e.target.value })}
                field="mlRefreshToken"
                required
              />
              
              
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => handleTestCredentials('mercadolivre')}
                  disabled={loading || !mlForm.clientId || !mlForm.clientSecret}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Testar Conexão
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-primary-orange text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    'Salvar Credenciais'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CredentialsConfig;