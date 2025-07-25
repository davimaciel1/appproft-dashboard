const axios = require('axios');
const pool = require('../../db/pool');

class BuyBoxSimple {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.endpoint = 'https://sellingpartnerapi-na.amazon.com';
  }

  async getAccessToken() {
    // Se o token ainda é válido, retorná-lo
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      console.log('🔐 Renovando token de acesso...');
      
      const response = await axios.post('https://api.amazon.com/auth/o2/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: process.env.AMAZON_REFRESH_TOKEN,
          client_id: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
          client_secret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Token expira em 1 hora, renovar 5 minutos antes
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      
      console.log('✅ Token obtido com sucesso!');
      return this.accessToken;
      
    } catch (error) {
      console.error('❌ Erro ao obter token:', error.response?.data || error.message);
      throw error;
    }
  }

  async getBuyBoxData(asin) {
    try {
      const token = await this.getAccessToken();
      
      console.log(`🔍 Buscando Buy Box para ASIN: ${asin}`);
      
      // Buscar ofertas do produto
      const response = await axios.get(
        `${this.endpoint}/products/pricing/v0/items/${asin}/offers`,
        {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json'
          },
          params: {
            MarketplaceId: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
            ItemCondition: 'New',
            CustomerType: 'Consumer'
          }
        }
      );

      return response.data.payload;
      
    } catch (error) {
      if (error.response?.status === 403) {
        console.error(`❌ Acesso negado para ASIN ${asin}. Verifique as permissões da aplicação.`);
      } else if (error.response?.status === 404) {
        console.error(`❌ ASIN ${asin} não encontrado no marketplace.`);
      } else {
        console.error(`❌ Erro ao buscar ASIN ${asin}:`, error.response?.data || error.message);
      }
      return null;
    }
  }

  async saveBuyBoxData(asin, offersData) {
    if (!offersData) return false;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const offers = offersData.Offers || [];
      const summary = offersData.Summary;
      
      // Identificar quem tem o Buy Box
      const buyBoxWinner = offers.find(offer => offer.IsBuyBoxWinner);
      const ourSellerId = process.env.AMAZON_SELLER_ID;
      const weHaveBuyBox = buyBoxWinner?.SellerId === ourSellerId;
      
      // Nossa oferta
      const ourOffer = offers.find(offer => offer.SellerId === ourSellerId);
      const ourPrice = ourOffer?.ListingPrice?.Amount;
      
      // Preço do Buy Box
      const buyBoxPrice = summary?.BuyBoxPrices?.[0]?.LandedPrice?.Amount || 
                         buyBoxWinner?.ListingPrice?.Amount;

      // Verificar se já existe registro anterior
      const previousResult = await client.query(
        'SELECT is_winner FROM buy_box_winners WHERE product_asin = $1',
        [asin]
      );
      
      const hadBuyBoxBefore = previousResult.rows[0]?.is_winner;

      // Salvar ou atualizar status do Buy Box
      await client.query(`
        INSERT INTO buy_box_winners (
          product_asin,
          is_winner,
          our_price,
          buy_box_price,
          competitor_count,
          buy_box_winner_id,
          buy_box_winner_name,
          checked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (product_asin) 
        DO UPDATE SET
          is_winner = EXCLUDED.is_winner,
          our_price = EXCLUDED.our_price,
          buy_box_price = EXCLUDED.buy_box_price,
          competitor_count = EXCLUDED.competitor_count,
          buy_box_winner_id = EXCLUDED.buy_box_winner_id,
          buy_box_winner_name = EXCLUDED.buy_box_winner_name,
          checked_at = NOW()
      `, [
        asin,
        weHaveBuyBox,
        ourPrice,
        buyBoxPrice,
        offers.length - 1,
        buyBoxWinner?.SellerId || null,
        buyBoxWinner?.SellerName || buyBoxWinner?.SellerId || null
      ]);

      // Se houve mudança no status do Buy Box, registrar no histórico
      if (previousResult.rows.length > 0 && hadBuyBoxBefore !== weHaveBuyBox) {
        await client.query(`
          INSERT INTO buy_box_history (
            product_asin,
            change_type,
            old_winner,
            new_winner,
            old_price,
            new_price,
            changed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          asin,
          weHaveBuyBox ? 'won' : 'lost',
          hadBuyBoxBefore ? ourSellerId : (buyBoxWinner?.SellerId || 'unknown'),
          weHaveBuyBox ? ourSellerId : (buyBoxWinner?.SellerId || 'unknown'),
          ourPrice,
          buyBoxPrice
        ]);
        
        console.log(`🔔 Buy Box ${weHaveBuyBox ? 'GANHO' : 'PERDIDO'} para ${asin}`);
      }

      // Salvar dados de todos os competidores
      for (const offer of offers) {
        await client.query(`
          INSERT INTO competitor_pricing (
            product_asin,
            seller_id,
            price,
            shipping_cost,
            is_fba,
            is_buy_box,
            condition,
            collected_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          asin,
          offer.SellerId,
          offer.ListingPrice?.Amount || 0,
          offer.Shipping?.Amount || 0,
          offer.IsFulfilledByAmazon || false,
          offer.IsBuyBoxWinner || false,
          offer.SubCondition || 'New'
        ]);
      }

      await client.query('COMMIT');
      
      console.log(`✅ ${asin}: ${weHaveBuyBox ? 'COM Buy Box' : 'SEM Buy Box'} | Nossa: $${ourPrice} | Buy Box: $${buyBoxPrice}`);
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao salvar dados:', error.message);
      return false;
    } finally {
      client.release();
    }
  }

  async syncBuyBoxForProducts() {
    try {
      // Buscar produtos ativos
      const result = await pool.query(`
        SELECT DISTINCT asin 
        FROM products 
        WHERE marketplace = 'amazon' 
        ORDER BY asin
      `);

      const asins = result.rows.map(row => row.asin);
      console.log(`\n📦 Sincronizando Buy Box para ${asins.length} produtos...\n`);

      let success = 0;
      let errors = 0;

      // Processar em lotes pequenos
      for (let i = 0; i < asins.length; i++) {
        const asin = asins[i];
        
        try {
          const offersData = await this.getBuyBoxData(asin);
          if (offersData) {
            const saved = await this.saveBuyBoxData(asin, offersData);
            if (saved) success++;
            else errors++;
          } else {
            errors++;
          }
        } catch (error) {
          console.error(`❌ Erro em ${asin}:`, error.message);
          errors++;
        }

        // Rate limiting: aguardar 1 segundo entre requisições
        if (i < asins.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`\n✅ Sincronização concluída!`);
      console.log(`   Sucessos: ${success}`);
      console.log(`   Erros: ${errors}`);

      return { total: asins.length, success, errors };

    } catch (error) {
      console.error('❌ Erro geral na sincronização:', error);
      throw error;
    }
  }
}

module.exports = new BuyBoxSimple();