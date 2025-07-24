const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createAsinSalesViewWithFilters() {
  try {
    console.log('=== CRIANDO VIEW DE VENDAS POR ASIN COM FILTROS DE PERÍODO ===\n');
    
    // Verificar estrutura das tabelas com campos de data
    console.log('Verificando campos de data nas tabelas...');
    
    const checkOrders = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND (column_name LIKE '%date%' OR column_name LIKE '%time%' OR column_name LIKE '%created%')
      ORDER BY ordinal_position
    `);
    
    console.log('Campos de data em orders:', checkOrders.rows);
    
    const checkOrderItems = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' 
      AND (column_name LIKE '%date%' OR column_name LIKE '%time%' OR column_name LIKE '%created%')
      ORDER BY ordinal_position
    `);
    
    console.log('Campos de data em order_items:', checkOrderItems.rows);
    
    // Ver amostra de dados para entender o formato das datas
    console.log('\nAmostra de dados de pedidos:');
    const sampleOrders = await executeSQL('SELECT * FROM orders LIMIT 3');
    console.table(sampleOrders.rows);
    
    // Criar função para filtros de período
    console.log('\nCriando função para filtros de período...');
    
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
    console.log('✅ Função criada com sucesso!');
    
    // Criar views para períodos comuns
    console.log('\nCriando views para períodos específicos...');
    
    // View para hoje
    const viewHoje = `
      CREATE OR REPLACE VIEW vendas_por_asin_hoje AS
      SELECT * FROM get_vendas_por_asin_periodo(CURRENT_DATE, CURRENT_DATE)
    `;
    await executeSQL(viewHoje);
    
    // View para últimos 7 dias
    const viewSemana = `
      CREATE OR REPLACE VIEW vendas_por_asin_7dias AS
      SELECT * FROM get_vendas_por_asin_periodo(CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE)
    `;
    await executeSQL(viewSemana);
    
    // View para últimos 30 dias
    const viewMes = `
      CREATE OR REPLACE VIEW vendas_por_asin_30dias AS
      SELECT * FROM get_vendas_por_asin_periodo(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE)
    `;
    await executeSQL(viewMes);
    
    // View para este mês
    const viewMesAtual = `
      CREATE OR REPLACE VIEW vendas_por_asin_mes_atual AS
      SELECT * FROM get_vendas_por_asin_periodo(DATE_TRUNC('month', CURRENT_DATE)::DATE, CURRENT_DATE)
    `;
    await executeSQL(viewMesAtual);
    
    console.log('✅ Views de período criadas!');
    
    // Testar as views
    console.log('\n=== TESTANDO VIEWS DE PERÍODO ===');
    
    // Últimos 30 dias
    const vendas30dias = await executeSQL('SELECT * FROM vendas_por_asin_30dias LIMIT 10');
    console.log('\nTop 10 produtos - Últimos 30 dias:');
    console.table(vendas30dias.rows.map(row => ({
      ASIN: row.asin,
      Produto: row.product_name ? row.product_name.substring(0, 40) + '...' : 'N/A',
      'Total Vendas': row.total_vendas,
      'Total Pedidos': row.total_pedidos,
      'Primeiro Pedido': row.primeiro_pedido ? new Date(row.primeiro_pedido).toLocaleDateString('pt-BR') : 'N/A',
      'Último Pedido': row.ultimo_pedido ? new Date(row.ultimo_pedido).toLocaleDateString('pt-BR') : 'N/A'
    })));
    
    // Estatísticas por período
    const stats30dias = await executeSQL(`
      SELECT 
        COUNT(*) as total_asins,
        SUM(total_vendas) as vendas_totais,
        AVG(total_vendas) as media_vendas_por_asin
      FROM vendas_por_asin_30dias
      WHERE total_vendas > 0
    `);
    
    console.log('\nEstatísticas dos últimos 30 dias:');
    console.log('ASINs com vendas:', stats30dias.rows[0].total_asins);
    console.log('Total de vendas:', stats30dias.rows[0].vendas_totais);
    console.log('Média por ASIN:', parseFloat(stats30dias.rows[0].media_vendas_por_asin || 0).toFixed(2));
    
    console.log('\n=== QUERIES PARA USAR NO DATABASE VIEWER ===');
    console.log('\n1. Hoje:');
    console.log('SELECT * FROM vendas_por_asin_hoje ORDER BY total_vendas DESC LIMIT 50');
    
    console.log('\n2. Últimos 7 dias:');
    console.log('SELECT * FROM vendas_por_asin_7dias ORDER BY total_vendas DESC LIMIT 50');
    
    console.log('\n3. Últimos 30 dias:');
    console.log('SELECT * FROM vendas_por_asin_30dias ORDER BY total_vendas DESC LIMIT 50');
    
    console.log('\n4. Mês atual:');
    console.log('SELECT * FROM vendas_por_asin_mes_atual ORDER BY total_vendas DESC LIMIT 50');
    
    console.log('\n5. Período personalizado (exemplo: Janeiro 2024):');
    console.log("SELECT * FROM get_vendas_por_asin_periodo('2024-01-01', '2024-01-31') LIMIT 50");
    
    console.log('\n6. Últimos 90 dias:');
    console.log("SELECT * FROM get_vendas_por_asin_periodo(CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE) LIMIT 50");
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

createAsinSalesViewWithFilters();