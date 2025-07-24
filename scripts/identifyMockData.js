const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function identifyMockData() {
  console.log('=== IDENTIFICAÇÃO DE DADOS MOCKADOS ===\n');
  console.log('⚠️  ATENÇÃO: Dados mockados são INACEITÁVEIS neste SaaS!\n');
  
  const mockDataFound = {
    products: [],
    orders: [],
    users: [],
    otherTables: []
  };
  
  try {
    // 1. PRODUTOS SUSPEITOS
    console.log('🔍 ANALISANDO PRODUTOS...\n');
    
    // Produtos da Amazon (Fire TV, Echo, etc)
    const amazonProducts = await executeSQL(`
      SELECT id, asin, sku, name, marketplace
      FROM products 
      WHERE 
        name ILIKE '%fire tv%' OR
        name ILIKE '%echo%' OR
        name ILIKE '%kindle%' OR
        name ILIKE '%alexa%' OR
        name ILIKE '%amazon%' OR
        name ILIKE '%test%' OR
        name ILIKE '%demo%' OR
        name ILIKE '%sample%' OR
        name ILIKE '%example%' OR
        name ILIKE '%produto teste%' OR
        name ILIKE '%mock%'
      ORDER BY id
    `);
    
    if (amazonProducts.rows.length > 0) {
      console.log('❌ PRODUTOS MOCKADOS ENCONTRADOS:');
      amazonProducts.rows.forEach(p => {
        console.log(`   ID: ${p.id} | ASIN: ${p.asin} | Nome: ${p.name}`);
        mockDataFound.products.push(p.id);
      });
    }
    
    // Produtos com padrões suspeitos
    const suspiciousProducts = await executeSQL(`
      SELECT id, asin, sku, name, price, inventory
      FROM products 
      WHERE 
        price = 0 OR
        price = 99.99 OR
        price = 123.45 OR
        (inventory = 0 AND name NOT ILIKE '%cuttero%') OR
        inventory = 999 OR
        inventory = 1000 OR
        inventory = 12345 OR
        asin LIKE 'B0%' OR
        sku LIKE 'TEST%' OR
        sku LIKE 'DEMO%'
    `);
    
    console.log(`\n📊 Produtos com valores suspeitos: ${suspiciousProducts.rows.length}`);
    
    // 2. PEDIDOS SUSPEITOS
    console.log('\n\n🔍 ANALISANDO PEDIDOS...\n');
    
    // Pedidos com padrões de teste
    const testOrders = await executeSQL(`
      SELECT id, marketplace_order_id, total, buyer_name, status
      FROM orders 
      WHERE 
        buyer_name ILIKE '%test%' OR
        buyer_name ILIKE '%demo%' OR
        buyer_name ILIKE '%john doe%' OR
        buyer_name ILIKE '%jane doe%' OR
        buyer_email ILIKE '%test%' OR
        buyer_email ILIKE '%example.com%' OR
        total = 0 OR
        total = 99.99 OR
        total = 123.45 OR
        marketplace_order_id LIKE 'TEST%' OR
        marketplace_order_id LIKE 'DEMO%'
    `);
    
    if (testOrders.rows.length > 0) {
      console.log('❌ PEDIDOS MOCKADOS ENCONTRADOS:');
      testOrders.rows.forEach(o => {
        console.log(`   ID: ${o.id} | Order: ${o.marketplace_order_id} | Cliente: ${o.buyer_name} | Total: R$ ${o.total}`);
        mockDataFound.orders.push(o.id);
      });
    }
    
    // Verificar se todos os pedidos são do mesmo dia
    const orderDates = await executeSQL(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM orders
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    console.log('\n📅 Distribuição de pedidos por data:');
    orderDates.rows.forEach(d => {
      console.log(`   ${d.date}: ${d.count} pedidos`);
    });
    
    if (orderDates.rows.length === 1) {
      console.log('\n⚠️  AVISO: Todos os pedidos são do mesmo dia - possível dado mockado!');
    }
    
    // 3. USUÁRIOS SUSPEITOS
    console.log('\n\n🔍 ANALISANDO USUÁRIOS...\n');
    
    const testUsers = await executeSQL(`
      SELECT id, name, email
      FROM users 
      WHERE 
        email ILIKE '%test%' OR
        email ILIKE '%demo%' OR
        email ILIKE '%example.com%' OR
        name ILIKE '%test%' OR
        name ILIKE '%demo%' OR
        name ILIKE '%admin%' AND email NOT LIKE '%@appproft.com%'
    `);
    
    if (testUsers.rows.length > 0) {
      console.log('❌ USUÁRIOS DE TESTE ENCONTRADOS:');
      testUsers.rows.forEach(u => {
        console.log(`   ID: ${u.id} | Nome: ${u.name} | Email: ${u.email}`);
        mockDataFound.users.push(u.id);
      });
    }
    
    // 4. VERIFICAR OUTRAS TABELAS
    console.log('\n\n🔍 ANALISANDO OUTRAS TABELAS...\n');
    
    // Traffic metrics suspeitas
    const trafficMetrics = await executeSQL(`
      SELECT COUNT(*) as count FROM traffic_metrics
    `);
    
    if (trafficMetrics.rows[0].count > 0) {
      console.log(`⚠️  Tabela traffic_metrics tem ${trafficMetrics.rows[0].count} registros - verificar se são dados reais`);
    }
    
    // 5. RESUMO FINAL
    console.log('\n\n📊 RESUMO DOS DADOS MOCKADOS IDENTIFICADOS:');
    console.log('━'.repeat(50));
    console.log(`Produtos mockados: ${mockDataFound.products.length}`);
    console.log(`Pedidos mockados: ${mockDataFound.orders.length}`);
    console.log(`Usuários de teste: ${mockDataFound.users.length}`);
    
    const totalMocked = mockDataFound.products.length + mockDataFound.orders.length + mockDataFound.users.length;
    
    if (totalMocked > 0) {
      console.log(`\n❌ TOTAL DE REGISTROS MOCKADOS: ${totalMocked}`);
      console.log('\n⚠️  AÇÃO NECESSÁRIA: Execute o script de limpeza para remover todos os dados mockados!');
      
      // Salvar IDs para limpeza
      const fs = require('fs');
      fs.writeFileSync('mock-data-ids.json', JSON.stringify(mockDataFound, null, 2));
      console.log('\n✅ IDs dos dados mockados salvos em: mock-data-ids.json');
    } else {
      console.log('\n✅ Nenhum dado mockado óbvio foi encontrado.');
      console.log('   (Ainda assim, verifique manualmente os dados)');
    }
    
  } catch (error) {
    console.error('❌ Erro ao identificar dados mockados:', error.message);
  }
}

// Executar análise
identifyMockData();