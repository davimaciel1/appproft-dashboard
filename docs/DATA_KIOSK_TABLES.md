# 📊 TABELAS CRIADAS PARA AMAZON DATA KIOSK API

## 🆕 NOVAS TABELAS IMPLEMENTADAS

### 1. **`daily_metrics`** - Métricas Diárias Agregadas
Armazena métricas consolidadas por dia de todas as vendas e tráfego.

```sql
CREATE TABLE daily_metrics (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
    date DATE NOT NULL,
    marketplace VARCHAR(50) NOT NULL DEFAULT 'amazon',
    ordered_product_sales DECIMAL(10,2) DEFAULT 0,      -- Vendas totais do dia
    units_ordered INTEGER DEFAULT 0,                     -- Unidades vendidas
    total_order_items INTEGER DEFAULT 0,                 -- Total de itens pedidos
    page_views INTEGER DEFAULT 0,                        -- Visualizações de página
    sessions INTEGER DEFAULT 0,                          -- Sessões de usuários
    buy_box_percentage DECIMAL(5,2) DEFAULT 0,          -- % Buy Box ganho
    unit_session_percentage DECIMAL(5,2) DEFAULT 0,     -- Taxa de conversão
    average_selling_price DECIMAL(10,2) DEFAULT 0,      -- Preço médio de venda
    units_refunded INTEGER DEFAULT 0,                    -- Unidades devolvidas
    refund_rate DECIMAL(5,2) DEFAULT 0,                 -- Taxa de devolução
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, date, marketplace)
);
```

**Dados que armazena**: Métricas diárias consolidadas de vendas, tráfego e performance

---

### 2. **`product_metrics_history`** - Histórico de Métricas por Produto
Histórico detalhado de performance individual de cada produto.

```sql
CREATE TABLE product_metrics_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
    date DATE NOT NULL,
    asin VARCHAR(20),                               -- ASIN do produto
    sku VARCHAR(100),                               -- SKU do produto
    units_ordered INTEGER DEFAULT 0,                -- Unidades vendidas
    revenue DECIMAL(10,2) DEFAULT 0,                -- Receita gerada
    page_views INTEGER DEFAULT 0,                   -- Visualizações do produto
    sessions INTEGER DEFAULT 0,                     -- Sessões no produto
    buy_box_percentage DECIMAL(5,2) DEFAULT 0,     -- % Buy Box do produto
    unit_session_percentage DECIMAL(5,2) DEFAULT 0, -- Conversão do produto
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(product_id, date)
);
```

**Dados que armazena**: Performance histórica individual de cada produto (vendas, visualizações, conversão)

---

### 3. **`traffic_metrics`** - Métricas de Tráfego Detalhadas
Análise detalhada do tráfego e comportamento dos usuários.

```sql
CREATE TABLE traffic_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    tenant_id INTEGER NOT NULL,
    marketplace VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    page_views INTEGER DEFAULT 0,                      -- Total de page views
    sessions INTEGER DEFAULT 0,                        -- Total de sessões
    browser_page_views INTEGER DEFAULT 0,              -- Views via navegador
    mobile_app_page_views INTEGER DEFAULT 0,           -- Views via app mobile
    buy_box_percentage DECIMAL(5,2) DEFAULT 0,        -- % Buy Box
    unit_session_percentage DECIMAL(5,2) DEFAULT 0,    -- Taxa de conversão
    feedback_received INTEGER DEFAULT 0,               -- Feedbacks recebidos
    negative_feedback_received INTEGER DEFAULT 0,      -- Feedbacks negativos
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, marketplace, date)
);
```

**Dados que armazena**: Tráfego detalhado por fonte (browser/mobile), feedbacks e conversão

---

### 4. **`data_kiosk_dashboard`** - View Consolidada (não é tabela, é VIEW)
View que consolida todas as métricas para fácil visualização no dashboard.

```sql
CREATE VIEW data_kiosk_dashboard AS
SELECT 
    dm.date,
    dm.tenant_id,
    dm.marketplace,
    dm.ordered_product_sales as todays_sales,        -- Vendas do dia
    dm.total_order_items as orders_count,            -- Número de pedidos
    dm.units_ordered as units_sold,                  -- Unidades vendidas
    ROUND(dm.units_ordered::numeric / NULLIF(dm.total_order_items, 0), 1) as avg_units_per_order,
    dm.buy_box_percentage,                           -- % Buy Box
    dm.unit_session_percentage as conversion_rate,    -- Taxa de conversão
    dm.page_views,                                   -- Visualizações
    dm.sessions,                                     -- Sessões
    ROUND((dm.page_views::numeric / NULLIF(dm.sessions, 0)) * 100, 2) as page_views_per_session,
    ROUND(dm.ordered_product_sales * 0.3, 2) as estimated_profit,  -- Lucro estimado (30%)
    '30.0' as profit_margin_percent,
    '0.0' as acos_percent                            -- Placeholder para advertising
FROM daily_metrics dm
ORDER BY dm.date DESC;
```

---

## 📋 CAMPOS ADICIONADOS EM TABELAS EXISTENTES

### Tabela `products` - Novos campos adicionados:
```sql
ALTER TABLE products ADD COLUMN:
- last_units_sold INTEGER DEFAULT 0          -- Últimas unidades vendidas
- last_revenue DECIMAL(10,2) DEFAULT 0       -- Última receita
- buy_box_percentage DECIMAL(5,2) DEFAULT 0  -- % Buy Box atual
- conversion_rate DECIMAL(5,2) DEFAULT 0     -- Taxa de conversão
- last_sync_at TIMESTAMP DEFAULT NOW()       -- Última sincronização
```

---

## 🔍 ÍNDICES CRIADOS PARA PERFORMANCE

```sql
-- Índices para daily_metrics
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_tenant ON daily_metrics(tenant_id);
CREATE INDEX idx_daily_metrics_marketplace ON daily_metrics(marketplace);

-- Índices para product_metrics_history
CREATE INDEX idx_product_metrics_history_date ON product_metrics_history(date);
CREATE INDEX idx_product_metrics_history_asin ON product_metrics_history(asin);
CREATE INDEX idx_product_metrics_history_tenant ON product_metrics_history(tenant_id);
```

---

## 📊 RESUMO DAS TABELAS DATA KIOSK

| Tabela | Tipo | Dados Armazenados | Frequência de Atualização |
|--------|------|-------------------|---------------------------|
| **daily_metrics** | Tabela | Métricas diárias agregadas (vendas, tráfego) | Diariamente |
| **product_metrics_history** | Tabela | Histórico individual por produto | Diariamente |
| **traffic_metrics** | Tabela | Tráfego detalhado e feedbacks | Diariamente |
| **data_kiosk_dashboard** | View | Consolidação para dashboard | Tempo real (view) |

---

## 🎯 COMO USAR AS TABELAS

### Exemplos de Queries Úteis:

```sql
-- 1. Ver vendas dos últimos 7 dias
SELECT * FROM daily_metrics 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- 2. Top 10 produtos por receita
SELECT 
    p.name,
    p.asin,
    SUM(pmh.revenue) as total_revenue,
    SUM(pmh.units_ordered) as total_units
FROM product_metrics_history pmh
JOIN products p ON pmh.product_id = p.id
WHERE pmh.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.id, p.name, p.asin
ORDER BY total_revenue DESC
LIMIT 10;

-- 3. Dashboard completo de hoje
SELECT * FROM data_kiosk_dashboard
WHERE date = CURRENT_DATE;

-- 4. Análise de conversão por dia
SELECT 
    date,
    sessions,
    page_views,
    units_ordered,
    unit_session_percentage as conversion_rate,
    ROUND(page_views::numeric / NULLIF(sessions, 0), 2) as pages_per_session
FROM daily_metrics
ORDER BY date DESC
LIMIT 30;
```

---

## 🔄 STATUS ATUAL

- ✅ **Tabelas criadas e prontas para uso**
- ✅ **Índices otimizados implementados**
- ✅ **View de dashboard configurada**
- ⏳ **Aguardando primeira sincronização com Data Kiosk**
- 🔄 **PersistentSyncManager processando tarefas**

Para verificar se há dados:
```sql
SELECT COUNT(*) FROM daily_metrics;
SELECT COUNT(*) FROM product_metrics_history;
SELECT COUNT(*) FROM traffic_metrics;
```