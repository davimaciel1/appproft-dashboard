const axios = require('axios');

async function testInsightsAPI() {
  const query = `
    SELECT 
      i.*,
      p.title as product_title
    FROM ai_insights_advanced i
    LEFT JOIN products p ON i.asin = p.asin
    ORDER BY 
      CASE i.priority 
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      i.potential_impact DESC
    LIMIT 50
  `;

  try {
    // Testar endpoint autenticado
    console.log('🔍 Testando endpoint autenticado...');
    try {
      const response1 = await axios.post('http://localhost:5000/api/database/query', 
        { query },
        { headers: { 'Content-Type': 'application/json' } }
      );
      console.log('✅ Endpoint autenticado OK');
      console.log(`   Insights retornados: ${response1.data.rows?.length || 0}`);
    } catch (error) {
      console.log('❌ Endpoint autenticado falhou:', error.response?.status || error.message);
    }

    // Testar endpoint dashboard/database (auto-auth)
    console.log('\n🔍 Testando endpoint dashboard/database...');
    try {
      const response2 = await axios.post('http://localhost:5000/api/dashboard/database/query', 
        { query },
        { headers: { 'Content-Type': 'application/json' } }
      );
      console.log('✅ Endpoint dashboard OK');
      console.log(`   Insights retornados: ${response2.data.rows?.length || 0}`);
      
      if (response2.data.rows?.length > 0) {
        const sample = response2.data.rows[0];
        console.log('\n📋 Exemplo de insight retornado:');
        console.log(`   ID: ${sample.id}`);
        console.log(`   Título: ${sample.title}`);
        console.log(`   Tipo: ${sample.insight_type}`);
        console.log(`   Prioridade: ${sample.priority}`);
        console.log(`   Status: ${sample.status}`);
      }
    } catch (error) {
      console.log('❌ Endpoint dashboard falhou:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Erro:', error.response.data);
      }
    }

  } catch (error) {
    console.error('Erro geral:', error.message);
  }
}

testInsightsAPI();