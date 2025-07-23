 DASHBOARD APPPROFT - ESPECIFICAÇÃO COMPLETA v2.0
🎯 OBJETIVO PRINCIPAL
Criar um dashboard profissional que mostre dados REAIS da Amazon e Mercado Livre, com produtos agrupados por vendas (mais vendidos primeiro) e atualização de pedidos em tempo real.
❌ PROBLEMAS ATUAIS QUE DEVEM SER CORRIGIDOS

Produtos sem imagens - Implementar fallback e lazy loading
Valores todos zerados - Conectar com PostgreSQL e APIs reais
Filtros não funcionam - Implementar lógica de filtros
Sem agrupamento - Agrupar produtos por total de vendas
Sem real-time - Implementar WebSocket/SSE para novos pedidos

✅ ARQUITETURA DA SOLUÇÃO
1. FLUXO DE DADOS OBRIGATÓRIO
APIs (Amazon/ML) → PostgreSQL → Dashboard
     ↓                ↓           ↓
[Rate Limiter]   [Cache Redis]  [WebSocket]
2. ESTRUTURA DO BANCO (PostgreSQL)
sql-- Tabela principal de produtos com agregações
CREATE MATERIALIZED VIEW product_sales_summary AS
SELECT 
  p.*,
  COUNT(DISTINCT o.id) as total_orders,
  SUM(oi.quantity) as total_units_sold,
  SUM(oi.price * oi.quantity) as total_revenue,
  SUM((oi.price - oi.cost) * oi.quantity) as total_profit,
  RANK() OVER (ORDER BY SUM(oi.quantity) DESC) as sales_rank
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.status NOT IN ('cancelled', 'returned')
GROUP BY p.id
ORDER BY total_units_sold DESC;

-- Índices para performance
CREATE INDEX idx_orders_date ON orders(order_date DESC);
CREATE INDEX idx_products_tenant ON products(tenant_id, marketplace);
📋 IMPLEMENTAÇÃO PASSO A PASSO
PASSO 1: Configurar Conexões com APIs Reais
javascript// config/apis.js
const { SellingPartner } = require('amazon-sp-api');

// Configurar Amazon SP-API
const amazonClient = new SellingPartner({
  region: 'na',
  refresh_token: process.env.AMAZON_REFRESH_TOKEN,
  options: {
    auto_request_tokens: true,
    auto_request_throttled: true
  }
});

// Configurar Mercado Livre
const mercadoLivreClient = {
  baseURL: 'https://api.mercadolibre.com',
  getToken: async () => {
    // Implementar renovação automática
    return await tokenManager.getMercadoLivreToken();
  }
};
PASSO 2: Sistema de Sincronização com Rate Limiting
javascript// services/syncService.js
class SyncService {
  constructor() {
    this.rateLimits = {
      amazon: { orders: 6, inventory: 2 }, // por segundo
      mercadolivre: { orders: 10, products: 10 } // por segundo
    };
  }

  async syncAmazonOrders() {
    // Respeitar rate limit: 6 req/segundo
    const orders = await this.rateLimitedRequest(async () => {
      return await amazonClient.callAPI({
        operation: 'getOrders',
        query: {
          MarketplaceIds: ['A2Q3Y263D00KWC'],
          CreatedAfter: new Date(Date.now() - 3600000).toISOString()
        }
      });
    }, 'amazon', 'orders');

    // Processar e salvar no PostgreSQL
    for (const order of orders.orders) {
      await this.saveOrder(order);
    }
  }

  async rateLimitedRequest(fn, marketplace, endpoint) {
    // Implementar controle de rate limit
    const limit = this.rateLimits[marketplace][endpoint];
    // ... lógica de rate limiting
    return await fn();
  }
}
PASSO 3: Dashboard com Produtos Agrupados
jsx// pages/Dashboard.jsx
const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [realtimeOrders, setRealtimeOrders] = useState([]);
  const [filters, setFilters] = useState({
    marketplace: 'all',
    dateRange: 'today',
    country: 'BR'
  });

  // Buscar produtos agrupados por vendas
  const fetchProducts = async () => {
    const { data } = await api.get('/api/products/ranked', { params: filters });
    setProducts(data);
  };

  // WebSocket para pedidos em tempo real
  useEffect(() => {
    const socket = io('/orders');
    
    socket.on('new-order', (order) => {
      // Tocar som de notificação
      playNotificationSound();
      
      // Adicionar à lista
      setRealtimeOrders(prev => [order, ...prev].slice(0, 10));
      
      // Atualizar produtos
      fetchProducts();
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="dashboard-container">
      {/* Cards de Métricas */}
      <MetricsCards />
      
      {/* Filtros Funcionais */}
      <FiltersBar filters={filters} onChange={setFilters} />
      
      {/* Tabela de Produtos Rankeados */}
      <ProductsTable products={products} />
      
      {/* Sidebar com Pedidos Real-time */}
      <RealtimeOrdersSidebar orders={realtimeOrders} />
    </div>
  );
};
PASSO 4: Tabela de Produtos com Ranking
jsx// components/ProductsTable.jsx
const ProductsTable = ({ products }) => {
  return (
    <table className="products-table">
      <thead>
        <tr>
          <th>Ranking</th>
          <th>Produto</th>
          <th>Vendas Totais</th>
          <th>Vendas Hoje</th>
          <th>Receita</th>
          <th>Lucro</th>
          <th>ROI</th>
          <th>Estoque</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product, index) => (
          <tr key={product.id}>
            <td>
              <div className="rank-badge">#{index + 1}</div>
            </td>
            <td>
              <div className="product-info">
                <img 
                  src={product.image_url || '/placeholder.png'} 
                  onError={(e) => e.target.src = '/placeholder.png'}
                />
                <div>
                  <h4>{product.name}</h4>
                  <span>{product.sku} • {product.marketplace}</span>
                </div>
              </div>
            </td>
            <td className="text-center">
              <strong>{product.total_units_sold}</strong>
              <small>{product.total_orders} pedidos</small>
            </td>
            <td className="text-center">
              {product.today_units || 0}
            </td>
            <td className="text-right">
              {formatCurrency(product.total_revenue)}
            </td>
            <td className={`text-right ${product.total_profit >= 0 ? 'text-green' : 'text-red'}`}>
              {formatCurrency(product.total_profit)}
            </td>
            <td>
              <RoiBadge value={product.roi} />
            </td>
            <td>
              <StockIndicator current={product.stock} alert={product.alert_level} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
PASSO 5: API Endpoints
javascript// api/products/ranked.js
app.get('/api/products/ranked', async (req, res) => {
  const { marketplace, dateRange, country } = req.query;
  
  const query = `
    SELECT 
      p.*,
      ps.total_orders,
      ps.total_units_sold,
      ps.total_revenue,
      ps.total_profit,
      ps.sales_rank,
      COALESCE(i.quantity, 0) as stock,
      COALESCE(
        (SELECT SUM(quantity) FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id 
         WHERE oi.product_id = p.id 
         AND DATE(o.order_date) = CURRENT_DATE), 0
      ) as today_units
    FROM products p
    JOIN product_sales_summary ps ON p.id = ps.product_id
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.tenant_id = $1
      ${marketplace !== 'all' ? 'AND p.marketplace = $2' : ''}
      ${country !== 'all' ? 'AND p.country_code = $3' : ''}
    ORDER BY ps.total_units_sold DESC
    LIMIT 100
  `;
  
  const products = await db.query(query, [req.user.tenantId, marketplace, country]);
  res.json(products.rows);
});
PASSO 6: Worker para Sincronização Contínua
javascript// workers/realtimeSync.js
const cron = require('node-cron');

// Sincronizar pedidos a cada minuto (respeitando rate limits)
cron.schedule('* * * * *', async () => {
  const sync = new SyncService();
  
  try {
    // Amazon: máximo 6 requisições
    await sync.syncAmazonOrders();
    
    // Mercado Livre: máximo 10 requisições
    await sync.syncMercadoLivreOrders();
    
    console.log('✅ Sincronização em tempo real completa');
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  }
});

// Sincronização completa a cada 15 minutos
cron.schedule('*/15 * * * *', async () => {
  await fullSync();
});
🔧 CHECKLIST DE IMPLEMENTAÇÃO
Configuração Inicial

 Criar arquivo .env com todas as credenciais
 Configurar PostgreSQL com as tabelas necessárias
 Instalar dependências: npm install amazon-sp-api bull socket.io pg redis
 Configurar Redis para cache e filas

Backend

 Implementar TokenManager com renovação automática
 Criar serviços de sincronização com rate limiting
 Implementar WebSocket server para real-time
 Criar endpoints da API REST
 Configurar workers e cron jobs

Frontend

 Implementar tabela com produtos rankeados
 Adicionar filtros funcionais
 Criar sidebar de pedidos em tempo real
 Implementar notificações sonoras
 Adicionar loading states e error handling

Testes

 Testar sincronização com APIs reais
 Verificar rate limiting funcionando
 Confirmar atualização em tempo real
 Validar cálculos de ranking
 Testar em mobile

📊 RESULTADO ESPERADO

Tabela de produtos ordenada por vendas (mais vendidos primeiro)
Imagens carregando com fallback para placeholder
Valores reais vindos do banco de dados
Filtros funcionando e atualizando dados
Notificações em tempo real de novos pedidos
Respeito aos rate limits das APIs
Performance < 2 segundos de carregamento

⚠️ PONTOS CRÍTICOS

NUNCA usar dados mockados - sempre dados reais
Respeitar rate limits - Amazon: 6/s, ML: 10/s
Cache inteligente - Redis para métricas
Isolamento multi-tenant - segurança dos dados
Logs detalhados - para debug em produção


Use este documento único para implementar o dashboard completo. Todos os requisitos estão consolidados aqui de forma clara e objetiva.