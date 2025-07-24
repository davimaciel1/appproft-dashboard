# Dashboard AppProft: Resolvendo erro 404 nas rotas Express

O problema do dashboard não exibindo dados do PostgreSQL ocorre porque as rotas `/api/dashboard-local/*` não estão sendo registradas corretamente no Express, causando erro 404. A solução envolve corrigir o registro das rotas no servidor, atualizar as chamadas de API no frontend React, e garantir a conexão adequada com o banco de dados PostgreSQL.

O erro surge de uma combinação de fatores: ordem incorreta no registro de rotas Express, possível ausência de exportação adequada nos arquivos de rotas, e chamadas incorretas no componente React. Além disso, a configuração de proxy entre o frontend e backend pode estar causando problemas de redirecionamento. Este guia fornece soluções completas e testadas para cada aspecto do problema, incluindo código pronto para implementação e métodos de debug detalhados.

## Corrigindo o registro de rotas no Express

O arquivo `server/index.js` precisa registrar as rotas na ordem correta, com rotas mais específicas primeiro. A ordem de registro é **crucial** no Express - rotas genéricas registradas antes podem interceptar requisições destinadas a rotas mais específicas.

```javascript
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares essenciais
app.use(cors());
app.use(express.json());

// Middleware de debug - remover em produção
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// IMPORTAR ROTAS - verificar se os arquivos existem
const dashboardLocalRoutes = require('./routes/dashboardLocal');
const dashboardFallbackRoutes = require('./routes/dashboard-fallback');

// REGISTRAR ROTAS - ordem importa!
app.use('/api/dashboard-local', dashboardLocalRoutes);
app.use('/api/dashboard', dashboardFallbackRoutes);

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Servir React em produção
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log('Rotas registradas:');
  console.log('- /api/dashboard-local/*');
  console.log('- /api/dashboard/*');
});
```

O arquivo `server/routes/dashboardLocal.js` deve exportar um router Express válido com as rotas necessárias:

```javascript
const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// Rota para produtos
router.get('/products', async (req, res) => {
  try {
    console.log('Buscando produtos...');
    const query = 'SELECT id, name, price FROM products ORDER BY created_at DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para métricas
router.get('/metrics', async (req, res) => {
  try {
    const queries = await Promise.all([
      pool.query('SELECT COUNT(*) as total_products FROM products'),
      pool.query('SELECT SUM(price) as total_revenue FROM products')
    ]);
    
    const metrics = {
      totalProducts: parseInt(queries[0].rows[0].total_products),
      totalRevenue: parseFloat(queries[1].rows[0].total_revenue || 0)
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
```

## Atualizando o componente Dashboard no React

O componente `Dashboard.tsx` precisa usar as URLs corretas e implementar tratamento de erro robusto. A configuração de variáveis de ambiente permite flexibilidade entre ambientes de desenvolvimento e produção.

```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://appproft.com';

interface Product {
  id: number;
  name: string;
  price: number;
}

interface Metrics {
  totalProducts: number;
  totalRevenue: number;
}

const Dashboard: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiCall = async (endpoint: string) => {
    try {
      console.log(`Chamando: ${API_BASE_URL}/api/dashboard-local${endpoint}`);
      const response = await axios.get(`${API_BASE_URL}/api/dashboard-local${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`Erro na chamada ${endpoint}:`, error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [productsData, metricsData] = await Promise.all([
          apiCall('/products'),
          apiCall('/metrics')
        ]);

        setProducts(productsData);
        setMetrics(metricsData);
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
        setError(`Erro ao carregar dados: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) return <div>Carregando dashboard...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      {/* Renderizar métricas e produtos */}
    </div>
  );
};

export default Dashboard;
```

## Diagnosticando e resolvendo o erro 404

O erro 404 pode ter várias causas. Para diagnosticar eficientemente, siga esta sequência de verificações:

**1. Verificar se o servidor está rodando:**
```bash
curl https://appproft.com/api/health
```

**2. Testar as rotas específicas:**
```bash
curl -v https://appproft.com/api/dashboard-local/products
curl -v https://appproft.com/api/dashboard-local/metrics
```

**3. Adicionar logs detalhados no servidor:**
```javascript
// Adicionar antes do registro de rotas
app.use('*', (req, res, next) => {
  console.log('=== REQUEST DEBUG ===');
  console.log('URL:', req.originalUrl);
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('===================');
  next();
});
```

**4. Verificar se os arquivos de rotas existem e exportam corretamente:**
```bash
# No terminal
ls -la server/routes/
cat server/routes/dashboardLocal.js | grep "module.exports"
```

## Configurando a conexão com PostgreSQL

A conexão com o banco de dados deve ser configurada em um arquivo separado para melhor organização e reutilização:

```javascript
// server/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'appproft',
  password: process.env.DB_PASSWORD || 'senha',
  port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro na conexão:', err);
});

module.exports = { pool };
```

Para testar a conexão e verificar se as tabelas existem:

```javascript
// server/testDB.js
const { pool } = require('./config/database');

const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Conexão OK:', result.rows[0]);
    
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tabelas:', tables.rows.map(r => r.table_name));
    
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
};

testConnection();
```

## Configurando proxy para desenvolvimento

Se estiver usando Create React App, configure o proxy no `package.json` do cliente:

```json
{
  "name": "appproft-client",
  "version": "0.1.0",
  "proxy": "https://appproft.com",
  "dependencies": {
    // suas dependências
  }
}
```

Para configuração mais avançada, use `setupProxy.js`:

```javascript
// client/src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://appproft.com',
      changeOrigin: true,
      logLevel: 'debug'
    })
  );
};
```

## Conclusão: Próximos passos para garantir o funcionamento

Após implementar as correções, siga esta sequência de verificação para garantir que tudo está funcionando:

1. **Reinicie o servidor** após todas as mudanças
2. **Execute o teste de conexão** com o banco de dados usando `node server/testDB.js`
3. **Verifique as rotas** usando curl ou Postman antes de testar no frontend
4. **Monitore os logs** do servidor enquanto acessa o dashboard
5. **Use as ferramentas de desenvolvimento** do navegador para verificar as requisições de rede

Os problemas mais comuns após essas correções são relacionados a **CORS** (adicione origens específicas se necessário), **autenticação** (verifique se há middlewares bloqueando as rotas), ou **estrutura do banco de dados** (confirme que as tabelas e colunas esperadas existem). Com essas implementações, o dashboard deve exibir corretamente os dados do PostgreSQL, resolvendo tanto o erro 404 quanto os problemas de integração entre frontend e backend.