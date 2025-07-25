require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function generateSampleData() {
  console.log('🎯 Gerando dados de exemplo para visualização...\n');
  
  try {
    // Verificar conexão
    await executeSQL('SELECT 1');
    console.log('✅ Conexão com PostgreSQL OK\n');
    
    // 1. Adicionar dados de vendas para produtos existentes
    console.log('📊 Gerando métricas de vendas...');
    await executeSQL(`
      INSERT INTO sales_metrics (asin, units_sold_7d, units_sold_30d, revenue_7d, revenue_30d, daily_velocity_7d)
      SELECT 
        asin,
        FLOOR(RANDOM() * 50 + 10) as units_sold_7d,
        FLOOR(RANDOM() * 200 + 50) as units_sold_30d,
        ROUND((RANDOM() * 5000 + 1000)::numeric, 2) as revenue_7d,
        ROUND((RANDOM() * 20000 + 5000)::numeric, 2) as revenue_30d,
        ROUND((RANDOM() * 10 + 2)::numeric, 2) as daily_velocity_7d
      FROM products
      WHERE asin IS NOT NULL
      ON CONFLICT (asin) DO UPDATE SET
        units_sold_7d = EXCLUDED.units_sold_7d,
        units_sold_30d = EXCLUDED.units_sold_30d,
        revenue_7d = EXCLUDED.revenue_7d,
        revenue_30d = EXCLUDED.revenue_30d,
        daily_velocity_7d = EXCLUDED.daily_velocity_7d,
        last_updated = NOW()
    `);
    console.log('✅ Métricas de vendas geradas\n');
    
    // 2. Adicionar dados de estoque
    console.log('📦 Gerando dados de inventário...');
    await executeSQL(`
      UPDATE products
      SET inventory = FLOOR(RANDOM() * 200 + 10)
      WHERE asin IS NOT NULL
    `);
    console.log('✅ Dados de estoque gerados\n');
    
    // 3. Adicionar dados de competidores
    console.log('🏆 Gerando dados de competidores...');
    const competitors = [
      'Fast Seller BR', 'MegaStore', 'Prime Seller', 'Top Products', 'Best Deals BR'
    ];
    
    for (const competitor of competitors) {
      await executeSQL(`
        INSERT INTO competitor_tracking_advanced 
        (asin, buy_box_price, buy_box_seller, our_price, our_has_buy_box, total_offers, fba_offers)
        SELECT 
          asin,
          ROUND((price * (0.9 + RANDOM() * 0.2))::numeric, 2) as buy_box_price,
          $1 as buy_box_seller,
          price as our_price,
          RANDOM() > 0.7 as our_has_buy_box,
          FLOOR(RANDOM() * 10 + 2) as total_offers,
          FLOOR(RANDOM() * 5 + 1) as fba_offers
        FROM products
        WHERE asin IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 20
      `, [competitor]);
    }
    console.log('✅ Dados de competidores gerados\n');
    
    // 4. Gerar insights automáticos
    console.log('🧠 Gerando insights com IA...');
    
    // Insights de restock
    await executeSQL(`
      INSERT INTO ai_insights_advanced 
      (asin, insight_type, priority, title, description, recommendation, confidence_score, potential_impact)
      SELECT 
        p.asin,
        'restock' as insight_type,
        CASE 
          WHEN i.available_quantity < 20 THEN 'critical'
          WHEN i.available_quantity < 50 THEN 'high'
          ELSE 'medium'
        END as priority,
        'Risco de Stockout: ' || p.name as title,
        'Produto com apenas ' || p.inventory || ' unidades. Velocidade: ' || 
          COALESCE(sm.daily_velocity_7d, 5) || ' un/dia.' as description,
        'Enviar ' || GREATEST(100, COALESCE(sm.units_sold_30d, 50) * 2) || 
          ' unidades para FBA imediatamente.' as recommendation,
        0.85 as confidence_score,
        COALESCE(p.price * sm.units_sold_30d * 0.3, 1000) as potential_impact
      FROM products p
      LEFT JOIN sales_metrics sm ON p.asin = sm.asin
      WHERE p.inventory < 100
        AND p.asin IS NOT NULL
      ORDER BY p.inventory ASC
      LIMIT 10
    `);
    
    // Insights de pricing
    await executeSQL(`
      INSERT INTO ai_insights_advanced 
      (asin, insight_type, priority, title, description, recommendation, confidence_score, potential_impact)
      SELECT 
        p.asin,
        'pricing' as insight_type,
        'high' as priority,
        'Otimizar Preço: ' || p.name as title,
        'Buy Box perdido. Competidor ' || ct.buy_box_seller || ' está ' || 
          ABS(ROUND(((p.price - ct.buy_box_price) / p.price * 100)::numeric, 1)) || '% mais barato.' as description,
        'Ajustar preço de R$ ' || p.price || ' para R$ ' || 
          ROUND(ct.buy_box_price * 0.99, 2) || ' para recuperar Buy Box.' as recommendation,
        0.75 as confidence_score,
        COALESCE(sm.revenue_30d * 0.2, 500) as potential_impact
      FROM products p
      JOIN competitor_tracking_advanced ct ON p.asin = ct.asin
      LEFT JOIN sales_metrics sm ON p.asin = sm.asin
      WHERE ct.our_has_buy_box = false
        AND ct.buy_box_price < p.price
        AND p.asin IS NOT NULL
      ORDER BY (p.price - ct.buy_box_price) DESC
      LIMIT 10
    `);
    
    // Insights de novos competidores
    await executeSQL(`
      INSERT INTO ai_insights_advanced 
      (asin, insight_type, priority, title, description, recommendation, confidence_score, potential_impact, competitor_name)
      SELECT DISTINCT
        ct.asin,
        'competitor' as insight_type,
        'medium' as priority,
        'Novo Competidor Detectado' as title,
        'Vendedor ' || ct.buy_box_seller || ' entrou no mercado com preço competitivo.' as description,
        'Monitorar estratégia de preços e ajustar se necessário.' as recommendation,
        0.70 as confidence_score,
        COALESCE(sm.revenue_30d * 0.1, 300) as potential_impact,
        ct.buy_box_seller as competitor_name
      FROM competitor_tracking_advanced ct
      LEFT JOIN sales_metrics sm ON ct.asin = sm.asin
      WHERE ct.timestamp > NOW() - INTERVAL '1 hour'
      LIMIT 5
    `);
    
    console.log('✅ Insights gerados com sucesso\n');
    
    // 5. Gerar previsões de demanda
    console.log('📈 Gerando previsões de demanda...');
    await executeSQL(`
      INSERT INTO demand_forecasts 
      (asin, forecast_date, units_forecast, units_lower_bound, units_upper_bound, 
       recommended_stock_level, reorder_point, confidence_level)
      SELECT 
        p.asin,
        CURRENT_DATE + (interval '1 day' * generate_series(1, 30)) as forecast_date,
        COALESCE(sm.daily_velocity_7d, 5) * (0.8 + RANDOM() * 0.4) as units_forecast,
        COALESCE(sm.daily_velocity_7d, 5) * 0.7 as units_lower_bound,
        COALESCE(sm.daily_velocity_7d, 5) * 1.3 as units_upper_bound,
        COALESCE(sm.units_sold_30d, 100) * 1.5 as recommended_stock_level,
        COALESCE(sm.units_sold_7d, 20) * 3 as reorder_point,
        0.80 + RANDOM() * 0.15 as confidence_level
      FROM products p
      LEFT JOIN sales_metrics sm ON p.asin = sm.asin
      WHERE p.asin IS NOT NULL
      LIMIT 300
    `);
    console.log('✅ Previsões de demanda geradas\n');
    
    // 6. Gerar sugestões de otimização de preços
    console.log('💰 Gerando otimizações de preços...');
    await executeSQL(`
      INSERT INTO price_optimization 
      (asin, current_price, suggested_price, min_price, max_price, 
       expected_profit_change, buy_box_probability, price_elasticity, status, confidence_score)
      SELECT 
        p.asin,
        p.price as current_price,
        CASE 
          WHEN ct.our_has_buy_box = false THEN ROUND(ct.buy_box_price * 0.99, 2)
          ELSE ROUND(p.price * (1 + (RANDOM() * 0.1 - 0.05)), 2)
        END as suggested_price,
        ROUND(p.price * 0.85, 2) as min_price,
        ROUND(p.price * 1.15, 2) as max_price,
        ROUND((RANDOM() * 2000 - 500)::numeric, 2) as expected_profit_change,
        CASE 
          WHEN ct.our_has_buy_box = false THEN 0.75
          ELSE 0.85
        END as buy_box_probability,
        -1.2 - RANDOM() * 0.8 as price_elasticity,
        'pending' as status,
        0.70 + RANDOM() * 0.25 as confidence_score
      FROM products p
      LEFT JOIN LATERAL (
        SELECT * FROM competitor_tracking_advanced 
        WHERE asin = p.asin 
        ORDER BY timestamp DESC 
        LIMIT 1
      ) ct ON true
      WHERE p.asin IS NOT NULL
        AND p.price > 0
      LIMIT 20
    `);
    console.log('✅ Otimizações de preços geradas\n');
    
    // Verificar estatísticas finais
    const stats = await executeSQL(`
      SELECT 
        (SELECT COUNT(*) FROM sales_metrics) as sales_metrics,
        (SELECT COUNT(*) FROM products WHERE inventory > 0) as inventory,
        (SELECT COUNT(*) FROM competitor_tracking_advanced) as competitors,
        (SELECT COUNT(*) FROM ai_insights_advanced) as insights,
        (SELECT COUNT(*) FROM demand_forecasts) as forecasts,
        (SELECT COUNT(*) FROM price_optimization) as price_opts
    `);
    
    console.log('📊 Estatísticas finais:');
    const s = stats.rows[0];
    console.log(`  - Métricas de vendas: ${s.sales_metrics}`);
    console.log(`  - Produtos com estoque atualizado: ${s.inventory}`);
    console.log(`  - Tracking de competidores: ${s.competitors}`);
    console.log(`  - Insights gerados: ${s.insights}`);
    console.log(`  - Previsões de demanda: ${s.forecasts}`);
    console.log(`  - Otimizações de preço: ${s.price_opts}`);
    
    console.log('\n✅ Dados de exemplo gerados com sucesso!');
    console.log('\n🎯 Acesse os dashboards:');
    console.log('- http://localhost:3000/amazon-data - Visualização completa dos dados');
    console.log('- http://localhost:3000/insights - Central de insights com IA');
    console.log('- http://localhost:3000/database - SQL Viewer avançado');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.detail) console.error('Detalhes:', error.detail);
  }
}

generateSampleData();