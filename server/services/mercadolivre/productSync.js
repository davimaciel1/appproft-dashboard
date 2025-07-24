const pool = require('../../db/pool');
const secureLogger = require('../../utils/secureLogger');
const MercadoLivreService = require('../mercadolivreService');

class MLProductSync {
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

  async syncProducts() {
    await this.initializeService();
    
    let recordsSynced = 0;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Log início da sincronização
      const syncLogResult = await client.query(`
        INSERT INTO sync_logs (tenant_id, marketplace, sync_type, status, started_at)
        VALUES ($1, 'mercadolivre', 'products', 'running', NOW())
        RETURNING id
      `, [this.tenantId]);
      const syncLogId = syncLogResult.rows[0].id;

      console.log(`🔄 Sincronizando produtos Mercado Livre para tenant ${this.tenantId}...`);

      // 1. Buscar produtos ativos do Mercado Livre
      const products = await this.mlService.getActiveListings();

      for (const product of products) {
        try {
          // Buscar detalhes completos do produto
          let productDetails = null;
          let imageUrl = null;

          try {
            productDetails = await this.mlService.getItem(product.id);

            // Extrair imagem principal
            if (productDetails.pictures && productDetails.pictures.length > 0) {
              imageUrl = productDetails.pictures[0].url || productDetails.pictures[0].secure_url;
            }
          } catch (detailsError) {
            // Continuar mesmo se falhar ao buscar detalhes
            secureLogger.warn('Erro ao buscar detalhes do produto ML', {
              itemId: product.id,
              error: detailsError.message
            });
          }

          // Inserir/atualizar produto
          await client.query(`
            INSERT INTO products (
              tenant_id, marketplace, marketplace_id, sku, name, image_url, 
              brand, category, status, synced_at
            ) VALUES ($1, 'mercadolivre', $2, $3, $4, $5, $6, $7, 'active', NOW())
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
            product.id,
            product.id, // ML usa o mesmo ID
            productDetails?.title || product.title || `Produto ${product.id}`,
            imageUrl,
            productDetails?.brand || null,
            productDetails?.category_id || null
          ]);

          recordsSynced++;

          // Rate limiting - ML API: 10 req/s
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          secureLogger.error('Erro ao processar produto ML', {
            itemId: product.id,
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

      console.log(`✅ ML produtos sincronizados: ${recordsSynced} itens`);
      return { success: true, recordsSynced };

    } catch (error) {
      await client.query('ROLLBACK');
      secureLogger.error('Erro na sincronização de produtos ML', {
        tenantId: this.tenantId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = MLProductSync;