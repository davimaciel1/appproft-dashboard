require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function generateSimpleDemoData() {
  console.log('🎯 Gerando dados de demonstração simplificados...\n');
  
  try {
    // Verificar conexão
    await executeSQL('SELECT 1');
    console.log('✅ Conexão com PostgreSQL OK\n');
    
    // 1. Atualizar estoque dos produtos
    console.log('📦 Atualizando estoque dos produtos...');
    await executeSQL(`
      UPDATE products
      SET inventory = FLOOR(RANDOM() * 200 + 10),
          buy_box_percentage = ROUND((RANDOM() * 100)::numeric, 2)
      WHERE asin IS NOT NULL
    `);
    console.log('✅ Estoque atualizado\n');
    
    // 2. Adicionar dados de competidores com nomes brasileiros
    console.log('🏆 Gerando dados de competidores...');
    const brazilianSellers = [
      'Fast Commerce BR', 'MegaStore Brasil', 'Prime Vendas', 
      'Top Produtos BR', 'Super Deals', 'Loja Premium',
      'Express Shop BR', 'Best Price Store'
    ];
    
    // Limpar dados antigos
    await executeSQL('DELETE FROM competitor_tracking_advanced');
    
    // Inserir novos dados
    for (let i = 0; i < 5; i++) {
      const seller = brazilianSellers[i];
      await executeSQL(`
        INSERT INTO competitor_tracking_advanced 
        (asin, tenant_id, buy_box_price, buy_box_seller, our_price, our_has_buy_box, 
         total_offers, fba_offers, fbm_offers, lowest_fba_price, lowest_fbm_price)
        SELECT 
          asin,
          1 as tenant_id,
          ROUND((price * (0.85 + RANDOM() * 0.3))::numeric, 2) as buy_box_price,
          $1 as buy_box_seller,
          price as our_price,
          CASE WHEN RANDOM() > 0.6 THEN true ELSE false END as our_has_buy_box,
          FLOOR(RANDOM() * 15 + 3)::integer as total_offers,
          FLOOR(RANDOM() * 10 + 1)::integer as fba_offers,
          FLOOR(RANDOM() * 5 + 1)::integer as fbm_offers,
          ROUND((price * (0.80 + RANDOM() * 0.3))::numeric, 2) as lowest_fba_price,
          ROUND((price * (0.75 + RANDOM() * 0.35))::numeric, 2) as lowest_fbm_price
        FROM products
        WHERE asin IS NOT NULL
          AND price > 0
        ORDER BY RANDOM()
        LIMIT 15
      `, [seller]);
    }
    console.log('✅ Dados de competidores gerados\n');
    
    // 3. Gerar insights básicos
    console.log('🧠 Gerando insights com IA...');
    
    // Limpar insights antigos
    await executeSQL('DELETE FROM ai_insights_advanced');
    
    // Insights de estoque baixo
    await executeSQL(`
      INSERT INTO ai_insights_advanced 
      (asin, insight_type, priority, title, description, recommendation, 
       confidence_score, potential_impact, status)
      SELECT 
        asin,
        'restock' as insight_type,
        CASE 
          WHEN inventory < 20 THEN 'critical'
          WHEN inventory < 50 THEN 'high'
          ELSE 'medium'
        END as priority,
        'Alerta de Estoque: ' || LEFT(name, 150) as title,
        'Produto com apenas ' || inventory || ' unidades em estoque.' as description,
        'Enviar ' || GREATEST(100, inventory * 3) || ' unidades para o centro de distribuição.' as recommendation,
        0.85 as confidence_score,
        ROUND((price * 100)::numeric, 2) as potential_impact,
        'pending' as status
      FROM products
      WHERE inventory < 100
        AND asin IS NOT NULL
        AND active = true
      ORDER BY inventory ASC
      LIMIT 10
    `);
    
    // Insights de preço
    await executeSQL(`
      INSERT INTO ai_insights_advanced 
      (asin, insight_type, priority, title, description, recommendation, 
       confidence_score, potential_impact, status, competitor_name)
      SELECT 
        p.asin,
        'pricing' as insight_type,
        'high' as priority,
        'Oportunidade de Preço: ' || LEFT(p.name, 130) as title,
        'Competidor ' || ct.buy_box_seller || ' tem o Buy Box com preço ' || 
          ABS(ROUND(((p.price - ct.buy_box_price) / p.price * 100)::numeric, 1)) || '% menor.' as description,
        'Considere ajustar o preço de R$ ' || p.price || ' para R$ ' || 
          ROUND(ct.buy_box_price * 0.98, 2) || ' para competir pelo Buy Box.' as recommendation,
        0.75 as confidence_score,
        ROUND((p.price * 50)::numeric, 2) as potential_impact,
        'pending' as status,
        ct.buy_box_seller as competitor_name
      FROM products p
      JOIN competitor_tracking_advanced ct ON p.asin = ct.asin
      WHERE ct.our_has_buy_box = false
        AND ct.buy_box_price < p.price
        AND p.active = true
      ORDER BY (p.price - ct.buy_box_price) DESC
      LIMIT 10
    `);
    
    // Insights de novos competidores
    await executeSQL(`
      INSERT INTO ai_insights_advanced 
      (asin, insight_type, priority, title, description, recommendation, 
       confidence_score, potential_impact, status, competitor_name)
      SELECT DISTINCT ON (ct.buy_box_seller)
        ct.asin,
        'competitor' as insight_type,
        'medium' as priority,
        'Novo Competidor: ' || ct.buy_box_seller as title,
        'Vendedor ' || ct.buy_box_seller || ' está competindo em ' || 
          COUNT(*) OVER (PARTITION BY ct.buy_box_seller) || ' dos seus produtos.' as description,
        'Monitore a estratégia de preços deste competidor e ajuste conforme necessário.' as recommendation,
        0.70 as confidence_score,
        ROUND((AVG(p.price) OVER (PARTITION BY ct.buy_box_seller) * 20)::numeric, 2) as potential_impact,
        'pending' as status,
        ct.buy_box_seller as competitor_name
      FROM competitor_tracking_advanced ct
      JOIN products p ON ct.asin = p.asin
      WHERE ct.timestamp > NOW() - INTERVAL '1 day'
      ORDER BY ct.buy_box_seller, ct.timestamp DESC
      LIMIT 5
    `);
    
    console.log('✅ Insights gerados com sucesso\n');
    
    // 4. Gerar previsões simples
    console.log('📈 Gerando previsões de demanda...');
    
    // Limpar previsões antigas
    await executeSQL('DELETE FROM demand_forecasts');
    
    // Gerar previsões para próximos 30 dias
    await executeSQL(`
      INSERT INTO demand_forecasts 
      (asin, forecast_date, units_forecast, units_lower_bound, units_upper_bound,
       recommended_stock_level, reorder_point, confidence_level, model_name)
      SELECT 
        p.asin,
        CURRENT_DATE + (interval '1 day' * s.day_offset) as forecast_date,
        FLOOR(5 + RANDOM() * 20 + (30 - s.day_offset) * 0.5) as units_forecast,
        FLOOR(3 + RANDOM() * 15 + (30 - s.day_offset) * 0.3) as units_lower_bound,
        FLOOR(7 + RANDOM() * 25 + (30 - s.day_offset) * 0.7) as units_upper_bound,
        GREATEST(100, p.inventory * 2) as recommended_stock_level,
        GREATEST(50, p.inventory) as reorder_point,
        0.85 as confidence_level,
        'prophet_v1' as model_name
      FROM products p
      CROSS JOIN generate_series(1, 30) as s(day_offset)
      WHERE p.asin IS NOT NULL
        AND p.active = true
      ORDER BY p.asin, s.day_offset
      LIMIT 500
    `);
    
    console.log('✅ Previsões de demanda geradas\n');
    
    // 5. Gerar otimizações de preço
    console.log('💰 Gerando otimizações de preço...');
    
    // Limpar otimizações antigas
    await executeSQL('DELETE FROM price_optimization');
    
    await executeSQL(`
      INSERT INTO price_optimization 
      (asin, current_price, suggested_price, min_price, max_price,
       expected_profit_change, buy_box_probability, price_elasticity,
       competitor_avg_price, status, confidence_score, model_name)
      SELECT 
        p.asin,
        p.price as current_price,
        CASE 
          WHEN ct.our_has_buy_box = false AND ct.buy_box_price < p.price 
          THEN ROUND(ct.buy_box_price * 0.99, 2)
          ELSE ROUND(p.price * (1 + (RANDOM() * 0.1 - 0.05)), 2)
        END as suggested_price,
        ROUND(p.price * 0.85, 2) as min_price,
        ROUND(p.price * 1.15, 2) as max_price,
        ROUND((RANDOM() * 1000 - 200)::numeric, 2) as expected_profit_change,
        CASE 
          WHEN ct.our_has_buy_box = true THEN ROUND((0.85 + RANDOM() * 0.1)::numeric, 2)
          ELSE ROUND((0.60 + RANDOM() * 0.25)::numeric, 2)
        END as buy_box_probability,
        ROUND((-1.5 + RANDOM() * 0.7)::numeric, 2) as price_elasticity,
        ct.buy_box_price as competitor_avg_price,
        'pending' as status,
        ROUND((0.70 + RANDOM() * 0.25)::numeric, 2) as confidence_score,
        'elasticity_model_v1' as model_name
      FROM products p
      LEFT JOIN LATERAL (
        SELECT * FROM competitor_tracking_advanced 
        WHERE asin = p.asin 
        ORDER BY timestamp DESC 
        LIMIT 1
      ) ct ON true
      WHERE p.asin IS NOT NULL
        AND p.price > 0
        AND p.active = true
      LIMIT 30
    `);
    
    console.log('✅ Otimizações de preço geradas\n');
    
    // Verificar estatísticas finais
    const stats = await executeSQL(`
      SELECT 
        (SELECT COUNT(*) FROM products WHERE inventory > 0) as products_with_stock,
        (SELECT COUNT(*) FROM competitor_tracking_advanced) as competitor_data,
        (SELECT COUNT(*) FROM ai_insights_advanced WHERE status = 'pending') as pending_insights,
        (SELECT COUNT(*) FROM demand_forecasts) as forecasts,
        (SELECT COUNT(*) FROM price_optimization WHERE status = 'pending') as price_optimizations
    `);
    
    console.log('📊 Dados gerados com sucesso:');
    const s = stats.rows[0];
    console.log(`  ✓ Produtos com estoque: ${s.products_with_stock}`);
    console.log(`  ✓ Dados de competidores: ${s.competitor_data}`);
    console.log(`  ✓ Insights pendentes: ${s.pending_insights}`);
    console.log(`  ✓ Previsões de demanda: ${s.forecasts}`);
    console.log(`  ✓ Otimizações de preço: ${s.price_optimizations}`);
    
    console.log('\n✅ Demonstração pronta!');
    console.log('\n🎯 Acesse os dashboards para visualizar:');
    console.log('');
    console.log('📊 Dashboard de Dados Amazon:');
    console.log('   http://localhost:3000/amazon-data');
    console.log('   - Veja métricas consolidadas');
    console.log('   - Analise competidores e Buy Box');
    console.log('   - Visualize previsões de demanda');
    console.log('');
    console.log('🧠 Central de Insights com IA:');
    console.log('   http://localhost:3000/insights');
    console.log('   - Recomendações de restock');
    console.log('   - Oportunidades de pricing');
    console.log('   - Alertas de competidores');
    console.log('');
    console.log('🗄️ Database Viewer Avançado:');
    console.log('   http://localhost:3000/database');
    console.log('   - Execute queries SQL customizadas');
    console.log('   - Use filtros inteligentes');
    console.log('   - Explore todas as tabelas');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.detail) console.error('Detalhes:', error.detail);
  }
}

generateSimpleDemoData();