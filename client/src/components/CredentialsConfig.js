import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import axios from 'axios';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CredentialsConfig = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [credentials, setCredentials] = useState({
    amazon: { configured: false },
    mercadolivre: { configured: false }
  });
  
  const [amazonForm, setAmazonForm] = useState({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    sellerId: '',
    marketplaceId: 'A2Q3Y263D00KWC',
    awsAccessKey: '',
    awsSecretKey: ''
  });
  
  const [mlForm, setMlForm] = useState({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    accessToken: '',
    sellerId: ''
  });
  
  const [showSecrets, setShowSecrets] = useState({});

  useEffect(() => {
    fetchCredentialsStatus();
  }, []);

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

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setMessage(null);
  };

  const toggleShowSecret = (field) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleAmazonSubmit = async (e) => {
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
      
      // Limpar formulário após sucesso
      setAmazonForm({
        clientId: '',
        clientSecret: '',
        refreshToken: '',
        sellerId: '',
        marketplaceId: 'A2Q3Y263D00KWC',
        awsAccessKey: '',
        awsSecretKey: ''
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Erro ao salvar credenciais' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMlSubmit = async (e) => {
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
      
      // Limpar formulário após sucesso
      setMlForm({
        clientId: '',
        clientSecret: '',
        refreshToken: '',
        accessToken: '',
        sellerId: ''
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Erro ao salvar credenciais' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredentials = async (service) => {
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

  const SecretField = ({ label, name, value, onChange, showSecret, field }) => (
    <TextField
      fullWidth
      label={label}
      name={name}
      type={showSecret ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      required
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton onClick={() => toggleShowSecret(field)} edge="end">
              {showSecret ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        )
      }}
    />
  );

  return (
    <Card sx={{ maxWidth: 800, margin: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Configuração de Credenciais
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {credentials.amazon.configured ? (
              <CheckCircle color="success" />
            ) : (
              <Cancel color="error" />
            )}
            <Typography variant="body2">
              Amazon {credentials.amazon.configured ? 'Configurado' : 'Não configurado'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {credentials.mercadolivre.configured ? (
              <CheckCircle color="success" />
            ) : (
              <Cancel color="error" />
            )}
            <Typography variant="body2">
              Mercado Livre {credentials.mercadolivre.configured ? 'Configurado' : 'Não configurado'}
            </Typography>
          </Box>
        </Box>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Amazon SP-API" />
          <Tab label="Mercado Livre API" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <form onSubmit={handleAmazonSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Client ID"
                  name="clientId"
                  value={amazonForm.clientId}
                  onChange={(e) => setAmazonForm({ ...amazonForm, clientId: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <SecretField
                  label="Client Secret"
                  name="clientSecret"
                  value={amazonForm.clientSecret}
                  onChange={(e) => setAmazonForm({ ...amazonForm, clientSecret: e.target.value })}
                  showSecret={showSecrets.amazonClientSecret}
                  field="amazonClientSecret"
                />
              </Grid>
              
              <Grid item xs={12}>
                <SecretField
                  label="Refresh Token"
                  name="refreshToken"
                  value={amazonForm.refreshToken}
                  onChange={(e) => setAmazonForm({ ...amazonForm, refreshToken: e.target.value })}
                  showSecret={showSecrets.amazonRefreshToken}
                  field="amazonRefreshToken"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Seller ID"
                  name="sellerId"
                  value={amazonForm.sellerId}
                  onChange={(e) => setAmazonForm({ ...amazonForm, sellerId: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Marketplace ID"
                  name="marketplaceId"
                  value={amazonForm.marketplaceId}
                  onChange={(e) => setAmazonForm({ ...amazonForm, marketplaceId: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <SecretField
                  label="AWS Access Key (opcional)"
                  name="awsAccessKey"
                  value={amazonForm.awsAccessKey}
                  onChange={(e) => setAmazonForm({ ...amazonForm, awsAccessKey: e.target.value })}
                  showSecret={showSecrets.awsAccessKey}
                  field="awsAccessKey"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <SecretField
                  label="AWS Secret Key (opcional)"
                  name="awsSecretKey"
                  value={amazonForm.awsSecretKey}
                  onChange={(e) => setAmazonForm({ ...amazonForm, awsSecretKey: e.target.value })}
                  showSecret={showSecrets.awsSecretKey}
                  field="awsSecretKey"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => handleTestCredentials('amazon')}
                    disabled={loading || !amazonForm.clientId || !amazonForm.clientSecret}
                  >
                    Testar Conexão
                  </Button>
                  
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{ 
                      backgroundColor: '#FF8C00',
                      '&:hover': { backgroundColor: '#ff7700' }
                    }}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Salvar Credenciais'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <form onSubmit={handleMlSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Client ID"
                  name="clientId"
                  value={mlForm.clientId}
                  onChange={(e) => setMlForm({ ...mlForm, clientId: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <SecretField
                  label="Client Secret"
                  name="clientSecret"
                  value={mlForm.clientSecret}
                  onChange={(e) => setMlForm({ ...mlForm, clientSecret: e.target.value })}
                  showSecret={showSecrets.mlClientSecret}
                  field="mlClientSecret"
                />
              </Grid>
              
              <Grid item xs={12}>
                <SecretField
                  label="Access Token"
                  name="accessToken"
                  value={mlForm.accessToken}
                  onChange={(e) => setMlForm({ ...mlForm, accessToken: e.target.value })}
                  showSecret={showSecrets.mlAccessToken}
                  field="mlAccessToken"
                />
              </Grid>
              
              <Grid item xs={12}>
                <SecretField
                  label="Refresh Token"
                  name="refreshToken"
                  value={mlForm.refreshToken}
                  onChange={(e) => setMlForm({ ...mlForm, refreshToken: e.target.value })}
                  showSecret={showSecrets.mlRefreshToken}
                  field="mlRefreshToken"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Seller ID"
                  name="sellerId"
                  value={mlForm.sellerId}
                  onChange={(e) => setMlForm({ ...mlForm, sellerId: e.target.value })}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => handleTestCredentials('mercadolivre')}
                    disabled={loading || !mlForm.clientId || !mlForm.clientSecret}
                  >
                    Testar Conexão
                  </Button>
                  
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{ 
                      backgroundColor: '#FF8C00',
                      '&:hover': { backgroundColor: '#ff7700' }
                    }}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Salvar Credenciais'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </TabPanel>
      </CardContent>
    </Card>
  );
};

export default CredentialsConfig;