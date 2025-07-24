-- AppProft Dashboard v3.0 - Schema completo baseado no Shopkeeper
-- PostgreSQL com arquitetura de sincronização 24/7

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (migration)
DROP MATERIALIZED VIEW IF EXISTS product_sales_summary CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;

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

-- Inventário atual
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  alert_level INTEGER DEFAULT 10,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id)
);

-- Logs de sincronização
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  marketplace VARCHAR(50) NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- View materializada para performance (como o Shopkeeper faz)
CREATE MATERIALIZED VIEW product_sales_summary AS
SELECT 
  p.*,
  COUNT(DISTINCT o.id) as total_orders,
  COALESCE(SUM(oi.quantity), 0) as total_units_sold,
  COALESCE(SUM(oi.total_price), 0) as total_revenue,
  COALESCE(SUM(oi.total_price - COALESCE(oi.cost, 0) - COALESCE(oi.fees, 0)), 0) as total_profit,
  -- Calcular ROI
  CASE 
    WHEN SUM(oi.cost) > 0 
    THEN ((SUM(oi.total_price - COALESCE(oi.cost, 0) - COALESCE(oi.fees, 0)) / SUM(oi.cost)) * 100)
    ELSE 0 
  END as roi,
  -- Margem de lucro
  CASE 
    WHEN SUM(oi.total_price) > 0 
    THEN ((SUM(oi.total_price - COALESCE(oi.cost, 0) - COALESCE(oi.fees, 0)) / SUM(oi.total_price)) * 100)
    ELSE 0 
  END as profit_margin,
  -- Última atualização
  MAX(o.order_date) as last_sale_date,
  -- Variação de unidades (hoje vs ontem)
  COALESCE(SUM(CASE WHEN o.order_date >= CURRENT_DATE THEN oi.quantity ELSE 0 END), 0) as today_units,
  COALESCE(SUM(CASE WHEN o.order_date >= CURRENT_DATE - INTERVAL '1 day' 
                AND o.order_date < CURRENT_DATE THEN oi.quantity ELSE 0 END), 0) as yesterday_units
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.status IS NULL OR o.status NOT IN ('Cancelled', 'Returned')
GROUP BY p.id, p.tenant_id, p.marketplace, p.marketplace_id, p.sku, p.name, p.image_url, p.brand, p.category, p.status, p.created_at, p.updated_at, p.synced_at;

-- Índices para performance
CREATE INDEX idx_orders_date ON orders(order_date DESC);
CREATE INDEX idx_orders_tenant_date ON orders(tenant_id, order_date DESC);
CREATE INDEX idx_products_tenant ON products(tenant_id, marketplace);
CREATE INDEX idx_products_marketplace_id ON products(marketplace_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_sync_logs_tenant ON sync_logs(tenant_id, started_at DESC);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para refresh da materialized view
CREATE OR REPLACE FUNCTION refresh_product_sales_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_sales_summary;
EXCEPTION WHEN OTHERS THEN
  -- Se falhar o CONCURRENTLY, tentar normal
  REFRESH MATERIALIZED VIEW product_sales_summary;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se é primeira sincronização
CREATE OR REPLACE FUNCTION is_first_sync(tenant_id_param VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM products WHERE tenant_id = tenant_id_param LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- View para dashboard (produtos com ou sem vendas)
CREATE OR REPLACE VIEW dashboard_products AS
SELECT 
  p.id,
  p.tenant_id,
  p.marketplace,
  p.marketplace_id,
  p.sku,
  p.name,
  p.image_url,
  p.brand,
  p.category,
  p.status,
  COALESCE(ps.total_orders, 0) as total_orders,
  COALESCE(ps.total_units_sold, 0) as total_units_sold,
  COALESCE(ps.total_revenue, 0) as total_revenue,
  COALESCE(ps.total_profit, 0) as total_profit,
  COALESCE(ps.roi, 0) as roi,
  COALESCE(ps.profit_margin, 0) as profit_margin,
  COALESCE(ps.today_units, 0) as today_units,
  COALESCE(ps.yesterday_units, 0) as yesterday_units,
  COALESCE(ps.today_units - ps.yesterday_units, 0) as units_variation,
  COALESCE(i.quantity, 0) as inventory_quantity,
  p.synced_at,
  ps.last_sale_date
FROM products p
LEFT JOIN product_sales_summary ps ON p.id = ps.id
LEFT JOIN inventory i ON p.id = i.product_id
WHERE p.status = 'active';

-- Comando para migrar dados existentes (se houver)
-- INSERT INTO products (tenant_id, marketplace, marketplace_id, sku, name, image_url)
-- SELECT tenant_id, marketplace, COALESCE(asin, sku), sku, name, image_url 
-- FROM old_products_table WHERE ...;

COMMENT ON TABLE products IS 'Produtos sincronizados das APIs Amazon e Mercado Livre';
COMMENT ON TABLE orders IS 'Pedidos agrupados por ID único de cada marketplace';
COMMENT ON TABLE order_items IS 'Itens individuais dos pedidos para cálculos de agregação';
COMMENT ON MATERIALIZED VIEW product_sales_summary IS 'View otimizada para dashboard - recalculada a cada sync';
COMMENT ON VIEW dashboard_products IS 'View final para dashboard - mostra produtos com 0 vendas também';