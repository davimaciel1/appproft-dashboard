const { Pool } = require('pg');
require('dotenv').config();

async function populateTestData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
  });

  try {
    console.log('=== POPULANDO DADOS DE TESTE ===\n');
    
    // 1. Verificar usuário admin
    const user = await pool.query("SELECT id FROM users WHERE email = 'admin@appproft.com'");
    const userId = user.rows[0]?.id || 1;
    console.log(`✅ Usando user_id: ${userId}`);
    
    // 2. Inserir produtos Amazon se não existirem
    console.log('\n📦 Inserindo produtos Amazon:');
    const amazonProducts = [
      {
        sku: 'B0C5BG5T48',
        name: 'Echo Dot (5ª geração) - Smart Speaker com Alexa',
        price: 299.00,
        cost: 150.00,
        image: 'https://m.media-amazon.com/images/I/71xoR4A6q2L._AC_SL1500_.jpg'
      },
      {
        sku: 'B0C5BCDWTQ',
        name: 'Fire TV Stick 4K - Streaming em 4K com Alexa',
        price: 379.00,
        cost: 189.00,
        image: 'https://m.media-amazon.com/images/I/51IgZL1U7ZL._AC_SL1000_.jpg'
      },
      {
        sku: 'B08N3TCP4K',
        name: 'Kindle Paperwhite - 8GB à prova d\'água',
        price: 599.00,
        cost: 299.00,
        image: 'https://m.media-amazon.com/images/I/61CneQZjKdL._AC_SL1000_.jpg'
      }
    ];
    
    for (const product of amazonProducts) {
      try {
        await pool.query(`
          INSERT INTO products (user_id, marketplace, marketplace_product_id, sku, name, price, cost, image_url, inventory)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (marketplace, marketplace_product_id) DO UPDATE
          SET 
            name = EXCLUDED.name,
            price = EXCLUDED.price,
            cost = EXCLUDED.cost,
            image_url = EXCLUDED.image_url,
            updated_at = NOW()
        `, [userId, 'amazon', product.sku, product.sku, product.name, product.price, product.cost, product.image, 100]);
        
        console.log(`  ✅ ${product.name}`);
      } catch (error) {
        console.log(`  ⚠️  Erro ao inserir ${product.sku}: ${error.message}`);
      }
    }
    
    // 3. Inserir produtos Mercado Livre
    console.log('\n📦 Inserindo produtos Mercado Livre:');
    const mlProducts = [
      {
        id: 'MLB123456',
        name: 'Notebook Dell Inspiron 15 Intel Core i5',
        price: 3499.00,
        cost: 2800.00,
        image: 'https://http2.mlstatic.com/D_NQ_NP_2X_715019-MLB71568741438_092023-F.webp'
      },
      {
        id: 'MLB789012',
        name: 'Samsung Galaxy S23 128GB Preto',
        price: 2999.00,
        cost: 2400.00,
        image: 'https://http2.mlstatic.com/D_NQ_NP_2X_743986-MLB69007410616_042023-F.webp'
      }
    ];
    
    for (const product of mlProducts) {
      try {
        await pool.query(`
          INSERT INTO products (user_id, marketplace, marketplace_product_id, sku, name, price, cost, image_url, inventory)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (marketplace, marketplace_product_id) DO UPDATE
          SET 
            name = EXCLUDED.name,
            price = EXCLUDED.price,
            cost = EXCLUDED.cost,
            image_url = EXCLUDED.image_url,
            updated_at = NOW()
        `, [userId, 'mercadolivre', product.id, product.id, product.name, product.price, product.cost, product.image, 50]);
        
        console.log(`  ✅ ${product.name}`);
      } catch (error) {
        console.log(`  ⚠️  Erro ao inserir ${product.id}: ${error.message}`);
      }
    }
    
    // 4. Criar algumas vendas de exemplo
    console.log('\n💰 Criando vendas de exemplo:');
    
    // Buscar produtos inseridos
    const products = await pool.query('SELECT id, marketplace, price, cost FROM products WHERE user_id = $1', [userId]);
    
    if (products.rows.length > 0) {
      // Criar pedidos
      const orderDates = [
        new Date(),
        new Date(Date.now() - 24 * 60 * 60 * 1000), // ontem
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
      ];
      
      for (let i = 0; i < orderDates.length; i++) {
        const marketplace = i % 2 === 0 ? 'amazon' : 'mercadolivre';
        const orderId = `${marketplace.toUpperCase()}-${Date.now()}-${i}`;
        
        const order = await pool.query(`
          INSERT INTO orders (user_id, marketplace, order_id, status, total_amount, order_date, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [userId, marketplace, orderId, 'completed', 0, orderDates[i], orderDates[i]]);
        
        // Adicionar itens ao pedido
        let totalAmount = 0;
        const productSample = products.rows.filter(p => p.marketplace === marketplace).slice(0, 2);
        
        for (const product of productSample) {
          const quantity = Math.floor(Math.random() * 3) + 1;
          const itemTotal = product.price * quantity;
          totalAmount += itemTotal;
          
          await pool.query(`
            INSERT INTO order_items (order_id, product_id, quantity, price, cost)
            VALUES ($1, $2, $3, $4, $5)
          `, [order.rows[0].id, product.id, quantity, product.price, product.cost]);
        }
        
        // Atualizar total do pedido
        await pool.query('UPDATE orders SET total_amount = $1 WHERE id = $2', [totalAmount, order.rows[0].id]);
        console.log(`  ✅ Pedido ${orderId} - Total: R$ ${totalAmount.toFixed(2)}`);
      }
    }
    
    console.log('\n✅ Dados de teste populados com sucesso!');
    
    // 5. Verificar resumo
    console.log('\n📊 Resumo dos dados:');
    const summary = await pool.query(`
      SELECT 
        p.marketplace,
        COUNT(DISTINCT p.id) as total_produtos,
        COUNT(DISTINCT o.id) as total_pedidos,
        COALESCE(SUM(oi.quantity), 0) as unidades_vendidas,
        COALESCE(SUM(oi.quantity * oi.price), 0) as revenue_total
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.user_id = $1
      GROUP BY p.marketplace
    `, [userId]);
    
    console.table(summary.rows);
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  } finally {
    await pool.end();
  }
}

populateTestData();