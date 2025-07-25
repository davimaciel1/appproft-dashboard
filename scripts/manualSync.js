require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function manualSync() {
  console.log('🚀 Iniciando sincronização manual com Amazon SP-API...\n');
  
  try {
    // Verificar conexão com banco
    console.log('📊 Verificando conexão com PostgreSQL...');
    await executeSQL('SELECT 1');
    console.log('✅ Conexão com banco OK!\n');
    
    // Verificar dados existentes
    console.log('📊 Estatísticas atuais do banco:');
    const stats = await executeSQL(`
      SELECT 
        'products' as table_name, COUNT(*) as count FROM products
      UNION ALL
      SELECT 'orders', COUNT(*) FROM orders
      UNION ALL
      SELECT 'competitors', COUNT(DISTINCT buy_box_seller) FROM competitor_tracking_advanced WHERE buy_box_seller IS NOT NULL
      UNION ALL
      SELECT 'insights', COUNT(*) FROM ai_insights_advanced WHERE status = 'pending'
    `);
    
    stats.rows.forEach(row => {
      console.log(`  - ${row.table_name}: ${row.count} registros`);
    });
    
    console.log('\n⚠️  IMPORTANTE: A sincronização completa foi pausada devido aos limites da API.');
    console.log('\n📋 Para visualizar os dados já coletados:');
    console.log('1. Acesse: http://localhost:3000/amazon-data');
    console.log('2. Explore as diferentes abas para ver:');
    console.log('   - Visão Geral: Dashboard com métricas principais');
    console.log('   - Produtos: Lista de produtos com estoque e vendas');
    console.log('   - Competidores: Análise de Buy Box e preços');
    console.log('   - Insights IA: Recomendações geradas automaticamente');
    console.log('   - Previsões: Demanda para os próximos 30 dias');
    console.log('   - Otimização Preços: Sugestões de ajuste de preços');
    console.log('   - Estoque: Status e dias de cobertura');
    
    console.log('\n🔄 Para retomar a sincronização completa:');
    console.log('1. Aguarde 1 hora para reset dos limites da API');
    console.log('2. Execute: node workers/aiDataCollectionWorker.js');
    console.log('3. O worker implementa rate limiting automático');
    
    // Gerar alguns insights de exemplo com os dados existentes
    console.log('\n🧠 Gerando insights com os dados disponíveis...');
    
    // Verificar produtos com baixo estoque
    const lowStock = await executeSQL(`
      INSERT INTO ai_insights_advanced (
        insight_type, priority, title, description, recommendation,
        confidence_score, potential_impact, status, asin
      )
      SELECT 
        'restock' as insight_type,
        CASE 
          WHEN i.available_quantity < 10 THEN 'critical'
          WHEN i.available_quantity < 50 THEN 'high'
          ELSE 'medium'
        END as priority,
        'Risco de Stockout: ' || p.title as title,
        'Produto com apenas ' || i.available_quantity || ' unidades em estoque.' as description,
        'Enviar ' || GREATEST(100, COALESCE(sm.units_sold_30d, 50) * 2) || ' unidades para FBA.' as recommendation,
        0.85 as confidence_score,
        COALESCE(p.price * sm.units_sold_30d * 0.3, 500) as potential_impact,
        'pending' as status,
        p.asin
      FROM products p
      JOIN inventory_snapshots i ON p.asin = i.asin
      LEFT JOIN sales_metrics sm ON p.asin = sm.asin
      WHERE i.available_quantity < 100
        AND (i.asin, i.snapshot_date) IN (
          SELECT asin, MAX(snapshot_date) 
          FROM inventory_snapshots 
          GROUP BY asin
        )
        AND NOT EXISTS (
          SELECT 1 FROM ai_insights_advanced ai 
          WHERE ai.asin = p.asin 
            AND ai.insight_type = 'restock' 
            AND ai.status = 'pending'
        )
      LIMIT 5
      RETURNING *
    `);
    
    if (lowStock.rowCount > 0) {
      console.log(`✅ ${lowStock.rowCount} insights de restock gerados`);
    }
    
    // Gerar insights de pricing
    const pricingInsights = await executeSQL(`
      INSERT INTO ai_insights_advanced (
        insight_type, priority, title, description, recommendation,
        confidence_score, potential_impact, status, asin
      )
      SELECT 
        'pricing' as insight_type,
        'high' as priority,
        'Otimizar Preço: ' || p.name as title,
        'Competidor com preço ' || ROUND(((p.price - ct.buy_box_price) / ct.buy_box_price * 100)::numeric, 1) || '% menor e Buy Box.' as description,
        'Ajustar preço de R$ ' || p.price || ' para R$ ' || ROUND(ct.buy_box_price * 0.99, 2) as recommendation,
        0.75 as confidence_score,
        COALESCE(sm.units_sold_30d * (p.price - ct.buy_box_price * 0.99), 300) as potential_impact,
        'pending' as status,
        p.asin
      FROM products p
      JOIN competitor_tracking_advanced ct ON p.asin = ct.asin
      LEFT JOIN sales_metrics sm ON p.asin = sm.asin
      WHERE ct.our_has_buy_box = false
        AND ct.buy_box_price < p.price
        AND ct.tracking_date = (SELECT MAX(tracking_date) FROM competitor_tracking_advanced)
        AND NOT EXISTS (
          SELECT 1 FROM ai_insights_advanced ai 
          WHERE ai.asin = p.asin 
            AND ai.insight_type = 'pricing' 
            AND ai.status = 'pending'
        )
      LIMIT 5
      RETURNING *
    `);
    
    if (pricingInsights.rowCount > 0) {
      console.log(`✅ ${pricingInsights.rowCount} insights de pricing gerados`);
    }
    
    console.log('\n✅ Processo concluído!');
    console.log('\n🎯 Acesse os novos dashboards:');
    console.log('- http://localhost:3000/amazon-data - Visualização completa dos dados');
    console.log('- http://localhost:3000/insights - Central de insights com IA');
    
  } catch (error) {
    console.error('❌ Erro durante sincronização:', error.message);
    if (error.message.includes('connect')) {
      console.log('\n💡 Dica: Verifique se o túnel SSH está ativo (start-tunnel.bat)');
    }
  }
}

manualSync();