const axios = require('axios');
const pool = require('../../db/pool');
const secureLogger = require('../../utils/secureLogger');

class BuyBoxRealTimeService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.isRunning = false;
    this.syncInterval = 15 * 60 * 1000; // 15 minutos
    this.marketplaceId = process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER';
  }

  /**
   * Obtém access token usando refresh token
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: process.env.AMAZON_REFRESH_TOKEN,
          client_id: process.env.AMAZON_CLIENT_ID,
          client_secret: process.env.AMAZON_CLIENT_SECRET
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (3600 - 300) * 1000);
      
      secureLogger.info('✅ Token renovado com sucesso');
      return this.accessToken;
    } catch (error) {
      secureLogger.error('Erro ao obter token:', error.message);
      throw error;
    }
  }

  /**
   * Busca informações de listings (incluindo Buy Box) via API
   */
  async getListingsForASINs(asins) {
    const accessToken = await this.getAccessToken();
    const results = [];

    // API de Listings - máximo 20 ASINs por vez
    const chunks = [];
    for (let i = 0; i < asins.length; i += 20) {
      chunks.push(asins.slice(i, i + 20));
    }

    for (const chunk of chunks) {
      try {
        // Usar API de Listings que retorna informações de Buy Box
        const response = await axios.get(
          `https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'x-amz-access-token': accessToken,
              'Content-Type': 'application/json'
            },
            params: {
              marketplaceIds: this.marketplaceId,
              sellerSku: chunk.join(','), // Assumindo que SKU = ASIN para simplificar
              includedData: 'offers,buyBoxPrices'
            }
          }
        );

        if (response.data && response.data.items) {
          results.push(...response.data.items);
        }
      } catch (error) {
        // Se Listings API falhar, tentar Inventory API como backup
        console.log('Listings API falhou, tentando Inventory API...');
        await this.getInventoryData(chunk, results, accessToken);
      }

      // Respeitar rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Fallback: Busca dados via Inventory API
   */
  async getInventoryData(asins, results, accessToken) {
    try {
      const response = await axios.get(
        `https://sellingpartnerapi-na.amazon.com/fba/inventory/v1/summaries`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json'
          },
          params: {
            marketplaceIds: this.marketplaceId,
            granularityType: 'Marketplace',
            granularityId: this.marketplaceId
          }
        }
      );

      if (response.data && response.data.inventorySummaries) {
        // Mapear dados de inventory para formato esperado
        for (const item of response.data.inventorySummaries) {
          if (asins.includes(item.asin)) {
            results.push({
              asin: item.asin,
              fnSku: item.fnSku,
              totalQuantity: item.totalQuantity
            });
          }
        }
      }
    } catch (error) {
      console.error('Erro na Inventory API:', error.message);
    }
  }

  /**
   * Sincroniza Buy Box de todos os produtos
   */
  async syncAllBuyBoxData() {
    console.log('🔄 Iniciando sincronização em tempo real do Buy Box...');
    
    try {
      // Buscar todos os produtos ativos
      const productsResult = await pool.query(`
        SELECT DISTINCT asin, name, price
        FROM products
        WHERE asin IS NOT NULL
        AND asin != ''
        ORDER BY price DESC NULLS LAST
      `);

      const products = productsResult.rows;
      console.log(`📦 ${products.length} produtos para sincronizar`);

      const asins = products.map(p => p.asin);
      const listingsData = await this.getListingsForASINs(asins);

      let updates = 0;
      let changes = 0;

      // Processar cada produto
      for (const product of products) {
        const listing = listingsData.find(l => l.asin === product.asin);
        
        // Buscar dados atuais do banco
        const currentResult = await pool.query(
          'SELECT * FROM buy_box_winners WHERE product_asin = $1',
          [product.asin]
        );
        
        const current = currentResult.rows[0];
        let hasChanged = false;

        if (listing && listing.offers && listing.offers.length > 0) {
          // Encontrar oferta com Buy Box
          const buyBoxOffer = listing.offers.find(o => o.isBuyBoxWinner);
          
          if (buyBoxOffer) {
            const newWinnerId = buyBoxOffer.sellerId;
            const newPrice = buyBoxOffer.price?.amount;
            const isOurOffer = buyBoxOffer.sellerId === process.env.AMAZON_SELLER_ID;
            
            // Verificar se houve mudança
            if (current && (
              current.buy_box_winner_id !== newWinnerId ||
              current.buy_box_price !== newPrice ||
              current.is_winner !== isOurOffer
            )) {
              hasChanged = true;
              changes++;
            }

            // Atualizar banco
            await pool.query(`
              INSERT INTO buy_box_winners (
                product_asin, is_winner, buy_box_price, 
                buy_box_winner_id, buy_box_winner_name,
                competitor_count, our_price, checked_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
              ON CONFLICT (product_asin) DO UPDATE SET
                is_winner = EXCLUDED.is_winner,
                buy_box_price = EXCLUDED.buy_box_price,
                buy_box_winner_id = EXCLUDED.buy_box_winner_id,
                buy_box_winner_name = EXCLUDED.buy_box_winner_name,
                competitor_count = EXCLUDED.competitor_count,
                our_price = EXCLUDED.our_price,
                checked_at = NOW(),
                updated_at = NOW()
            `, [
              product.asin,
              isOurOffer,
              newPrice,
              newWinnerId,
              isOurOffer ? 'Connect Brands' : `Seller ${newWinnerId}`,
              listing.offers.length - 1,
              product.price
            ]);

            updates++;

            if (hasChanged) {
              console.log(`🔄 ${product.asin}: Mudança detectada!`);
              if (current.is_winner && !isOurOffer) {
                console.log(`   ❌ PERDEMOS o Buy Box para ${newWinnerId}`);
              } else if (!current.is_winner && isOurOffer) {
                console.log(`   ✅ GANHAMOS o Buy Box!`);
              }
            }
          }
        } else {
          // Produto sem ofertas ativas
          await pool.query(`
            UPDATE buy_box_winners
            SET 
              buy_box_price = NULL,
              buy_box_winner_id = NULL,
              buy_box_winner_name = 'Sem ofertas ativas',
              is_winner = false,
              checked_at = NOW()
            WHERE product_asin = $1
          `, [product.asin]);
        }
      }

      console.log(`\n✅ Sincronização concluída:`);
      console.log(`   📊 ${updates} produtos atualizados`);
      console.log(`   🔄 ${changes} mudanças detectadas`);

      // Registrar sincronização
      await pool.query(`
        UPDATE buy_box_sync_config
        SET last_sync_at = NOW()
        WHERE id = 1
      `);

      return { updates, changes };

    } catch (error) {
      secureLogger.error('Erro na sincronização:', error);
      throw error;
    }
  }

  /**
   * Inicia monitoramento contínuo
   */
  async startRealTimeMonitoring() {
    if (this.isRunning) {
      console.log('⚠️ Monitoramento já está em execução');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Iniciando monitoramento em tempo real do Buy Box');
    console.log(`   Intervalo: ${this.syncInterval / 1000 / 60} minutos`);

    // Sincronização inicial
    await this.syncAllBuyBoxData();

    // Configurar sincronização periódica
    this.syncTimer = setInterval(async () => {
      try {
        await this.syncAllBuyBoxData();
      } catch (error) {
        console.error('Erro na sincronização periódica:', error.message);
      }
    }, this.syncInterval);

    // Escutar notificações do PostgreSQL
    const client = await pool.connect();
    await client.query('LISTEN buy_box_change');
    
    client.on('notification', (msg) => {
      if (msg.channel === 'buy_box_change') {
        const data = JSON.parse(msg.payload);
        console.log('🔔 Mudança detectada em tempo real:', data);
        
        // Aqui você pode adicionar lógica adicional
        // como enviar notificação, email, etc.
      }
    });

    console.log('✅ Monitoramento em tempo real ativo');
  }

  /**
   * Para o monitoramento
   */
  stopMonitoring() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.isRunning = false;
      console.log('🛑 Monitoramento parado');
    }
  }
}

module.exports = new BuyBoxRealTimeService();