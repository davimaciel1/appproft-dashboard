-- Database schema for AppProft Dashboard
-- PostgreSQL with multi-tenant support

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  marketplace VARCHAR(20) NOT NULL CHECK (marketplace IN ('amazon', 'mercadolivre')),
  country_code VARCHAR(2) DEFAULT 'BR',
  asin VARCHAR(20),
  sku VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, marketplace, sku)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  marketplace VARCHAR(20) NOT NULL,
  order_id VARCHAR(100) NOT NULL,
  order_date TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'BRL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, marketplace, order_id)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  alert_level INTEGER DEFAULT 10,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id)
);

-- Sync logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  marketplace VARCHAR(20) NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Materialized view for product sales summary
CREATE MATERIALIZED VIEW IF NOT EXISTS product_sales_summary AS
SELECT 
  p.id,
  p.tenant_id,
  p.marketplace,
  p.country_code,
  p.asin,
  p.sku,
  p.name,
  p.image_url,
  COUNT(DISTINCT o.id) as total_orders,
  COALESCE(SUM(oi.quantity), 0) as total_units_sold,
  COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
  COALESCE(SUM((oi.price - oi.cost) * oi.quantity), 0) as total_profit,
  CASE 
    WHEN COALESCE(SUM(oi.cost * oi.quantity), 0) > 0 
    THEN ((COALESCE(SUM((oi.price - oi.cost) * oi.quantity), 0) / SUM(oi.cost * oi.quantity)) * 100)
    ELSE 0 
  END as roi,
  RANK() OVER (PARTITION BY p.tenant_id ORDER BY COALESCE(SUM(oi.quantity), 0) DESC) as sales_rank
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'returned')
GROUP BY p.id, p.tenant_id, p.marketplace, p.country_code, p.asin, p.sku, p.name, p.image_url
ORDER BY total_units_sold DESC;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_date ON orders(tenant_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_product_sales_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_sales_summary;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();