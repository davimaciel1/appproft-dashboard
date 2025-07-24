const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkAmazonData() {
  console.log('=== ANÁLISE DOS DADOS DA AMAZON NO BANCO ===\n');
  
  try {
    // 1. Verificar estrutura da tabela orders
    console.log('📦 ESTRUTURA DA TABELA ORDERS:');
    const ordersStructure = await executeSQL(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nColunas da tabela orders:');
    ordersStructure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // 2. Verificar estrutura da tabela products
    console.log('\n\n📦 ESTRUTURA DA TABELA PRODUCTS:');
    const productsStructure = await executeSQL(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nColunas da tabela products:');
    productsStructure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // 3. Contar pedidos da Amazon
    console.log('\n\n📊 DADOS DA AMAZON - ORDERS:');
    const amazonOrdersCount = await executeSQL(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(DISTINCT CASE WHEN marketplace = 'amazon' THEN id END) as amazon_orders,
        COUNT(DISTINCT CASE WHEN marketplace = 'mercadolivre' THEN id END) as ml_orders
      FROM orders
    `);
    
    const counts = amazonOrdersCount.rows[0];
    console.log(`Total de pedidos: ${counts.total_orders}`);
    console.log(`Pedidos Amazon: ${counts.amazon_orders}`);
    console.log(`Pedidos Mercado Livre: ${counts.ml_orders}`);
    
    // 4. Últimos pedidos da Amazon
    console.log('\n\n📅 ÚLTIMOS PEDIDOS DA AMAZON:');
    const recentOrders = await executeSQL(`
      SELECT 
        id,
        marketplace_order_id,
        marketplace,
        status,
        total,
        created_at,
        updated_at,
        buyer_name,
        items_count
      FROM orders 
      WHERE marketplace = 'amazon'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (recentOrders.rows.length > 0) {
      console.log('\nID | Order ID | Status | Total | Data');
      console.log('---|----------|--------|-------|-----');
      recentOrders.rows.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('pt-BR');
        console.log(`${order.id} | ${order.marketplace_order_id} | ${order.status} | R$ ${order.total || 0} | ${date}`);
      });
    } else {
      console.log('Nenhum pedido da Amazon encontrado.');
    }
    
    // 5. Produtos da Amazon
    console.log('\n\n📦 PRODUTOS DA AMAZON:');
    const amazonProducts = await executeSQL(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(DISTINCT CASE WHEN marketplace = 'amazon' THEN id END) as amazon_products,
        COUNT(DISTINCT CASE WHEN marketplace = 'mercadolivre' THEN id END) as ml_products
      FROM products
    `);
    
    const productCounts = amazonProducts.rows[0];
    console.log(`Total de produtos: ${productCounts.total_products}`);
    console.log(`Produtos Amazon: ${productCounts.amazon_products}`);
    console.log(`Produtos Mercado Livre: ${productCounts.ml_products}`);
    
    // 6. Alguns produtos da Amazon
    console.log('\n\n📋 EXEMPLOS DE PRODUTOS DA AMAZON:');
    const sampleProducts = await executeSQL(`
      SELECT 
        id,
        asin,
        sku,
        name,
        price,
        inventory,
        marketplace,
        created_at
      FROM products 
      WHERE marketplace = 'amazon'
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (sampleProducts.rows.length > 0) {
      console.log('\nID | ASIN | SKU | Nome | Preço | Estoque');
      console.log('---|------|-----|------|-------|--------');
      sampleProducts.rows.forEach(product => {
        const name = product.name ? product.name.substring(0, 30) + '...' : 'N/A';
        console.log(`${product.id} | ${product.asin || 'N/A'} | ${product.sku || 'N/A'} | ${name} | R$ ${product.price || 0} | ${product.inventory || 0}`);
      });
    } else {
      console.log('Nenhum produto da Amazon encontrado.');
    }
    
    // 7. Estatísticas gerais
    console.log('\n\n📈 ESTATÍSTICAS GERAIS DA AMAZON:');
    const stats = await executeSQL(`
      SELECT 
        'orders' as tipo,
        COUNT(*) as quantidade,
        MIN(created_at) as primeira_data,
        MAX(created_at) as ultima_data
      FROM orders 
      WHERE marketplace = 'amazon'
      UNION ALL
      SELECT 
        'products' as tipo,
        COUNT(*) as quantidade,
        MIN(created_at) as primeira_data,
        MAX(created_at) as ultima_data
      FROM products 
      WHERE marketplace = 'amazon'
    `);
    
    console.log('\nTipo | Quantidade | Primeira Data | Última Data');
    console.log('-----|------------|---------------|-------------');
    stats.rows.forEach(stat => {
      const firstDate = stat.primeira_data ? new Date(stat.primeira_data).toLocaleDateString('pt-BR') : 'N/A';
      const lastDate = stat.ultima_data ? new Date(stat.ultima_data).toLocaleDateString('pt-BR') : 'N/A';
      console.log(`${stat.tipo} | ${stat.quantidade} | ${firstDate} | ${lastDate}`);
    });
    
    // 8. Verificar credenciais da Amazon
    console.log('\n\n🔑 CREDENCIAIS DA AMAZON:');
    const credentials = await executeSQL(`
      SELECT 
        id,
        user_id,
        marketplace,
        created_at,
        updated_at
      FROM marketplace_credentials 
      WHERE marketplace = 'amazon'
    `);
    
    if (credentials.rows.length > 0) {
      console.log('\nCredenciais da Amazon encontradas:');
      credentials.rows.forEach(cred => {
        console.log(`- ID: ${cred.id}, User: ${cred.user_id}, Marketplace: ${cred.marketplace}, Criado em: ${new Date(cred.created_at).toLocaleDateString('pt-BR')}`);
      });
    } else {
      console.log('Nenhuma credencial da Amazon configurada.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error.message);
  }
}

// Executar a verificação
checkAmazonData();