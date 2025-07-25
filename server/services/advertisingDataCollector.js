/**
 * Coletor de Dados da Amazon Advertising API
 * Coleta campanhas, keywords, métricas e relatórios
 */

const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');
const secureLogger = require('../utils/secureLogger');
const { getAdvertisingTokenManager } = require('./advertisingTokenManager');
const { getRateLimiter } = require('./rateLimiter');

class AdvertisingDataCollector {
  constructor() {
    this.tokenManager = getAdvertisingTokenManager();
    this.rateLimiter = getRateLimiter();
    this.currentProfileId = null;
    
    // Cache para perfis
    this.profilesCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 horas
  }

  /**
   * Inicializar coletor e obter perfis
   */
  async initialize() {
    try {
      const profiles = await this.tokenManager.getProfiles();
      
      // Salvar perfis no cache e banco
      for (const profile of profiles) {
        this.profilesCache.set(profile.profileId, {
          ...profile,
          cachedAt: Date.now()
        });
        
        await this.saveProfile(profile);
      }
      
      // Definir perfil padrão (primeiro ativo)
      const activeProfile = profiles.find(p => p.accountInfo.validPaymentMethod) || profiles[0];
      if (activeProfile) {
        this.currentProfileId = activeProfile.profileId;
        secureLogger.info(`Perfil ativo selecionado: ${activeProfile.profileId}`);
      }
      
      secureLogger.info('✅ Advertising Data Collector inicializado', {
        profilesCount: profiles.length,
        activeProfileId: this.currentProfileId
      });
      
      return profiles;
    } catch (error) {
      secureLogger.error('Erro ao inicializar Advertising collector:', error);
      throw error;
    }
  }

  async saveProfile(profile) {
    try {
      await executeSQL(`
        INSERT INTO advertising_profiles (
          profile_id, country_code, currency_code, timezone, 
          account_type, account_name, account_valid_payment_method,
          account_id, tenant_id, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (profile_id) DO UPDATE SET
          account_name = EXCLUDED.account_name,
          account_valid_payment_method = EXCLUDED.account_valid_payment_method,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        profile.profileId,
        profile.countryCode,
        profile.currencyCode,
        profile.timezone,
        profile.accountInfo?.type || 'seller',
        profile.accountInfo?.name,
        profile.accountInfo?.validPaymentMethod || false,
        profile.accountInfo?.id,
        'default',
        JSON.stringify(profile)
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar perfil:', error);
    }
  }

  /**
   * Coletar todas as campanhas
   */
  async collectCampaigns(profileId = null) {
    const pid = profileId || this.currentProfileId;
    if (!pid) throw new Error('Profile ID não definido');

    try {
      await this.rateLimiter.waitForToken('advertising-api', '/v2/sp/campaigns');
      
      const response = await this.tokenManager.makeAuthenticatedRequest('/v2/sp/campaigns', {
        headers: {
          'Amazon-Advertising-API-Scope': pid
        }
      });

      const campaigns = await response.json();
      
      secureLogger.info(`${campaigns.length} campanhas encontradas`, { profileId: pid });
      
      // Salvar campanhas
      for (const campaign of campaigns) {
        await this.saveCampaign(campaign, pid);
      }
      
      return campaigns;
    } catch (error) {
      secureLogger.error('Erro ao coletar campanhas:', error);
      throw error;
    }
  }

  async saveCampaign(campaign, profileId) {
    try {
      await executeSQL(`
        INSERT INTO advertising_campaigns (
          campaign_id, profile_id, name, campaign_type, targeting_type,
          state, daily_budget, start_date, end_date, 
          premium_bid_adjustment, tenant_id, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (campaign_id, profile_id) DO UPDATE SET
          name = EXCLUDED.name,
          state = EXCLUDED.state,
          daily_budget = EXCLUDED.daily_budget,
          end_date = EXCLUDED.end_date,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        campaign.campaignId,
        profileId,
        campaign.name,
        campaign.campaignType || 'sponsoredProducts',
        campaign.targetingType || 'manual',
        campaign.state,
        campaign.dailyBudget,
        campaign.startDate,
        campaign.endDate,
        campaign.premiumBidAdjustment || false,
        'default',
        JSON.stringify(campaign)
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar campanha:', error);
    }
  }

  /**
   * Coletar ad groups de uma campanha
   */
  async collectAdGroups(campaignId, profileId = null) {
    const pid = profileId || this.currentProfileId;
    
    try {
      await this.rateLimiter.waitForToken('advertising-api', '/v2/sp/adGroups');
      
      const response = await this.tokenManager.makeAuthenticatedRequest(
        `/v2/sp/adGroups?campaignIdFilter=${campaignId}`,
        {
          headers: {
            'Amazon-Advertising-API-Scope': pid
          }
        }
      );

      const adGroups = await response.json();
      
      // Salvar ad groups
      for (const adGroup of adGroups) {
        await this.saveAdGroup(adGroup, pid);
      }
      
      return adGroups;
    } catch (error) {
      secureLogger.error('Erro ao coletar ad groups:', error);
      throw error;
    }
  }

  async saveAdGroup(adGroup, profileId) {
    try {
      await executeSQL(`
        INSERT INTO advertising_ad_groups (
          ad_group_id, campaign_id, profile_id, name, default_bid,
          state, tenant_id, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (ad_group_id, profile_id) DO UPDATE SET
          name = EXCLUDED.name,
          default_bid = EXCLUDED.default_bid,
          state = EXCLUDED.state,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        adGroup.adGroupId,
        adGroup.campaignId,
        profileId,
        adGroup.name,
        adGroup.defaultBid,
        adGroup.state,
        'default',
        JSON.stringify(adGroup)
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar ad group:', error);
    }
  }

  /**
   * Coletar keywords de um ad group
   */
  async collectKeywords(adGroupId, profileId = null) {
    const pid = profileId || this.currentProfileId;
    
    try {
      await this.rateLimiter.waitForToken('advertising-api', '/v2/sp/keywords');
      
      const response = await this.tokenManager.makeAuthenticatedRequest(
        `/v2/sp/keywords?adGroupIdFilter=${adGroupId}`,
        {
          headers: {
            'Amazon-Advertising-API-Scope': pid
          }
        }
      );

      const keywords = await response.json();
      
      // Salvar keywords
      for (const keyword of keywords) {
        await this.saveKeyword(keyword, pid);
      }
      
      return keywords;
    } catch (error) {
      secureLogger.error('Erro ao coletar keywords:', error);
      throw error;
    }
  }

  async saveKeyword(keyword, profileId) {
    try {
      await executeSQL(`
        INSERT INTO advertising_keywords (
          keyword_id, ad_group_id, campaign_id, profile_id, 
          keyword_text, match_type, state, bid, tenant_id, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (keyword_id, profile_id) DO UPDATE SET
          keyword_text = EXCLUDED.keyword_text,
          match_type = EXCLUDED.match_type,
          state = EXCLUDED.state,
          bid = EXCLUDED.bid,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `, [
        keyword.keywordId,
        keyword.adGroupId,
        keyword.campaignId,
        profileId,
        keyword.keywordText,
        keyword.matchType,
        keyword.state,
        keyword.bid,
        'default',
        JSON.stringify(keyword)
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar keyword:', error);
    }
  }

  /**
   * Coletar relatório de performance de campanhas
   */
  async collectCampaignReport(profileId = null, startDate = null, endDate = null) {
    const pid = profileId || this.currentProfileId;
    
    // Datas padrão: últimos 30 dias
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    try {
      await this.rateLimiter.waitForToken('advertising-api', '/v2/sp/campaigns/report');
      
      // Solicitar relatório
      const reportResponse = await this.tokenManager.makeAuthenticatedRequest('/v2/sp/campaigns/report', {
        method: 'POST',
        headers: {
          'Amazon-Advertising-API-Scope': pid
        },
        body: JSON.stringify({
          reportDate: end.toISOString().split('T')[0],
          metrics: [
            'campaignName', 'campaignId', 'impressions', 'clicks', 'cost', 
            'sales1d', 'sales7d', 'sales14d', 'sales30d',
            'orders1d', 'orders7d', 'orders14d', 'orders30d',
            'attributedConversions1d', 'attributedConversions7d', 
            'attributedConversions14d', 'attributedConversions30d'
          ]
        })
      });

      const reportRequest = await reportResponse.json();
      const reportId = reportRequest.reportId;
      
      secureLogger.info(`Relatório de campanha solicitado: ${reportId}`);
      
      // Aguardar processamento do relatório
      const reportData = await this.waitForReport(reportId, pid);
      
      // Processar e salvar dados
      if (reportData) {
        await this.processCampaignReportData(reportData, pid);
      }
      
      return reportId;
    } catch (error) {
      secureLogger.error('Erro ao coletar relatório de campanha:', error);
      throw error;
    }
  }

  /**
   * Aguardar processamento de relatório
   */
  async waitForReport(reportId, profileId, maxWaitMinutes = 10) {
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        await this.rateLimiter.waitForToken('advertising-api', `/v2/reports/${reportId}`);
        
        const response = await this.tokenManager.makeAuthenticatedRequest(`/v2/reports/${reportId}`, {
          headers: {
            'Amazon-Advertising-API-Scope': profileId
          }
        });

        const reportStatus = await response.json();
        
        if (reportStatus.status === 'SUCCESS') {
          // Baixar dados do relatório
          const dataResponse = await fetch(reportStatus.location);
          const reportData = await dataResponse.text();
          
          secureLogger.info(`Relatório ${reportId} processado com sucesso`);
          return reportData;
        } else if (reportStatus.status === 'FAILURE') {
          throw new Error(`Relatório falhou: ${reportStatus.statusDetails}`);
        }
        
        // Aguardar 30 segundos antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, 30000));
        
      } catch (error) {
        secureLogger.error(`Erro ao verificar relatório ${reportId}:`, error);
        throw error;
      }
    }
    
    throw new Error(`Timeout aguardando relatório ${reportId}`);
  }

  /**
   * Processar dados do relatório de campanha
   */
  async processCampaignReportData(csvData, profileId) {
    const lines = csvData.split('\n');
    const headers = lines[0].split('\t');
    
    let processed = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      if (values.length < headers.length) continue;
      
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index];
      });
      
      if (record.campaignId) {
        await this.saveCampaignMetrics(record, profileId);
        processed++;
      }
    }
    
    secureLogger.info(`${processed} métricas de campanha processadas`);
    return processed;
  }

  async saveCampaignMetrics(metrics, profileId) {
    try {
      await executeSQL(`
        INSERT INTO advertising_campaign_metrics (
          campaign_id, profile_id, date, impressions, clicks, cost,
          sales_1d, sales_7d, sales_14d, sales_30d,
          orders_1d, orders_7d, orders_14d, orders_30d,
          conversions_1d, conversions_7d, conversions_14d, conversions_30d,
          ctr, acos, roas, cpc, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ON CONFLICT (campaign_id, profile_id, date) DO UPDATE SET
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          cost = EXCLUDED.cost,
          sales_1d = EXCLUDED.sales_1d,
          sales_7d = EXCLUDED.sales_7d,
          sales_14d = EXCLUDED.sales_14d,
          sales_30d = EXCLUDED.sales_30d,
          updated_at = NOW()
      `, [
        metrics.campaignId,
        profileId,
        new Date().toISOString().split('T')[0], // Data atual
        parseInt(metrics.impressions) || 0,
        parseInt(metrics.clicks) || 0,
        parseFloat(metrics.cost) || 0,
        parseFloat(metrics.sales1d) || 0,
        parseFloat(metrics.sales7d) || 0,
        parseFloat(metrics.sales14d) || 0,
        parseFloat(metrics.sales30d) || 0,
        parseInt(metrics.orders1d) || 0,
        parseInt(metrics.orders7d) || 0,
        parseInt(metrics.orders14d) || 0,
        parseInt(metrics.orders30d) || 0,
        parseInt(metrics.attributedConversions1d) || 0,
        parseInt(metrics.attributedConversions7d) || 0,
        parseInt(metrics.attributedConversions14d) || 0,
        parseInt(metrics.attributedConversions30d) || 0,
        // Calcular métricas derivadas
        metrics.impressions > 0 ? (metrics.clicks / metrics.impressions * 100) : 0, // CTR
        metrics.sales7d > 0 ? (metrics.cost / metrics.sales7d * 100) : 0, // ACOS
        metrics.cost > 0 ? (metrics.sales7d / metrics.cost) : 0, // ROAS
        metrics.clicks > 0 ? (metrics.cost / metrics.clicks) : 0, // CPC
        'default'
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar métricas de campanha:', error);
    }
  }

  /**
   * Coleta completa de dados de advertising
   */
  async collectAllAdvertisingData(profileId = null) {
    const pid = profileId || this.currentProfileId;
    
    secureLogger.info('🚀 Iniciando coleta completa de dados de advertising', { profileId: pid });
    
    const results = {
      profiles: 0,
      campaigns: 0,
      adGroups: 0,
      keywords: 0,
      reports: 0
    };
    
    try {
      // 1. Inicializar e obter perfis
      const profiles = await this.initialize();
      results.profiles = profiles.length;
      
      // 2. Coletar campanhas
      const campaigns = await this.collectCampaigns(pid);
      results.campaigns = campaigns.length;
      
      // 3. Coletar ad groups e keywords para cada campanha (limitado para não sobrecarregar)
      const limitedCampaigns = campaigns.slice(0, 10); // Primeiras 10 campanhas
      
      for (const campaign of limitedCampaigns) {
        try {
          const adGroups = await this.collectAdGroups(campaign.campaignId, pid);
          results.adGroups += adGroups.length;
          
          // Coletar keywords dos primeiros 5 ad groups
          const limitedAdGroups = adGroups.slice(0, 5);
          for (const adGroup of limitedAdGroups) {
            const keywords = await this.collectKeywords(adGroup.adGroupId, pid);
            results.keywords += keywords.length;
          }
          
          // Rate limiting entre campanhas
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          secureLogger.error(`Erro ao processar campanha ${campaign.campaignId}:`, error);
        }
      }
      
      // 4. Coletar relatório de performance
      await this.collectCampaignReport(pid);
      results.reports = 1;
      
      secureLogger.info('✅ Coleta completa de advertising finalizada', results);
      
      return results;
    } catch (error) {
      secureLogger.error('❌ Erro na coleta de advertising:', error);
      throw error;
    }
  }
}

// Singleton
let instance = null;

module.exports = {
  getAdvertisingDataCollector: () => {
    if (!instance) {
      instance = new AdvertisingDataCollector();
    }
    return instance;
  },
  AdvertisingDataCollector
};