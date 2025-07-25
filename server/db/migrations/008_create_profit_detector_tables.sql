-- Migration 008: Create Profit Detector tables
-- Description: Tables for tracking real profit/loss per product

-- 1. Products master data
CREATE TABLE IF NOT EXISTS products_master (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) UNIQUE NOT NULL,
    sku VARCHAR(100),
    title TEXT,
    current_price DECIMAL(10,2),
    product_cost DECIMAL(10,2), -- manual input from user
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sales data (from Sales & Traffic Report)
CREATE TABLE IF NOT EXISTS sales_data (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    report_date DATE NOT NULL,
    sessions INTEGER,
    page_views INTEGER,
    buy_box_percentage DECIMAL(5,2),
    units_ordered INTEGER,
    units_ordered_b2b INTEGER,
    total_order_items INTEGER,
    ordered_product_sales DECIMAL(12,2),
    ordered_product_sales_b2b DECIMAL(12,2),
    unit_session_percentage DECIMAL(5,2), -- conversion rate
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asin, report_date)
);

-- 3. FBA fees (from FBA Fees Report)
CREATE TABLE IF NOT EXISTS fba_fees (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    sku VARCHAR(100),
    report_date DATE NOT NULL,
    price DECIMAL(10,2),
    referral_fee DECIMAL(10,2),
    variable_closing_fee DECIMAL(10,2),
    fba_fees DECIMAL(10,2),
    total_fee_estimate DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asin, report_date)
);

-- 4. Storage fees (from Storage Fee Report)
CREATE TABLE IF NOT EXISTS storage_fees (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    report_month DATE NOT NULL,
    fulfillment_center VARCHAR(10),
    average_quantity_on_hand DECIMAL(10,2),
    average_quantity_pending_removal DECIMAL(10,2),
    estimated_monthly_storage_fee DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asin, report_month, fulfillment_center)
);

-- 5. Long term storage fees
CREATE TABLE IF NOT EXISTS long_term_storage_fees (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    snapshot_date DATE NOT NULL,
    sku VARCHAR(100),
    fnsku VARCHAR(100),
    condition_type VARCHAR(50),
    quantity_charged_12_mo_long_term_storage_fee INTEGER,
    per_unit_volume DECIMAL(10,4),
    currency VARCHAR(3),
    twelve_mo_long_term_storage_fee DECIMAL(10,2),
    quantity_charged_6_mo_long_term_storage_fee INTEGER,
    six_mo_long_term_storage_fee DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Inventory data (from Inventory API and Aged Inventory Report)
CREATE TABLE IF NOT EXISTS inventory_data (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    sku VARCHAR(100),
    snapshot_date DATE NOT NULL,
    sellable_quantity INTEGER,
    unsellable_quantity INTEGER,
    aged_90_plus_days INTEGER,
    aged_180_plus_days INTEGER,
    aged_270_plus_days INTEGER,
    aged_365_plus_days INTEGER,
    currency VARCHAR(3),
    qty_to_be_charged_ltsf_12_mo INTEGER,
    projected_ltsf_12_mo DECIMAL(10,2),
    qty_to_be_charged_ltsf_6_mo INTEGER,
    projected_ltsf_6_mo DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asin, snapshot_date)
);

-- 7. Returns data (from Returns Report)
CREATE TABLE IF NOT EXISTS returns_data (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    return_date DATE NOT NULL,
    order_id VARCHAR(50),
    sku VARCHAR(100),
    fnsku VARCHAR(100),
    quantity INTEGER,
    fulfillment_center_id VARCHAR(10),
    detailed_disposition VARCHAR(100),
    reason VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Profit analysis (calculated table)
CREATE TABLE IF NOT EXISTS profit_analysis (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    analysis_date DATE DEFAULT CURRENT_DATE,
    period_days INTEGER DEFAULT 30,
    
    -- Revenue
    selling_price DECIMAL(10,2),
    units_sold INTEGER,
    total_revenue DECIMAL(12,2),
    
    -- Direct costs
    product_cost DECIMAL(10,2),
    total_product_cost DECIMAL(12,2),
    
    -- Amazon fees
    referral_fee_total DECIMAL(10,2),
    fba_fee_total DECIMAL(10,2),
    variable_closing_fee_total DECIMAL(10,2),
    
    -- Storage
    monthly_storage_fee_total DECIMAL(10,2),
    long_term_storage_fee_total DECIMAL(10,2),
    aged_inventory_surcharge DECIMAL(10,2),
    
    -- Returns
    units_returned INTEGER,
    return_rate DECIMAL(5,2),
    return_processing_cost DECIMAL(10,2),
    
    -- Final analysis
    total_costs DECIMAL(12,2),
    gross_profit DECIMAL(12,2),
    profit_margin DECIMAL(5,2),
    profit_per_unit DECIMAL(10,2),
    
    -- Status and classification
    profit_status VARCHAR(20), -- 'hemorrhage', 'loss', 'danger', 'healthy'
    main_cost_driver VARCHAR(50), -- 'storage', 'returns', 'fees', 'cogs'
    
    -- Recommendations
    recommended_action VARCHAR(100),
    recommended_price DECIMAL(10,2),
    potential_savings_monthly DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profit_asin_date ON profit_analysis(asin, analysis_date);
CREATE INDEX IF NOT EXISTS idx_profit_status ON profit_analysis(profit_status);
CREATE INDEX IF NOT EXISTS idx_profit_margin ON profit_analysis(profit_margin);

-- 9. Alert system
CREATE TABLE IF NOT EXISTS profit_alerts (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    alert_type VARCHAR(50), -- 'new_loss', 'increasing_loss', 'storage_alert', 'return_spike'
    severity VARCHAR(20), -- 'critical', 'high', 'medium', 'low'
    title VARCHAR(200),
    message TEXT,
    metrics JSONB, -- specific alert data
    action_url VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    is_actioned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    actioned_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_asin_unread ON profit_alerts(asin, is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_severity_created ON profit_alerts(severity, created_at);

-- 10. Action history
CREATE TABLE IF NOT EXISTS profit_actions (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    action_type VARCHAR(50), -- 'price_change', 'pause_listing', 'create_removal', 'adjust_inventory'
    action_details JSONB,
    previous_state JSONB,
    new_state JSONB,
    estimated_impact DECIMAL(10,2),
    actual_impact DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_actions_asin_type ON profit_actions(asin, action_type);

-- 11. Reports processing tracking
CREATE TABLE IF NOT EXISTS profit_reports_tracking (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(100) NOT NULL,
    report_id VARCHAR(100) UNIQUE NOT NULL,
    document_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'DONE', 'FAILED'
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    records_processed INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_products_master_updated_at ON products_master;
CREATE TRIGGER update_products_master_updated_at BEFORE UPDATE ON products_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profit_analysis_updated_at ON profit_analysis;
CREATE TRIGGER update_profit_analysis_updated_at BEFORE UPDATE ON profit_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert migration record
INSERT INTO migrations (version, description, executed_at)
VALUES ('008', 'Create Profit Detector tables', NOW())
ON CONFLICT (version) DO NOTHING;