const { executeSQL } = require('./DATABASE_ACCESS_CONFIG');

async function checkWorkerLogs() {
  try {
    // Verificar sync_logs
    const syncLogs = await executeSQL(`
      SELECT * FROM sync_logs 
      WHERE sync_type = 'competitor_pricing' 
      ORDER BY completed_at DESC 
      LIMIT 10
    `);
    
    console.log('\n=== SYNC LOGS - COMPETITOR PRICING ===');
    console.table(syncLogs.rows);
    
    // Verificar competitor_tracking
    const competitorData = await executeSQL(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT asin) as total_asins,
        COUNT(DISTINCT competitor_seller_id) as total_sellers,
        MIN(timestamp) as oldest_record,
        MAX(timestamp) as newest_record
      FROM competitor_tracking
    `);
    
    console.log('\n=== COMPETITOR TRACKING STATUS ===');
    console.table(competitorData.rows);
    
    // Verificar produtos com ASIN
    const products = await executeSQL(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(DISTINCT asin) as total_asins,
        COUNT(*) FILTER (WHERE asin IS NOT NULL AND asin != '') as products_with_asin,
        COUNT(*) FILTER (WHERE asin IS NULL OR asin = '') as products_without_asin
      FROM products
      WHERE marketplace = 'amazon'
    `);
    
    console.log('\n=== PRODUTOS AMAZON ===');
    console.table(products.rows);
    
    // Verificar ai_insights de buy box
    const insights = await executeSQL(`
      SELECT 
        COUNT(*) as total_insights,
        COUNT(*) FILTER (WHERE insight_type = 'buy_box') as buy_box_insights,
        MIN(created_at) as oldest_insight,
        MAX(created_at) as newest_insight
      FROM ai_insights
      WHERE insight_type = 'buy_box'
    `);
    
    console.log('\n=== BUY BOX INSIGHTS ===');
    console.table(insights.rows);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkWorkerLogs();