const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkInsights() {
  try {
    const result = await executeSQL(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium
      FROM ai_insights_advanced
      WHERE status = 'pending'
    `);
    
    console.log('📊 Insights disponíveis:');
    console.log(result.rows[0]);
    
    // Pegar um exemplo
    const sample = await executeSQL(`
      SELECT 
        id,
        title, 
        description, 
        priority, 
        confidence_score,
        potential_impact,
        insight_type
      FROM ai_insights_advanced
      WHERE status = 'pending'
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        potential_impact DESC
      LIMIT 3
    `);
    
    if (sample.rows.length > 0) {
      console.log('\n📋 Exemplos de insights:');
      sample.rows.forEach((insight, i) => {
        console.log(`\n${i + 1}. ${insight.title}`);
        console.log(`   Tipo: ${insight.insight_type}, Prioridade: ${insight.priority}`);
        console.log(`   Impacto: R$ ${parseFloat(insight.potential_impact || 0).toFixed(2)}`);
      });
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkInsights();