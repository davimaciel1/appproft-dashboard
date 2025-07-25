/**
 * Criar tabelas restantes para Advertising e Notificações
 */

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createRemainingTables() {
  console.log('🏗️  Criando tabelas restantes para Advertising e Notificações\n');
  
  const tables = [
    {
      name: 'advertising_profiles',
      sql: `
        CREATE TABLE IF NOT EXISTS advertising_profiles (
          id SERIAL PRIMARY KEY,
          profile_id BIGINT UNIQUE NOT NULL,
          country_code VARCHAR(5) NOT NULL,
          currency_code VARCHAR(5) NOT NULL,
          timezone VARCHAR(50),
          account_type VARCHAR(20) DEFAULT 'seller',
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
      `
    },
    {
      name: 'advertising_campaigns',
      sql: `
        CREATE TABLE IF NOT EXISTS advertising_campaigns (
          id SERIAL PRIMARY KEY,
          campaign_id BIGINT NOT NULL,
          profile_id BIGINT NOT NULL,
          name VARCHAR(255) NOT NULL,
          campaign_type VARCHAR(30) DEFAULT 'sponsoredProducts',
          targeting_type VARCHAR(20) DEFAULT 'manual',
          state VARCHAR(20) NOT NULL,
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
      `
    },
    {
      name: 'advertising_ad_groups',
      sql: `
        CREATE TABLE IF NOT EXISTS advertising_ad_groups (
          id SERIAL PRIMARY KEY,
          ad_group_id BIGINT NOT NULL,
          campaign_id BIGINT NOT NULL,
          profile_id BIGINT NOT NULL,
          name VARCHAR(255) NOT NULL,
          default_bid DECIMAL(10,2),
          state VARCHAR(20) NOT NULL,
          tenant_id VARCHAR(50) DEFAULT 'default',
          raw_data JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(ad_group_id, profile_id)
        );
        CREATE INDEX IF NOT EXISTS idx_advertising_ad_groups_campaign ON advertising_ad_groups(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_advertising_ad_groups_profile ON advertising_ad_groups(profile_id);
      `
    },
    {
      name: 'advertising_keywords',
      sql: `
        CREATE TABLE IF NOT EXISTS advertising_keywords (
          id SERIAL PRIMARY KEY,
          keyword_id BIGINT NOT NULL,
          ad_group_id BIGINT NOT NULL,
          campaign_id BIGINT NOT NULL,
          profile_id BIGINT NOT NULL,
          keyword_text VARCHAR(255) NOT NULL,
          match_type VARCHAR(20) NOT NULL,
          state VARCHAR(20) NOT NULL,
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
      `
    },
    {
      name: 'advertising_campaign_metrics',
      sql: `
        CREATE TABLE IF NOT EXISTS advertising_campaign_metrics (
          id SERIAL PRIMARY KEY,
          campaign_id BIGINT NOT NULL,
          profile_id BIGINT NOT NULL,
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
          ctr DECIMAL(5,2) DEFAULT 0,
          acos DECIMAL(5,2) DEFAULT 0,
          roas DECIMAL(10,2) DEFAULT 0,
          cpc DECIMAL(10,2) DEFAULT 0,
          tenant_id VARCHAR(50) DEFAULT 'default',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(campaign_id, profile_id, date)
        );
        CREATE INDEX IF NOT EXISTS idx_advertising_campaign_metrics_date ON advertising_campaign_metrics(date);
        CREATE INDEX IF NOT EXISTS idx_advertising_campaign_metrics_campaign ON advertising_campaign_metrics(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_advertising_campaign_metrics_performance ON advertising_campaign_metrics(acos, roas);
      `
    },
    {
      name: 'notification_settings',
      sql: `
        CREATE TABLE IF NOT EXISTS notification_settings (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) DEFAULT 'default',
          user_id VARCHAR(50),
          notification_type VARCHAR(50) NOT NULL,
          channels TEXT[] NOT NULL,
          enabled BOOLEAN DEFAULT true,
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(tenant_id, user_id, notification_type)
        );
        CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(tenant_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_notification_settings_type ON notification_settings(notification_type, enabled);
      `
    },
    {
      name: 'notification_channels',
      sql: `
        CREATE TABLE IF NOT EXISTS notification_channels (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) DEFAULT 'default',
          channel_type VARCHAR(20) NOT NULL,
          channel_name VARCHAR(100) NOT NULL,
          configuration JSONB NOT NULL,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant ON notification_channels(tenant_id, enabled);
        CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(channel_type);
      `
    },
    {
      name: 'tokens_storage',
      sql: `
        CREATE TABLE IF NOT EXISTS tokens_storage (
          id SERIAL PRIMARY KEY,
          service VARCHAR(50) NOT NULL,
          token_data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tokens_storage_service ON tokens_storage(service, created_at DESC);
      `
    },
    {
      name: 'buy_box_history',
      sql: `
        CREATE TABLE IF NOT EXISTS buy_box_history (
          id SERIAL PRIMARY KEY,
          asin VARCHAR(20) NOT NULL,
          product_name VARCHAR(255),
          change_type VARCHAR(20) NOT NULL,
          our_price DECIMAL(10,2),
          competitor_price DECIMAL(10,2),
          buy_box_winner VARCHAR(255),
          tenant_id VARCHAR(50) DEFAULT 'default',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_buy_box_history_asin ON buy_box_history(asin, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_buy_box_history_change ON buy_box_history(change_type, created_at DESC);
      `
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  try {
    for (const table of tables) {
      try {
        console.log(`🔨 Criando tabela: ${table.name}`);
        await executeSQL(table.sql);
        console.log(`   ✅ ${table.name} criada com sucesso`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ Erro em ${table.name}: ${error.message}`);
        errorCount++;
      }
    }

    // Inserir configurações padrão de notificação
    console.log('\n⚙️  Inserindo configurações padrão de notificação...');
    
    const defaultNotifications = [
      ['inventory_low', ['email', 'inapp']],
      ['inventory_critical', ['email', 'slack', 'inapp']],
      ['new_order', ['slack', 'inapp']],
      ['buy_box_lost', ['email', 'slack', 'inapp']],
      ['buy_box_won', ['slack', 'inapp']],
      ['competitor_price_change', ['inapp']],
      ['campaign_budget_depleted', ['email', 'slack', 'inapp']],
      ['system_error', ['email', 'slack']],
      ['sync_completed', ['inapp']],
      ['sync_failed', ['email', 'slack', 'inapp']]
    ];

    for (const [type, channels] of defaultNotifications) {
      await executeSQL(`
        INSERT INTO notification_settings (tenant_id, user_id, notification_type, channels, enabled) 
        VALUES ('default', null, $1, $2, true)
        ON CONFLICT (tenant_id, user_id, notification_type) DO NOTHING
      `, [type, channels]);
    }
    
    console.log(`   ✅ ${defaultNotifications.length} configurações padrão inseridas`);

    // Verificar resultado final
    const finalTableCount = await executeSQL(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE 'advertising_%' OR table_name LIKE 'notification%' OR table_name IN ('tokens_storage', 'buy_box_history'))
    `);

    console.log('\n📊 RESUMO FINAL:');
    console.log(`   ✅ Tabelas criadas: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log(`   📋 Total de tabelas relacionadas: ${finalTableCount.rows[0].count}`);

    if (errorCount === 0) {
      console.log('\n🎉 TODAS AS TABELAS CRIADAS COM SUCESSO!');
      console.log('\n📋 Próximos passos:');
      console.log('1. Execute: node scripts/testCompleteImplementation.js');
      console.log('2. Configure credenciais no .env');
      console.log('3. Inicie o sistema: node scripts/startPersistentSync.js');
    } else {
      console.log('\n⚠️  Algumas tabelas tiveram problemas. Verifique os erros acima.');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  createRemainingTables();
}

module.exports = { createRemainingTables };