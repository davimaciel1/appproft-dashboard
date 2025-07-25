#!/usr/bin/env node

/**
 * Worker Principal de Coleta de Dados com IA
 * Orquestra toda a coleta de dados e análise com inteligência artificial
 */

const cron = require('node-cron');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const { getDataCollector } = require('../server/services/dataCollector');
const secureLogger = require('../server/utils/secureLogger');
const { spawn } = require('child_process');
const path = require('path');

class AIDataCollectionWorker {
  constructor() {
    this.isRunning = false;
    this.dataCollector = getDataCollector();
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.aiScriptsPath = path.join(__dirname, '..', 'ai', 'scripts');
  }
  
  /**
   * Inicia o worker
   */
  start() {
    console.log('🤖 Iniciando AI Data Collection Worker...');
    console.log('📊 Este worker coleta TODOS os dados possíveis das APIs');
    console.log('🧠 E usa IA para gerar insights acionáveis\n');
    
    // Executar coleta inicial após 30 segundos
    setTimeout(() => {
      this.runFullCollection().catch(err => {
        secureLogger.error('Erro na coleta inicial', { error: err.message });
      });
    }, 30000);
    
    // Agendar coletas regulares
    this.scheduleJobs();
    
    console.log('✅ Worker iniciado com sucesso!');
  }
  
  /**
   * Agenda todos os jobs
   */
  scheduleJobs() {
    // Coleta rápida a cada 15 minutos (pricing e inventory)
    cron.schedule('*/15 * * * *', async () => {
      if (!this.isRunning) {
        await this.runQuickCollection();
      }
    });
    
    // Coleta completa a cada 2 horas
    cron.schedule('0 */2 * * *', async () => {
      if (!this.isRunning) {
        await this.runFullCollection();
      }
    });
    
    // Análise com IA a cada 6 horas
    cron.schedule('0 */6 * * *', async () => {
      await this.runAIAnalysis();
    });
    
    // Previsão de demanda diária às 2h da manhã
    cron.schedule('0 2 * * *', async () => {
      await this.runDemandForecasting();
    });
    
    // Otimização de preços diária às 3h da manhã
    cron.schedule('0 3 * * *', async () => {
      await this.runPriceOptimization();
    });
    
    // Análise de campanhas às 4h da manhã
    cron.schedule('0 4 * * *', async () => {
      await this.runCampaignAnalysis();
    });
    
    // Limpeza de dados antigos às 5h da manhã
    cron.schedule('0 5 * * *', async () => {
      await this.cleanupOldData();
    });
    
    console.log('📅 Jobs agendados:');
    console.log('   - Coleta rápida: a cada 15 minutos');
    console.log('   - Coleta completa: a cada 2 horas');
    console.log('   - Análise com IA: a cada 6 horas');
    console.log('   - Previsão de demanda: diariamente às 2h');
    console.log('   - Otimização de preços: diariamente às 3h');
    console.log('   - Análise de campanhas: diariamente às 4h');
    console.log('   - Limpeza: diariamente às 5h');
  }
  
  /**
   * Coleta rápida (pricing e inventory)
   */
  async runQuickCollection() {
    if (this.isRunning) {
      secureLogger.info('Coleta já em andamento, pulando...');
      return;
    }
    
    this.isRunning = true;
    secureLogger.info('🚀 Iniciando coleta rápida...');
    
    try {
      const tenants = await this.getActiveTenants();
      
      for (const tenant of tenants) {
        try {
          // Coletar apenas pricing e inventory
          const results = {
            inventory: { success: 0, errors: 0 },
            pricing: { success: 0, errors: 0 },
            competitors: { success: 0, errors: 0 }
          };
          
          await this.dataCollector.collectInventory(tenant.tenant_id, results.inventory);
          await this.dataCollector.collectPricingAndCompetitors(
            tenant.tenant_id, 
            results.pricing, 
            results.competitors
          );
          
          secureLogger.info('Coleta rápida concluída', {
            tenantId: tenant.tenant_id,
            results
          });
          
        } catch (error) {
          secureLogger.error('Erro na coleta rápida do tenant', {
            tenantId: tenant.tenant_id,
            error: error.message
          });
        }
      }
      
    } catch (error) {
      secureLogger.error('Erro na coleta rápida', { error: error.message });
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Coleta completa de todos os dados
   */
  async runFullCollection() {
    if (this.isRunning) {
      secureLogger.info('Coleta já em andamento, pulando...');
      return;
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    secureLogger.info('🚀 Iniciando coleta completa de dados...');
    
    try {
      const tenants = await this.getActiveTenants();
      let totalSuccess = 0;
      let totalErrors = 0;
      
      for (const tenant of tenants) {
        try {
          const results = await this.dataCollector.collectAllData(tenant.tenant_id);
          
          // Somar estatísticas
          Object.values(results).forEach(stat => {
            totalSuccess += stat.success;
            totalErrors += stat.errors;
          });
          
        } catch (error) {
          secureLogger.error('Erro na coleta completa do tenant', {
            tenantId: tenant.tenant_id,
            error: error.message
          });
          totalErrors++;
        }
      }
      
      const duration = (Date.now() - startTime) / 1000;
      
      secureLogger.info('✅ Coleta completa finalizada', {
        duration: `${duration.toFixed(1)}s`,
        tenants: tenants.length,
        totalSuccess,
        totalErrors
      });
      
      // Executar análise com IA após coleta completa
      if (totalSuccess > 0) {
        await this.runAIAnalysis();
      }
      
    } catch (error) {
      secureLogger.error('Erro fatal na coleta completa', { error: error.message });
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Executa análise com IA
   */
  async runAIAnalysis() {
    secureLogger.info('🧠 Iniciando análise com IA...');
    
    try {
      // Executar script Python de análise
      const analysisResult = await this.executePythonScript('analyze_all.py', {
        command: 'generate_insights',
        params: {
          lookback_days: 30,
          confidence_threshold: 0.7
        }
      });
      
      if (analysisResult.success) {
        const insights = analysisResult.data.insights || [];
        
        secureLogger.info(`✨ ${insights.length} insights gerados pela IA`);
        
        // Salvar insights no banco
        for (const insight of insights) {
          await this.saveAIInsight(insight);
        }
        
        // Notificar sobre insights de alta prioridade
        const highPriority = insights.filter(i => i.priority === 'critical' || i.priority === 'high');
        if (highPriority.length > 0) {
          await this.notifyHighPriorityInsights(highPriority);
        }
      }
      
    } catch (error) {
      secureLogger.error('Erro na análise com IA', { error: error.message });
    }
  }
  
  /**
   * Executa previsão de demanda
   */
  async runDemandForecasting() {
    secureLogger.info('📈 Iniciando previsão de demanda com Prophet...');
    
    try {
      const result = await this.executePythonScript('demand_forecast.py', {
        command: 'forecast_all',
        params: {
          forecast_days: 30,
          include_seasonality: true,
          include_holidays: true
        }
      });
      
      if (result.success) {
        const forecasts = result.data.forecasts || [];
        
        secureLogger.info(`📊 ${forecasts.length} previsões geradas`);
        
        // Salvar previsões no banco
        for (const forecast of forecasts) {
          await this.saveDemandForecast(forecast);
        }
      }
      
    } catch (error) {
      secureLogger.error('Erro na previsão de demanda', { error: error.message });
    }
  }
  
  /**
   * Executa otimização de preços
   */
  async runPriceOptimization() {
    secureLogger.info('💰 Iniciando otimização de preços com ML...');
    
    try {
      const result = await this.executePythonScript('price_optimization.py', {
        command: 'optimize_all_prices',
        params: {
          elasticity_window: 90, // dias para calcular elasticidade
          min_margin: 0.15, // margem mínima de 15%
          buy_box_weight: 0.7 // peso da Buy Box na otimização
        }
      });
      
      if (result.success) {
        const optimizations = result.data.optimizations || [];
        
        secureLogger.info(`💵 ${optimizations.length} otimizações de preço sugeridas`);
        
        // Salvar sugestões
        for (const optimization of optimizations) {
          await this.savePriceOptimization(optimization);
        }
      }
      
    } catch (error) {
      secureLogger.error('Erro na otimização de preços', { error: error.message });
    }
  }
  
  /**
   * Executa análise de campanhas
   */
  async runCampaignAnalysis() {
    secureLogger.info('📊 Iniciando análise de campanhas de advertising...');
    
    try {
      const result = await this.executePythonScript('campaign_analysis.py', {
        command: 'analyze_campaigns',
        params: {
          lookback_days: 30,
          min_impressions: 1000,
          acos_target: 0.25
        }
      });
      
      if (result.success) {
        const recommendations = result.data.recommendations || [];
        
        secureLogger.info(`🎯 ${recommendations.length} recomendações de otimização`);
        
        // Processar recomendações
        for (const rec of recommendations) {
          if (rec.type === 'keyword') {
            await this.saveKeywordRecommendation(rec);
          } else if (rec.type === 'campaign') {
            await this.saveCampaignInsight(rec);
          }
        }
      }
      
    } catch (error) {
      secureLogger.error('Erro na análise de campanhas', { error: error.message });
    }
  }
  
  /**
   * Executa script Python
   */
  async executePythonScript(scriptName, data) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.aiScriptsPath, scriptName);
      
      const python = spawn(this.pythonPath, [scriptPath], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });
      
      let output = '';
      let error = '';
      
      // Enviar dados para o script
      python.stdin.write(JSON.stringify(data));
      python.stdin.end();
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${error}`));
        } else {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            reject(new Error(`Invalid JSON from Python: ${output}`));
          }
        }
      });
      
      python.on('error', (err) => {
        reject(err);
      });
    });
  }
  
  /**
   * Salva insight da IA
   */
  async saveAIInsight(insight) {
    await executeSQL(`
      INSERT INTO ai_insights_advanced (
        asin, insight_type, priority, title, description, recommendation,
        competitor_name, competitor_action, supporting_data,
        confidence_score, potential_impact, model_name, model_version,
        tenant_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW() + INTERVAL '7 days')
    `, [
      insight.asin,
      insight.type,
      insight.priority,
      insight.title,
      insight.description,
      insight.recommendation,
      insight.competitor_name,
      insight.competitor_action,
      JSON.stringify(insight.supporting_data),
      insight.confidence_score,
      insight.potential_impact,
      insight.model_name || 'ensemble_v1',
      insight.model_version || '1.0',
      insight.tenant_id || 'default'
    ]);
  }
  
  /**
   * Salva previsão de demanda
   */
  async saveDemandForecast(forecast) {
    // Salvar cada dia da previsão
    for (const daily of forecast.daily_forecasts) {
      await executeSQL(`
        INSERT INTO demand_forecasts (
          asin, forecast_date, tenant_id,
          units_forecast, units_lower_bound, units_upper_bound,
          revenue_forecast, revenue_lower_bound, revenue_upper_bound,
          seasonality_factor, trend_factor, promotion_factor,
          recommended_stock_level, reorder_point, reorder_quantity,
          model_name, model_version, confidence_level, mape
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (asin, forecast_date) DO UPDATE SET
          units_forecast = EXCLUDED.units_forecast,
          units_lower_bound = EXCLUDED.units_lower_bound,
          units_upper_bound = EXCLUDED.units_upper_bound,
          revenue_forecast = EXCLUDED.revenue_forecast,
          updated_at = NOW()
      `, [
        forecast.asin,
        daily.date,
        forecast.tenant_id || 'default',
        daily.units_forecast,
        daily.units_lower,
        daily.units_upper,
        daily.revenue_forecast,
        daily.revenue_lower,
        daily.revenue_upper,
        daily.seasonality_factor,
        daily.trend_factor,
        daily.promotion_factor || 1.0,
        forecast.recommended_stock_level,
        forecast.reorder_point,
        forecast.reorder_quantity,
        'prophet',
        forecast.model_version || '3.0',
        forecast.confidence_level,
        forecast.mape
      ]);
    }
  }
  
  /**
   * Salva otimização de preço
   */
  async savePriceOptimization(optimization) {
    await executeSQL(`
      INSERT INTO price_optimization (
        asin, optimization_date, tenant_id,
        current_price, current_buy_box_percentage,
        current_units_per_day, current_profit_margin,
        price_elasticity, cross_elasticity,
        suggested_price, suggested_price_min, suggested_price_max,
        expected_buy_box_percentage, expected_units_per_day,
        expected_revenue_change, expected_profit_change,
        competitor_min_price, competitor_avg_price,
        status
      ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'suggested')
    `, [
      optimization.asin,
      optimization.tenant_id || 'default',
      optimization.current_price,
      optimization.current_buy_box_pct,
      optimization.current_velocity,
      optimization.current_margin,
      optimization.elasticity,
      JSON.stringify(optimization.cross_elasticity || {}),
      optimization.suggested_price,
      optimization.price_range.min,
      optimization.price_range.max,
      optimization.expected_buy_box_pct,
      optimization.expected_velocity,
      optimization.expected_revenue_change,
      optimization.expected_profit_change,
      optimization.competitor_min_price,
      optimization.competitor_avg_price
    ]);
  }
  
  /**
   * Busca tenants ativos
   */
  async getActiveTenants() {
    const result = await executeSQL(`
      SELECT DISTINCT tenant_id 
      FROM products 
      WHERE active = true 
      GROUP BY tenant_id
      HAVING COUNT(*) > 0
    `);
    
    return result.rows.length > 0 ? result.rows : [{ tenant_id: 1 }];
  }
  
  /**
   * Limpa dados antigos
   */
  async cleanupOldData() {
    secureLogger.info('🧹 Iniciando limpeza de dados antigos...');
    
    try {
      // Limpar sales_metrics antigas (manter 180 dias)
      const salesCleanup = await executeSQL(`
        DELETE FROM sales_metrics 
        WHERE date < CURRENT_DATE - INTERVAL '180 days'
      `);
      
      // Limpar inventory snapshots (manter 90 dias)
      const inventoryCleanup = await executeSQL(`
        DELETE FROM inventory_snapshots 
        WHERE snapshot_time < NOW() - INTERVAL '90 days'
      `);
      
      // Limpar competitor tracking (manter 60 dias)
      const competitorCleanup = await executeSQL(`
        DELETE FROM competitor_tracking_advanced 
        WHERE timestamp < NOW() - INTERVAL '60 days'
      `);
      
      // Limpar insights aplicados ou expirados
      const insightsCleanup = await executeSQL(`
        DELETE FROM ai_insights_advanced 
        WHERE (status IN ('applied', 'dismissed') AND created_at < NOW() - INTERVAL '30 days')
        OR (expires_at < NOW())
      `);
      
      // Limpar jobs antigos
      const jobsCleanup = await executeSQL(`
        DELETE FROM sync_jobs 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      
      secureLogger.info('✅ Limpeza concluída', {
        salesMetrics: salesCleanup.rowCount,
        inventorySnapshots: inventoryCleanup.rowCount,
        competitorTracking: competitorCleanup.rowCount,
        insights: insightsCleanup.rowCount,
        syncJobs: jobsCleanup.rowCount
      });
      
    } catch (error) {
      secureLogger.error('Erro na limpeza de dados', { error: error.message });
    }
  }
  
  /**
   * Notifica insights de alta prioridade
   */
  async notifyHighPriorityInsights(insights) {
    // TODO: Implementar notificações (email, Slack, etc)
    secureLogger.info('🔔 Insights de alta prioridade detectados', {
      count: insights.length,
      types: insights.map(i => i.type).filter((v, i, a) => a.indexOf(v) === i)
    });
  }
  
  /**
   * Para o worker
   */
  stop() {
    console.log('🛑 Parando AI Data Collection Worker...');
    // Os cron jobs param automaticamente quando o processo termina
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const worker = new AIDataCollectionWorker();
  worker.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Recebido SIGINT, parando worker...');
    worker.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n👋 Recebido SIGTERM, parando worker...');
    worker.stop();
    process.exit(0);
  });
}

module.exports = AIDataCollectionWorker;