const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const fs = require('fs');

async function cleanMockData() {
  console.log('=== LIMPEZA DE DADOS MOCKADOS ===\n');
  console.log('⚠️  ATENÇÃO: Este script removerá TODOS os dados mockados identificados!\n');
  
  try {
    // Ler os IDs dos dados mockados
    let mockDataIds;
    try {
      const data = fs.readFileSync('mock-data-ids.json', 'utf8');
      mockDataIds = JSON.parse(data);
    } catch (error) {
      console.error('❌ Erro ao ler mock-data-ids.json. Execute identifyMockData.js primeiro!');
      return;
    }
    
    console.log('📊 Dados a serem removidos:');
    console.log(`- Produtos: ${mockDataIds.products.length}`);
    console.log(`- Pedidos: ${mockDataIds.orders.length}`);
    console.log(`- Usuários: ${mockDataIds.users.length}`);
    
    // Começar transação
    await executeSQL('BEGIN');
    
    try {
      // 1. Remover itens de pedidos mockados
      if (mockDataIds.orders.length > 0) {
        console.log('\n🗑️  Removendo itens de pedidos mockados...');
        const deleteOrderItems = await executeSQL(`
          DELETE FROM order_items 
          WHERE order_id IN (${mockDataIds.orders.join(',')})
        `);
        console.log(`✅ ${deleteOrderItems.rowCount} itens de pedidos removidos`);
      }
      
      // 2. Remover pedidos mockados
      if (mockDataIds.orders.length > 0) {
        console.log('\n🗑️  Removendo pedidos mockados...');
        const deleteOrders = await executeSQL(`
          DELETE FROM orders 
          WHERE id IN (${mockDataIds.orders.join(',')})
        `);
        console.log(`✅ ${deleteOrders.rowCount} pedidos removidos`);
      }
      
      // 3. Remover produtos mockados
      if (mockDataIds.products.length > 0) {
        console.log('\n🗑️  Removendo produtos mockados...');
        const deleteProducts = await executeSQL(`
          DELETE FROM products 
          WHERE id IN (${mockDataIds.products.join(',')})
        `);
        console.log(`✅ ${deleteProducts.rowCount} produtos removidos`);
      }
      
      // 4. Remover TODOS os produtos com padrões suspeitos
      console.log('\n🗑️  Removendo TODOS os produtos com ASINs da Amazon ou valores suspeitos...');
      const deleteAllSuspicious = await executeSQL(`
        DELETE FROM products 
        WHERE 
          name ILIKE '%fire tv%' OR
          name ILIKE '%echo%' OR
          name ILIKE '%kindle%' OR
          name ILIKE '%alexa%' OR
          name ILIKE '%amazon%' OR
          name ILIKE '%test%' OR
          name ILIKE '%demo%' OR
          asin LIKE 'B0%' OR
          price = 0 OR
          price = 99.99 OR
          price = 123.45 OR
          inventory = 999 OR
          inventory = 1000 OR
          inventory = 12345
      `);
      console.log(`✅ ${deleteAllSuspicious.rowCount} produtos suspeitos adicionais removidos`);
      
      // 5. Remover TODOS os pedidos com total = 0 ou sem cliente
      console.log('\n🗑️  Removendo TODOS os pedidos com valor zero ou sem cliente...');
      const deleteZeroOrders = await executeSQL(`
        DELETE FROM orders 
        WHERE 
          total = 0 OR 
          total IS NULL OR
          buyer_name IS NULL OR
          buyer_name = ''
      `);
      console.log(`✅ ${deleteZeroOrders.rowCount} pedidos com valor zero removidos`);
      
      // 6. Limpar traffic_metrics (provavelmente dados de teste)
      console.log('\n🗑️  Limpando tabela traffic_metrics...');
      const deleteTraffic = await executeSQL(`DELETE FROM traffic_metrics`);
      console.log(`✅ ${deleteTraffic.rowCount} registros de tráfego removidos`);
      
      // 7. Limpar product_page_views (vazia)
      console.log('\n🗑️  Limpando tabela product_page_views...');
      const deletePageViews = await executeSQL(`DELETE FROM product_page_views`);
      console.log(`✅ ${deletePageViews.rowCount} registros de visualizações removidos`);
      
      // 8. Remover usuários de teste (exceto admin principal)
      if (mockDataIds.users.length > 0) {
        console.log('\n🗑️  Removendo usuários de teste...');
        const deleteUsers = await executeSQL(`
          DELETE FROM users 
          WHERE id IN (${mockDataIds.users.join(',')}) AND id != 1
        `);
        console.log(`✅ ${deleteUsers.rowCount} usuários de teste removidos`);
      }
      
      // Confirmar transação
      await executeSQL('COMMIT');
      console.log('\n✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
      
      // Verificar estado final
      console.log('\n📊 ESTADO FINAL DO BANCO:');
      const finalCounts = await executeSQL(`
        SELECT 
          'orders' as table_name, COUNT(*) as count FROM orders
        UNION ALL
        SELECT 'products', COUNT(*) FROM products
        UNION ALL
        SELECT 'users', COUNT(*) FROM users
        UNION ALL
        SELECT 'order_items', COUNT(*) FROM order_items
      `);
      
      console.log('\nTabela | Registros Restantes');
      console.log('-------|-------------------');
      finalCounts.rows.forEach(row => {
        console.log(`${row.table_name.padEnd(10)} | ${row.count}`);
      });
      
      // Remover arquivo de IDs
      fs.unlinkSync('mock-data-ids.json');
      console.log('\n✅ Arquivo mock-data-ids.json removido');
      
      console.log('\n🎯 PRÓXIMOS PASSOS:');
      console.log('1. Configure as credenciais reais das APIs no .env');
      console.log('2. Execute a sincronização com Amazon: node scripts/syncAmazonFullData.js');
      console.log('3. Execute a sincronização com Mercado Livre: node scripts/syncMercadoLivre.js');
      console.log('4. Verifique os dados reais com: node scripts/checkAmazonData.js');
      
    } catch (error) {
      // Reverter transação em caso de erro
      await executeSQL('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Erro ao limpar dados mockados:', error.message);
  }
}

// Perguntar confirmação antes de executar
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  AVISO: Este script removerá PERMANENTEMENTE todos os dados mockados!');
console.log('');
rl.question('Tem certeza que deseja continuar? (sim/não): ', (answer) => {
  if (answer.toLowerCase() === 'sim' || answer.toLowerCase() === 's') {
    rl.close();
    cleanMockData();
  } else {
    console.log('Operação cancelada.');
    rl.close();
  }
});