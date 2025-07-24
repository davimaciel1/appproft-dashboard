const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function fixAsinSalesViewWithFilters() {
  try {
    console.log('=== CORRIGINDO VIEW DE VENDAS POR ASIN COM FILTROS ===\n');
    
    // Criar função corrigida para filtros de período
    console.log('Criando função corrigida para filtros de período...');
    
    const createFunctionQuery = `
      CREATE OR REPLACE FUNCTION get_vendas_por_asin_periodo(
        periodo_inicio DATE DEFAULT NULL,
        periodo_fim DATE DEFAULT NULL
      )
      RETURNS TABLE (
        asin VARCHAR,
        image_url TEXT,
        product_name VARCHAR,
        total_vendas BIGINT,
        total_pedidos BIGINT,
        marketplace VARCHAR,
        country_code VARCHAR,
        primeiro_pedido TIMESTAMP,
        ultimo_pedido TIMESTAMP
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          p.asin,
          p.image_url,
          p.name as product_name,
          COALESCE(SUM(oi.quantity), 0) as total_vendas,
          COUNT(DISTINCT oi.order_id) as total_pedidos,
          p.marketplace,
          p.country_code,
          MIN(o.order_date) as primeiro_pedido,
          MAX(o.order_date) as ultimo_pedido
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id
        WHERE p.asin IS NOT NULL 
        AND p.asin != ''
        AND (periodo_inicio IS NULL OR DATE(o.order_date) >= periodo_inicio)
        AND (periodo_fim IS NULL OR DATE(o.order_date) <= periodo_fim)
        GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
        ORDER BY total_vendas DESC;
      END;
      $$;
    `;
    
    await executeSQL(createFunctionQuery);
    console.log('✅ Função corrigida criada!');
    
    // Criar views para períodos específicos com casting correto
    console.log('\nCriando views para períodos específicos...');
    
    // View para hoje
    const viewHoje = `
      CREATE OR REPLACE VIEW vendas_por_asin_hoje AS
      SELECT * FROM get_vendas_por_asin_periodo(CURRENT_DATE::DATE, CURRENT_DATE::DATE)
    `;
    await executeSQL(viewHoje);
    console.log('✅ View hoje criada');
    
    // View para últimos 7 dias
    const viewSemana = `
      CREATE OR REPLACE VIEW vendas_por_asin_7dias AS
      SELECT * FROM get_vendas_por_asin_periodo((CURRENT_DATE - INTERVAL '7 days')::DATE, CURRENT_DATE::DATE)
    `;
    await executeSQL(viewSemana);
    console.log('✅ View 7 dias criada');
    
    // View para últimos 30 dias
    const viewMes = `
      CREATE OR REPLACE VIEW vendas_por_asin_30dias AS
      SELECT * FROM get_vendas_por_asin_periodo((CURRENT_DATE - INTERVAL '30 days')::DATE, CURRENT_DATE::DATE)
    `;
    await executeSQL(viewMes);
    console.log('✅ View 30 dias criada');
    
    // View para este mês
    const viewMesAtual = `
      CREATE OR REPLACE VIEW vendas_por_asin_mes_atual AS
      SELECT * FROM get_vendas_por_asin_periodo(DATE_TRUNC('month', CURRENT_DATE)::DATE, CURRENT_DATE::DATE)
    `;
    await executeSQL(viewMesAtual);
    console.log('✅ View mês atual criada');
    
    // Testar as views
    console.log('\n=== TESTANDO VIEWS DE PERÍODO ===');
    
    // Hoje
    const vendasHoje = await executeSQL('SELECT COUNT(*) as total FROM vendas_por_asin_hoje WHERE total_vendas > 0');
    console.log(`Produtos com vendas hoje: ${vendasHoje.rows[0].total}`);
    
    // Últimos 7 dias
    const vendas7dias = await executeSQL('SELECT COUNT(*) as total, SUM(total_vendas) as vendas FROM vendas_por_asin_7dias WHERE total_vendas > 0');
    console.log(`Últimos 7 dias: ${vendas7dias.rows[0].total} produtos, ${vendas7dias.rows[0].vendas} vendas`);
    
    // Últimos 30 dias
    const vendas30dias = await executeSQL('SELECT COUNT(*) as total, SUM(total_vendas) as vendas FROM vendas_por_asin_30dias WHERE total_vendas > 0');
    console.log(`Últimos 30 dias: ${vendas30dias.rows[0].total} produtos, ${vendas30dias.rows[0].vendas} vendas`);
    
    // Top 5 dos últimos 30 dias
    const top30dias = await executeSQL('SELECT * FROM vendas_por_asin_30dias WHERE total_vendas > 0 LIMIT 5');
    console.log('\nTop 5 produtos - Últimos 30 dias:');
    console.table(top30dias.rows.map(row => ({
      ASIN: row.asin,
      Produto: row.product_name ? row.product_name.substring(0, 40) + '...' : 'N/A',
      'Vendas': row.total_vendas,
      'Pedidos': row.total_pedidos,
      'Período': `${new Date(row.primeiro_pedido).toLocaleDateString('pt-BR')} - ${new Date(row.ultimo_pedido).toLocaleDateString('pt-BR')}`
    })));
    
    console.log('\n=== QUERIES PARA DATABASE VIEWER ===');
    console.log('\n🕐 HOJE:');
    console.log('SELECT * FROM vendas_por_asin_hoje WHERE total_vendas > 0 ORDER BY total_vendas DESC');
    
    console.log('\n📅 ÚLTIMOS 7 DIAS:');
    console.log('SELECT * FROM vendas_por_asin_7dias WHERE total_vendas > 0 ORDER BY total_vendas DESC LIMIT 50');
    
    console.log('\n📊 ÚLTIMOS 30 DIAS:');
    console.log('SELECT * FROM vendas_por_asin_30dias WHERE total_vendas > 0 ORDER BY total_vendas DESC LIMIT 50');
    
    console.log('\n🗓️ MÊS ATUAL:');
    console.log('SELECT * FROM vendas_por_asin_mes_atual WHERE total_vendas > 0 ORDER BY total_vendas DESC LIMIT 50');
    
    console.log('\n⚡ PERÍODO PERSONALIZADO:');
    console.log("-- Julho 2023 (onde há mais dados):");
    console.log("SELECT * FROM get_vendas_por_asin_periodo('2023-07-01', '2023-07-31') WHERE total_vendas > 0 LIMIT 50");
    
    console.log('\n-- Últimos 90 dias:');
    console.log("SELECT * FROM get_vendas_por_asin_periodo((CURRENT_DATE - INTERVAL '90 days')::DATE, CURRENT_DATE::DATE) WHERE total_vendas > 0 LIMIT 50");
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

fixAsinSalesViewWithFilters();