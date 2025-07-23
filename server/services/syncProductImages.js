const pool = require('../db/pool');
const secureLogger = require('../utils/secureLogger');
const AmazonService = require('./amazonService');
const MercadoLivreService = require('./mercadolivreService');

class ProductImageSync {
  async syncAmazonProductImages(tenantId) {
    try {
      // Buscar produtos sem imagens
      const productsResult = await pool.query(
        `SELECT p.*, mc.client_id, mc.client_secret, mc.refresh_token, mc.seller_id, mc.marketplace_id
         FROM products p
         JOIN marketplace_credentials mc ON mc.user_id = p.tenant_id AND mc.marketplace = 'amazon'
         WHERE p.tenant_id = $1 
         AND p.marketplace = 'amazon'
         AND (p.image_url IS NULL OR p.image_url = '')`,
        [tenantId]
      );

      if (productsResult.rows.length === 0) {
        secureLogger.log('Nenhum produto Amazon sem imagem encontrado', { tenantId });
        return;
      }

      const credentials = {
        clientId: productsResult.rows[0].client_id,
        clientSecret: productsResult.rows[0].client_secret,
        refreshToken: productsResult.rows[0].refresh_token,
        sellerId: productsResult.rows[0].seller_id,
        marketplaceId: productsResult.rows[0].marketplace_id || 'A2Q3Y263D00KWC'
      };

      const amazonService = new AmazonService(credentials);

      for (const product of productsResult.rows) {
        try {
          if (!product.asin) continue;

          // Buscar detalhes do produto incluindo imagens
          const catalogItem = await amazonService.getCatalogItem(product.asin, {
            marketplaceIds: [credentials.marketplaceId],
            includedData: ['images', 'attributes', 'summaries']
          });

          // Encontrar imagem principal
          let mainImageUrl = null;
          
          if (catalogItem.images && catalogItem.images.length > 0) {
            for (const imageSet of catalogItem.images) {
              if (imageSet.images && imageSet.images.length > 0) {
                const mainImage = imageSet.images.find(img => img.variant === 'MAIN');
                if (mainImage && mainImage.link) {
                  mainImageUrl = mainImage.link;
                  break;
                }
                // Se não houver MAIN, pegar a primeira imagem disponível
                if (!mainImageUrl && imageSet.images[0].link) {
                  mainImageUrl = imageSet.images[0].link;
                }
              }
            }
          }

          if (mainImageUrl) {
            await pool.query(
              'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2',
              [mainImageUrl, product.id]
            );
            secureLogger.log('Imagem atualizada para produto Amazon', { 
              productId: product.id, 
              asin: product.asin 
            });
          }

          // Rate limiting - Amazon Catalog API tem limite de 2 req/s
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          secureLogger.error('Erro ao buscar imagem do produto Amazon', {
            productId: product.id,
            asin: product.asin,
            error: error.message
          });
        }
      }
    } catch (error) {
      secureLogger.error('Erro ao sincronizar imagens Amazon', {
        tenantId,
        error: error.message
      });
    }
  }

  async syncMercadoLivreProductImages(tenantId) {
    try {
      // Buscar produtos sem imagens
      const productsResult = await pool.query(
        `SELECT p.*, mc.client_id, mc.client_secret, mc.refresh_token, mc.seller_id
         FROM products p
         JOIN marketplace_credentials mc ON mc.user_id = p.tenant_id AND mc.marketplace = 'mercadolivre'
         WHERE p.tenant_id = $1 
         AND p.marketplace = 'mercadolivre'
         AND (p.image_url IS NULL OR p.image_url = '')`,
        [tenantId]
      );

      if (productsResult.rows.length === 0) {
        secureLogger.log('Nenhum produto ML sem imagem encontrado', { tenantId });
        return;
      }

      const credentials = {
        clientId: productsResult.rows[0].client_id,
        clientSecret: productsResult.rows[0].client_secret,
        refreshToken: productsResult.rows[0].refresh_token,
        sellerId: productsResult.rows[0].seller_id
      };

      const mlService = new MercadoLivreService(credentials);

      for (const product of productsResult.rows) {
        try {
          // ML usa o SKU como ID do item
          if (!product.sku) continue;

          // Buscar detalhes do item
          const item = await mlService.getItem(product.sku);

          if (item.pictures && item.pictures.length > 0) {
            // Pegar a primeira imagem (principal)
            const mainImageUrl = item.pictures[0].url || item.pictures[0].secure_url;

            if (mainImageUrl) {
              await pool.query(
                'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2',
                [mainImageUrl, product.id]
              );
              secureLogger.log('Imagem atualizada para produto ML', { 
                productId: product.id, 
                itemId: product.sku 
              });
            }
          }

          // Rate limiting - ML tem limite de 10 req/s
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          secureLogger.error('Erro ao buscar imagem do produto ML', {
            productId: product.id,
            sku: product.sku,
            error: error.message
          });
        }
      }
    } catch (error) {
      secureLogger.error('Erro ao sincronizar imagens ML', {
        tenantId,
        error: error.message
      });
    }
  }

  async syncAllProductImages(tenantId) {
    secureLogger.log('Iniciando sincronização de imagens de produtos', { tenantId });
    
    await Promise.all([
      this.syncAmazonProductImages(tenantId),
      this.syncMercadoLivreProductImages(tenantId)
    ]);
    
    secureLogger.log('Sincronização de imagens concluída', { tenantId });
  }
}

module.exports = new ProductImageSync();