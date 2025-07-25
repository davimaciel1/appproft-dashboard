require('dotenv').config();
const axios = require('axios');
const { executeSQL, ensureConnection } = require('../DATABASE_ACCESS_CONFIG');

class SellerNameUpdater {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.endpoint = 'https://sellingpartnerapi-na.amazon.com';
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: process.env.AMAZON_REFRESH_TOKEN,
          client_id: process.env.AMAZON_CLIENT_ID || process.env.LWA_CLIENT_ID,
          client_secret: process.env.AMAZON_CLIENT_SECRET || process.env.LWA_CLIENT_SECRET
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('❌ Erro ao obter token:', error.response?.data || error.message);
      throw error;
    }
  }

  async getSellerName(sellerId) {
    try {
      // Para o vendedor principal (você), buscar informações da conta
      if (sellerId === process.env.AMAZON_SELLER_ID) {
        return await this.getOwnSellerInfo();
      }

      // Para outros vendedores, tentar buscar via API (limitado)
      // A API da Amazon tem limitações para buscar info de outros vendedores
      return sellerId; // Retorna o ID se não conseguir o nome
    } catch (error) {
      console.error(`Erro ao buscar nome do vendedor ${sellerId}:`, error.message);
      return sellerId;
    }
  }

  async getOwnSellerInfo() {
    try {
      const token = await this.getAccessToken();
      
      // Buscar informações do próprio vendedor
      const response = await axios.get(
        `${this.endpoint}/sellers/v1/marketplaceParticipations`,
        {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json'
          }
        }
      );

      // Extrair nome da conta/empresa
      const participations = response.data.payload || [];
      for (const participation of participations) {
        if (participation.marketplace.id === process.env.SP_API_MARKETPLACE_ID) {
          const accountInfo = participation.participation;
          return accountInfo.sellerName || accountInfo.businessName || process.env.AMAZON_SELLER_ID;
        }
      }

      return process.env.AMAZON_SELLER_ID;
    } catch (error) {
      console.error('Erro ao buscar informações do vendedor:', error.message);
      return process.env.AMAZON_SELLER_ID;
    }
  }

  async updateAllSellerNames() {
    console.log('🔄 Atualizando nomes dos vendedores...\n');

    if (!await ensureConnection()) {
      console.error('❌ Não foi possível conectar ao banco de dados');
      return;
    }

    try {
      // 1. Buscar o nome da sua própria empresa
      console.log('🏢 Buscando informações da sua empresa...');
      const yourSellerName = await this.getOwnSellerInfo();
      console.log(`✅ Sua empresa: ${yourSellerName} (ID: ${process.env.AMAZON_SELLER_ID})\n`);

      // 2. Salvar na tabela sellers_cache
      await executeSQL(`
        INSERT INTO sellers_cache (seller_id, seller_name, last_updated)
        VALUES ($1, $2, NOW())
        ON CONFLICT (seller_id) 
        DO UPDATE SET seller_name = EXCLUDED.seller_name, last_updated = NOW()
      `, [process.env.AMAZON_SELLER_ID, yourSellerName]);

      // 3. Atualizar buy_box_winners com o nome correto
      console.log('📝 Atualizando tabela buy_box_winners...');
      
      // Atualizar onde você tem o Buy Box
      await executeSQL(`
        UPDATE buy_box_winners
        SET buy_box_winner_name = $1
        WHERE buy_box_winner_id = $2
        OR (is_winner = true AND buy_box_winner_id IS NULL)
      `, [yourSellerName, process.env.AMAZON_SELLER_ID]);

      // 4. Buscar vendedores únicos para tentar obter nomes
      const sellers = await executeSQL(`
        SELECT DISTINCT buy_box_winner_id 
        FROM buy_box_winners 
        WHERE buy_box_winner_id IS NOT NULL
        AND buy_box_winner_id != $1
      `, [process.env.AMAZON_SELLER_ID]);

      console.log(`\n🔍 Vendedores únicos encontrados: ${sellers.rows.length}`);

      // 5. Para cada vendedor, tentar buscar o nome
      for (const seller of sellers.rows) {
        const sellerId = seller.buy_box_winner_id;
        console.log(`   Verificando ${sellerId}...`);
        
        // Por limitações da API, geralmente só conseguimos o nome do próprio vendedor
        // Para outros, mantemos o ID
        const sellerName = await this.getSellerName(sellerId);
        
        if (sellerName !== sellerId) {
          await executeSQL(`
            INSERT INTO sellers_cache (seller_id, seller_name, last_updated)
            VALUES ($1, $2, NOW())
            ON CONFLICT (seller_id) 
            DO UPDATE SET seller_name = EXCLUDED.seller_name, last_updated = NOW()
          `, [sellerId, sellerName]);

          await executeSQL(`
            UPDATE buy_box_winners
            SET buy_box_winner_name = $1
            WHERE buy_box_winner_id = $2
          `, [sellerName, sellerId]);
        }
      }

      // 6. Mostrar resultados atualizados
      console.log('\n📊 DADOS ATUALIZADOS NO BANCO:\n');
      
      const results = await executeSQL(`
        SELECT 
          bw.product_asin,
          p.name as product_name,
          bw.is_winner,
          bw.buy_box_winner_id,
          bw.buy_box_winner_name,
          bw.buy_box_price,
          bw.our_price,
          CASE 
            WHEN bw.is_winner = true THEN COALESCE(bw.buy_box_winner_name, $1)
            WHEN bw.buy_box_winner_name IS NOT NULL THEN bw.buy_box_winner_name
            WHEN bw.buy_box_winner_id IS NOT NULL THEN bw.buy_box_winner_id
            ELSE 'Sem Buy Box'
          END as empresa_com_buy_box
        FROM buy_box_winners bw
        LEFT JOIN products p ON bw.product_asin = p.asin
        WHERE bw.buy_box_price IS NOT NULL
        ORDER BY bw.is_winner DESC, bw.product_asin
      `, [yourSellerName]);

      console.table(results.rows.map(row => ({
        'ASIN': row.product_asin,
        'Produto': (row.product_name || '').substring(0, 30) + '...',
        'Empresa com Buy Box': row.empresa_com_buy_box,
        'Preço Buy Box': `$${row.buy_box_price}`,
        'Seu Preço': `$${row.our_price || 'N/A'}`
      })));

      console.log('\n✅ Nomes dos vendedores atualizados com sucesso!');

    } catch (error) {
      console.error('❌ Erro:', error);
    }
  }
}

// Executar
async function main() {
  const updater = new SellerNameUpdater();
  await updater.updateAllSellerNames();
  process.exit(0);
}

main();