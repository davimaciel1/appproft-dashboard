INSTRUÇÕES PARA O CLAUDE CODE - DASHBOARD APPPROFT v3.0
CONTEXTO CRÍTICO:
Analisei o código fonte do nosso concorrente Shopkeeper e descobri EXATAMENTE por que o dashboard deles funciona e o nosso não. Eles têm:
1. Workers rodando 24/7 sincronizando dados das APIs
2. Banco de dados PostgreSQL com MILHÕES de registros reais
3. Sistema de cache para performance
4. Arquitetura completa de sincronização

PROBLEMA ATUAL DO APPPROFT:
- Temos as APIs configuradas ✓
- Temos o banco de dados ✓
- MAS não temos dados porque NÃO ESTAMOS SINCRONIZANDO!

O QUE VOCÊ PRECISA FAZER:

## 1. CRIAR SISTEMA DE SINCRONIZAÇÃO COMPLETO

### A) Worker Principal de Sincronização
Criar arquivo: workers/mainSyncWorker.js

```javascript
// Este worker DEVE rodar continuamente para buscar dados das APIs
// Similar ao Sidekiq do Rails que o Shopkeeper usa

class MainSyncWorker {
  async start() {
    // 1. Sincronização inicial (primeira vez)
    if (await this.isFirstSync()) {
      await this.initialSync();
    }
    
    // 2. Sincronização contínua (a cada minuto)
    setInterval(() => this.continuousSync(), 60000);
  }

  async initialSync() {
    // Buscar últimos 30 dias de dados
    console.log('🚀 SINCRONIZAÇÃO INICIAL - Buscando 30 dias de dados...');
    
    // Amazon
    await this.syncAmazonProducts();
    await this.syncAmazonOrders(30);
    await this.syncAmazonInventory();
    
    // Mercado Livre  
    await this.syncMLProducts();
    await this.syncMLOrders(30);
  }

  async continuousSync() {
    // Buscar apenas dados novos/atualizados
    await this.syncAmazonOrders(0.04); // Últimos 60 minutos
    await this.syncMLOrders(0.04);
  }
}
B) Sincronizadores Específicos
Criar arquivos:

services/amazon/productSync.js
services/amazon/orderSync.js
services/mercadolivre/productSync.js
services/mercadolivre/orderSync.js

IMPORTANTE: Cada sincronizador deve:

Buscar dados REAIS da API
Salvar no PostgreSQL
Atualizar cache se houver
Emitir eventos via WebSocket

2. ESTRUTURA DO BANCO DE DADOS COMPLETA
sql-- Criar EXATAMENTE esta estrutura (baseada no Shopkeeper)

-- Produtos com todas as informações necessárias
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  marketplace VARCHAR(50) NOT NULL,
  marketplace_id VARCHAR(100) NOT NULL, -- ASIN ou MLB_ID
  sku VARCHAR(255) NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  brand VARCHAR(255),
  category VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, marketplace, marketplace_id)
);

-- Pedidos agrupados
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  marketplace VARCHAR(50) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  order_type VARCHAR(50), -- FBA, FBM, Business, Retail
  status VARCHAR(50),
  total_amount DECIMAL(10,2),
  currency VARCHAR(10),
  order_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, marketplace, order_id)
);

-- Itens dos pedidos para agregação
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  cost DECIMAL(10,2),
  fees DECIMAL(10,2)
);

-- View materializada para performance (como o Shopkeeper faz)
CREATE MATERIALIZED VIEW product_sales_summary AS
SELECT 
  p.*,
  COUNT(DISTINCT o.id) as total_orders,
  SUM(oi.quantity) as total_units_sold,
  SUM(oi.total_price) as total_revenue,
  SUM(oi.total_price - COALESCE(oi.cost, 0) - COALESCE(oi.fees, 0)) as total_profit,
  -- Calcular ROI
  CASE 
    WHEN SUM(oi.cost) > 0 
    THEN ((SUM(oi.total_price - oi.cost - oi.fees) / SUM(oi.cost)) * 100)
    ELSE 0 
  END as roi,
  -- Última atualização
  MAX(o.order_date) as last_sale_date
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.status NOT IN ('Cancelled', 'Returned')
GROUP BY p.id;

-- Índices para performance
CREATE INDEX idx_orders_date ON orders(order_date DESC);
CREATE INDEX idx_products_tenant ON products(tenant_id, marketplace);
CREATE INDEX idx_order_items_product ON order_items(product_id);
3. IMPLEMENTAR O DASHBOARD (pages/dashboard.jsx)
O dashboard DEVE seguir EXATAMENTE este padrão:
jsxconst Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: 'today',
    marketplace: 'all',
    orderType: 'all'
  });

  // Buscar dados REAIS do banco (NUNCA mockados)
  useEffect(() => {
    fetchRealProducts();
    
    // WebSocket para atualizações em tempo real
    const socket = io('/dashboard');
    socket.on('new-order', (order) => {
      // Atualizar produtos quando novo pedido chegar
      fetchRealProducts();
      showNotification(`Novo pedido: ${order.id}`);
    });
    
    return () => socket.disconnect();
  }, [filters]);

  const fetchRealProducts = async () => {
    try {
      // SEMPRE buscar do endpoint que consulta o PostgreSQL
      const response = await fetch('/api/products/summary?' + new URLSearchParams(filters));
      const data = await response.json();
      
      if (data.length === 0) {
        // Se não houver dados, mostrar mensagem apropriada
        console.log('Nenhum produto encontrado. Executando sincronização...');
        await fetch('/api/sync/trigger', { method: 'POST' });
      }
      
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  // Se não houver dados, mostrar estado apropriado
  if (!loading && products.length === 0) {
    return (
      <EmptyState 
        title="Sincronizando dados..."
        description="Estamos buscando seus produtos na Amazon e Mercado Livre. Isso pode levar alguns minutos na primeira vez."
        showSpinner={true}
      />
    );
  }

  return (
    <div>
      {/* Filtros iguais ao Shopkeeper */}
      <Filters 
        periods={[
          'today', 'yesterday', 'day-before-yesterday',
          'this-week', 'last-week', 'last-7-days', 'last-14-days',
          'this-month', 'last-month', 'month-before-last',
          'last-30-days', 'last-3-months', 'last-6-months',
          'last-12-months', 'year-to-date', 'last-year', 'all-time'
        ]}
      />
      
      {/* Tabela com produtos REAIS */}
      <ProductsTable products={products} />
    </div>
  );
};
4. ENDPOINTS DA API (OBRIGATÓRIOS)
javascript// api/products/summary.js
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  // Query REAL no PostgreSQL (nunca retornar dados fake)
  const query = `
    SELECT 
      p.id,
      p.name,
      p.sku,
      p.marketplace_id as asin,
      p.image_url,
      p.marketplace,
      ps.total_units_sold,
      ps.total_revenue,
      ps.total_profit,
      ps.roi,
      ps.last_sale_date
    FROM products p
    JOIN product_sales_summary ps ON p.id = ps.id
    WHERE p.tenant_id = $1
    ${filters.dateRange ? 'AND ps.last_sale_date >= $2' : ''}
    ORDER BY ps.total_units_sold DESC
    LIMIT 100
  `;
  
  const result = await db.query(query, [tenantId, startDate]);
  return NextResponse.json(result.rows);
}

// api/sync/trigger.js
export async function POST() {
  // Disparar sincronização manual
  await syncWorker.triggerSync();
  return NextResponse.json({ status: 'syncing' });
}
5. SCRIPT DE SETUP INICIAL
Criar: scripts/setupDashboard.js
javascriptasync function setupDashboard() {
  console.log('🚀 Configurando AppProft Dashboard...\n');
  
  // 1. Verificar conexão com banco
  const dbOk = await testDatabase();
  if (!dbOk) {
    console.error('❌ Configure DATABASE_URL no .env');
    process.exit(1);
  }
  
  // 2. Criar estrutura do banco
  await createTables();
  
  // 3. Verificar APIs
  const amazonOk = await testAmazonAPI();
  const mlOk = await testMercadoLivreAPI();
  
  if (!amazonOk || !mlOk) {
    console.error('❌ Configure as credenciais das APIs no .env');
    process.exit(1);
  }
  
  // 4. Iniciar sincronização
  console.log('🔄 Iniciando sincronização inicial...');
  console.log('⏳ Isso pode levar alguns minutos...\n');
  
  const worker = new MainSyncWorker();
  await worker.initialSync();
  
  console.log('\n✅ Setup completo!');
  console.log('🎯 Acesse: http://localhost:3000/dashboard');
  console.log('📊 Worker de sincronização rodando em background');
}
6. COMANDOS PARA EXECUTAR
json// package.json
{
  "scripts": {
    "setup": "node scripts/setupDashboard.js",
    "sync:worker": "node workers/mainSyncWorker.js",
    "sync:force": "node scripts/forceSyncAll.js",
    "dev": "concurrently \"next dev\" \"npm run sync:worker\""
  }
}
RESULTADO ESPERADO:

Dashboard mostrando produtos REAIS agrupados por vendas
Imagens dos produtos carregando das URLs reais
Filtros funcionando e atualizando dados
Novos pedidos aparecendo em tempo real
Zero dados mockados - tudo vindo do PostgreSQL

LEMBRE-SE: O Shopkeeper funciona porque tem WORKERS SINCRONIZANDO DADOS 24/7. Implemente a mesma arquitetura!