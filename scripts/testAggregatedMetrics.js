const axios = require('axios');

const API_URL = 'http://localhost:3001/api/dashboard';

async function testAggregatedMetrics() {
  console.log('🧪 Testando rotas de métricas agregadas...\n');

  try {
    // Teste 1: Métricas agregadas por data (padrão)
    console.log('1️⃣ Testando métricas agregadas por DATA:');
    const byDateResponse = await axios.get(`${API_URL}/aggregated-metrics`, {
      params: {
        aggregationType: 'byDate',
        granularity: 'DAY',
        marketplace: 'amazon'
      }
    });
    
    console.log('✅ Resposta recebida - Métricas por Data:');
    console.log('- Data inicial:', byDateResponse.data.salesAndTrafficByDate.startDate);
    console.log('- Data final:', byDateResponse.data.salesAndTrafficByDate.endDate);
    console.log('- Granularidade:', byDateResponse.data.salesAndTrafficByDate.granularity);
    console.log('- Total de registros:', byDateResponse.data.salesAndTrafficByDate.data.length);
    
    if (byDateResponse.data.salesAndTrafficByDate.data.length > 0) {
      const firstDay = byDateResponse.data.salesAndTrafficByDate.data[0];
      console.log('\n📊 Primeira entrada (mais recente):');
      console.log('- Data:', new Date(firstDay.date).toLocaleDateString('pt-BR'));
      console.log('- Vendas:', {
        total: `R$ ${firstDay.sales.orderedProductSales.amount.toFixed(2)}`,
        unidades: firstDay.sales.unitsOrdered,
        taxaDevolucao: `${firstDay.sales.refundRate.toFixed(2)}%`
      });
      console.log('- Tráfego:', {
        pageViews: firstDay.traffic.pageViews,
        sessoes: firstDay.traffic.sessions,
        buyBox: `${firstDay.traffic.buyBoxPercentage.toFixed(2)}%`,
        conversao: `${firstDay.traffic.unitSessionPercentage.toFixed(2)}%`
      });
    }

    // Teste 2: Métricas agregadas por ASIN
    console.log('\n\n2️⃣ Testando métricas agregadas por ASIN/PRODUTO:');
    const byAsinResponse = await axios.get(`${API_URL}/aggregated-metrics`, {
      params: {
        aggregationType: 'byAsin',
        asinLevel: 'PARENT',
        marketplace: 'amazon'
      }
    });
    
    console.log('✅ Resposta recebida - Métricas por ASIN:');
    console.log('- Total de produtos:', byAsinResponse.data.salesAndTrafficByAsin.data.length);
    console.log('- Nível ASIN:', byAsinResponse.data.salesAndTrafficByAsin.asinLevel);
    
    if (byAsinResponse.data.salesAndTrafficByAsin.data.length > 0) {
      console.log('\n📦 Top 3 produtos por vendas:');
      byAsinResponse.data.salesAndTrafficByAsin.data.slice(0, 3).forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.productName || product.sku}`);
        console.log(`   - ASIN: ${product.childAsin}`);
        console.log(`   - Vendas: R$ ${product.sales.orderedProductSales.amount.toFixed(2)}`);
        console.log(`   - Unidades: ${product.sales.unitsOrdered}`);
        console.log(`   - Buy Box: ${product.traffic.buyBoxPercentage.toFixed(2)}%`);
        console.log(`   - Conversão: ${product.traffic.unitSessionPercentage.toFixed(2)}%`);
      });
    }

    // Teste 3: Granularidade semanal
    console.log('\n\n3️⃣ Testando granularidade SEMANAL:');
    const weeklyResponse = await axios.get(`${API_URL}/aggregated-metrics`, {
      params: {
        aggregationType: 'byDate',
        granularity: 'WEEK',
        marketplace: 'amazon'
      }
    });
    
    console.log('✅ Métricas semanais:');
    console.log('- Total de semanas:', weeklyResponse.data.salesAndTrafficByDate.data.length);
    
    // Teste 4: Filtro por período específico
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // 7 dias atrás
    const endDate = new Date();
    
    console.log('\n\n4️⃣ Testando período específico (últimos 7 dias):');
    const periodResponse = await axios.get(`${API_URL}/aggregated-metrics`, {
      params: {
        aggregationType: 'byDate',
        granularity: 'DAY',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        marketplace: 'amazon'
      }
    });
    
    console.log('✅ Métricas do período:');
    console.log('- Dias retornados:', periodResponse.data.salesAndTrafficByDate.data.length);
    
    // Calcular totais do período
    const totals = periodResponse.data.salesAndTrafficByDate.data.reduce((acc, day) => {
      acc.vendas += day.sales.orderedProductSales.amount;
      acc.unidades += day.sales.unitsOrdered;
      acc.sessoes += day.traffic.sessions;
      acc.pageViews += day.traffic.pageViews;
      return acc;
    }, { vendas: 0, unidades: 0, sessoes: 0, pageViews: 0 });
    
    console.log('\n📈 Totais do período (7 dias):');
    console.log(`- Vendas totais: R$ ${totals.vendas.toFixed(2)}`);
    console.log(`- Unidades vendidas: ${totals.unidades}`);
    console.log(`- Sessões totais: ${totals.sessoes}`);
    console.log(`- Page views totais: ${totals.pageViews}`);
    
    console.log('\n✨ Todos os testes concluídos com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('Detalhes:', error.response.data);
    }
  }
}

// Executar testes
testAggregatedMetrics();