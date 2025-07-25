#!/usr/bin/env node

/**
 * Script para testar coleta de dados de competidores
 * Executa uma coleta única para verificar se o sistema está funcionando
 */

const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const AmazonService = require('../server/services/amazonService');
const CompetitorPricingService = require('../server/services/amazon/competitorPricingService');

async function testCompetitorCollection() {
  console.log('🧪 Testando sistema de coleta de competidores...');
  
  try {
    // Inicializar serviços
    const amazonService = new AmazonService();
    const competitorService = new CompetitorPricingService(amazonService, { 
      query: executeSQL,
      connect: () => ({ query: executeSQL })
    });

    // Testar conexão com Amazon
    console.log('🔌 Testando conexão com Amazon SP-API...');
    const connectionTest = await amazonService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Falha na conexão: ${connectionTest.error}`);
    }
    
    console.log('✅ Conexão com Amazon SP-API OK');

    // Verificar se existem produtos para testar
    console.log('📦 Verificando produtos disponíveis...');
    const products = await executeSQL(`
      SELECT asin, name 
      FROM products 
      WHERE marketplace = 'amazon' 
      AND asin IS NOT NULL 
      AND asin != ''
      LIMIT 3
    `);

    if (products.rows.length === 0) {
      console.log('⚠️ Nenhum produto Amazon encontrado. Criando produto de teste...');
      
      // Criar produtos de teste com ASINs válidos do Brasil
      const testAsins = [
        {asin: 'B07YNYK2M6', name: 'Smartphone Samsung Galaxy A12', sku: 'TEST-SAMSUNG-001'},
        {asin: 'B08GKSL3SN', name: 'Notebook Lenovo IdeaPad', sku: 'TEST-LENOVO-001'},
        {asin: 'B07YNYKX8Q', name: 'Fone de Ouvido Bluetooth JBL', sku: 'TEST-JBL-001'}
      ];

      for (const product of testAsins) {
        await executeSQL(`
          INSERT INTO products (tenant_id, marketplace, asin, sku, name)
          VALUES ('test', 'amazon', '${product.asin}', '${product.sku}', '${product.name}')
          ON CONFLICT (tenant_id, marketplace, sku) DO NOTHING
        `);
      }
      
      // Buscar novamente
      const testProducts = await executeSQL(`
        SELECT asin, name 
        FROM products 
        WHERE tenant_id = 'test' AND marketplace = 'amazon'
        LIMIT 3
      `);
      
      if (testProducts.rows.length > 0) {
        products.rows = testProducts.rows;
        console.log(`✅ ${testProducts.rows.length} produtos de teste criados`);
      }
    }

    console.log(`📋 Encontrados ${products.rows.length} produtos para testar`);

    // Testar coleta para cada produto
    let successCount = 0;
    let errorCount = 0;

    for (const product of products.rows) {
      console.log(`\n🔍 Testando coleta para: ${product.name} (${product.asin})`);
      
      try {
        const competitorData = await competitorService.getCompetitivePricing(product.asin);
        
        console.log(`📊 Resultado da coleta:`);
        console.log(`  - ASIN: ${competitorData.asin}`);
        console.log(`  - Ofertas encontradas: ${competitorData.offers.length}`);
        
        if (competitorData.summary.buyBoxWinner) {
          console.log(`  - 🏆 Buy Box: ${competitorData.summary.buyBoxWinner.sellerName}`);
          console.log(`  - 💰 Preço Buy Box: R$ ${competitorData.summary.buyBoxWinner.price}`);
        } else {
          console.log(`  - ⚠️ Nenhum detentor da Buy Box identificado`);
        }

        // Mostrar alguns competidores
        const topCompetitors = competitorData.offers.slice(0, 3);
        if (topCompetitors.length > 0) {
          console.log(`  - 🥇 Top competidores:`);
          topCompetitors.forEach((offer, idx) => {
            console.log(`    ${idx + 1}. ${offer.sellerName} - R$ ${offer.price} ${offer.isBuyBoxWinner ? '🏆' : ''}`);
          });
        }

        successCount++;
        
      } catch (error) {
        console.error(`❌ Erro na coleta de ${product.asin}:`, error.message);
        errorCount++;
        
        // Se for um ASIN inválido, continuar
        if (error.message.includes('400') || error.message.includes('not found')) {
          console.log('   → ASIN pode não existir ou não ter ofertas ativas');
        }
      }
      
      // Aguardar entre produtos para respeitar rate limits
      if (products.rows.indexOf(product) < products.rows.length - 1) {
        console.log('⏳ Aguardando 2 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n📋 Resumo dos testes:');
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);

    if (successCount > 0) {
      console.log('\n🔍 Verificando dados salvos no banco...');
      
      // Verificar dados salvos
      const savedData = await executeSQL(`
        SELECT 
          asin,
          seller_name,
          price,
          is_buy_box_winner,
          timestamp
        FROM competitor_tracking
        WHERE timestamp >= NOW() - INTERVAL '5 minutes'
        ORDER BY timestamp DESC
        LIMIT 10
      `);

      console.log(`💾 Registros salvos: ${savedData.rows.length}`);
      
      if (savedData.rows.length > 0) {
        console.log('📄 Últimos registros:');
        savedData.rows.forEach((row, idx) => {
          console.log(`  ${idx + 1}. ${row.asin} - ${row.seller_name} - R$ ${row.price} ${row.is_buy_box_winner ? '🏆' : ''}`);
        });
      }

      // Verificar insights gerados
      const insights = await executeSQL(`
        SELECT title, description, priority
        FROM ai_insights
        WHERE created_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC
        LIMIT 5
      `);

      if (insights.rows.length > 0) {
        console.log(`\n🧠 Insights gerados: ${insights.rows.length}`);
        insights.rows.forEach((insight, idx) => {
          console.log(`  ${idx + 1}. [${insight.priority.toUpperCase()}] ${insight.title}`);
          console.log(`     ${insight.description}`);
        });
      } else {
        console.log('\n💡 Nenhum insight gerado (normal se não houve mudanças)');
      }

      // Verificar cache de vendedores
      const sellersCache = await executeSQL(`
        SELECT seller_name, COUNT(*) as count
        FROM sellers_cache
        WHERE last_updated >= NOW() - INTERVAL '5 minutes'
        GROUP BY seller_name
        ORDER BY count DESC
        LIMIT 5
      `);

      if (sellersCache.rows.length > 0) {
        console.log(`\n👥 Vendedores em cache: ${sellersCache.rows.length}`);
        sellersCache.rows.forEach((seller, idx) => {
          console.log(`  ${idx + 1}. ${seller.seller_name}`);
        });
      }
    }

    if (successCount > 0) {
      console.log('\n🎉 Teste concluído com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('1. Execute o worker: node workers/competitorDataWorker.js');
      console.log('2. Verifique o dashboard: http://localhost:3000/buy-box-dashboard');
      console.log('3. Configure alertas automáticos');
    } else {
      console.log('\n⚠️ Nenhuma coleta foi bem-sucedida');
      console.log('Verifique:');
      console.log('1. Credenciais da Amazon SP-API no .env');
      console.log('2. ASINs válidos na tabela products');
      console.log('3. Conectividade com a internet');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testCompetitorCollection();
}

module.exports = testCompetitorCollection;