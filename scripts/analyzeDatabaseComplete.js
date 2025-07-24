const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function analyzeDatabaseComplete() {
  console.log('=== ANÁLISE COMPLETA DO BANCO DE DADOS ===\n');
  console.log(`Data: ${new Date().toLocaleString('pt-BR')}\n`);
  
  try {
    // 1. RESUMO GERAL
    console.log('📊 RESUMO GERAL DO BANCO:');
    console.log('━'.repeat(50));
    
    const summary = await executeSQL(`
      SELECT 
        'orders' as tabela, COUNT(*) as total FROM orders
      UNION ALL
      SELECT 'products', COUNT(*) FROM products
      UNION ALL
      SELECT 'order_items', COUNT(*) FROM order_items
      UNION ALL
      SELECT 'users', COUNT(*) FROM users
      UNION ALL
      SELECT 'marketplace_credentials', COUNT(*) FROM marketplace_credentials
      UNION ALL
      SELECT 'notifications', COUNT(*) FROM notifications
      UNION ALL
      SELECT 'product_page_views', COUNT(*) FROM product_page_views
      UNION ALL
      SELECT 'traffic_metrics', COUNT(*) FROM traffic_metrics
      ORDER BY tabela
    `);
    
    console.log('\nTabela                  | Registros');
    console.log('------------------------|----------');
    summary.rows.forEach(row => {
      console.log(`${row.tabela.padEnd(23)} | ${row.total}`);
    });
    
    // 2. ANÁLISE DE PEDIDOS
    console.log('\n\n📦 ANÁLISE DETALHADA DE PEDIDOS:');
    console.log('━'.repeat(50));
    
    // Pedidos por marketplace
    const ordersByMarketplace = await executeSQL(`
      SELECT 
        marketplace,
        COUNT(*) as total_pedidos,
        SUM(total) as valor_total,
        AVG(total) as ticket_medio,
        MIN(order_date) as primeiro_pedido,
        MAX(order_date) as ultimo_pedido
      FROM orders
      GROUP BY marketplace
      ORDER BY total_pedidos DESC
    `);
    
    console.log('\nPedidos por Marketplace:');
    ordersByMarketplace.rows.forEach(row => {
      console.log(`\n🛒 ${row.marketplace.toUpperCase()}`);
      console.log(`   Total de pedidos: ${row.total_pedidos}`);
      console.log(`   Valor total: R$ ${parseFloat(row.valor_total || 0).toFixed(2)}`);
      console.log(`   Ticket médio: R$ ${parseFloat(row.ticket_medio || 0).toFixed(2)}`);
      console.log(`   Primeiro pedido: ${row.primeiro_pedido ? new Date(row.primeiro_pedido).toLocaleDateString('pt-BR') : 'N/A'}`);
      console.log(`   Último pedido: ${row.ultimo_pedido ? new Date(row.ultimo_pedido).toLocaleDateString('pt-BR') : 'N/A'}`);
    });
    
    // Status dos pedidos
    const ordersByStatus = await executeSQL(`
      SELECT 
        status,
        COUNT(*) as total,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 2) as percentual
      FROM orders
      GROUP BY status
      ORDER BY total DESC
    `);
    
    console.log('\n\n📊 Distribuição por Status:');
    ordersByStatus.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.total} pedidos (${row.percentual}%)`);
    });
    
    // Pedidos por data
    const ordersByDate = await executeSQL(`
      SELECT 
        DATE(order_date) as data,
        COUNT(*) as pedidos,
        SUM(total) as valor_total
      FROM orders
      WHERE order_date IS NOT NULL
      GROUP BY DATE(order_date)
      ORDER BY data DESC
      LIMIT 10
    `);
    
    console.log('\n\n📅 Últimos 10 dias com pedidos:');
    console.log('Data       | Pedidos | Valor Total');
    console.log('-----------|---------|------------');
    ordersByDate.rows.forEach(row => {
      const data = row.data ? new Date(row.data).toLocaleDateString('pt-BR') : 'N/A';
      console.log(`${data} | ${String(row.pedidos).padStart(7)} | R$ ${parseFloat(row.valor_total || 0).toFixed(2)}`);
    });
    
    // 3. ANÁLISE DE PRODUTOS
    console.log('\n\n📦 ANÁLISE DETALHADA DE PRODUTOS:');
    console.log('━'.repeat(50));
    
    // Produtos por marketplace
    const productsByMarketplace = await executeSQL(`
      SELECT 
        marketplace,
        COUNT(*) as total_produtos,
        COUNT(DISTINCT sku) as skus_unicos,
        AVG(price) as preco_medio,
        SUM(inventory) as estoque_total
      FROM products
      GROUP BY marketplace
    `);
    
    console.log('\nProdutos por Marketplace:');
    productsByMarketplace.rows.forEach(row => {
      console.log(`\n📦 ${row.marketplace.toUpperCase()}`);
      console.log(`   Total de produtos: ${row.total_produtos}`);
      console.log(`   SKUs únicos: ${row.skus_unicos}`);
      console.log(`   Preço médio: R$ ${parseFloat(row.preco_medio || 0).toFixed(2)}`);
      console.log(`   Estoque total: ${row.estoque_total || 0} unidades`);
    });
    
    // Top 10 produtos mais vendidos
    console.log('\n\n🏆 TOP 10 PRODUTOS MAIS VENDIDOS:');
    const topProducts = await executeSQL(`
      SELECT 
        p.name,
        p.sku,
        p.price,
        COUNT(DISTINCT oi.order_id) as pedidos,
        SUM(oi.quantity) as unidades_vendidas,
        SUM(oi.unit_price * oi.quantity) as receita_total
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      GROUP BY p.id, p.name, p.sku, p.price
      ORDER BY unidades_vendidas DESC
      LIMIT 10
    `);
    
    if (topProducts.rows.length > 0) {
      console.log('\nProduto | SKU | Preço | Pedidos | Unidades | Receita');
      console.log('--------|-----|-------|---------|----------|--------');
      topProducts.rows.forEach(row => {
        const nome = row.name ? row.name.substring(0, 30) + '...' : 'N/A';
        console.log(`${nome} | ${row.sku || 'N/A'} | R$ ${row.price || 0} | ${row.pedidos} | ${row.unidades_vendidas} | R$ ${parseFloat(row.receita_total || 0).toFixed(2)}`);
      });
    } else {
      console.log('Nenhuma venda registrada ainda.');
    }
    
    // 4. ANÁLISE DE USUÁRIOS
    console.log('\n\n👥 ANÁLISE DE USUÁRIOS:');
    console.log('━'.repeat(50));
    
    const users = await executeSQL(`
      SELECT 
        id,
        name,
        email,
        created_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as total_pedidos,
        (SELECT COUNT(*) FROM products WHERE user_id = users.id) as total_produtos
      FROM users
      ORDER BY id
    `);
    
    console.log('\nUsuários cadastrados:');
    users.rows.forEach(user => {
      console.log(`\n👤 ${user.name} (ID: ${user.id})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Cadastrado em: ${new Date(user.created_at).toLocaleDateString('pt-BR')}`);
      console.log(`   Total de pedidos: ${user.total_pedidos}`);
      console.log(`   Total de produtos: ${user.total_produtos}`);
    });
    
    // 5. ANÁLISE DE CREDENCIAIS
    console.log('\n\n🔑 CREDENCIAIS CONFIGURADAS:');
    console.log('━'.repeat(50));
    
    const credentials = await executeSQL(`
      SELECT 
        marketplace,
        user_id,
        CASE WHEN refresh_token IS NOT NULL THEN '✅ Configurado' ELSE '❌ Não configurado' END as refresh_token_status,
        CASE WHEN access_token IS NOT NULL THEN '✅ Presente' ELSE '❌ Ausente' END as access_token_status,
        created_at,
        updated_at
      FROM marketplace_credentials
    `);
    
    credentials.rows.forEach(cred => {
      console.log(`\n${cred.marketplace.toUpperCase()}`);
      console.log(`   Usuário: ${cred.user_id}`);
      console.log(`   Refresh Token: ${cred.refresh_token_status}`);
      console.log(`   Access Token: ${cred.access_token_status}`);
      console.log(`   Última atualização: ${cred.updated_at ? new Date(cred.updated_at).toLocaleString('pt-BR') : 'Nunca'}`);
    });
    
    // 6. MÉTRICAS DE NEGÓCIO
    console.log('\n\n💰 MÉTRICAS DE NEGÓCIO:');
    console.log('━'.repeat(50));
    
    const businessMetrics = await executeSQL(`
      SELECT 
        COUNT(DISTINCT DATE(order_date)) as dias_com_vendas,
        SUM(total) as receita_total,
        AVG(total) as ticket_medio_geral,
        COUNT(DISTINCT buyer_email) as clientes_unicos,
        COUNT(*) as total_pedidos
      FROM orders
      WHERE order_date IS NOT NULL
    `);
    
    const metrics = businessMetrics.rows[0];
    console.log(`\n📈 Métricas Gerais:`);
    console.log(`   Receita Total: R$ ${parseFloat(metrics.receita_total || 0).toFixed(2)}`);
    console.log(`   Total de Pedidos: ${metrics.total_pedidos}`);
    console.log(`   Ticket Médio: R$ ${parseFloat(metrics.ticket_medio_geral || 0).toFixed(2)}`);
    console.log(`   Clientes Únicos: ${metrics.clientes_unicos}`);
    console.log(`   Dias com Vendas: ${metrics.dias_com_vendas}`);
    
    // Taxa de conversão se houver dados de tráfego
    const trafficData = await executeSQL(`SELECT COUNT(*) as views FROM product_page_views`);
    if (trafficData.rows[0].views > 0) {
      const conversionRate = (metrics.total_pedidos / trafficData.rows[0].views * 100).toFixed(2);
      console.log(`   Taxa de Conversão: ${conversionRate}%`);
    }
    
    // 7. ÚLTIMAS ATIVIDADES
    console.log('\n\n🕐 ÚLTIMAS ATIVIDADES:');
    console.log('━'.repeat(50));
    
    // Últimos pedidos
    const lastOrders = await executeSQL(`
      SELECT 
        marketplace_order_id,
        marketplace,
        total,
        status,
        created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('\nÚltimos 5 pedidos:');
    lastOrders.rows.forEach(order => {
      const data = new Date(order.created_at).toLocaleString('pt-BR');
      console.log(`   ${order.marketplace_order_id} | ${order.marketplace} | R$ ${order.total} | ${order.status} | ${data}`);
    });
    
    // Produtos recém adicionados
    const lastProducts = await executeSQL(`
      SELECT 
        name,
        sku,
        marketplace,
        created_at
      FROM products
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('\n\nÚltimos 5 produtos adicionados:');
    lastProducts.rows.forEach(product => {
      const data = new Date(product.created_at).toLocaleString('pt-BR');
      const nome = product.name ? product.name.substring(0, 40) + '...' : 'N/A';
      console.log(`   ${nome} | ${product.sku} | ${product.marketplace} | ${data}`);
    });
    
    console.log('\n\n✅ Análise completa finalizada!');
    
  } catch (error) {
    console.error('❌ Erro ao analisar banco:', error.message);
  }
}

// Executar análise
analyzeDatabaseComplete();