const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
require('dotenv').config({ path: '../server/.env' });

// Simular ambiente do servidor
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres';

async function testBuyBoxSync() {
  try {
    console.log('🔍 Testando sincronização de Buy Box...\n');
    
    // Verificar se temos ASINs no banco
    const asins = await executeSQL(`
      SELECT asin, name, price, active
      FROM products
      WHERE asin IS NOT NULL
      LIMIT 5
    `);
    
    if (asins.rows.length === 0) {
      console.log('❌ Nenhum produto com ASIN encontrado no banco');
      return;
    }
    
    console.log(`📦 Encontrados ${asins.rows.length} produtos para teste:\n`);
    asins.rows.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.asin} - ${p.name.substring(0, 50)}...`);
      console.log(`   Preço: $${p.price} | Ativo: ${p.active ? '✅' : '❌'}`);
    });
    
    // Verificar credenciais da Amazon
    console.log('\n🔑 Verificando credenciais da Amazon...');
    const requiredEnvVars = [
      'AMAZON_CLIENT_ID',
      'AMAZON_CLIENT_SECRET',
      'AMAZON_REFRESH_TOKEN',
      'AMAZON_SELLER_ID',
      'SP_API_MARKETPLACE_ID'
    ];
    
    let credentialsOk = true;
    requiredEnvVars.forEach(varName => {
      if (process.env[varName]) {
        console.log(`   ✅ ${varName}: ${process.env[varName].substring(0, 10)}...`);
      } else {
        console.log(`   ❌ ${varName}: NÃO CONFIGURADO`);
        credentialsOk = false;
      }
    });
    
    if (!credentialsOk) {
      console.log('\n❌ Configure as credenciais da Amazon no arquivo .env');
      return;
    }
    
    // Testar com o primeiro ASIN
    const testAsin = asins.rows[0].asin;
    console.log(`\n🚀 Testando sincronização com ASIN: ${testAsin}`);
    
    // Fazer requisição para o endpoint de sincronização
    const fetch = require('node-fetch');
    
    try {
      const response = await fetch(`http://localhost:5000/api/buybox/sync/single/${testAsin}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Simular autenticação
          'Authorization': 'Bearer test-token'
        }
      });
      
      const data = await response.json();
      console.log('\n📡 Resposta da API:', data);
      
      if (data.status === 'success') {
        // Verificar se os dados foram salvos
        const savedData = await executeSQL(`
          SELECT * FROM competitor_tracking_advanced
          WHERE asin = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `, [testAsin]);
        
        if (savedData.rows.length > 0) {
          console.log('\n✅ Dados salvos com sucesso:');
          const row = savedData.rows[0];
          console.log(`   Buy Box Price: $${row.buy_box_price || 'N/A'}`);
          console.log(`   Buy Box Seller: ${row.buy_box_seller || 'N/A'}`);
          console.log(`   Our Has Buy Box: ${row.our_has_buy_box ? '✅' : '❌'}`);
          console.log(`   Total Offers: ${row.total_offers}`);
          console.log(`   FBA Offers: ${row.fba_offers}`);
          console.log(`   FBM Offers: ${row.fbm_offers}`);
        }
      }
    } catch (fetchError) {
      console.error('\n❌ Erro ao chamar API:', fetchError.message);
      console.log('\n💡 Certifique-se de que o servidor está rodando na porta 5000');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testBuyBoxSync();