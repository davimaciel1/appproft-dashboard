-- Migration: Create Complete AI Structure
-- Description: Estrutura completa para sistema de IA com análise competitiva avançada
-- Date: 2025-01-24
-- Extensions: TimescaleDB, pgvector

-- Ativar extensões necessárias (requer superuser)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- TABELAS PRINCIPAIS COM FEATURES PARA ML
-- =====================================================

-- Tabela principal de produtos com features para ML
CREATE TABLE IF NOT EXISTS products_ml (
    asin VARCHAR(10) PRIMARY KEY,
    sku VARCHAR(100),
    title TEXT,
    brand VARCHAR(100),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    
    -- Features numéricas para ML
    price DECIMAL(10,2),
    weight_kg DECIMAL(6,3),
    volume_cm3 INTEGER,
    package_quantity INTEGER DEFAULT 1,
    
    -- Features categóricas
    is_fba BOOLEAN DEFAULT false,
    is_prime BOOLEAN DEFAULT false,
    is_hazmat BOOLEAN DEFAULT false,
    is_oversized BOOLEAN DEFAULT false,
    
    -- Embeddings de texto (para NLP) - comentado pois requer pgvector
    -- title_embedding VECTOR(768),
    -- description_embedding VECTOR(768),
    
    -- Rankings e métricas
    sales_rank INTEGER,
    sales_rank_category VARCHAR(100),
    review_count INTEGER DEFAULT 0,
    review_rating DECIMAL(2,1),
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_ml_tenant ON products_ml(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_ml_category ON products_ml(category);
CREATE INDEX IF NOT EXISTS idx_products_ml_brand ON products_ml(brand);

-- =====================================================
-- DADOS DE VENDAS E TRÁFEGO
-- =====================================================

-- Tabela de métricas de vendas (time-series)
CREATE TABLE IF NOT EXISTS sales_metrics (
    asin VARCHAR(10),
    date DATE,
    hour INTEGER DEFAULT 0, -- 0-23
    
    -- Métricas de vendas
    units_ordered INTEGER DEFAULT 0,
    units_ordered_b2b INTEGER DEFAULT 0,
    ordered_product_sales DECIMAL(10,2) DEFAULT 0,
    ordered_product_sales_b2b DECIMAL(10,2) DEFAULT 0,
    
    -- Métricas de tráfego
    sessions INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    mobile_sessions INTEGER DEFAULT 0,
    mobile_page_views INTEGER DEFAULT 0,
    browser_sessions INTEGER DEFAULT 0,
    browser_page_views INTEGER DEFAULT 0,
    
    -- Taxas calculadas
    unit_session_percentage DECIMAL(5,2), -- Conversion rate
    buy_box_percentage DECIMAL(5,2),
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asin, date, hour)
);

-- Converter para hypertable se TimescaleDB estiver ativo
-- SELECT create_hypertable('sales_metrics', 'date', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_sales_metrics_asin_date ON sales_metrics(asin, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_metrics_tenant ON sales_metrics(tenant_id);

-- =====================================================
-- DADOS DE INVENTÁRIO
-- =====================================================

-- Tabela de snapshots de inventário
CREATE TABLE IF NOT EXISTS inventory_snapshots (
    asin VARCHAR(10),
    sku VARCHAR(100),
    snapshot_time TIMESTAMPTZ,
    
    -- Quantidades
    fulfillable_quantity INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0,
    inbound_working_quantity INTEGER DEFAULT 0,
    inbound_shipped_quantity INTEGER DEFAULT 0,
    inbound_receiving_quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    researching_quantity INTEGER DEFAULT 0,
    unfulfillable_quantity INTEGER DEFAULT 0,
    
    -- Análise
    days_of_supply INTEGER,
    alert_status VARCHAR(20), -- 'healthy', 'low', 'critical', 'overstock'
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    
    PRIMARY KEY (asin, snapshot_time)
);

-- Converter para hypertable se TimescaleDB estiver ativo
-- SELECT create_hypertable('inventory_snapshots', 'snapshot_time', if_not_exists => TRUE);

-- =====================================================
-- DADOS DE COMPETIDORES EXPANDIDOS
-- =====================================================

-- Tabela expandida de tracking de competidores
CREATE TABLE IF NOT EXISTS competitor_tracking_advanced (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    competitor_seller_id VARCHAR(50),
    seller_name VARCHAR(255),
    timestamp TIMESTAMPTZ,
    
    -- Dados do competidor
    price DECIMAL(10,2),
    shipping_price DECIMAL(10,2),
    total_price DECIMAL(10,2) GENERATED ALWAYS AS (price + COALESCE(shipping_price, 0)) STORED,
    is_buy_box_winner BOOLEAN DEFAULT false,
    is_fba BOOLEAN DEFAULT false,
    is_prime BOOLEAN DEFAULT false,
    
    -- Métricas do vendedor
    feedback_count INTEGER,
    feedback_rating DECIMAL(3,1),
    ships_from_country VARCHAR(2),
    ships_from_state VARCHAR(50),
    
    -- Análise competitiva
    price_difference DECIMAL(10,2), -- vs nosso preço
    price_percentile INTEGER, -- posição no mercado (1-100)
    buy_box_duration_minutes INTEGER,
    
    -- Dados de entrega
    minimum_hours_to_ship INTEGER,
    maximum_hours_to_ship INTEGER,
    availability_type VARCHAR(20), -- 'NOW', 'SOON', 'FUTURE'
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_track_adv_asin_time ON competitor_tracking_advanced(asin, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_comp_track_adv_seller ON competitor_tracking_advanced(competitor_seller_id);
CREATE INDEX IF NOT EXISTS idx_comp_track_adv_buybox ON competitor_tracking_advanced(asin, is_buy_box_winner, timestamp DESC);

-- =====================================================
-- DADOS DE ADVERTISING
-- =====================================================

-- Tabela de métricas de campanhas
CREATE TABLE IF NOT EXISTS campaign_metrics (
    campaign_id VARCHAR(50),
    campaign_name VARCHAR(200),
    date DATE,
    
    -- Configuração
    campaign_type VARCHAR(20), -- 'SP', 'SB', 'SD'
    targeting_type VARCHAR(20), -- 'manual', 'auto'
    daily_budget DECIMAL(10,2),
    campaign_status VARCHAR(20),
    
    -- Métricas de performance
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    attributed_conversions_1d INTEGER DEFAULT 0,
    attributed_conversions_7d INTEGER DEFAULT 0,
    attributed_conversions_14d INTEGER DEFAULT 0,
    attributed_conversions_30d INTEGER DEFAULT 0,
    attributed_sales_1d DECIMAL(10,2) DEFAULT 0,
    attributed_sales_7d DECIMAL(10,2) DEFAULT 0,
    attributed_sales_14d DECIMAL(10,2) DEFAULT 0,
    attributed_sales_30d DECIMAL(10,2) DEFAULT 0,
    
    -- Métricas calculadas
    ctr DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN impressions > 0 THEN (clicks::DECIMAL / impressions * 100) ELSE 0 END
    ) STORED,
    acos DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN attributed_sales_7d > 0 THEN (cost / attributed_sales_7d * 100) ELSE 999 END
    ) STORED,
    roas DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN cost > 0 THEN (attributed_sales_7d / cost) ELSE 0 END
    ) STORED,
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date ON campaign_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_acos ON campaign_metrics(acos);

-- Tabela de performance de keywords
CREATE TABLE IF NOT EXISTS keywords_performance (
    keyword_id VARCHAR(50),
    keyword_text VARCHAR(200),
    campaign_id VARCHAR(50),
    ad_group_id VARCHAR(50),
    asin VARCHAR(10),
    date DATE,
    
    -- Configuração
    match_type VARCHAR(20), -- 'exact', 'phrase', 'broad'
    bid DECIMAL(10,2),
    state VARCHAR(20), -- 'enabled', 'paused', 'archived'
    
    -- Métricas de performance
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    attributed_conversions_7d INTEGER DEFAULT 0,
    attributed_sales_7d DECIMAL(10,2) DEFAULT 0,
    
    -- Métricas calculadas
    ctr DECIMAL(5,2),
    cvr DECIMAL(5,2),
    acos DECIMAL(5,2),
    cpc DECIMAL(10,2),
    
    -- Features para ML
    search_volume_index INTEGER, -- 1-100
    competition_index INTEGER, -- 1-100
    relevance_score DECIMAL(3,2), -- 0-1
    quality_score INTEGER, -- 1-10
    
    -- Sugestões da IA
    suggested_bid DECIMAL(10,2),
    suggested_action VARCHAR(50), -- 'increase_bid', 'decrease_bid', 'pause', 'negative'
    action_confidence DECIMAL(3,2),
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (keyword_id, date)
);

CREATE INDEX IF NOT EXISTS idx_keywords_perf_campaign ON keywords_performance(campaign_id);
CREATE INDEX IF NOT EXISTS idx_keywords_perf_asin ON keywords_performance(asin);
CREATE INDEX IF NOT EXISTS idx_keywords_perf_acos ON keywords_performance(acos);

-- Tabela de termos de busca
CREATE TABLE IF NOT EXISTS search_terms (
    search_term VARCHAR(500),
    campaign_id VARCHAR(50),
    ad_group_id VARCHAR(50),
    keyword_id VARCHAR(50),
    date DATE,
    
    -- Métricas
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    attributed_conversions_7d INTEGER DEFAULT 0,
    attributed_sales_7d DECIMAL(10,2) DEFAULT 0,
    
    -- Análise
    customer_search_frequency_rank INTEGER,
    click_share DECIMAL(5,2),
    conversion_share DECIMAL(5,2),
    
    -- Status
    is_negative_target BOOLEAN DEFAULT false,
    should_add_as_keyword BOOLEAN DEFAULT false,
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (search_term, campaign_id, date)
);

-- =====================================================
-- TABELAS DE IA E INSIGHTS
-- =====================================================

-- Tabela expandida de insights gerados pela IA
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

-- Tabela de previsões de demanda
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

-- Tabela de otimização de preços
CREATE TABLE IF NOT EXISTS price_optimization (
    asin VARCHAR(10),
    optimization_date TIMESTAMPTZ,
    
    -- Preço atual
    current_price DECIMAL(10,2),
    current_buy_box_percentage DECIMAL(5,2),
    current_units_per_day DECIMAL(10,2),
    current_profit_margin DECIMAL(5,2),
    
    -- Análise de elasticidade
    price_elasticity DECIMAL(5,2),
    cross_elasticity JSONB, -- elasticidade com produtos relacionados
    
    -- Preços sugeridos
    suggested_price DECIMAL(10,2),
    suggested_price_min DECIMAL(10,2),
    suggested_price_max DECIMAL(10,2),
    
    -- Impacto esperado
    expected_buy_box_percentage DECIMAL(5,2),
    expected_units_per_day DECIMAL(10,2),
    expected_revenue_change DECIMAL(10,2),
    expected_profit_change DECIMAL(10,2),
    
    -- Considerações
    competitor_min_price DECIMAL(10,2),
    competitor_avg_price DECIMAL(10,2),
    map_price DECIMAL(10,2), -- Minimum Advertised Price
    
    -- Status
    status VARCHAR(20) DEFAULT 'suggested', -- 'suggested', 'approved', 'applied', 'rejected'
    applied_at TIMESTAMPTZ,
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asin, optimization_date)
);

-- =====================================================
-- TABELAS DE CONTROLE E MONITORAMENTO
-- =====================================================

-- Tabela de jobs de sincronização
CREATE TABLE IF NOT EXISTS sync_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50), -- 'orders', 'inventory', 'pricing', 'advertising'
    status VARCHAR(20), -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Estatísticas
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    
    -- Erros
    error_message TEXT,
    error_details JSONB,
    
    -- Rate limiting
    api_calls_made INTEGER DEFAULT 0,
    api_calls_remaining INTEGER,
    rate_limit_reset_at TIMESTAMPTZ,
    
    -- Metadados
    tenant_id VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status, job_type);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON sync_jobs(created_at DESC);

-- Tabela de rate limiting
CREATE TABLE IF NOT EXISTS api_rate_limits (
    api_name VARCHAR(50), -- 'sp-api', 'advertising-api'
    endpoint VARCHAR(200),
    tenant_id VARCHAR(50),
    
    -- Limites
    calls_per_second DECIMAL(5,2),
    burst_size INTEGER,
    
    -- Uso atual
    tokens_available DECIMAL(10,2),
    last_refill_at TIMESTAMPTZ,
    
    -- Estatísticas
    calls_today INTEGER DEFAULT 0,
    calls_this_hour INTEGER DEFAULT 0,
    last_call_at TIMESTAMPTZ,
    
    PRIMARY KEY (api_name, endpoint, tenant_id)
);

-- =====================================================
-- VIEWS ÚTEIS PARA ANÁLISE
-- =====================================================

-- View de produtos com análise completa
CREATE OR REPLACE VIEW product_analysis AS
SELECT 
    p.asin,
    p.title,
    p.brand,
    p.category,
    pm.price as current_price,
    
    -- Métricas de vendas (últimos 30 dias)
    COALESCE(s.units_30d, 0) as units_sold_30d,
    COALESCE(s.revenue_30d, 0) as revenue_30d,
    COALESCE(s.sessions_30d, 0) as sessions_30d,
    COALESCE(s.conversion_rate, 0) as conversion_rate,
    
    -- Métricas de estoque
    COALESCE(i.fulfillable_quantity, 0) as current_stock,
    COALESCE(i.days_of_supply, 0) as days_of_supply,
    
    -- Análise competitiva
    COALESCE(c.competitor_count, 0) as active_competitors,
    COALESCE(c.min_competitor_price, 0) as min_competitor_price,
    COALESCE(c.buy_box_percentage, 0) as buy_box_percentage_24h,
    
    -- Advertising
    COALESCE(a.total_spend_30d, 0) as ad_spend_30d,
    COALESCE(a.acos_30d, 999) as acos_30d,
    COALESCE(a.tacos_30d, 999) as tacos_30d
    
FROM products_ml p

-- Vendas agregadas
LEFT JOIN (
    SELECT 
        asin,
        SUM(units_ordered) as units_30d,
        SUM(ordered_product_sales) as revenue_30d,
        SUM(sessions) as sessions_30d,
        AVG(unit_session_percentage) as conversion_rate
    FROM sales_metrics
    WHERE date >= CURRENT_DATE - 30
    GROUP BY asin
) s ON p.asin = s.asin

-- Último snapshot de inventário
LEFT JOIN LATERAL (
    SELECT 
        fulfillable_quantity,
        days_of_supply
    FROM inventory_snapshots
    WHERE asin = p.asin
    ORDER BY snapshot_time DESC
    LIMIT 1
) i ON true

-- Análise de competidores (24h)
LEFT JOIN (
    SELECT 
        asin,
        COUNT(DISTINCT competitor_seller_id) as competitor_count,
        MIN(price) as min_competitor_price,
        AVG(CASE WHEN is_buy_box_winner THEN 100 ELSE 0 END) as buy_box_percentage
    FROM competitor_tracking_advanced
    WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY asin
) c ON p.asin = c.asin

-- Métricas de advertising
LEFT JOIN (
    SELECT 
        kp.asin,
        SUM(kp.cost) as total_spend_30d,
        CASE 
            WHEN SUM(kp.attributed_sales_7d) > 0 
            THEN SUM(kp.cost) / SUM(kp.attributed_sales_7d) * 100 
            ELSE 999 
        END as acos_30d,
        CASE 
            WHEN SUM(s.revenue_30d) > 0 
            THEN SUM(kp.cost) / SUM(s.revenue_30d) * 100 
            ELSE 999 
        END as tacos_30d
    FROM keywords_performance kp
    JOIN (
        SELECT asin, SUM(ordered_product_sales) as revenue_30d
        FROM sales_metrics
        WHERE date >= CURRENT_DATE - 30
        GROUP BY asin
    ) s ON kp.asin = s.asin
    WHERE kp.date >= CURRENT_DATE - 30
    GROUP BY kp.asin, s.revenue_30d
) a ON p.asin = a.asin;

-- View de alertas prioritários
CREATE OR REPLACE VIEW priority_alerts AS
SELECT * FROM (
    -- Produtos próximos de stockout
    SELECT 
        asin,
        'stockout_risk' as alert_type,
        'critical' as priority,
        CONCAT('Estoque crítico: ', days_of_supply, ' dias restantes') as message,
        current_stock as value,
        NOW() as created_at
    FROM product_analysis
    WHERE days_of_supply < 14
    
    UNION ALL
    
    -- Produtos perdendo Buy Box
    SELECT 
        asin,
        'buy_box_loss' as alert_type,
        'high' as priority,
        CONCAT('Buy Box em apenas ', ROUND(buy_box_percentage_24h), '%') as message,
        buy_box_percentage_24h as value,
        NOW() as created_at
    FROM product_analysis
    WHERE buy_box_percentage_24h < 50
    
    UNION ALL
    
    -- ACOS muito alto
    SELECT 
        asin,
        'high_acos' as alert_type,
        'medium' as priority,
        CONCAT('ACOS alto: ', ROUND(acos_30d), '%') as message,
        acos_30d as value,
        NOW() as created_at
    FROM product_analysis
    WHERE acos_30d > 30 AND ad_spend_30d > 100
) alerts
ORDER BY 
    CASE priority 
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
    END,
    created_at DESC;

-- =====================================================
-- FUNÇÕES ÚTEIS
-- =====================================================

-- Função para calcular velocidade de vendas
CREATE OR REPLACE FUNCTION calculate_sales_velocity(
    p_asin VARCHAR(10),
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    daily_velocity DECIMAL(10,2),
    weekly_velocity DECIMAL(10,2),
    monthly_velocity DECIMAL(10,2),
    trend VARCHAR(10)
) AS $$
BEGIN
    RETURN QUERY
    WITH sales_data AS (
        SELECT 
            date,
            units_ordered
        FROM sales_metrics
        WHERE asin = p_asin
        AND date >= CURRENT_DATE - p_days
        ORDER BY date DESC
    ),
    velocities AS (
        SELECT 
            AVG(units_ordered) as daily_avg,
            AVG(units_ordered) * 7 as weekly_avg,
            AVG(units_ordered) * 30 as monthly_avg,
            -- Trend baseado na comparação das duas metades do período
            CASE 
                WHEN AVG(CASE WHEN date >= CURRENT_DATE - (p_days/2) THEN units_ordered END) >
                     AVG(CASE WHEN date < CURRENT_DATE - (p_days/2) THEN units_ordered END) * 1.1
                THEN 'increasing'
                WHEN AVG(CASE WHEN date >= CURRENT_DATE - (p_days/2) THEN units_ordered END) <
                     AVG(CASE WHEN date < CURRENT_DATE - (p_days/2) THEN units_ordered END) * 0.9
                THEN 'decreasing'
                ELSE 'stable'
            END as trend_direction
        FROM sales_data
    )
    SELECT 
        ROUND(daily_avg, 2),
        ROUND(weekly_avg, 2),
        ROUND(monthly_avg, 2),
        trend_direction
    FROM velocities;
END;
$$ LANGUAGE plpgsql;

-- Função para sugerir reorder point
CREATE OR REPLACE FUNCTION suggest_reorder_point(
    p_asin VARCHAR(10),
    p_lead_time_days INTEGER,
    p_safety_stock_days INTEGER DEFAULT 7
) RETURNS INTEGER AS $$
DECLARE
    v_daily_velocity DECIMAL(10,2);
    v_reorder_point INTEGER;
BEGIN
    -- Calcular velocidade média diária
    SELECT daily_velocity INTO v_daily_velocity
    FROM calculate_sales_velocity(p_asin, 30);
    
    -- Reorder point = (lead time + safety stock) * daily velocity
    v_reorder_point := CEIL((p_lead_time_days + p_safety_stock_days) * v_daily_velocity);
    
    RETURN v_reorder_point;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas relevantes
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY[
            'products_ml',
            'keywords_performance'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at 
                BEFORE UPDATE ON %I 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- =====================================================
-- DADOS INICIAIS E COMENTÁRIOS
-- =====================================================

-- Inserir tipos de insights suportados
INSERT INTO ai_insights_advanced (asin, insight_type, priority, title, description, tenant_id)
VALUES 
    ('SYSTEM', 'system', 'low', 'Sistema de IA Configurado', 'O sistema de análise com IA foi configurado com sucesso', 'default')
ON CONFLICT DO NOTHING;

-- Comentários nas tabelas
COMMENT ON TABLE products_ml IS 'Tabela principal de produtos com features para Machine Learning';
COMMENT ON TABLE sales_metrics IS 'Métricas de vendas time-series para análise e previsão';
COMMENT ON TABLE inventory_snapshots IS 'Histórico de snapshots de inventário para análise de tendências';
COMMENT ON TABLE competitor_tracking_advanced IS 'Tracking avançado de competidores com análise em tempo real';
COMMENT ON TABLE campaign_metrics IS 'Métricas de campanhas de advertising para otimização';
COMMENT ON TABLE keywords_performance IS 'Performance de keywords com sugestões de IA';
COMMENT ON TABLE ai_insights_advanced IS 'Insights gerados por IA com tracking de impacto';
COMMENT ON TABLE demand_forecasts IS 'Previsões de demanda usando modelos de ML';
COMMENT ON TABLE price_optimization IS 'Sugestões de otimização de preço baseadas em elasticidade';

-- Grant permissions (ajustar conforme necessário)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO appproft_user;