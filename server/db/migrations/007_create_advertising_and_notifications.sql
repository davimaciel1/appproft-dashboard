-- Migration 007: Criar tabelas para Advertising API e Sistema de Notificações
-- Data: 2025-07-24

-- =====================================================
-- TABELAS DA AMAZON ADVERTISING API
-- =====================================================

-- Tabela de perfis de advertising
CREATE TABLE IF NOT EXISTS advertising_profiles (
  id SERIAL PRIMARY KEY,
  profile_id BIGINT UNIQUE NOT NULL,
  country_code VARCHAR(5) NOT NULL,
  currency_code VARCHAR(5) NOT NULL,
  timezone VARCHAR(50),
  account_type VARCHAR(20) DEFAULT 'seller', -- seller, vendor, agency
  account_name VARCHAR(255),
  account_valid_payment_method BOOLEAN DEFAULT false,
  account_id BIGINT,
  tenant_id VARCHAR(50) DEFAULT 'default',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertising_profiles_tenant ON advertising_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_advertising_profiles_account ON advertising_profiles(account_id);

-- Tabela de campanhas
CREATE TABLE IF NOT EXISTS advertising_campaigns (
  id SERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  profile_id BIGINT NOT NULL REFERENCES advertising_profiles(profile_id),
  name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(30) DEFAULT 'sponsoredProducts', -- sponsoredProducts, sponsoredBrands, sponsoredDisplay
  targeting_type VARCHAR(20) DEFAULT 'manual', -- manual, auto
  state VARCHAR(20) NOT NULL, -- enabled, paused, archived
  daily_budget DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  premium_bid_adjustment BOOLEAN DEFAULT false,
  tenant_id VARCHAR(50) DEFAULT 'default',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_advertising_campaigns_profile ON advertising_campaigns(profile_id);
CREATE INDEX IF NOT EXISTS idx_advertising_campaigns_state ON advertising_campaigns(state);
CREATE INDEX IF NOT EXISTS idx_advertising_campaigns_tenant ON advertising_campaigns(tenant_id);

-- Tabela de ad groups
CREATE TABLE IF NOT EXISTS advertising_ad_groups (
  id SERIAL PRIMARY KEY,
  ad_group_id BIGINT NOT NULL,
  campaign_id BIGINT NOT NULL,
  profile_id BIGINT NOT NULL REFERENCES advertising_profiles(profile_id),
  name VARCHAR(255) NOT NULL,
  default_bid DECIMAL(10,2),
  state VARCHAR(20) NOT NULL, -- enabled, paused, archived
  tenant_id VARCHAR(50) DEFAULT 'default',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_group_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_advertising_ad_groups_campaign ON advertising_ad_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_advertising_ad_groups_profile ON advertising_ad_groups(profile_id);

-- Tabela de keywords
CREATE TABLE IF NOT EXISTS advertising_keywords (
  id SERIAL PRIMARY KEY,
  keyword_id BIGINT NOT NULL,
  ad_group_id BIGINT NOT NULL,
  campaign_id BIGINT NOT NULL,
  profile_id BIGINT NOT NULL REFERENCES advertising_profiles(profile_id),
  keyword_text VARCHAR(255) NOT NULL,
  match_type VARCHAR(20) NOT NULL, -- exact, phrase, broad
  state VARCHAR(20) NOT NULL, -- enabled, paused, archived
  bid DECIMAL(10,2),
  tenant_id VARCHAR(50) DEFAULT 'default',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(keyword_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_advertising_keywords_ad_group ON advertising_keywords(ad_group_id);
CREATE INDEX IF NOT EXISTS idx_advertising_keywords_campaign ON advertising_keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_advertising_keywords_text ON advertising_keywords(keyword_text);

-- Tabela de métricas de campanhas (dados de performance)
CREATE TABLE IF NOT EXISTS advertising_campaign_metrics (
  id SERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  profile_id BIGINT NOT NULL REFERENCES advertising_profiles(profile_id),
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  sales_1d DECIMAL(10,2) DEFAULT 0,
  sales_7d DECIMAL(10,2) DEFAULT 0,
  sales_14d DECIMAL(10,2) DEFAULT 0,
  sales_30d DECIMAL(10,2) DEFAULT 0,
  orders_1d INTEGER DEFAULT 0,
  orders_7d INTEGER DEFAULT 0,
  orders_14d INTEGER DEFAULT 0,
  orders_30d INTEGER DEFAULT 0,
  conversions_1d INTEGER DEFAULT 0,
  conversions_7d INTEGER DEFAULT 0,
  conversions_14d INTEGER DEFAULT 0,
  conversions_30d INTEGER DEFAULT 0,
  -- Métricas calculadas
  ctr DECIMAL(5,2) DEFAULT 0, -- Click Through Rate
  acos DECIMAL(5,2) DEFAULT 0, -- Advertising Cost of Sales
  roas DECIMAL(10,2) DEFAULT 0, -- Return on Ad Spend
  cpc DECIMAL(10,2) DEFAULT 0, -- Cost Per Click
  tenant_id VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_advertising_campaign_metrics_date ON advertising_campaign_metrics(date);
CREATE INDEX IF NOT EXISTS idx_advertising_campaign_metrics_campaign ON advertising_campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_advertising_campaign_metrics_performance ON advertising_campaign_metrics(acos, roas);

-- Tabela de métricas de keywords
CREATE TABLE IF NOT EXISTS advertising_keyword_metrics (
  id SERIAL PRIMARY KEY,
  keyword_id BIGINT NOT NULL,
  ad_group_id BIGINT NOT NULL,
  campaign_id BIGINT NOT NULL,
  profile_id BIGINT NOT NULL REFERENCES advertising_profiles(profile_id),
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  sales_7d DECIMAL(10,2) DEFAULT 0,
  orders_7d INTEGER DEFAULT 0,
  average_position DECIMAL(5,2),
  ctr DECIMAL(5,2) DEFAULT 0,
  acos DECIMAL(5,2) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  tenant_id VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(keyword_id, profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_advertising_keyword_metrics_date ON advertising_keyword_metrics(date);
CREATE INDEX IF NOT EXISTS idx_advertising_keyword_metrics_keyword ON advertising_keyword_metrics(keyword_id);

-- =====================================================
-- TABELAS DO SISTEMA DE NOTIFICAÇÕES
-- =====================================================

-- Tabela principal de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) DEFAULT 'default',
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, read
  channels TEXT[] DEFAULT '{}', -- canais usados: email, slack, webhook, inapp, sms
  metadata JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_type_priority ON notifications(notification_type, priority);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read_at) WHERE read_at IS NULL;

-- Tabela de configurações de notificação por usuário
CREATE TABLE IF NOT EXISTS notification_settings (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) DEFAULT 'default',
  user_id VARCHAR(50),
  notification_type VARCHAR(50) NOT NULL,
  channels TEXT[] NOT NULL, -- canais preferidos do usuário
  enabled BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}', -- configurações específicas por canal
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_type ON notification_settings(notification_type, enabled);

-- Tabela de configuração de canais de notificação
CREATE TABLE IF NOT EXISTS notification_channels (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) DEFAULT 'default',
  channel_type VARCHAR(20) NOT NULL, -- email, slack, webhook, sms
  channel_name VARCHAR(100) NOT NULL,
  configuration JSONB NOT NULL, -- configurações específicas do canal
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant ON notification_channels(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(channel_type);

-- Tabela para armazenar tokens (OAuth, API keys, etc.)
CREATE TABLE IF NOT EXISTS tokens_storage (
  id SERIAL PRIMARY KEY,
  service VARCHAR(50) NOT NULL, -- advertising_api, sp_api, etc.
  token_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_storage_service ON tokens_storage(service, created_at DESC);

-- =====================================================
-- TABELAS AUXILIARES PARA NOTIFICAÇÕES AUTOMÁTICAS
-- =====================================================

-- Tabela de histórico de Buy Box para detectar mudanças
CREATE TABLE IF NOT EXISTS buy_box_history (
  id SERIAL PRIMARY KEY,
  asin VARCHAR(20) NOT NULL,
  product_name VARCHAR(255),
  change_type VARCHAR(20) NOT NULL, -- won, lost, price_change
  our_price DECIMAL(10,2),
  competitor_price DECIMAL(10,2),
  buy_box_winner VARCHAR(255), -- nome do seller que ganhou
  tenant_id VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buy_box_history_asin ON buy_box_history(asin, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buy_box_history_change ON buy_box_history(change_type, created_at DESC);

-- =====================================================
-- INSERIR CONFIGURAÇÕES PADRÃO
-- =====================================================

-- Configurações padrão de notificação para o tenant 'default'
INSERT INTO notification_settings (tenant_id, user_id, notification_type, channels, enabled) VALUES
('default', null, 'inventory_low', ARRAY['email', 'inapp'], true),
('default', null, 'inventory_critical', ARRAY['email', 'slack', 'inapp'], true),
('default', null, 'new_order', ARRAY['slack', 'inapp'], true),
('default', null, 'buy_box_lost', ARRAY['email', 'slack', 'inapp'], true),
('default', null, 'buy_box_won', ARRAY['slack', 'inapp'], true),
('default', null, 'competitor_price_change', ARRAY['inapp'], true),
('default', null, 'campaign_budget_depleted', ARRAY['email', 'slack', 'inapp'], true),
('default', null, 'keyword_position_drop', ARRAY['inapp'], true),
('default', null, 'sales_target_achieved', ARRAY['slack', 'inapp'], true),
('default', null, 'system_error', ARRAY['email', 'slack'], true),
('default', null, 'sync_completed', ARRAY['inapp'], true),
('default', null, 'sync_failed', ARRAY['email', 'slack', 'inapp'], true)
ON CONFLICT (tenant_id, user_id, notification_type) DO NOTHING;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE advertising_profiles IS 'Perfis de advertising da Amazon (contas de vendedor/vendor)';
COMMENT ON TABLE advertising_campaigns IS 'Campanhas de advertising (Sponsored Products, Brands, Display)';
COMMENT ON TABLE advertising_ad_groups IS 'Grupos de anúncios dentro das campanhas';
COMMENT ON TABLE advertising_keywords IS 'Keywords/palavras-chave das campanhas';
COMMENT ON TABLE advertising_campaign_metrics IS 'Métricas de performance das campanhas por data';
COMMENT ON TABLE advertising_keyword_metrics IS 'Métricas de performance das keywords por data';

COMMENT ON TABLE notifications IS 'Sistema de notificações multi-canal (email, slack, webhook, etc.)';
COMMENT ON TABLE notification_settings IS 'Configurações personalizadas de notificação por usuário';
COMMENT ON TABLE notification_channels IS 'Configuração dos canais de notificação disponíveis';
COMMENT ON TABLE tokens_storage IS 'Armazenamento seguro de tokens OAuth e API keys';
COMMENT ON TABLE buy_box_history IS 'Histórico de mudanças na Buy Box para detectar ganhos/perdas';

-- =====================================================
-- VALIDAÇÃO E TESTE
-- =====================================================

-- Verificar se as tabelas foram criadas corretamente
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN (
    'advertising_profiles', 'advertising_campaigns', 'advertising_ad_groups', 
    'advertising_keywords', 'advertising_campaign_metrics', 'advertising_keyword_metrics',
    'notifications', 'notification_settings', 'notification_channels', 
    'tokens_storage', 'buy_box_history'
  );
  
  IF table_count = 11 THEN
    RAISE NOTICE '✅ Migration 007 executada com sucesso! % tabelas criadas.', table_count;
  ELSE
    RAISE EXCEPTION '❌ Migration 007 falhou! Apenas % de 11 tabelas foram criadas.', table_count;
  END IF;
END $$;