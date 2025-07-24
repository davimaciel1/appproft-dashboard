const AmazonService = require('../server/services/amazonService');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres',
  ssl: false // Desabilitar SSL para conexão local
});

async function testDataKiosk() {
  const tenantId = process.argv[2] || '1';
  const daysBack = parseInt(process.argv[3]) || 7; // Padrão: últimos 7 dias
  
  console.log('\n🧪 Testando Amazon Data Kiosk');
  console.log('============================');
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Período: últimos ${daysBack} dias\n`);

  try {
    // 1. Buscar credenciais do usuário
    console.log('1️⃣ Buscando credenciais...');
    const credentialsResult = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
      [1, 'amazon']
    );
    
    if (credentialsResult.rows.length === 0) {
      console.error('❌ Credenciais Amazon não encontradas!');
      console.log('Execute primeiro: node scripts/createTestUser.js');
      process.exit(1);
    }
    
    const credentials = credentialsResult.rows[0];
    console.log('✅ Credenciais encontradas');

    // 2. Criar instância do AmazonService
    const amazonService = new AmazonService({
      clientId: credentials.client_id || process.env.AMAZON_CLIENT_ID,
      clientSecret: credentials.client_secret || process.env.AMAZON_CLIENT_SECRET,
      refreshToken: credentials.refresh_token || process.env.AMAZON_REFRESH_TOKEN,
      sellerId: credentials.seller_id || process.env.AMAZON_SELLER_ID,
      marketplaceId: credentials.marketplace_id || process.env.SP_API_MARKETPLACE_ID
    });

    // 3. Testar conexão
    console.log('\n2️⃣ Testando conexão com Amazon...');
    const connectionTest = await amazonService.testConnection();
    
    if (!connectionTest.success) {
      console.error('❌ Falha na conexão:', connectionTest.error);
      process.exit(1);
    }
    
    console.log('✅ Conexão estabelecida');
    console.log(`   Marketplaces disponíveis: ${connectionTest.marketplaces}`);

    // 4. Executar sincronização do Data Kiosk
    console.log('\n3️⃣ Iniciando sincronização Data Kiosk...');
    console.log('⏳ Isso pode levar alguns minutos...\n');
    
    const startTime = Date.now();
    const result = await amazonService.syncDataKioskMetrics(tenantId, daysBack);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Sincronização concluída em ${duration}s`);
    console.log('Resultados:', result);

    // 5. Verificar dados salvos
    console.log('\n4️⃣ Verificando dados salvos...');
    
    // Verificar métricas de tráfego
    const trafficResult = await pool.query(`
      SELECT 
        COUNT(*) as total_days,
        MIN(date) as first_date,
        MAX(date) as last_date,
        AVG(page_views) as avg_page_views,
        AVG(sessions) as avg_sessions,
        AVG(buy_box_percentage) as avg_buy_box
      FROM traffic_metrics
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const traffic = trafficResult.rows[0];
    console.log('\n📊 Métricas de Tráfego:');
    console.log(`   Dias com dados: ${traffic.total_days}`);
    console.log(`   Período: ${traffic.first_date ? new Date(traffic.first_date).toLocaleDateString() : 'N/A'} até ${traffic.last_date ? new Date(traffic.last_date).toLocaleDateString() : 'N/A'}`);
    console.log(`   Média de page views/dia: ${parseFloat(traffic.avg_page_views || 0).toFixed(0)}`);
    console.log(`   Média de sessões/dia: ${parseFloat(traffic.avg_sessions || 0).toFixed(0)}`);
    console.log(`   Buy Box médio: ${parseFloat(traffic.avg_buy_box || 0).toFixed(1)}%`);

    // Verificar produtos com métricas
    const productsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN buy_box_percentage > 0 THEN 1 END) as products_with_buy_box,
        AVG(buy_box_percentage) as avg_buy_box
      FROM products
      WHERE user_id = 1
    `);
    
    const products = productsResult.rows[0];
    console.log('\n📦 Produtos:');
    console.log(`   Total de produtos: ${products.total_products}`);
    console.log(`   Produtos com Buy Box: ${products.products_with_buy_box}`);
    console.log(`   Buy Box médio: ${parseFloat(products.avg_buy_box || 0).toFixed(1)}%`);

    // 6. Testar cálculo de métricas do dashboard
    console.log('\n5️⃣ Calculando métricas do dashboard...');
    const DataKioskProcessor = require('../server/services/dataKiosk/dataKioskProcessor');
    const dashboardMetrics = await DataKioskProcessor.calculateDashboardMetrics(tenantId);
    
    console.log('\n💰 Métricas do Dashboard:');
    console.log(`   Vendas hoje: R$ ${dashboardMetrics.todaysSales.toFixed(2)}`);
    console.log(`   Pedidos: ${dashboardMetrics.ordersCount}`);
    console.log(`   Unidades vendidas: ${dashboardMetrics.unitsSold}`);
    console.log(`   Média unidades/pedido: ${dashboardMetrics.avgUnitsPerOrder}`);
    console.log(`   Buy Box: ${dashboardMetrics.buyBoxPercentage}%`);
    console.log(`   Taxa de conversão: ${dashboardMetrics.unitSessionPercentage}%`);
    console.log(`   Comparação com ontem: ${dashboardMetrics.yesterdayComparison}%`);

    console.log('\n✨ Teste concluído com sucesso!');
    
    // 7. URLs para testar
    console.log('\n📍 URLs para testar em produção:');
    console.log('   https://appproft.com/api/data-kiosk/metrics');
    console.log('   https://appproft.com/api/data-kiosk/products');
    console.log('   https://appproft.com/api/data-kiosk/status');
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Executar teste
testDataKiosk();