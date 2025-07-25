const { executeSQL } = require('./DATABASE_ACCESS_CONFIG');

async function checkASINs() {
  try {
    // Verificar alguns ASINs
    const asins = await executeSQL(`
      SELECT DISTINCT asin, name, marketplace 
      FROM products 
      WHERE marketplace = 'amazon' 
      AND asin IS NOT NULL 
      AND asin != ''
      LIMIT 10
    `);
    
    console.log('\n=== ASINs NO BANCO ===');
    asins.rows.forEach((row, index) => {
      console.log(`${index + 1}. ASIN: ${row.asin} - ${row.name.substring(0, 50)}...`);
    });
    
    // Verificar se são ASINs brasileiros ou americanos
    console.log('\n=== ANÁLISE DOS ASINs ===');
    console.log('Marketplace ID usado: A2Q3Y263D00KWC (Brasil)');
    console.log('\nObservação: Os ASINs parecem ser do marketplace americano.');
    console.log('Isso explica por que não há dados de Buy Box - os ASINs não são válidos para o Brasil.');
    
    // Verificar se há produtos com marketplace_id correto
    const marketplaceIds = await executeSQL(`
      SELECT DISTINCT marketplace_id 
      FROM products 
      WHERE marketplace_id IS NOT NULL
      LIMIT 5
    `);
    
    console.log('\n=== MARKETPLACE IDs ===');
    console.table(marketplaceIds.rows);
    
    // Sugerir solução
    console.log('\n=== SOLUÇÃO ===');
    console.log('1. Os ASINs atuais são do marketplace americano (ATVPDKIKX0DER)');
    console.log('2. Para coletar dados de Buy Box, precisa:');
    console.log('   - Usar ASINs do marketplace brasileiro (A2Q3Y263D00KWC)');
    console.log('   - OU mudar o marketplace_id para ATVPDKIKX0DER (USA)');
    console.log('3. Para testar com marketplace USA, altere em competitorPricingService.js:');
    console.log('   De: marketplaceId = "A2Q3Y263D00KWC"');
    console.log('   Para: marketplaceId = "ATVPDKIKX0DER"');
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkASINs();