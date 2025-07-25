-- Migration: Create Buy Box Tables
-- Description: Cria tabelas para rastreamento de competidores e Buy Box
-- Date: 2025-01-24

-- Tabela de cache de vendedores
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

CREATE INDEX IF NOT EXISTS idx_seller_name ON sellers_cache(seller_name);
CREATE INDEX IF NOT EXISTS idx_last_updated ON sellers_cache(last_updated);

-- Tabela de rastreamento de competidores
CREATE TABLE IF NOT EXISTS competitor_tracking (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    competitor_seller_id VARCHAR(50),
    seller_name VARCHAR(255),
    timestamp TIMESTAMPTZ,
    
    -- Dados do competidor
    price DECIMAL(10,2),
    shipping_price DECIMAL(10,2),
    is_buy_box_winner BOOLEAN,
    is_fba BOOLEAN,
    feedback_count INTEGER,
    feedback_rating DECIMAL(3,1),
    
    -- Análise competitiva
    price_difference DECIMAL(10,2),
    price_percentile INTEGER,
    buy_box_duration_minutes INTEGER,
    
    -- Campos adicionais
    seller_response_time_hours INTEGER,
    seller_city VARCHAR(100),
    seller_state VARCHAR(2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_asin_time ON competitor_tracking(asin, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_buy_box_winner ON competitor_tracking(asin, is_buy_box_winner, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_seller_name_tracking ON competitor_tracking(seller_name);
CREATE INDEX IF NOT EXISTS idx_timestamp ON competitor_tracking(timestamp DESC);

-- View para status da Buy Box em tempo real
CREATE OR REPLACE VIEW buy_box_status AS
SELECT 
    ct.asin,
    p.name as product_name,
    ct.seller_name as buy_box_owner,
    ct.price as buy_box_price,
    ct.is_fba,
    ct.feedback_rating,
    ct.timestamp as last_checked,
    p.price as our_price,
    ROUND(((p.price - ct.price) / p.price * 100), 2) as price_difference_pct,
    CASE 
        WHEN ct.competitor_seller_id = p.seller_id THEN 'Você tem a Buy Box! 🎉'
        ELSE CONCAT('Buy Box com: ', ct.seller_name)
    END as status_message
FROM competitor_tracking ct
JOIN products p ON ct.asin = p.asin
WHERE ct.is_buy_box_winner = true
AND ct.timestamp = (
    SELECT MAX(timestamp) 
    FROM competitor_tracking ct2 
    WHERE ct2.asin = ct.asin
)
ORDER BY ct.timestamp DESC;

-- Tabela de histórico de Buy Box
CREATE TABLE IF NOT EXISTS buy_box_history (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    seller_id VARCHAR(50),
    seller_name VARCHAR(255),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    avg_price DECIMAL(10,2),
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buybox_asin_time ON buy_box_history(asin, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_buybox_seller ON buy_box_history(seller_id, asin);

-- Tabela de insights gerados pela IA
CREATE TABLE IF NOT EXISTS ai_insights (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    insight_type VARCHAR(50), -- 'restock', 'pricing', 'listing', 'campaign', 'buy_box'
    priority VARCHAR(10), -- 'high', 'medium', 'low'
    
    -- Conteúdo do insight
    title VARCHAR(200),
    description TEXT,
    recommendation TEXT,
    
    -- Insights sobre competidores
    competitor_name VARCHAR(255),
    competitor_action VARCHAR(100), -- 'lowered_price', 'out_of_stock', 'new_competitor'
    
    -- Dados de suporte
    supporting_data JSONB,
    confidence_score DECIMAL(3,2), -- 0-1
    potential_impact DECIMAL(10,2), -- valor estimado
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'applied', 'dismissed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    
    tenant_id VARCHAR(50) DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_insights_asin_type ON ai_insights(asin, insight_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_status ON ai_insights(status, priority);
CREATE INDEX IF NOT EXISTS idx_insights_tenant ON ai_insights(tenant_id);

-- Função para obter mudanças de Buy Box
CREATE OR REPLACE FUNCTION get_buy_box_changes(hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
    asin VARCHAR,
    product_name VARCHAR,
    previous_owner VARCHAR,
    new_owner VARCHAR,
    previous_price DECIMAL,
    new_price DECIMAL,
    price_change_pct DECIMAL,
    change_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH changes AS (
        SELECT 
            ct.asin,
            ct.seller_name,
            ct.price,
            ct.timestamp,
            LAG(ct.seller_name) OVER (PARTITION BY ct.asin ORDER BY ct.timestamp) as prev_owner,
            LAG(ct.price) OVER (PARTITION BY ct.asin ORDER BY ct.timestamp) as prev_price
        FROM competitor_tracking ct
        WHERE ct.is_buy_box_winner = true
        AND ct.timestamp >= NOW() - INTERVAL '1 hour' * hours_back
    )
    SELECT 
        c.asin,
        p.name as product_name,
        c.prev_owner as previous_owner,
        c.seller_name as new_owner,
        c.prev_price as previous_price,
        c.price as new_price,
        CASE 
            WHEN c.prev_price > 0 
            THEN ROUND(((c.price - c.prev_price) / c.prev_price * 100), 2)
            ELSE 0
        END as price_change_pct,
        c.timestamp as change_time
    FROM changes c
    LEFT JOIN products p ON c.asin = p.asin
    WHERE c.seller_name != c.prev_owner
    AND c.prev_owner IS NOT NULL
    ORDER BY c.timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- Adicionar colunas faltantes na tabela products (se não existirem)
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_box_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_price DECIMAL(10,2);

-- Função para registrar mudança de Buy Box
CREATE OR REPLACE FUNCTION track_buy_box_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Se é uma mudança de Buy Box
    IF NEW.is_buy_box_winner = true THEN
        -- Verificar se houve mudança de vendedor
        DECLARE
            previous_winner RECORD;
        BEGIN
            SELECT seller_id, seller_name, timestamp
            INTO previous_winner
            FROM competitor_tracking
            WHERE asin = NEW.asin 
            AND is_buy_box_winner = true
            AND timestamp < NEW.timestamp
            ORDER BY timestamp DESC
            LIMIT 1;
            
            -- Se mudou de vendedor, registrar no histórico
            IF previous_winner.seller_id IS NOT NULL AND previous_winner.seller_id != NEW.competitor_seller_id THEN
                INSERT INTO buy_box_history (
                    asin, 
                    seller_id, 
                    seller_name, 
                    started_at, 
                    ended_at, 
                    duration_minutes
                )
                VALUES (
                    NEW.asin,
                    previous_winner.seller_id,
                    previous_winner.seller_name,
                    previous_winner.timestamp,
                    NEW.timestamp,
                    EXTRACT(EPOCH FROM (NEW.timestamp - previous_winner.timestamp)) / 60
                );
            END IF;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para rastrear mudanças
DROP TRIGGER IF EXISTS track_buy_box_changes ON competitor_tracking;
CREATE TRIGGER track_buy_box_changes
    AFTER INSERT ON competitor_tracking
    FOR EACH ROW
    EXECUTE FUNCTION track_buy_box_change();

-- Inserir dados de exemplo para testes (APENAS PARA DESENVOLVIMENTO)
-- Em produção, estes dados virão das APIs
INSERT INTO sellers_cache (seller_id, seller_name, feedback_rating, feedback_count, is_fba_seller)
VALUES 
    ('A1X2Y3Z4W5V6U7', 'Loja Premium LTDA', 98.5, 15234, true),
    ('B8A7B6C5D4E3F2', 'MegaStore Brasil', 97.2, 8921, false),
    ('C9D8E7F6G5H4I3', 'FastShop Express', 99.1, 22103, true),
    ('OUR_SELLER_ID', 'Sua Loja', 98.0, 5000, true)
ON CONFLICT (seller_id) DO NOTHING;

-- Comentário sobre os dados
COMMENT ON TABLE competitor_tracking IS 'Rastreamento de competidores e Buy Box - dados devem vir das APIs Amazon';
COMMENT ON TABLE sellers_cache IS 'Cache de informações de vendedores para evitar chamadas repetidas às APIs';
COMMENT ON TABLE buy_box_history IS 'Histórico de posse da Buy Box para análise de padrões';
COMMENT ON TABLE ai_insights IS 'Insights gerados por IA para otimização de vendas';