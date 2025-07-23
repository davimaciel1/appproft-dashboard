const pool = require('../db/pool');

function getAmazonService() {
  if (process.env.USE_MOCK_DATA === 'true') {
    return null;
  }
  return require('./amazonServiceNew');
}

function getMercadoLivreService() {
  if (process.env.USE_MOCK_DATA === 'true') {
    return null;
  }
  return require('./mercadolivreService');
}

class DataService {
  async syncAmazonData(userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Busca produtos da Amazon (temporariamente usando pedidos)
      console.log('🔄 Sincronizando dados Amazon...');
      const products = []; // Produtos serão implementados posteriormente
      
      for (const product of products) {
        await client.query(`
          INSERT INTO products (
            user_id, marketplace, marketplace_product_id, 
            sku, name, image_url, price, inventory
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (user_id, marketplace, marketplace_product_id) 
          DO UPDATE SET
            sku = EXCLUDED.sku,
            name = EXCLUDED.name,
            image_url = EXCLUDED.image_url,
            price = EXCLUDED.price,
            inventory = EXCLUDED.inventory,
            updated_at = CURRENT_TIMESTAMP
        `, [
          userId, 
          'amazon', 
          product.asin,
          product.sku,
          product.name,
          product.image,
          product.price,
          product.inventory
        ]);
      }
      
      // Busca pedidos da Amazon
      console.log('🔄 Sincronizando pedidos Amazon...');
      const amazonService = getAmazonService();
      const orders = await amazonService.getOrders();
      
      for (const order of orders) {
        // Insere o pedido
        const orderResult = await client.query(`
          INSERT INTO orders (
            user_id, marketplace, marketplace_order_id,
            status, total, items_count, buyer_name, 
            buyer_email, order_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (user_id, marketplace, marketplace_order_id) 
          DO UPDATE SET
            status = EXCLUDED.status,
            total = EXCLUDED.total,
            items_count = EXCLUDED.items_count,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          userId,
          'amazon',
          order.AmazonOrderId,
          order.OrderStatus,
          parseFloat(order.OrderTotal?.Amount || 0),
          order.NumberOfItemsShipped || 0,
          order.BuyerInfo?.BuyerName || 'N/A',
          order.BuyerInfo?.BuyerEmail || null,
          order.PurchaseDate
        ]);
        
        // Busca itens do pedido se necessário
        if (order.OrderItems) {
          for (const item of order.OrderItems) {
            await client.query(`
              INSERT INTO order_items (
                order_id, marketplace_product_id, sku,
                name, quantity, unit_price, total_price
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT DO NOTHING
            `, [
              orderResult.rows[0].id,
              item.ASIN,
              item.SellerSKU,
              item.Title,
              item.QuantityOrdered,
              parseFloat(item.ItemPrice?.Amount || 0),
              parseFloat(item.ItemPrice?.Amount || 0) * item.QuantityOrdered
            ]);
          }
        }
      }
      
      await client.query('COMMIT');
      console.log('✅ Dados Amazon sincronizados com sucesso!');
      
      return { 
        productsCount: products.length, 
        ordersCount: orders.length 
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao sincronizar dados Amazon:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  async syncMercadoLivreData(userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Busca produtos do Mercado Livre
      console.log('🔄 Sincronizando produtos Mercado Livre...');
      const mercadolivreService = getMercadoLivreService();
      const products = await mercadolivreService.getProducts();
      
      for (const product of products) {
        await client.query(`
          INSERT INTO products (
            user_id, marketplace, marketplace_product_id, 
            sku, name, image_url, price, inventory
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (user_id, marketplace, marketplace_product_id) 
          DO UPDATE SET
            sku = EXCLUDED.sku,
            name = EXCLUDED.name,
            image_url = EXCLUDED.image_url,
            price = EXCLUDED.price,
            inventory = EXCLUDED.inventory,
            updated_at = CURRENT_TIMESTAMP
        `, [
          userId, 
          'mercadolivre', 
          product.id,
          product.sku || product.id,
          product.title,
          product.thumbnail,
          product.price,
          product.available_quantity
        ]);
      }
      
      // Busca pedidos do Mercado Livre
      console.log('🔄 Sincronizando pedidos Mercado Livre...');
      const mercadolivreService2 = getMercadoLivreService();
      const orders = await mercadolivreService2.getOrders();
      
      for (const order of orders) {
        // Insere o pedido
        const orderResult = await client.query(`
          INSERT INTO orders (
            user_id, marketplace, marketplace_order_id,
            status, total, items_count, buyer_name, 
            buyer_email, order_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (user_id, marketplace, marketplace_order_id) 
          DO UPDATE SET
            status = EXCLUDED.status,
            total = EXCLUDED.total,
            items_count = EXCLUDED.items_count,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          userId,
          'mercadolivre',
          order.id.toString(),
          order.status,
          order.total_amount,
          order.order_items?.length || 0,
          order.buyer?.nickname || 'N/A',
          order.buyer?.email || null,
          order.date_created
        ]);
        
        // Insere itens do pedido
        if (order.order_items) {
          for (const item of order.order_items) {
            await client.query(`
              INSERT INTO order_items (
                order_id, marketplace_product_id, sku,
                name, quantity, unit_price, total_price
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT DO NOTHING
            `, [
              orderResult.rows[0].id,
              item.item.id,
              item.item.seller_sku || item.item.id,
              item.item.title,
              item.quantity,
              item.unit_price,
              item.unit_price * item.quantity
            ]);
          }
        }
      }
      
      await client.query('COMMIT');
      console.log('✅ Dados Mercado Livre sincronizados com sucesso!');
      
      return { 
        productsCount: products.length, 
        ordersCount: orders.length 
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao sincronizar dados Mercado Livre:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  async getDashboardData(userId) {
    const client = await pool.connect();
    
    try {
      // Métricas gerais
      const metricsQuery = await client.query(`
        SELECT 
          COUNT(DISTINCT o.id) as total_orders,
          SUM(o.total) as total_revenue,
          SUM(o.items_count) as total_units,
          COUNT(DISTINCT CASE WHEN DATE(o.order_date) = CURRENT_DATE THEN o.id END) as today_orders,
          COALESCE(SUM(CASE WHEN DATE(o.order_date) = CURRENT_DATE THEN o.total END), 0) as today_revenue
        FROM orders o
        WHERE o.user_id = $1
      `, [userId]);
      
      // Produtos mais vendidos
      const topProductsQuery = await client.query(`
        SELECT 
          p.name,
          p.image_url,
          p.marketplace,
          SUM(oi.quantity) as units_sold,
          SUM(oi.total_price) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.marketplace_product_id = p.marketplace_product_id 
          AND o.marketplace = p.marketplace
        WHERE o.user_id = $1
        GROUP BY p.id, p.name, p.image_url, p.marketplace
        ORDER BY units_sold DESC
        LIMIT 10
      `, [userId]);
      
      // Pedidos recentes
      const recentOrdersQuery = await client.query(`
        SELECT 
          o.*,
          COUNT(oi.id) as items_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = $1
        GROUP BY o.id
        ORDER BY o.order_date DESC
        LIMIT 50
      `, [userId]);
      
      return {
        metrics: metricsQuery.rows[0],
        topProducts: topProductsQuery.rows,
        recentOrders: recentOrdersQuery.rows
      };
      
    } finally {
      client.release();
    }
  }
}

module.exports = new DataService();