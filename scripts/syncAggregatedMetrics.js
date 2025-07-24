const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
});

class AggregatedMetricsSync {
  constructor() {
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC'
    };
  }

  /**
   * Sincroniza métricas de vendas e tráfego da Amazon
   * NOTA: Esta é uma simulação - a API real requer implementação específica
   */
  async syncFromAmazon(startDate, endDate) {
    console.log('🔄 Sincronizando métricas agregadas da Amazon...');
    console.log(`📅 Período: ${startDate} até ${endDate}`);

    try {
      // IMPORTANTE: Em produção, você deve:
      // 1. Usar a Amazon SP-API real com as queries GraphQL
      // 2. Implementar autenticação OAuth adequada
      // 3. Respeitar rate limits da API
      
      // Por enquanto, vamos simular a estrutura de dados que viria da API
      console.log('\n⚠️  ATENÇÃO: Para sincronização real, você precisa:');
      console.log('1. Implementar integração com Amazon SP-API GraphQL');
      console.log('2. Usar as queries salesAndTrafficByDate e salesAndTrafficByAsin');
      console.log('3. Configurar autenticação OAuth com tokens válidos');
      
      // Simular salvamento de métricas de tráfego
      const currentDate = new Date(startDate);
      const end = new Date(endDate);
      let savedCount = 0;

      while (currentDate <= end) {
        // Em produção, estes dados viriam da API real
        const mockTrafficData = {
          page_views: Math.floor(Math.random() * 2000) + 500,
          sessions: Math.floor(Math.random() * 500) + 100,
          browser_page_views: Math.floor(Math.random() * 1500) + 300,
          mobile_app_page_views: Math.floor(Math.random() * 500) + 100,
          buy_box_percentage: Math.random() * 30 + 70, // 70-100%
          unit_session_percentage: Math.random() * 10 + 20, // 20-30%
          feedback_received: Math.floor(Math.random() * 20),
          negative_feedback_received: Math.floor(Math.random() * 3)
        };

        await pool.query(`
          INSERT INTO traffic_metrics (
            user_id, tenant_id, marketplace, date,
            page_views, sessions, browser_page_views, mobile_app_page_views,
            buy_box_percentage, unit_session_percentage,
            feedback_received, negative_feedback_received
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (user_id, marketplace, date) 
          DO UPDATE SET
            page_views = EXCLUDED.page_views,
            sessions = EXCLUDED.sessions,
            browser_page_views = EXCLUDED.browser_page_views,
            mobile_app_page_views = EXCLUDED.mobile_app_page_views,
            buy_box_percentage = EXCLUDED.buy_box_percentage,
            unit_session_percentage = EXCLUDED.unit_session_percentage,
            feedback_received = EXCLUDED.feedback_received,
            negative_feedback_received = EXCLUDED.negative_feedback_received,
            updated_at = NOW()
        `, [
          1, 1, 'amazon', currentDate,
          mockTrafficData.page_views,
          mockTrafficData.sessions,
          mockTrafficData.browser_page_views,
          mockTrafficData.mobile_app_page_views,
          mockTrafficData.buy_box_percentage,
          mockTrafficData.unit_session_percentage,
          mockTrafficData.feedback_received,
          mockTrafficData.negative_feedback_received
        ]);

        savedCount++;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`\n✅ ${savedCount} dias de métricas salvas no banco`);

      // Atualizar métricas de produtos
      await this.updateProductMetrics();

      return { success: true, daysProcessed: savedCount };

    } catch (error) {
      console.error('❌ Erro na sincronização:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Atualiza métricas de buy box por produto
   */
  async updateProductMetrics() {
    console.log('\n🔄 Atualizando métricas de produtos...');

    // Simular atualização de buy box percentage para produtos
    const products = await pool.query('SELECT id FROM products WHERE marketplace = $1', ['amazon']);
    
    for (const product of products.rows) {
      const buyBoxPercentage = Math.random() * 30 + 70; // 70-100%
      
      await pool.query(
        'UPDATE products SET buy_box_percentage = $1 WHERE id = $2',
        [buyBoxPercentage, product.id]
      );
    }

    console.log(`✅ ${products.rows.length} produtos atualizados`);
  }

  /**
   * Configurar sincronização automática
   */
  static setupCronJob() {
    console.log('\n📅 Para sincronização automática, adicione ao seu cron:');
    console.log('0 */6 * * * node scripts/syncAggregatedMetrics.js # A cada 6 horas');
    console.log('0 2 * * * node scripts/syncAggregatedMetrics.js --full # Diariamente às 2h');
  }
}

// Executar sincronização
async function main() {
  const sync = new AggregatedMetricsSync();
  
  // Determinar período
  const args = process.argv.slice(2);
  const isFullSync = args.includes('--full');
  
  const endDate = new Date();
  const startDate = new Date();
  
  if (isFullSync) {
    startDate.setDate(startDate.getDate() - 30); // Últimos 30 dias
  } else {
    startDate.setDate(startDate.getDate() - 7); // Últimos 7 dias
  }

  console.log('🚀 Iniciando sincronização de métricas agregadas\n');
  
  const result = await sync.syncFromAmazon(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );

  if (result.success) {
    console.log('\n✨ Sincronização concluída com sucesso!');
    console.log('\n📊 Para visualizar os dados:');
    console.log('http://localhost:3001/api/dashboard/aggregated-metrics?aggregationType=byDate');
  }

  AggregatedMetricsSync.setupCronJob();
  
  await pool.end();
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = AggregatedMetricsSync;