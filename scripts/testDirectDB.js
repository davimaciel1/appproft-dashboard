require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

console.log('=== TESTE DIRETO NO BANCO DE DADOS ===\n');

async function testDatabase() {
  try {
    // 1. Testar conexão
    console.log('1. Testando conexão...');
    const testResult = await executeSQL('SELECT NOW() as time');
    console.log('✅ Conectado! Hora atual:', testResult.rows[0].time);
    
    // 2. Verificar tabelas
    console.log('\n2. Verificando tabelas...');
    const tablesResult = await executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tabelas encontradas:');
    tablesResult.rows.forEach(row => console.log('  -', row.table_name));
    
    // 3. Contar registros
    console.log('\n3. Contando registros...');
    const counts = await Promise.all([
      executeSQL('SELECT COUNT(*) as count FROM users'),
      executeSQL('SELECT COUNT(*) as count FROM products'),
      executeSQL('SELECT COUNT(*) as count FROM orders'),
      executeSQL('SELECT COUNT(*) as count FROM order_items')
    ]);
    
    console.log('  - users:', counts[0].rows[0].count);
    console.log('  - products:', counts[1].rows[0].count);
    console.log('  - orders:', counts[2].rows[0].count);
    console.log('  - order_items:', counts[3].rows[0].count);
    
    // 4. Buscar alguns produtos
    console.log('\n4. Buscando produtos...');
    const productsResult = await executeSQL(`
      SELECT 
        p.id,
        p.marketplace,
        p.sku,
        p.name,
        p.price
      FROM products p
      LIMIT 5
    `);
    
    if (productsResult.rows.length > 0) {
      console.log('Produtos encontrados:');
      productsResult.rows.forEach((p, i) => {
        console.log(`${i + 1}. ${p.name || 'Sem nome'} (${p.marketplace}) - SKU: ${p.sku}`);
      });
    } else {
      console.log('Nenhum produto encontrado.');
    }
    
    // 5. Verificar se há pedidos
    console.log('\n5. Verificando pedidos recentes...');
    const ordersResult = await executeSQL(`
      SELECT 
        o.id,
        o.marketplace,
        o.marketplace_order_id,
        o.order_date,
        o.total_amount
      FROM orders o
      ORDER BY o.order_date DESC
      LIMIT 5
    `);
    
    if (ordersResult.rows.length > 0) {
      console.log('Pedidos recentes:');
      ordersResult.rows.forEach((o, i) => {
        console.log(`${i + 1}. Order ${o.marketplace_order_id} (${o.marketplace}) - R$ ${o.total_amount}`);
      });
    } else {
      console.log('Nenhum pedido encontrado.');
    }
    
    console.log('\n✅ TESTE CONCLUÍDO!');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('Detalhes:', error);
  }
}

// Executar teste
testDatabase();