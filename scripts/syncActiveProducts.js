require('dotenv').config();
const buyBoxService = require('../server/services/amazon/buyBoxSimple');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function syncActiveProducts() {
  console.log('🔄 Sincronizando apenas produtos com ofertas ativas...\n');
  
  try {
    // Buscar apenas produtos que tiveram ofertas na última verificação
    const result = await executeSQL(`
      SELECT DISTINCT product_asin as asin
      FROM buy_box_winners 
      WHERE buy_box_price IS NOT NULL
      ORDER BY product_asin
    `);

    console.log(`📦 Produtos ativos encontrados: ${result.rows.length}\n`);

    for (const product of result.rows) {
      console.log(`🔍 Sincronizando ${product.asin}...`);
      
      try {
        const offersData = await buyBoxService.getBuyBoxData(product.asin);
        
        if (offersData && offersData.Offers) {
          console.log(`   📊 ${offersData.Offers.length} ofertas encontradas`);
          
          // Mostrar detalhes das ofertas
          offersData.Offers.forEach((offer, index) => {
            console.log(`   Oferta ${index + 1}:`);
            console.log(`     - Vendedor ID: ${offer.SellerId}`);
            console.log(`     - Preço: $${offer.ListingPrice?.Amount}`);
            console.log(`     - Buy Box Winner: ${offer.IsBuyBoxWinner ? '✅ SIM' : '❌ NÃO'}`);
            console.log(`     - FBA: ${offer.IsFulfilledByAmazon ? 'Sim' : 'Não'}`);
          });
          
          await buyBoxService.saveBuyBoxData(product.asin, offersData);
        }
      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}`);
      }
      
      // Aguardar entre requisições
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Sincronização concluída!');
    
    // Mostrar resultados atualizados
    console.log('\n📊 Verificando dados atualizados...\n');
    
    const updated = await executeSQL(`
      SELECT 
        product_asin,
        CASE 
          WHEN is_winner = true THEN 'VOCÊ'
          WHEN buy_box_winner_name IS NOT NULL THEN buy_box_winner_name
          WHEN buy_box_winner_id = '${process.env.AMAZON_SELLER_ID}' THEN 'VOCÊ'
          WHEN buy_box_winner_id IS NOT NULL THEN buy_box_winner_id
          ELSE 'Sem Buy Box'
        END as quem_tem_buy_box,
        buy_box_price,
        our_price
      FROM buy_box_winners
      WHERE buy_box_price IS NOT NULL
      ORDER BY product_asin
    `);
    
    console.table(updated.rows);

  } catch (error) {
    console.error('❌ Erro:', error);
  }
  
  process.exit(0);
}

syncActiveProducts();