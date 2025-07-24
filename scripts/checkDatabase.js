const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
  });

  try {
    console.log('=== VERIFICANDO BANCO DE DADOS ===\n');
    
    // Verificar tabelas
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas encontradas:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    console.log('\n📊 Contagem de registros:\n');
    
    // Verificar produtos
    try {
      const products = await pool.query('SELECT COUNT(*) FROM products');
      console.log(`✅ Produtos: ${products.rows[0].count} registros`);
      
      // Mostrar alguns produtos
      if (products.rows[0].count > 0) {
        const sampleProducts = await pool.query('SELECT id, name, marketplace FROM products LIMIT 3');
        console.log('\n   Exemplos:');
        sampleProducts.rows.forEach(p => {
          console.log(`   - ${p.name} (${p.marketplace})`);
        });
      }
    } catch (error) {
      console.log('❌ Tabela products não existe');
    }
    
    // Verificar pedidos
    try {
      const orders = await pool.query('SELECT COUNT(*) FROM orders');
      console.log(`✅ Pedidos: ${orders.rows[0].count} registros`);
    } catch (error) {
      console.log('❌ Tabela orders não existe');
    }
    
    // Verificar order_items
    try {
      const orderItems = await pool.query('SELECT COUNT(*) FROM order_items');
      console.log(`✅ Itens de pedido: ${orderItems.rows[0].count} registros`);
    } catch (error) {
      console.log('❌ Tabela order_items não existe');
    }
    
    // Verificar credenciais
    try {
      const creds = await pool.query('SELECT COUNT(*) FROM marketplace_credentials');
      console.log(`✅ Credenciais: ${creds.rows[0].count} registros`);
      
      if (creds.rows[0].count > 0) {
        const credDetails = await pool.query('SELECT marketplace, user_id FROM marketplace_credentials');
        console.log('\n   Marketplaces configurados:');
        credDetails.rows.forEach(c => {
          console.log(`   - ${c.marketplace} (user_id: ${c.user_id})`);
        });
      }
    } catch (error) {
      console.log('❌ Tabela marketplace_credentials não existe');
    }
    
    // Verificar última sincronização
    try {
      const lastSync = await pool.query(`
        SELECT marketplace, MAX(created_at) as last_sync 
        FROM products 
        GROUP BY marketplace
      `);
      
      if (lastSync.rows.length > 0) {
        console.log('\n⏰ Última sincronização:');
        lastSync.rows.forEach(s => {
          console.log(`   - ${s.marketplace}: ${s.last_sync || 'Nunca'}`);
        });
      }
    } catch (error) {
      // Ignorar se não houver dados
    }
    
    console.log('\n✅ Verificação concluída!');
    
    // Sugestões
    const hasProducts = tables.rows.some(t => t.table_name === 'products');
    const hasOrders = tables.rows.some(t => t.table_name === 'orders');
    
    if (!hasProducts || !hasOrders) {
      console.log('\n⚠️  ATENÇÃO: Tabelas essenciais estão faltando!');
      console.log('   Execute: npm run db:migrate para criar as tabelas');
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao conectar ao banco:', error.message);
    console.log('\n💡 Dicas:');
    console.log('   1. Verifique se o PostgreSQL está rodando');
    console.log('   2. Verifique as credenciais no arquivo .env');
    console.log('   3. Execute: npm run db:migrate para criar as tabelas');
  } finally {
    await pool.end();
  }
}

checkDatabase();