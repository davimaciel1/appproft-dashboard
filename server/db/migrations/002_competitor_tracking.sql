-- Migration 002: Competitor Tracking and Buy Box Analysis
-- Adiciona tabelas para rastreamento de competidores e análise de Buy Box

-- Table: sellers_cache
-- Cache de informações de vendedores para evitar chamadas repetidas à API
CREATE TABLE IF NOT EXISTS sellers_cache (
    seller_id VARCHAR(50) PRIMARY KEY,
    seller_name VARCHAR(255) NOT NULL,
    store_url VARCHAR(500),
    feedback_rating DECIMAL(3,1),
    feedback_count INTEGER,
    is_fba_seller BOOLEAN DEFAULT false,
    seller_since DATE,
    business_type VARCHAR(50), -- 'individual', 'company'
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para sellers_cache
CREATE INDEX IF NOT EXISTS idx_seller_name ON sellers_cache (seller_name);
CREATE INDEX IF NOT EXISTS idx_seller_last_updated ON sellers_cache (last_updated);

-- Table: competitor_tracking
-- Rastreamento de competidores com identificação de vendedores
CREATE TABLE IF NOT EXISTS competitor_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asin VARCHAR(20) NOT NULL,
    competitor_seller_id VARCHAR(50) NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Dados do competidor
    price DECIMAL(10,2),
    shipping_price DECIMAL(10,2) DEFAULT 0,
    is_buy_box_winner BOOLEAN DEFAULT false,
    is_fba BOOLEAN DEFAULT false,
    feedback_count INTEGER,
    feedback_rating DECIMAL(3,1),
    
    -- Análise competitiva
    price_difference DECIMAL(10,2) DEFAULT 0, -- vs nosso preço
    price_percentile INTEGER DEFAULT 0, -- posição no mercado (1-100)
    buy_box_duration_minutes INTEGER DEFAULT 0,
    
    -- Campos adicionais para análise
    seller_response_time_hours INTEGER,
    seller_city VARCHAR(100),
    seller_state VARCHAR(2)
);

-- Índices para competitor_tracking
CREATE INDEX IF NOT EXISTS idx_competitor_asin_time ON competitor_tracking (asin, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_buy_box_winner ON competitor_tracking (asin, is_buy_box_winner, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_seller_name ON competitor_tracking (seller_name);
CREATE INDEX IF NOT EXISTS idx_competitor_timestamp ON competitor_tracking (timestamp DESC);

-- Table: buy_box_history
-- Histórico de posse de Buy Box para análise de padrões
CREATE TABLE IF NOT EXISTS buy_box_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asin VARCHAR(20) NOT NULL,
    seller_id VARCHAR(50) NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    avg_price DECIMAL(10,2),
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2)
);

-- Índices para buy_box_history
CREATE INDEX IF NOT EXISTS idx_buybox_asin_time ON buy_box_history (asin, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_buybox_seller ON buy_box_history (seller_id, asin);
CREATE INDEX IF NOT EXISTS idx_buybox_duration ON buy_box_history (duration_minutes DESC);

-- Table: ai_insights
-- Insights gerados pela IA sobre competidores e Buy Box
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asin VARCHAR(20),
    insight_type VARCHAR(50) NOT NULL, -- 'restock', 'pricing', 'listing', 'campaign', 'buy_box'
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    
    -- Conteúdo do insight
    title VARCHAR(200) NOT NULL,
    description TEXT,
    recommendation TEXT,
    
    -- Insights sobre competidores
    competitor_name VARCHAR(255),
    competitor_action VARCHAR(100), -- 'lowered_price', 'out_of_stock', 'new_competitor'
    
    -- Dados de suporte
    supporting_data JSONB,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    potential_impact DECIMAL(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ
);

-- Índices para ai_insights
CREATE INDEX IF NOT EXISTS idx_insights_asin_type ON ai_insights (asin, insight_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON ai_insights (priority, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_competitor ON ai_insights (competitor_name, created_at DESC);

-- View: buy_box_status
-- Status atual da Buy Box em tempo real
CREATE OR REPLACE VIEW buy_box_status AS
WITH latest_tracking AS (
    SELECT DISTINCT ON (ct.asin)
        ct.asin,
        ct.seller_name as buy_box_owner,
        ct.price as buy_box_price,
        ct.is_fba,
        ct.feedback_rating,
        ct.timestamp as last_checked,
        ct.competitor_seller_id
    FROM competitor_tracking ct
    WHERE ct.is_buy_box_winner = true
    ORDER BY ct.asin, ct.timestamp DESC
)
SELECT 
    lt.asin,
    p.name as product_name,
    lt.buy_box_owner,
    lt.buy_box_price,
    lt.is_fba,
    lt.feedback_rating,
    lt.last_checked,
    -- Assumir que nosso seller_id seria conhecido
    CASE 
        WHEN lt.competitor_seller_id = 'OUR_SELLER_ID' 
        THEN 'Você tem a Buy Box! 🎉'
        ELSE CONCAT('Buy Box com: ', lt.buy_box_owner)
    END as status_message,
    -- Calcular diferença de preço se tivermos o produto
    CASE 
        WHEN p.id IS NOT NULL 
        THEN ROUND(((p.current_price - lt.buy_box_price) / p.current_price * 100), 2)
        ELSE NULL 
    END as price_difference_pct
FROM latest_tracking lt
LEFT JOIN products p ON lt.asin = p.marketplace_id AND p.marketplace = 'amazon'
ORDER BY lt.last_checked DESC;

-- View: competitor_summary
-- Resumo dos competidores mais ativos
CREATE OR REPLACE VIEW competitor_summary AS
SELECT 
    seller_name,
    COUNT(DISTINCT asin) as products_competing,
    COUNT(*) FILTER (WHERE is_buy_box_winner = true) as buybox_wins,
    ROUND(AVG(price), 2) as avg_price,
    ROUND(AVG(feedback_rating), 1) as avg_rating,
    MAX(timestamp) as last_seen,
    COUNT(*) FILTER (WHERE is_fba = true) as fba_offers,
    COUNT(*) as total_offers
FROM competitor_tracking
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY seller_name
HAVING COUNT(DISTINCT asin) >= 2
ORDER BY buybox_wins DESC, products_competing DESC;

-- Function: get_buy_box_changes
-- Função para obter mudanças recentes de Buy Box
CREATE OR REPLACE FUNCTION get_buy_box_changes(hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
    asin VARCHAR(20),
    product_name TEXT,
    previous_owner VARCHAR(255),
    new_owner VARCHAR(255),
    previous_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    price_change_pct DECIMAL(5,2),
    change_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_changes AS (
        SELECT 
            ct.asin,
            p.name as product_name,
            ct.seller_name,
            ct.price,
            ct.timestamp,
            LAG(ct.seller_name) OVER (PARTITION BY ct.asin ORDER BY ct.timestamp) as prev_seller,
            LAG(ct.price) OVER (PARTITION BY ct.asin ORDER BY ct.timestamp) as prev_price
        FROM competitor_tracking ct
        LEFT JOIN products p ON ct.asin = p.marketplace_id AND p.marketplace = 'amazon'
        WHERE ct.is_buy_box_winner = true
        AND ct.timestamp >= NOW() - INTERVAL '1 hour' * hours_back
        ORDER BY ct.asin, ct.timestamp DESC
    )
    SELECT 
        rc.asin,
        rc.product_name,
        rc.prev_seller,
        rc.seller_name,
        rc.prev_price,
        rc.price,
        CASE 
            WHEN rc.prev_price > 0 
            THEN ROUND(((rc.prev_price - rc.price) / rc.prev_price * 100), 2)
            ELSE 0 
        END,
        rc.timestamp
    FROM ranked_changes rc
    WHERE rc.prev_seller IS NOT NULL 
    AND rc.prev_seller != rc.seller_name
    ORDER BY rc.timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: calculate_buy_box_percentage
-- Calcula porcentagem de tempo com Buy Box para um produto
CREATE OR REPLACE FUNCTION calculate_buy_box_percentage(
    product_asin VARCHAR(20), 
    seller_name_param VARCHAR(255),
    days_back INTEGER DEFAULT 30
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_checks INTEGER;
    seller_wins INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_checks
    FROM competitor_tracking
    WHERE asin = product_asin
    AND is_buy_box_winner = true
    AND timestamp >= NOW() - INTERVAL '1 day' * days_back;
    
    SELECT COUNT(*) INTO seller_wins
    FROM competitor_tracking
    WHERE asin = product_asin
    AND seller_name = seller_name_param
    AND is_buy_box_winner = true
    AND timestamp >= NOW() - INTERVAL '1 day' * days_back;
    
    IF total_checks = 0 THEN
        RETURN 0;
    ELSE
        RETURN ROUND((seller_wins::DECIMAL / total_checks * 100), 2);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: update_price_differences
-- Atualiza diferenças de preço automaticamente
CREATE OR REPLACE FUNCTION update_price_differences()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar price_difference baseado no preço atual do produto
    UPDATE competitor_tracking ct
    SET price_difference = COALESCE(p.current_price, 0) - NEW.price
    FROM products p
    WHERE ct.id = NEW.id
    AND ct.asin = p.marketplace_id
    AND p.marketplace = 'amazon';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_price_differences
    AFTER INSERT ON competitor_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_price_differences();

-- Comentários nas tabelas
COMMENT ON TABLE sellers_cache IS 'Cache de informações de vendedores para evitar chamadas repetidas à API';
COMMENT ON TABLE competitor_tracking IS 'Rastreamento em tempo real de competidores com identificação de vendedores';
COMMENT ON TABLE buy_box_history IS 'Histórico de posse de Buy Box para análise de padrões competitivos';
COMMENT ON TABLE ai_insights IS 'Insights gerados automaticamente pela IA sobre competidores e oportunidades';
COMMENT ON VIEW buy_box_status IS 'Status atual da Buy Box em tempo real para todos os produtos';
COMMENT ON VIEW competitor_summary IS 'Resumo dos competidores mais ativos nos últimos 30 dias';