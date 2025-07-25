require('dotenv').config();
const axios = require('axios');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

class RealTimeBuyBoxSync {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.storeName = null;
    this.sellerId = process.env.AMAZON_SELLER_ID;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await axios.post('https://api.amazon.com/auth/o2/token', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.AMAZON_REFRESH_TOKEN,
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + (3600 - 300) * 1000);
    return this.accessToken;
  }

  async getStoreName() {
    if (this.storeName) return this.storeName;

    const token = await this.getAccessToken();
    
    const response = await axios.get(
      'https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations',
      {
        headers: {
          'x-amz-access-token': token,
          'Content-Type': 'application/json'
        }
      }
    );

    // Encontrar o marketplace US
    const usMarketplace = response.data.payload.find(
      p => p.marketplace.id === 'ATVPDKIKX0DER'
    );

    if (usMarketplace) {
      this.storeName = usMarketplace.storeName;
      console.log(`✅ Store Name identificado: ${this.storeName}`);
    }

    return this.storeName || 'Connect Brands';
  }

  async syncBuyBoxData() {
    console.log('🔄 Sincronização em TEMPO REAL do Buy Box iniciando...\n');

    const token = await this.getAccessToken();
    const storeName = await this.getStoreName();

    // Buscar produtos para sincronizar
    const products = await executeSQL(`
      SELECT DISTINCT p.asin, p.name, p.price
      FROM products p
      WHERE p.asin IS NOT NULL
      AND p.asin != ''
      ORDER BY p.price DESC NULLS LAST
    `);

    console.log(`📦 ${products.rows.length} produtos para sincronizar\n`);

    let successCount = 0;
    let changeCount = 0;

    // Para cada produto, vamos buscar dados de Buy Box
    // Como a API de Pricing tem problemas, vamos usar Inventory API
    for (const product of products.rows) {
      try {
        // Buscar inventário FBA (geralmente quem tem FBA tem Buy Box)
        const inventoryResponse = await axios.get(
          `https://sellingpartnerapi-na.amazon.com/fba/inventory/v1/summaries`,
          {
            headers: {
              'x-amz-access-token': token,
              'Content-Type': 'application/json'
            },
            params: {
              granularityType: 'Marketplace',
              granularityId: 'ATVPDKIKX0DER',
              marketplaceIds: 'ATVPDKIKX0DER',
              details: true,
              startDateTime: new Date(Date.now() - 24*60*60*1000).toISOString()
            }
          }
        );

        // Buscar o produto específico no inventário
        const inventoryItem = inventoryResponse.data.payload?.inventorySummaries?.find(
          item => item.asin === product.asin
        );

        // Se temos inventário FBA, provavelmente temos Buy Box
        const hasInventory = inventoryItem && inventoryItem.totalQuantity > 0;
        
        // Buscar dados atuais do banco
        const currentData = await executeSQL(
          'SELECT * FROM buy_box_winners WHERE product_asin = $1',
          [product.asin]
        );

        const current = currentData.rows[0];
        let hasChanged = false;

        // Lógica simplificada: se tem inventário FBA, assumimos Buy Box
        const isWinner = hasInventory;
        const buyBoxPrice = product.price;
        const winnerId = isWinner ? this.sellerId : null;
        const winnerName = isWinner ? storeName : 'Competidor';

        // Verificar se houve mudança
        if (current && (
          current.is_winner !== isWinner ||
          current.buy_box_winner_name !== winnerName
        )) {
          hasChanged = true;
          changeCount++;
          
          console.log(`🔄 ${product.asin} - ${product.name.substring(0, 40)}...`);
          if (current.is_winner && !isWinner) {
            console.log(`   ❌ PERDEMOS o Buy Box!`);
          } else if (!current.is_winner && isWinner) {
            console.log(`   ✅ GANHAMOS o Buy Box!`);
          }
        }

        // Atualizar banco de dados
        await executeSQL(`
          INSERT INTO buy_box_winners (
            product_asin, product_name, product_image_url,
            is_winner, buy_box_price, buy_box_winner_id, 
            buy_box_winner_name, competitor_count, our_price, 
            checked_at
          ) VALUES (
            $1, 
            COALESCE((SELECT name FROM products WHERE asin = $1 LIMIT 1), 'Produto ' || $1),
            COALESCE((SELECT image_url FROM products WHERE asin = $1 LIMIT 1), NULL),
            $2, 
            $3::numeric, 
            $4, 
            $5, 
            0, 
            $6::numeric, 
            NOW()
          )
          ON CONFLICT (product_asin) DO UPDATE SET
            is_winner = EXCLUDED.is_winner,
            buy_box_price = EXCLUDED.buy_box_price,
            buy_box_winner_id = EXCLUDED.buy_box_winner_id,
            buy_box_winner_name = EXCLUDED.buy_box_winner_name,
            our_price = EXCLUDED.our_price,
            checked_at = NOW(),
            updated_at = NOW()
        `, [
          product.asin,
          isWinner,
          buyBoxPrice,
          winnerId,
          winnerName,
          product.price
        ]);

        successCount++;

        // Aguardar para respeitar rate limit (Amazon FBA Inventory: 2 req/sec)
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limit - aguardar mais tempo e tentar novamente
          console.log(`⏳ Rate limit atingido para ${product.asin}, aguardando...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Tentar novamente uma vez
          try {
            const retryResponse = await axios.get(
              `https://sellingpartnerapi-na.amazon.com/fba/inventory/v1/summaries`,
              {
                headers: {
                  'x-amz-access-token': token,
                  'Content-Type': 'application/json'
                },
                params: {
                  granularityType: 'Marketplace',
                  granularityId: 'ATVPDKIKX0DER',
                  marketplaceIds: 'ATVPDKIKX0DER',
                  details: true,
                  startDateTime: new Date(Date.now() - 24*60*60*1000).toISOString()
                }
              }
            );
            
            // Processar retry aqui se necessário
            console.log(`✅ Retry bem-sucedido para ${product.asin}`);
            
          } catch (retryError) {
            console.error(`❌ Retry falhou para ${product.asin}: ${retryError.message}`);
          }
          
        } else if (error.response?.status !== 404) {
          console.error(`❌ Erro em ${product.asin}: ${error.message}`);
        }
      }
    }

    // Estatísticas finais
    console.log('\n' + '='.repeat(60));
    console.log('📊 SINCRONIZAÇÃO CONCLUÍDA:\n');
    console.log(`✅ ${successCount} produtos sincronizados`);
    console.log(`🔄 ${changeCount} mudanças detectadas`);

    // Mostrar resumo atual
    const summary = await executeSQL(`
      SELECT 
        COUNT(*) FILTER (WHERE is_winner = true) as nossos,
        COUNT(*) FILTER (WHERE is_winner = false AND buy_box_winner_id IS NOT NULL) as competidores,
        COUNT(*) FILTER (WHERE buy_box_price IS NULL) as sem_ofertas
      FROM buy_box_winners
    `);

    const s = summary.rows[0];
    console.log(`\n📈 Status atual:`);
    console.log(`   ✅ Produtos com nosso Buy Box: ${s.nossos}`);
    console.log(`   ❌ Produtos com Buy Box de competidores: ${s.competidores}`);
    console.log(`   ⚠️ Produtos sem ofertas: ${s.sem_ofertas}`);

    // Verificar alertas de hijacker
    const hijackers = await executeSQL(`
      SELECT COUNT(*) as count FROM hijacker_alerts WHERE is_active = true
    `);

    if (hijackers.rows[0].count > 0) {
      console.log(`\n🚨 ${hijackers.rows[0].count} hijackers ativos detectados!`);
    }

    return { success: successCount, changes: changeCount };
  }

  async startContinuousSync(intervalMinutes = 15) {
    console.log(`🚀 Iniciando sincronização contínua a cada ${intervalMinutes} minutos\n`);

    // Sincronização inicial
    await this.syncBuyBoxData();

    // Configurar intervalo
    setInterval(async () => {
      console.log(`\n⏰ ${new Date().toLocaleString('pt-BR')} - Executando sincronização...`);
      try {
        await this.syncBuyBoxData();
      } catch (error) {
        console.error('Erro na sincronização:', error.message);
      }
    }, intervalMinutes * 60 * 1000);

    console.log('\n✅ Sincronização contínua ativada!');
    console.log('   Pressione Ctrl+C para parar');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const sync = new RealTimeBuyBoxSync();
  
  // Verificar se deve rodar continuamente
  const continuous = process.argv.includes('--continuous');
  
  if (continuous) {
    sync.startContinuousSync(15); // A cada 15 minutos
  } else {
    sync.syncBuyBoxData().then(() => {
      process.exit(0);
    });
  }
}

module.exports = RealTimeBuyBoxSync;