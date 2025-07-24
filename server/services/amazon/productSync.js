const pool = require('../../db/pool');
const secureLogger = require('../../utils/secureLogger');
const AmazonService = require('../amazonService');

class AmazonProductSync {
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

  async syncProducts() {
    await this.initializeService();
    
    let recordsSynced = 0;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Log início da sincronização
      const syncLogResult = await client.query(`
        INSERT INTO sync_logs (tenant_id, marketplace, sync_type, status, started_at)
        VALUES ($1, 'amazon', 'products', 'running', NOW())
        RETURNING id
      `, [this.tenantId]);
      const syncLogId = syncLogResult.rows[0].id;

      console.log(`🔄 Sincronizando produtos Amazon para tenant ${this.tenantId}...`);

      // 1. Buscar produtos ativos da Amazon (usando Seller Central API)
      const products = await this.amazonService.getMyInventory();

      for (const product of products) {
        try {
          // Buscar detalhes do produto (incluindo imagens)
          let productDetails = null;
          let imageUrl = null;

          try {
            productDetails = await this.amazonService.getCatalogItem(product.asin, {
              marketplaceIds: [this.amazonService.marketplaceId],
              includedData: ['images', 'attributes', 'summaries']
            });

            // Extrair imagem principal
            if (productDetails?.images?.length > 0) {
              for (const imageSet of productDetails.images) {
                if (imageSet.images?.length > 0) {
                  const mainImage = imageSet.images.find(img => img.variant === 'MAIN');
                  if (mainImage?.link) {
                    imageUrl = mainImage.link;
                    break;
                  }
                  // Fallback para primeira imagem
                  if (!imageUrl && imageSet.images[0]?.link) {
                    imageUrl = imageSet.images[0].link;
                  }
                }
              }
            }
          } catch (catalogError) {
            // Continuar mesmo se falhar ao buscar detalhes
            secureLogger.warn('Erro ao buscar detalhes do produto Amazon', {
              asin: product.asin,
              error: catalogError.message
            });
          }

          // Inserir/atualizar produto
          await client.query(`
            INSERT INTO products (
              tenant_id, marketplace, marketplace_id, sku, name, image_url, 
              brand, category, status, synced_at
            ) VALUES ($1, 'amazon', $2, $3, $4, $5, $6, $7, 'active', NOW())
            ON CONFLICT (tenant_id, marketplace, marketplace_id)
            DO UPDATE SET
              sku = EXCLUDED.sku,
              name = EXCLUDED.name,
              image_url = COALESCE(EXCLUDED.image_url, products.image_url),
              brand = EXCLUDED.brand,
              category = EXCLUDED.category,
              synced_at = NOW()
          `, [
            this.tenantId,
            product.asin,
            product.sellerSku || product.asin,
            product.productName || `Produto ${product.asin}`,
            imageUrl,
            productDetails?.summaries?.[0]?.brand || null,
            productDetails?.summaries?.[0]?.productGroup || null
          ]);

          recordsSynced++;

          // Rate limiting - Amazon Catalog API: 2 req/s
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          secureLogger.error('Erro ao processar produto Amazon', {
            asin: product.asin,
            error: error.message
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

      console.log(`✅ Amazon produtos sincronizados: ${recordsSynced} itens`);
      return { success: true, recordsSynced };

    } catch (error) {
      await client.query('ROLLBACK');
      secureLogger.error('Erro na sincronização de produtos Amazon', {
        tenantId: this.tenantId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async syncInventory() {
    await this.initializeService();
    
    let recordsSynced = 0;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      console.log(`🔄 Sincronizando inventário Amazon para tenant ${this.tenantId}...`);

      // Buscar inventário atual
      const inventory = await this.amazonService.getInventory();

      for (const item of inventory) {
        try {
          // Encontrar produto correspondente
          const productResult = await client.query(`
            SELECT id FROM products 
            WHERE tenant_id = $1 AND marketplace = 'amazon' 
            AND (marketplace_id = $2 OR sku = $3)
            LIMIT 1
          `, [this.tenantId, item.asin, item.sellerSku]);

          if (productResult.rows.length > 0) {
            const productId = productResult.rows[0].id;

            // Inserir/atualizar inventário
            await client.query(`
              INSERT INTO inventory (product_id, quantity, updated_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (product_id)
              DO UPDATE SET
                quantity = EXCLUDED.quantity,
                updated_at = NOW()
            `, [productId, item.totalQuantity || 0]);

            recordsSynced++;
          }

        } catch (error) {
          secureLogger.error('Erro ao processar inventário Amazon', {
            asin: item.asin,
            error: error.message
          });
        }
      }

      await client.query('COMMIT');

      console.log(`✅ Amazon inventário sincronizado: ${recordsSynced} itens`);
      return { success: true, recordsSynced };

    } catch (error) {
      await client.query('ROLLBACK');
      secureLogger.error('Erro na sincronização de inventário Amazon', {
        tenantId: this.tenantId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = AmazonProductSync;