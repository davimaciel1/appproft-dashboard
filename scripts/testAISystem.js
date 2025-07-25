#!/usr/bin/env node

/**
 * Script de teste do sistema completo de IA
 * Verifica todos os componentes e executa testes básicos
 */

const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class AISystemTester {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.aiScriptsPath = path.join(__dirname, '..', 'ai', 'scripts');
    this.results = {
      database: { status: 'pending', message: '' },
      python: { status: 'pending', message: '' },
      insights: { status: 'pending', message: '' },
      forecast: { status: 'pending', message: '' },
      pricing: { status: 'pending', message: '' },
      campaigns: { status: 'pending', message: '' }
    };
  }

  async run() {
    console.log(`
╔═══════════════════════════════════════════════╗
║        🤖 TESTE DO SISTEMA DE IA              ║
╚═══════════════════════════════════════════════╝
    `);

    // 1. Testar estrutura do banco
    await this.testDatabase();
    
    // 2. Testar ambiente Python
    await this.testPythonEnvironment();
    
    // 3. Inserir dados de teste
    await this.insertTestData();
    
    // 4. Testar cada script Python
    await this.testInsightsGenerator();
    await this.testDemandForecast();
    await this.testPriceOptimization();
    await this.testCampaignAnalysis();
    
    // 5. Mostrar resumo
    this.showSummary();
  }

  async testDatabase() {
    console.log('\n📊 Testando estrutura do banco de dados...');
    
    try {
      // Verificar tabelas principais
      const tables = await executeSQL(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
          'products_ml', 'sales_metrics', 'inventory_snapshots',
          'competitor_tracking_advanced', 'ai_insights_advanced',
          'demand_forecasts', 'price_optimization'
        )
        ORDER BY table_name
      `);
      
      console.log(`✅ ${tables.rows.length} tabelas AI encontradas:`);
      tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
      
      this.results.database = {
        status: 'success',
        message: `${tables.rows.length}/7 tabelas encontradas`
      };
      
    } catch (error) {
      console.error('❌ Erro ao verificar banco:', error.message);
      this.results.database = {
        status: 'error',
        message: error.message
      };
    }
  }

  async testPythonEnvironment() {
    console.log('\n🐍 Testando ambiente Python...');
    
    try {
      const result = await this.executePythonCommand(
        '-c "import prophet, sklearn, pandas, psycopg2; print(\'Todas as bibliotecas carregadas com sucesso!\')"'
      );
      
      console.log('✅', result);
      this.results.python = {
        status: 'success',
        message: 'Ambiente Python OK'
      };
      
    } catch (error) {
      console.error('❌ Erro no ambiente Python:', error.message);
      console.log('💡 Execute: cd ai && python setup.py');
      this.results.python = {
        status: 'error',
        message: error.message
      };
    }
  }

  async insertTestData() {
    console.log('\n💾 Inserindo dados de teste...');
    
    try {
      // Inserir produto de teste
      await executeSQL(`
        INSERT INTO products (
          tenant_id, marketplace, asin, sku, name, price, cost, active
        ) VALUES (
          'test', 'amazon', 'TEST001', 'SKU-TEST-001', 'Produto Teste AI', 
          29.99, 10.00, true
        ) ON CONFLICT (tenant_id, marketplace, asin) DO UPDATE SET
          price = EXCLUDED.price,
          active = true
      `);
      
      // Inserir dados de vendas dos últimos 30 dias
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const units = Math.floor(Math.random() * 20) + 5;
        const price = 29.99 + (Math.random() * 10 - 5); // Variação de preço
        
        await executeSQL(`
          INSERT INTO sales_metrics (
            asin, date, hour, tenant_id, units_ordered, 
            ordered_product_sales, sessions, buy_box_percentage
          ) VALUES (
            'TEST001', $1, 12, 'test', $2, $3, $4, $5
          ) ON CONFLICT (asin, date, hour) DO UPDATE SET
            units_ordered = EXCLUDED.units_ordered
        `, [
          date.toISOString().split('T')[0],
          units,
          units * price,
          Math.floor(Math.random() * 100) + 50,
          Math.random() * 100
        ]);
      }
      
      // Inserir competidor
      await executeSQL(`
        INSERT INTO competitor_tracking_advanced (
          asin, timestamp, competitor_seller_id, seller_name,
          price, is_fba, is_buy_box_winner, condition_type,
          shipping_time_min, shipping_time_max, feedback_rating,
          feedback_count, tenant_id
        ) VALUES (
          'TEST001', NOW(), 'COMP001', 'Competidor Teste',
          27.99, true, true, 'new', 1, 3, 4.5, 1000, 'test'
        )
      `);
      
      console.log('✅ Dados de teste inseridos');
      
    } catch (error) {
      console.error('⚠️  Erro ao inserir dados de teste:', error.message);
    }
  }

  async testInsightsGenerator() {
    console.log('\n🧠 Testando gerador de insights...');
    
    try {
      const result = await this.executePythonScript('analyze_all.py', {
        command: 'generate_insights',
        params: {
          lookback_days: 30,
          confidence_threshold: 0.5
        }
      });
      
      if (result.success) {
        console.log(`✅ ${result.data.insights.length} insights gerados`);
        if (result.data.insights.length > 0) {
          const insight = result.data.insights[0];
          console.log(`   Exemplo: ${insight.title}`);
          console.log(`   Tipo: ${insight.type}, Prioridade: ${insight.priority}`);
        }
        
        this.results.insights = {
          status: 'success',
          message: `${result.data.insights.length} insights`
        };
      }
      
    } catch (error) {
      console.error('❌ Erro no gerador de insights:', error.message);
      this.results.insights = {
        status: 'error',
        message: error.message
      };
    }
  }

  async testDemandForecast() {
    console.log('\n📈 Testando previsão de demanda...');
    
    try {
      const result = await this.executePythonScript('demand_forecast.py', {
        command: 'forecast_all',
        params: {
          forecast_days: 7
        }
      });
      
      if (result.success) {
        console.log(`✅ ${result.data.successful_forecasts} previsões geradas`);
        if (result.data.forecasts && result.data.forecasts.length > 0) {
          const forecast = result.data.forecasts[0];
          console.log(`   ASIN: ${forecast.asin}`);
          console.log(`   Total próximos 7 dias: ${forecast.summary.total_units_30d} unidades`);
        }
        
        this.results.forecast = {
          status: 'success',
          message: `${result.data.successful_forecasts} previsões`
        };
      }
      
    } catch (error) {
      console.error('❌ Erro na previsão de demanda:', error.message);
      this.results.forecast = {
        status: 'error',
        message: error.message
      };
    }
  }

  async testPriceOptimization() {
    console.log('\n💰 Testando otimização de preços...');
    
    try {
      const result = await this.executePythonScript('price_optimization.py', {
        command: 'optimize_all_prices',
        params: {
          min_margin: 0.15,
          buy_box_weight: 0.7
        }
      });
      
      if (result.success) {
        console.log(`✅ ${result.data.successful_optimizations} otimizações geradas`);
        if (result.data.summary) {
          console.log(`   Impacto mensal no lucro: R$ ${result.data.summary.total_profit_impact_monthly}`);
        }
        
        this.results.pricing = {
          status: 'success',
          message: `${result.data.successful_optimizations} otimizações`
        };
      }
      
    } catch (error) {
      console.error('❌ Erro na otimização de preços:', error.message);
      this.results.pricing = {
        status: 'error',
        message: error.message
      };
    }
  }

  async testCampaignAnalysis() {
    console.log('\n📊 Testando análise de campanhas...');
    
    try {
      const result = await this.executePythonScript('campaign_analysis.py', {
        command: 'analyze_campaigns',
        params: {
          lookback_days: 30,
          acos_target: 0.25
        }
      });
      
      if (result.success) {
        console.log(`✅ ${result.data.total_recommendations} recomendações geradas`);
        if (result.data.recommendations && result.data.recommendations.length > 0) {
          const rec = result.data.recommendations[0];
          console.log(`   Exemplo: ${rec.title}`);
          console.log(`   Ação: ${rec.action}`);
        }
        
        this.results.campaigns = {
          status: 'success',
          message: `${result.data.total_recommendations} recomendações`
        };
      }
      
    } catch (error) {
      console.error('❌ Erro na análise de campanhas:', error.message);
      this.results.campaigns = {
        status: 'error',
        message: error.message
      };
    }
  }

  async executePythonCommand(command) {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, command.split(' '), {
        cwd: path.join(__dirname, '..', 'ai')
      });
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(error || 'Python command failed'));
        } else {
          resolve(output.trim());
        }
      });
    });
  }

  async executePythonScript(scriptName, data) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.aiScriptsPath, scriptName);
      
      const python = spawn(this.pythonPath, [scriptPath], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });
      
      let output = '';
      let error = '';
      
      // Enviar dados
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
            reject(new Error(`Invalid JSON: ${output}`));
          }
        }
      });
      
      python.on('error', (err) => {
        reject(err);
      });
    });
  }

  showSummary() {
    console.log(`
╔═══════════════════════════════════════════════╗
║              📋 RESUMO DOS TESTES             ║
╚═══════════════════════════════════════════════╝
`);

    const statusEmoji = {
      success: '✅',
      error: '❌',
      pending: '⏳'
    };

    Object.entries(this.results).forEach(([test, result]) => {
      const emoji = statusEmoji[result.status];
      const testName = test.charAt(0).toUpperCase() + test.slice(1);
      console.log(`${emoji} ${testName.padEnd(15)} ${result.message}`);
    });

    const successCount = Object.values(this.results).filter(r => r.status === 'success').length;
    const totalCount = Object.keys(this.results).length;
    
    console.log(`
📊 Score: ${successCount}/${totalCount}
`);

    if (successCount === totalCount) {
      console.log('🎉 Sistema de IA totalmente operacional!');
    } else if (successCount >= totalCount * 0.7) {
      console.log('⚠️  Sistema parcialmente operacional. Verifique os erros acima.');
    } else {
      console.log('❌ Sistema precisa de configuração. Execute os scripts de setup.');
    }

    // Próximos passos
    console.log(`
📌 Próximos passos:
1. Se houver erros Python: cd ai && python setup.py
2. Se houver erros de banco: node scripts/runAICompleteMigration.js
3. Para executar o worker: node workers/aiDataCollectionWorker.js
4. Para ver insights: consulte a tabela ai_insights_advanced
`);
  }
}

// Executar teste
if (require.main === module) {
  const tester = new AISystemTester();
  tester.run().catch(console.error);
}

module.exports = AISystemTester;