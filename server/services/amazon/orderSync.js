const pool = require('../../db/pool');
const secureLogger = require('../../utils/secureLogger');
const AmazonService = require('../amazonService');

class AmazonOrderSync {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.amazonService = null;
  }

  async initializeService() {
    if (this.amazonService) return;

    // Buscar credenciais do tenant
    const result = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
      [this.tenantId, 'amazon']
    );

    if (result.rows.length === 0) {
      throw new Error(`Credenciais Amazon não encontradas para tenant ${this.tenantId}`);
    }

    const creds = result.rows[0];
    this.amazonService = new AmazonService({
      clientId: creds.client_id,
      clientSecret: creds.client_secret,
      refreshToken: creds.refresh_token,
      sellerId: creds.seller_id,
      marketplaceId: creds.marketplace_id || 'A2Q3Y263D00KWC'
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
        VALUES ($1, 'amazon', 'orders', 'running', NOW())
        RETURNING id
      `, [this.tenantId]);
      const syncLogId = syncLogResult.rows[0].id;

      console.log(`🔄 Sincronizando pedidos Amazon (${days} dias) para tenant ${this.tenantId}...`);

      // Calcular data de início
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 1. Buscar pedidos da Amazon
      const orders = await this.amazonService.getOrders(startDate);

      for (const order of orders) {
        try {
          // Inserir/atualizar pedido
          const orderResult = await client.query(`
            INSERT INTO orders (
              tenant_id, marketplace, order_id, order_type, status, 
              total_amount, currency, order_date, created_at
            ) VALUES ($1, 'amazon', $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (tenant_id, marketplace, order_id)
            DO UPDATE SET
              status = EXCLUDED.status,
              total_amount = EXCLUDED.total_amount,
              order_date = EXCLUDED.order_date
            RETURNING id
          `, [
            this.tenantId,
            order.amazonOrderId,
            order.orderType || 'Regular',
            order.orderStatus,
            parseFloat(order.orderTotal?.amount || 0),
            order.orderTotal?.currencyCode || 'USD',
            new Date(order.purchaseDate)
          ]);

          const orderId = orderResult.rows[0].id;

          // 2. Buscar itens do pedido
          const orderItems = await this.amazonService.getOrderItems(order.amazonOrderId);

          for (const item of orderItems) {
            try {
              // Encontrar produto correspondente
              const productResult = await client.query(`
                SELECT id FROM products 
                WHERE tenant_id = $1 AND marketplace = 'amazon' 
                AND (marketplace_id = $2 OR sku = $3)
                LIMIT 1
              `, [this.tenantId, item.asin, item.sellerSku]);

              let productId = null;

              if (productResult.rows.length > 0) {
                productId = productResult.rows[0].id;
              } else {
                // Criar produto se não existir
                const newProductResult = await client.query(`
                  INSERT INTO products (
                    tenant_id, marketplace, marketplace_id, sku, name, status, synced_at
                  ) VALUES ($1, 'amazon', $2, $3, $4, 'active', NOW())
                  ON CONFLICT (tenant_id, marketplace, marketplace_id) DO NOTHING
                  RETURNING id
                `, [
                  this.tenantId,
                  item.asin,
                  item.sellerSku || item.asin,
                  item.title || `Produto ${item.asin}`
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
                  parseInt(item.quantityOrdered),
                  parseFloat(item.itemPrice?.amount || 0),
                  parseFloat(item.itemPrice?.amount || 0) * parseInt(item.quantityOrdered),
                  0, // Cost será calculado posteriormente
                  parseFloat(item.itemTax?.amount || 0) + parseFloat(item.shippingPrice?.amount || 0)
                ]);

                recordsSynced++;
              }

            } catch (itemError) {
              secureLogger.error('Erro ao processar item do pedido Amazon', {
                orderId: order.amazonOrderId,
                asin: item.asin,
                error: itemError.message
              });
            }
          }

          // Rate limiting - Amazon Orders API: 6 req/s
          await new Promise(resolve => setTimeout(resolve, 167));

        } catch (orderError) {
          secureLogger.error('Erro ao processar pedido Amazon', {
            orderId: order.amazonOrderId,
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

      console.log(`✅ Amazon pedidos sincronizados: ${recordsSynced} itens`);

      // Emitir eventos para novos pedidos
      if (recordsSynced > 0 && global.io) {
        global.io.to(this.tenantId).emit('new-orders', {
          marketplace: 'amazon',
          count: recordsSynced,
          timestamp: new Date()
        });
      }

      return { success: true, recordsSynced };

    } catch (error) {
      await client.query('ROLLBACK');
      secureLogger.error('Erro na sincronização de pedidos Amazon', {
        tenantId: this.tenantId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = AmazonOrderSync;