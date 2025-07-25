// Script para forçar sincronização do Data Kiosk

require('dotenv').config();
const dataKioskClient = require('../server/services/dataKiosk/dataKioskClient');
const DataKioskQueries = require('../server/services/dataKiosk/dataKioskQueries');
const DataKioskProcessor = require('../server/services/dataKiosk/dataKioskProcessor');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function forceDataKioskSync() {
  console.log('🚀 FORÇANDO SINCRONIZAÇÃO DATA KIOSK');
  console.log('='.repeat(50));
  console.log(`Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

  const tenantId = process.env.TENANT_ID || 'default';
  
  try {
    // 1. Verificar conexão
    console.log('1️⃣ Verificando conexão com banco...');
    await executeSQL('SELECT NOW()');
    console.log('✅ Banco de dados conectado\n');

    // 2. Executar sincronização de métricas diárias
    console.log('2️⃣ Sincronizando métricas diárias (últimos 30 dias)...');
    try {
      const dailyQuery = DataKioskQueries.getDailyMetricsQuery(30);
      console.log('📊 Executando query no Data Kiosk...');
      
      const dailyResult = await dataKioskClient.executeQuery(dailyQuery);
      
      if (dailyResult && dailyResult.data) {
        console.log('✅ Dados recebidos do Data Kiosk');
        
        // Processar e salvar no banco
        const processResult = await DataKioskProcessor.processDailyMetrics(dailyResult, tenantId);
        console.log(`✅ ${processResult.processed || 0} dias de métricas processados\n`);
      } else {
        console.log('⚠️ Nenhum dado retornado para métricas diárias\n');
      }
    } catch (error) {
      console.error('❌ Erro em métricas diárias:', error.message);
    }

    // 3. Executar sincronização de métricas por produto
    console.log('3️⃣ Sincronizando métricas por produto (últimos 7 dias)...');
    try {
      // Calcular datas para query
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const productQuery = DataKioskQueries.getAsinMetricsQuery(
        startDateStr,
        endDate,
        process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC'
      );
      console.log('📦 Executando query de produtos...');
      
      const productResult = await dataKioskClient.executeQuery(productQuery);
      
      if (productResult && productResult.data) {
        console.log('✅ Dados de produtos recebidos');
        
        // Processar e salvar
        const processResult = await DataKioskProcessor.processAsinMetrics(productResult, tenantId);
        console.log(`✅ ${processResult.processed || 0} produtos processados\n`);
      } else {
        console.log('⚠️ Nenhum dado retornado para produtos\n');
      }
    } catch (error) {
      console.error('❌ Erro em métricas de produtos:', error.message);
    }

    // 4. Calcular métricas do dashboard
    console.log('4️⃣ Calculando métricas do dashboard...');
    try {
      const dashboardMetrics = await DataKioskProcessor.calculateDashboardMetrics(tenantId);
      console.log('📊 Métricas do dashboard:');
      console.log(`   Vendas hoje: R$ ${dashboardMetrics.todaysSales.toFixed(2)}`);
      console.log(`   Pedidos: ${dashboardMetrics.ordersCount}`);
      console.log(`   Unidades: ${dashboardMetrics.unitsSold}`);
      console.log(`   Buy Box %: ${dashboardMetrics.buyBoxPercentage}%`);
      console.log(`   Conversão: ${dashboardMetrics.unitSessionPercentage}%\n`);
    } catch (error) {
      console.error('❌ Erro ao calcular métricas:', error.message);
    }

    // 5. Verificar dados nas tabelas
    console.log('5️⃣ Verificando dados salvos...');
    const tables = ['daily_metrics', 'product_metrics_history', 'traffic_metrics'];
    
    for (const table of tables) {
      try {
        const result = await executeSQL(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   📊 ${table}: ${result.rows[0].count} registros`);
      } catch (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      }
    }

    console.log('\n✅ Sincronização Data Kiosk concluída!');
    
  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
    console.error(error.stack);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  forceDataKioskSync().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = forceDataKioskSync;