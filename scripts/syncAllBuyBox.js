require('dotenv').config();
const axios = require('axios');
const pool = require('../server/db/pool');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

class CompleteBuyBoxSync {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.endpoint = 'https://sellingpartnerapi-na.amazon.com';
    this.results = {
      total: 0,
      processed: 0,
      withBuyBox: 0,
      withoutBuyBox: 0,
      errors: 0,
      buyBoxWinners: []
    };
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
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
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

  async getSellerInfo(sellerId) {
    try {
      // Primeiro verificar se já temos no cache
      const cached = await executeSQL(
        'SELECT seller_name FROM sellers_cache WHERE seller_id = $1',
        [sellerId]
      );
      
      if (cached.rows.length > 0) {
        return cached.rows[0].seller_name;
      }

      // Se não temos, buscar na API
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.endpoint}/sellers/v1/sellers/${sellerId}`,
        {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json'
          }
        }
      );

      const sellerName = response.data.payload?.businessName || response.data.payload?.sellerName || sellerId;
      
      // Salvar no cache
      await executeSQL(`
        INSERT INTO sellers_cache (seller_id, seller_name, last_updated)
        VALUES ($1, $2, NOW())
        ON CONFLICT (seller_id) 
        DO UPDATE SET seller_name = EXCLUDED.seller_name, last_updated = NOW()
      `, [sellerId, sellerName]);

      return sellerName;
    } catch (error) {
      // Se não conseguir buscar, retornar o ID mesmo
      return sellerId;
    }
  }

  async getBuyBoxData(asin) {
    try {
      const token = await this.getAccessToken();
      
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
      if (error.response?.status === 429) {
        console.error(`⏳ Rate limit para ${asin}. Aguardando...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await this.getBuyBoxData(asin); // Retry
      }
      throw error;
    }
  }

  async processBuyBoxData(asin, offersData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const offers = offersData.Offers || [];
      const summary = offersData.Summary;
      
      // Identificar o Buy Box winner
      const buyBoxWinner = offers.find(offer => offer.IsBuyBoxWinner);
      const ourSellerId = process.env.AMAZON_SELLER_ID;
      const weHaveBuyBox = buyBoxWinner?.SellerId === ourSellerId;
      
      let buyBoxWinnerName = 'Nenhum';
      if (buyBoxWinner) {
        buyBoxWinnerName = await this.getSellerInfo(buyBoxWinner.SellerId);
      }
      
      // Nossa oferta
      const ourOffer = offers.find(offer => offer.SellerId === ourSellerId);
      const ourPrice = ourOffer?.ListingPrice?.Amount;
      
      // Preço do Buy Box
      const buyBoxPrice = summary?.BuyBoxPrices?.[0]?.LandedPrice?.Amount || 
                         buyBoxWinner?.ListingPrice?.Amount;

      // Buscar nome do produto
      const productResult = await client.query(
        'SELECT name FROM products WHERE asin = $1',
        [asin]
      );
      const productName = productResult.rows[0]?.name || asin;

      // Salvar status do Buy Box
      await client.query(`
        INSERT INTO buy_box_winners (
          product_asin,
          is_winner,
          our_price,
          buy_box_price,
          competitor_count,
          checked_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (product_asin) 
        DO UPDATE SET
          is_winner = EXCLUDED.is_winner,
          our_price = EXCLUDED.our_price,
          buy_box_price = EXCLUDED.buy_box_price,
          competitor_count = EXCLUDED.competitor_count,
          checked_at = NOW()
      `, [
        asin,
        weHaveBuyBox,
        ourPrice,
        buyBoxPrice,
        offers.length - 1
      ]);

      // Salvar informação do Buy Box winner
      if (buyBoxWinner) {
        await client.query(`
          INSERT INTO competitor_tracking_advanced (
            asin,
            tenant_id,
            timestamp,
            buy_box_price,
            buy_box_seller,
            buy_box_seller_name,
            our_price,
            our_has_buy_box,
            total_offers
          ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8)
        `, [
          asin,
          1, // tenant_id padrão
          buyBoxPrice,
          buyBoxWinner.SellerId,
          buyBoxWinnerName,
          ourPrice,
          weHaveBuyBox,
          offers.length
        ]);
      }

      await client.query('COMMIT');

      // Adicionar ao resultado
      this.results.buyBoxWinners.push({
        asin,
        productName,
        weHaveBuyBox,
        buyBoxWinner: buyBoxWinnerName,
        ourPrice,
        buyBoxPrice,
        totalOffers: offers.length
      });

      if (weHaveBuyBox) {
        this.results.withBuyBox++;
        console.log(`✅ ${asin}: TEMOS o Buy Box! Nossa: $${ourPrice}`);
      } else if (buyBoxWinner) {
        this.results.withoutBuyBox++;
        console.log(`❌ ${asin}: Buy Box com "${buyBoxWinnerName}" | Nossa: $${ourPrice} | Buy Box: $${buyBoxPrice}`);
      } else {
        this.results.withoutBuyBox++;
        console.log(`⚠️ ${asin}: Sem Buy Box (sem ofertas ativas)`);
      }

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async syncAllProducts() {
    console.log('🚀 Iniciando sincronização completa de Buy Box...\n');
    
    // Criar tabela sellers_cache se não existir
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS sellers_cache (
        seller_id VARCHAR(50) PRIMARY KEY,
        seller_name VARCHAR(255),
        last_updated TIMESTAMP DEFAULT NOW()
      )
    `);

    // Criar coluna buy_box_seller_name se não existir
    await executeSQL(`
      ALTER TABLE competitor_tracking_advanced 
      ADD COLUMN IF NOT EXISTS buy_box_seller_name VARCHAR(255)
    `).catch(() => {}); // Ignorar erro se coluna já existir

    // Buscar TODOS os produtos
    const productsResult = await executeSQL(`
      SELECT DISTINCT asin, name 
      FROM products 
      WHERE marketplace = 'amazon' 
      ORDER BY asin
    `);

    const products = productsResult.rows;
    this.results.total = products.length;
    
    console.log(`📦 Total de produtos para sincronizar: ${products.length}\n`);
    console.log('🔐 Obtendo token de acesso...');
    await this.getAccessToken();
    console.log('✅ Token obtido!\n');

    // Processar em lotes para evitar timeout
    const batchSize = 10;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      console.log(`\n📦 Processando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(products.length/batchSize)}...`);
      
      for (const product of batch) {
        try {
          process.stdout.write(`🔍 ${product.asin}... `);
          const offersData = await this.getBuyBoxData(product.asin);
          
          if (offersData) {
            await this.processBuyBoxData(product.asin, offersData);
            this.results.processed++;
          } else {
            console.log('sem dados');
            this.results.errors++;
          }
        } catch (error) {
          console.error(`❌ Erro: ${error.message}`);
          this.results.errors++;
        }

        // Rate limiting: aguardar entre requisições
        await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2 segundos
      }
      
      // Pausa maior entre lotes
      if (i + batchSize < products.length) {
        console.log('\n⏳ Aguardando 5 segundos antes do próximo lote...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Gerar relatório final
    this.generateReport();
  }

  async generateReport() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RELATÓRIO FINAL - SINCRONIZAÇÃO BUY BOX');
    console.log('='.repeat(80));
    
    console.log(`\n📈 ESTATÍSTICAS GERAIS:`);
    console.log(`   Total de produtos: ${this.results.total}`);
    console.log(`   Processados com sucesso: ${this.results.processed}`);
    console.log(`   Com Buy Box: ${this.results.withBuyBox} (${((this.results.withBuyBox/this.results.processed)*100).toFixed(1)}%)`);
    console.log(`   Sem Buy Box: ${this.results.withoutBuyBox} (${((this.results.withoutBuyBox/this.results.processed)*100).toFixed(1)}%)`);
    console.log(`   Erros: ${this.results.errors}`);

    // Listar produtos que TEMOS o Buy Box
    const ourBuyBoxProducts = this.results.buyBoxWinners.filter(p => p.weHaveBuyBox);
    if (ourBuyBoxProducts.length > 0) {
      console.log(`\n✅ PRODUTOS ONDE TEMOS O BUY BOX (${ourBuyBoxProducts.length}):`);
      ourBuyBoxProducts.forEach(p => {
        console.log(`   ${p.asin} - ${p.productName.substring(0, 50)}... | $${p.ourPrice}`);
      });
    }

    // Listar top competidores
    const competitorCounts = {};
    this.results.buyBoxWinners
      .filter(p => !p.weHaveBuyBox && p.buyBoxWinner !== 'Nenhum')
      .forEach(p => {
        competitorCounts[p.buyBoxWinner] = (competitorCounts[p.buyBoxWinner] || 0) + 1;
      });

    const sortedCompetitors = Object.entries(competitorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (sortedCompetitors.length > 0) {
      console.log(`\n🏆 TOP 10 COMPETIDORES COM MAIS BUY BOXES:`);
      sortedCompetitors.forEach(([name, count], index) => {
        console.log(`   ${index + 1}. ${name}: ${count} produtos`);
      });
    }

    // Salvar relatório em arquivo
    const fs = require('fs');
    const reportContent = {
      date: new Date().toISOString(),
      statistics: this.results,
      timestamp: new Date().toLocaleString('pt-BR')
    };

    fs.writeFileSync(
      'buy_box_report.json',
      JSON.stringify(reportContent, null, 2)
    );

    console.log('\n💾 Relatório completo salvo em: buy_box_report.json');
    console.log('='.repeat(80));
  }
}

// Executar sincronização
async function main() {
  const sync = new CompleteBuyBoxSync();
  
  try {
    await sync.syncAllProducts();
  } catch (error) {
    console.error('❌ Erro fatal:', error);
  }
  
  process.exit(0);
}

main();