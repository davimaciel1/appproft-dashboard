require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkAI() {
  try {
    console.log('🧠 Verificando sistema de IA...\n');
    
    // Verificar tabela de insights
    try {
      const result = await executeSQL('SELECT COUNT(*) as count FROM ai_insights_advanced');
      console.log(`📊 ai_insights_advanced: ${result.rows[0].count} insights`);
      
      if (result.rows[0].count > 0) {
        const sample = await executeSQL(`
          SELECT insight_type, title, priority, created_at 
          FROM ai_insights_advanced 
          ORDER BY created_at DESC 
          LIMIT 5
        `);
        console.log('📈 Últimos insights gerados:');
        sample.rows.forEach(insight => {
          console.log(`   ${insight.insight_type}: ${insight.title} - ${insight.created_at}`);
        });
      } else {
        console.log('❌ Nenhum insight encontrado! IA não está gerando dados.');
      }
    } catch (error) {
      console.log(`❌ Tabela ai_insights_advanced não existe: ${error.message}`);
    }
    
    // Verificar outras tabelas de ML
    const mlTables = [
      'demand_forecasts',
      'price_optimization_ml', 
      'competitor_analysis_ml',
      'ml_predictions'
    ];
    
    console.log('\n🤖 Verificando outras tabelas de ML:');
    for (const table of mlTables) {
      try {
        const result = await executeSQL(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table}: ${result.rows[0].count} registros`);
      } catch (error) {
        console.log(`   ${table}: ❌ Não existe`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

checkAI();