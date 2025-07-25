-- ========================================
-- MIGRATION: Data Kiosk Tables
-- Tabelas adicionais para suportar Data Kiosk
-- ========================================

-- 1. Adicionar campos nos produtos para Data Kiosk
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_units_sold INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_revenue DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS buy_box_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP DEFAULT NOW();

-- 2. Criar tabela de métricas diárias agregadas
CREATE TABLE IF NOT EXISTS daily_metrics (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
    date DATE NOT NULL,
    marketplace VARCHAR(50) NOT NULL DEFAULT 'amazon',
    ordered_product_sales DECIMAL(10,2) DEFAULT 0,
    units_ordered INTEGER DEFAULT 0,
    total_order_items INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    buy_box_percentage DECIMAL(5,2) DEFAULT 0,
    unit_session_percentage DECIMAL(5,2) DEFAULT 0,
    average_selling_price DECIMAL(10,2) DEFAULT 0,
    units_refunded INTEGER DEFAULT 0,
    refund_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, date, marketplace)
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant ON daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_marketplace ON daily_metrics(marketplace);

-- 4. Atualizar produtos existentes com campos padrão
UPDATE products 
SET last_sync_at = NOW() 
WHERE last_sync_at IS NULL;

-- 5. Criar tabela de histórico de métricas por produto
CREATE TABLE IF NOT EXISTS product_metrics_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
    date DATE NOT NULL,
    asin VARCHAR(20),
    sku VARCHAR(100),
    units_ordered INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    buy_box_percentage DECIMAL(5,2) DEFAULT 0,
    unit_session_percentage DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(product_id, date)
);

-- 6. Índices para product_metrics_history
CREATE INDEX IF NOT EXISTS idx_product_metrics_history_date ON product_metrics_history(date);
CREATE INDEX IF NOT EXISTS idx_product_metrics_history_asin ON product_metrics_history(asin);
CREATE INDEX IF NOT EXISTS idx_product_metrics_history_tenant ON product_metrics_history(tenant_id);

-- 7. View consolidada para dashboard
CREATE OR REPLACE VIEW data_kiosk_dashboard AS
SELECT 
    dm.date,
    dm.tenant_id,
    dm.marketplace,
    dm.ordered_product_sales as todays_sales,
    dm.total_order_items as orders_count,
    dm.units_ordered as units_sold,
    CASE 
        WHEN dm.total_order_items > 0 
        THEN ROUND(dm.units_ordered::numeric / dm.total_order_items, 1)
        ELSE 0 
    END as avg_units_per_order,
    dm.buy_box_percentage,
    dm.unit_session_percentage as conversion_rate,
    dm.page_views,
    dm.sessions,
    CASE 
        WHEN dm.sessions > 0 
        THEN ROUND((dm.page_views::numeric / dm.sessions) * 100, 2)
        ELSE 0 
    END as page_views_per_session,
    ROUND(dm.ordered_product_sales * 0.3, 2) as estimated_profit, -- 30% margin
    '30.0' as profit_margin_percent,
    '0.0' as acos_percent -- Placeholder até implementar advertising
FROM daily_metrics dm
ORDER BY dm.date DESC;

-- 8. Comentários para documentação
COMMENT ON TABLE daily_metrics IS 'Métricas diárias agregadas do Amazon Data Kiosk';
COMMENT ON TABLE product_metrics_history IS 'Histórico de métricas por produto do Data Kiosk';
COMMENT ON VIEW data_kiosk_dashboard IS 'View consolidada para dashboard com dados do Data Kiosk';

-- 9. Inserir configuração de sincronização
INSERT INTO sync_queue (task_type, endpoint, payload, priority, status)
VALUES 
('data_kiosk_sync', '/dataKiosk/2023-11-15/queries', '{"tenantId": "default", "daysBack": 7}', 4, 'pending')
ON CONFLICT DO NOTHING;

-- Verificação final
SELECT 
    'daily_metrics' as table_name,
    COUNT(*) as record_count,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM daily_metrics
UNION ALL
SELECT 
    'product_metrics_history' as table_name,
    COUNT(*) as record_count,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM product_metrics_history
UNION ALL
SELECT 
    'traffic_metrics' as table_name,
    COUNT(*) as record_count,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM traffic_metrics;