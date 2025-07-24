const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function cleanAllMockData() {
  console.log('=== LIMPEZA COMPLETA DE DADOS MOCKADOS ===\n');
  console.log('⚠️  REMOVENDO TODOS OS DADOS MOCKADOS DO BANCO!\n');
  
  try {
    // Começar transação
    await executeSQL('BEGIN');
    
    try {
      // 1. Primeiro, remover TODOS os order_items de produtos mockados
      console.log('🗑️  Removendo TODOS os itens de pedidos com produtos mockados...');
      const deleteItemsFromMockProducts = await executeSQL(`
        DELETE FROM order_items 
        WHERE product_id IN (
          SELECT id FROM products 
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
            price = 123.45
        )
      `);
      console.log(`✅ ${deleteItemsFromMockProducts.rowCount} itens removidos (produtos mockados)`);
      
      // 2. Remover order_items de pedidos com total = 0
      console.log('\n🗑️  Removendo itens de pedidos com valor zero...');
      const deleteItemsZeroOrders = await executeSQL(`
        DELETE FROM order_items 
        WHERE order_id IN (
          SELECT id FROM orders 
          WHERE total = 0 OR total IS NULL OR buyer_name IS NULL
        )
      `);
      console.log(`✅ ${deleteItemsZeroOrders.rowCount} itens removidos (pedidos zero)`);
      
      // 3. Agora remover os pedidos problemáticos
      console.log('\n🗑️  Removendo pedidos com valor zero ou sem cliente...');
      const deleteZeroOrders = await executeSQL(`
        DELETE FROM orders 
        WHERE 
          total = 0 OR 
          total IS NULL OR
          buyer_name IS NULL OR
          buyer_name = ''
      `);
      console.log(`✅ ${deleteZeroOrders.rowCount} pedidos removidos`);
      
      // 4. Remover produtos mockados
      console.log('\n🗑️  Removendo TODOS os produtos mockados...');
      const deleteProducts = await executeSQL(`
        DELETE FROM products 
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
          asin LIKE 'B0%' OR
          price = 0 OR
          price = 99.99 OR
          price = 123.45 OR
          inventory = 999 OR
          inventory = 1000 OR
          inventory = 12345
      `);
      console.log(`✅ ${deleteProducts.rowCount} produtos mockados removidos`);
      
      // 5. Limpar tabelas auxiliares
      console.log('\n🗑️  Limpando tabelas auxiliares...');
      await executeSQL(`DELETE FROM traffic_metrics`);
      await executeSQL(`DELETE FROM product_page_views`);
      console.log(`✅ Tabelas auxiliares limpas`);
      
      // 6. Remover usuários de teste
      console.log('\n🗑️  Removendo usuários de teste...');
      const deleteUsers = await executeSQL(`
        DELETE FROM users 
        WHERE 
          (email ILIKE '%test%' OR 
           email ILIKE '%demo%' OR 
           email ILIKE '%example.com%' OR
           name ILIKE '%test%' OR
           name ILIKE '%demo%')
          AND id != 1
      `);
      console.log(`✅ ${deleteUsers.rowCount} usuários de teste removidos`);
      
      // 7. Verificar e limpar order_items órfãos
      console.log('\n🗑️  Removendo itens de pedidos órfãos...');
      const deleteOrphanItems = await executeSQL(`
        DELETE FROM order_items 
        WHERE 
          order_id NOT IN (SELECT id FROM orders) OR
          product_id NOT IN (SELECT id FROM products)
      `);
      console.log(`✅ ${deleteOrphanItems.rowCount} itens órfãos removidos`);
      
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
        SELECT 'order_items', COUNT(*) FROM order_items
        UNION ALL
        SELECT 'users', COUNT(*) FROM users
        UNION ALL
        SELECT 'marketplace_credentials', COUNT(*) FROM marketplace_credentials
      `);
      
      console.log('\nTabela | Registros Restantes');
      console.log('-------|-------------------');
      finalCounts.rows.forEach(row => {
        console.log(`${row.table_name.padEnd(22)} | ${row.count}`);
      });
      
      // Verificar dados restantes
      console.log('\n📋 VERIFICAÇÃO DOS DADOS RESTANTES:');
      
      const remainingProducts = await executeSQL(`
        SELECT COUNT(*) as count, marketplace 
        FROM products 
        GROUP BY marketplace
      `);
      
      if (remainingProducts.rows.length > 0) {
        console.log('\nProdutos por marketplace:');
        remainingProducts.rows.forEach(row => {
          console.log(`- ${row.marketplace}: ${row.count} produtos`);
        });
      } else {
        console.log('\n✅ Nenhum produto restante (banco limpo)');
      }
      
      const remainingOrders = await executeSQL(`
        SELECT COUNT(*) as count, marketplace 
        FROM orders 
        GROUP BY marketplace
      `);
      
      if (remainingOrders.rows.length > 0) {
        console.log('\nPedidos por marketplace:');
        remainingOrders.rows.forEach(row => {
          console.log(`- ${row.marketplace}: ${row.count} pedidos`);
        });
      } else {
        console.log('✅ Nenhum pedido restante (banco limpo)');
      }
      
      console.log('\n🎯 PRÓXIMOS PASSOS:');
      console.log('1. O banco está limpo e pronto para dados REAIS');
      console.log('2. Configure as credenciais reais das APIs no .env');
      console.log('3. Execute a sincronização com dados REAIS:');
      console.log('   - Amazon: node scripts/syncAmazonFullData.js');
      console.log('   - Mercado Livre: node scripts/syncMercadoLivre.js');
      console.log('4. NUNCA mais adicione dados mockados ao banco!');
      
      // Limpar arquivo de IDs se existir
      const fs = require('fs');
      if (fs.existsSync('mock-data-ids.json')) {
        fs.unlinkSync('mock-data-ids.json');
        console.log('\n✅ Arquivo mock-data-ids.json removido');
      }
      
    } catch (error) {
      // Reverter transação em caso de erro
      await executeSQL('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Erro ao limpar dados mockados:', error.message);
  }
}

// Executar limpeza
cleanAllMockData();