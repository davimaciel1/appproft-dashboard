-- =====================================================
-- CORREÇÃO: Estrutura de IA sem colunas conflitantes
-- =====================================================

-- Dropar índice problemático se existir
DROP INDEX IF EXISTS idx_comp_track_adv_seller;

-- Tabela de insights gerados pela IA (se não existir)
CREATE TABLE IF NOT EXISTS ai_insights_advanced (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    insight_type VARCHAR(50), -- 'restock', 'pricing', 'listing', 'campaign', 'competitor'
    priority VARCHAR(10), -- 'critical', 'high', 'medium', 'low'
    
    -- Conteúdo do insight
    title VARCHAR(200),
    description TEXT,
    recommendation TEXT,
    
    -- Insights sobre competidores
    competitor_name VARCHAR(255),
    competitor_action VARCHAR(100),
    
    -- Dados de suporte
    supporting_data JSONB,
    confidence_score DECIMAL(3,2), -- 0-1
    potential_impact DECIMAL(10,2), -- valor estimado em R$
    
    -- Machine Learning
    model_name VARCHAR(50),
    model_version VARCHAR(20),
    feature_importance JSONB,
    
    -- Status e tracking
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'applied', 'dismissed', 'expired'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Feedback
    user_feedback VARCHAR(20), -- 'helpful', 'not_helpful', 'incorrect'
    feedback_notes TEXT,
    
    -- Resultado se aplicado
    actual_impact DECIMAL(10,2),
    impact_measured_at TIMESTAMPTZ,
    
    tenant_id VARCHAR(50) DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_adv_asin ON ai_insights_advanced(asin);
CREATE INDEX IF NOT EXISTS idx_ai_insights_adv_type ON ai_insights_advanced(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_adv_status ON ai_insights_advanced(status, priority);
CREATE INDEX IF NOT EXISTS idx_ai_insights_adv_created ON ai_insights_advanced(created_at DESC);

-- Tabela de métricas de vendas agregadas (se não existir)
CREATE TABLE IF NOT EXISTS sales_metrics (
    asin VARCHAR(10) PRIMARY KEY,
    
    -- Métricas de vendas
    units_sold_7d INTEGER DEFAULT 0,
    units_sold_30d INTEGER DEFAULT 0,
    units_sold_90d INTEGER DEFAULT 0,
    revenue_7d DECIMAL(10,2) DEFAULT 0,
    revenue_30d DECIMAL(10,2) DEFAULT 0,
    revenue_90d DECIMAL(10,2) DEFAULT 0,
    
    -- Velocidade e tendência
    daily_velocity_7d DECIMAL(6,2),
    daily_velocity_30d DECIMAL(6,2),
    growth_rate_30d DECIMAL(5,2), -- % de crescimento
    
    -- Rankings
    sales_rank INTEGER,
    sales_rank_subcategory INTEGER,
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- View para Buy Box Status (corrigida)
CREATE OR REPLACE VIEW buy_box_status AS
SELECT 
    p.asin,
    p.name as title,
    p.price as our_price,
    ct.buy_box_price,
    ct.buy_box_seller as current_buy_box_owner,
    ct.our_has_buy_box,
    ct.total_offers,
    ROUND((p.price - ct.buy_box_price)::numeric, 2) as price_difference,
    ROUND(((p.price - ct.buy_box_price) / ct.buy_box_price * 100)::numeric, 2) as price_difference_pct,
    ct.timestamp as last_checked
FROM products p
LEFT JOIN LATERAL (
    SELECT * FROM competitor_tracking_advanced
    WHERE asin = p.asin
    ORDER BY timestamp DESC
    LIMIT 1
) ct ON true;

-- View para Dashboard de competidores
CREATE OR REPLACE VIEW competitor_dashboard AS
WITH latest_tracking AS (
    SELECT DISTINCT ON (asin)
        asin,
        buy_box_seller,
        buy_box_price,
        our_price,
        our_has_buy_box,
        total_offers,
        timestamp
    FROM competitor_tracking_advanced
    ORDER BY asin, timestamp DESC
)
SELECT 
    lt.asin,
    p.name as title,
    lt.buy_box_seller,
    lt.buy_box_price,
    lt.our_price,
    lt.our_has_buy_box,
    lt.total_offers,
    COUNT(DISTINCT ct.buy_box_seller) as unique_competitors_30d
FROM latest_tracking lt
JOIN products p ON lt.asin = p.asin
LEFT JOIN competitor_tracking_advanced ct ON lt.asin = ct.asin 
    AND ct.timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY lt.asin, p.name, lt.buy_box_seller, lt.buy_box_price, 
         lt.our_price, lt.our_has_buy_box, lt.total_offers;

-- Tabela de previsões de demanda (se não existir)
CREATE TABLE IF NOT EXISTS demand_forecasts (
    asin VARCHAR(10),
    forecast_date DATE,
    
    -- Previsões
    units_forecast INTEGER,
    units_lower_bound INTEGER,
    units_upper_bound INTEGER,
    revenue_forecast DECIMAL(10,2),
    revenue_lower_bound DECIMAL(10,2),
    revenue_upper_bound DECIMAL(10,2),
    
    -- Fatores considerados
    seasonality_factor DECIMAL(3,2),
    trend_factor DECIMAL(3,2),
    promotion_factor DECIMAL(3,2),
    competitor_factor DECIMAL(3,2),
    
    -- Recomendações de estoque
    recommended_stock_level INTEGER,
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    safety_stock_days INTEGER,
    
    -- Metadados do modelo
    model_name VARCHAR(50),
    model_version VARCHAR(20),
    confidence_level DECIMAL(3,2),
    mape DECIMAL(5,2), -- Mean Absolute Percentage Error
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asin, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_demand_forecast_date ON demand_forecasts(forecast_date);

-- Tabela de otimização de preços (se não existir)
CREATE TABLE IF NOT EXISTS price_optimization (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    
    -- Preços sugeridos
    current_price DECIMAL(10,2),
    suggested_price DECIMAL(10,2),
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    
    -- Elasticidade e demanda
    price_elasticity DECIMAL(4,2),
    demand_at_current_price INTEGER,
    demand_at_suggested_price INTEGER,
    
    -- Impacto esperado
    expected_revenue_change DECIMAL(10,2),
    expected_profit_change DECIMAL(10,2),
    expected_units_change INTEGER,
    buy_box_probability DECIMAL(3,2), -- 0-1
    
    -- Análise competitiva
    competitor_avg_price DECIMAL(10,2),
    price_position VARCHAR(20), -- 'lowest', 'below_avg', 'average', 'above_avg', 'highest'
    
    -- ML Metadata
    model_name VARCHAR(50),
    confidence_score DECIMAL(3,2),
    optimization_strategy VARCHAR(50), -- 'maximize_profit', 'maximize_revenue', 'gain_buy_box'
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'applied', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    
    tenant_id VARCHAR(50) DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_price_opt_asin ON price_optimization(asin);
CREATE INDEX IF NOT EXISTS idx_price_opt_status ON price_optimization(status);

-- Tabela de tracking de competidores com vendedor
CREATE TABLE IF NOT EXISTS competitor_tracking_detailed (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    tracking_date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Informações do competidor
    competitor_seller_id VARCHAR(50),
    competitor_seller_name VARCHAR(255),
    competitor_price DECIMAL(10,2),
    competitor_shipping DECIMAL(10,2),
    competitor_condition VARCHAR(20),
    competitor_fulfillment VARCHAR(10), -- 'FBA' ou 'FBM'
    competitor_ratings_count INTEGER,
    competitor_rating DECIMAL(2,1),
    
    -- Buy Box
    has_buy_box BOOLEAN DEFAULT false,
    buy_box_price DECIMAL(10,2),
    
    -- Nossa posição
    our_price DECIMAL(10,2),
    price_difference DECIMAL(10,2),
    price_difference_pct DECIMAL(5,2),
    
    -- Metadata
    tenant_id VARCHAR(50) DEFAULT 'default',
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_comp_track_det_asin ON competitor_tracking_detailed(asin);
CREATE INDEX IF NOT EXISTS idx_comp_track_det_seller ON competitor_tracking_detailed(competitor_seller_id);
CREATE INDEX IF NOT EXISTS idx_comp_track_det_date ON competitor_tracking_detailed(tracking_date DESC);

-- Tabela de logs de sincronização
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50), -- 'orders', 'inventory', 'pricing', 'competitors'
    marketplace VARCHAR(20), -- 'amazon', 'mercadolivre'
    status VARCHAR(20), -- 'started', 'completed', 'failed'
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    tenant_id VARCHAR(50) DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status, marketplace);
CREATE INDEX IF NOT EXISTS idx_sync_logs_date ON sync_logs(started_at DESC);

-- Inserir log de migração
INSERT INTO sync_logs (sync_type, marketplace, status, completed_at)
VALUES ('migration', 'system', 'completed', NOW());

-- Mensagem de conclusão
DO $$
BEGIN
    RAISE NOTICE 'Migração de correção concluída com sucesso!';
    RAISE NOTICE 'Tabelas criadas/corrigidas:';
    RAISE NOTICE '- ai_insights_advanced';
    RAISE NOTICE '- sales_metrics';
    RAISE NOTICE '- demand_forecasts';
    RAISE NOTICE '- price_optimization';
    RAISE NOTICE '- competitor_tracking_detailed';
    RAISE NOTICE '- sync_logs';
    RAISE NOTICE 'Views criadas/corrigidas:';
    RAISE NOTICE '- buy_box_status';
    RAISE NOTICE '- competitor_dashboard';
END $$;