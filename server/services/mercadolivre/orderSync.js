const pool = require('../../db/pool');
const secureLogger = require('../../utils/secureLogger');
const MercadoLivreService = require('../mercadolivreService');

class MLOrderSync {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.mlService = null;
  }

  async initializeService() {
    if (this.mlService) return;

    // Buscar credenciais do tenant
    const result = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
      [this.tenantId, 'mercadolivre']
    );

    if (result.rows.length === 0) {
      throw new Error(`Credenciais Mercado Livre não encontradas para tenant ${this.tenantId}`);
    }

    const creds = result.rows[0];
    this.mlService = new MercadoLivreService({
      clientId: creds.client_id,
      clientSecret: creds.client_secret,
      refreshToken: creds.refresh_token,
      sellerId: creds.seller_id
    });
  }

  async syncOrders(days = 30) {
    await this.initializeService();
    
    let recordsSynced = 0;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Log início da sincronização
      const syncLogResult = await client.query(`
        INSERT INTO sync_logs (tenant_id, marketplace, sync_type, status, started_at)
        VALUES ($1, 'mercadolivre', 'orders', 'running', NOW())
        RETURNING id
      `, [this.tenantId]);
      const syncLogId = syncLogResult.rows[0].id;

      console.log(`🔄 Sincronizando pedidos ML (${days} dias) para tenant ${this.tenantId}...`);

      // Calcular data de início
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 1. Buscar vendas do Mercado Livre
      const orders = await this.mlService.getOrders({
        seller: this.mlService.sellerId,
        order_status: ['paid', 'confirmed', 'ready_to_ship', 'shipped', 'delivered'],
        created_from: startDate.toISOString(),
        limit: 200
      });

      for (const order of orders.results || []) {
        try {
          // Inserir/atualizar pedido
          const orderResult = await client.query(`
            INSERT INTO orders (
              tenant_id, marketplace, order_id, order_type, status, 
              total_amount, currency, order_date, created_at
            ) VALUES ($1, 'mercadolivre', $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (tenant_id, marketplace, order_id)
            DO UPDATE SET
              status = EXCLUDED.status,
              total_amount = EXCLUDED.total_amount,
              order_date = EXCLUDED.order_date
            RETURNING id
          `, [
            this.tenantId,
            order.id.toString(),
            order.pack_id ? 'Pack' : 'Single',
            order.status,
            parseFloat(order.total_amount || 0),
            order.currency_id || 'BRL',
            new Date(order.date_created)
          ]);

          const orderId = orderResult.rows[0].id;

          // 2. Processar itens do pedido
          for (const item of order.order_items || []) {
            try {
              // Encontrar produto correspondente
              const productResult = await client.query(`
                SELECT id FROM products 
                WHERE tenant_id = $1 AND marketplace = 'mercadolivre' 
                AND marketplace_id = $2
                LIMIT 1
              `, [this.tenantId, item.item.id]);

              let productId = null;

              if (productResult.rows.length > 0) {
                productId = productResult.rows[0].id;
              } else {
                // Criar produto se não existir
                const newProductResult = await client.query(`
                  INSERT INTO products (
                    tenant_id, marketplace, marketplace_id, sku, name, status, synced_at
                  ) VALUES ($1, 'mercadolivre', $2, $3, $4, 'active', NOW())
                  ON CONFLICT (tenant_id, marketplace, marketplace_id) DO NOTHING
                  RETURNING id
                `, [
                  this.tenantId,
                  item.item.id,
                  item.item.id,
                  item.item.title || `Produto ${item.item.id}`
                ]);

                if (newProductResult.rows.length > 0) {
                  productId = newProductResult.rows[0].id;
                }
              }

              if (productId) {
                // Inserir item do pedido
                await client.query(`
                  INSERT INTO order_items (
                    order_id, product_id, quantity, unit_price, total_price, cost, fees
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                  ON CONFLICT DO NOTHING
                `, [
                  orderId,
                  productId,
                  parseInt(item.quantity),
                  parseFloat(item.unit_price || 0),
                  parseFloat(item.unit_price || 0) * parseInt(item.quantity),
                  0, // Cost será calculado posteriormente
                  parseFloat(order.shipping?.cost || 0) + parseFloat(order.taxes?.amount || 0)
                ]);

                recordsSynced++;
              }

            } catch (itemError) {
              secureLogger.error('Erro ao processar item do pedido ML', {
                orderId: order.id,
                itemId: item.item.id,
                error: itemError.message
              });
            }
          }

          // Rate limiting - ML API: 2 req/s para orders
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (orderError) {
          secureLogger.error('Erro ao processar pedido ML', {
            orderId: order.id,
            error: orderError.message
          });
        }
      }

      // Atualizar log de sucesso
      await client.query(`
        UPDATE sync_logs 
        SET status = 'completed', records_synced = $1, completed_at = NOW()
        WHERE id = $2
      `, [recordsSynced, syncLogId]);

      await client.query('COMMIT');

      console.log(`✅ ML pedidos sincronizados: ${recordsSynced} itens`);

      // Emitir eventos para novos pedidos
      if (recordsSynced > 0 && global.io) {
        global.io.to(this.tenantId).emit('new-orders', {
          marketplace: 'mercadolivre',
          count: recordsSynced,
          timestamp: new Date()
        });
      }

      return { success: true, recordsSynced };

    } catch (error) {
      await client.query('ROLLBACK');
      secureLogger.error('Erro na sincronização de pedidos ML', {
        tenantId: this.tenantId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = MLOrderSync;