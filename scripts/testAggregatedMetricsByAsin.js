const axios = require('axios');
const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:sua-senha@localhost:5432/postgres',
});

// Configuração da API - Usando domínio oficial
const API_BASE_URL = 'https://appproft.com/api/dashboard';

async function getAmazonCredentials(userId = 1) {
  try {
    const result = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
      [userId, 'amazon']
    );
    
    if (result.rows.length === 0) {
      throw new Error('Credenciais Amazon não encontradas no banco de dados');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Erro ao buscar credenciais:', error.message);
    throw error;
  }
}

async function testAggregatedMetricsByAsin() {
  try {
    console.log('🔍 Buscando credenciais da Amazon no banco de dados...');
    
    // Buscar credenciais automaticamente do banco
    const credentials = await getAmazonCredentials();
    console.log('✅ Credenciais encontradas para:', credentials.seller_id);
    
    console.log('\n🔍 Buscando métricas agregadas por ASIN...\n');

    // Parâmetros da requisição
    const params = {
      aggregationType: 'byAsin',       // Tipo de agregação: byAsin ou byDate
      marketplace: 'amazon',           // Marketplace: amazon ou mercadolivre
      asinLevel: 'PARENT',            // Nível do ASIN: PARENT, CHILD ou ALL
      startDate: '2024-01-01',        // Data inicial (ajuste conforme necessário)
      endDate: '2024-12-31'           // Data final (ajuste conforme necessário)
    };

    // Fazer a requisição (SEM TOKEN - sistema usa automaticamente usuário do banco)
    const response = await axios.get(`${API_BASE_URL}/aggregated-metrics`, {
      params,
      headers: {
        'Content-Type': 'application/json'
        // Sem Authorization header - middleware autoAuth usa usuário padrão do banco
      }
    });

    // Exibir os resultados
    if (response.data && response.data.salesAndTrafficByAsin) {
      const data = response.data.salesAndTrafficByAsin;
      
      console.log(`📊 Métricas Agregadas por ASIN`);
      console.log(`📅 Período: ${data.startDate} até ${data.endDate}`);
      console.log(`🏪 Marketplace: ${data.marketplaceId}`);
      console.log(`📦 Nível ASIN: ${data.asinLevel}`);
      console.log(`\n${'='.repeat(80)}\n`);

      // Exibir dados de cada produto
      if (data.data && data.data.length > 0) {
        data.data.forEach((product, index) => {
          console.log(`${index + 1}. ${product.productName || 'Produto sem nome'}`);
          console.log(`   ASIN: ${product.childAsin}`);
          console.log(`   Parent ASIN: ${product.parentAsin || 'N/A'}`);
          console.log(`   SKU: ${product.sku || 'N/A'}`);
          console.log(`   💰 Vendas: R$ ${product.sales.orderedProductSales.amount.toFixed(2)}`);
          console.log(`   📦 Unidades Vendidas: ${product.sales.unitsOrdered}`);
          console.log(`   👁️ Page Views: ${product.traffic.pageViews}`);
          console.log(`   🔄 Sessões: ${product.traffic.sessions}`);
          console.log(`   📊 Buy Box %: ${product.traffic.buyBoxPercentage.toFixed(2)}%`);
          console.log(`   🎯 Taxa de Conversão: ${product.traffic.unitSessionPercentage.toFixed(2)}%`);
          console.log(`   ${'─'.repeat(70)}`);
        });

        // Resumo
        const totalSales = data.data.reduce((sum, p) => sum + p.sales.orderedProductSales.amount, 0);
        const totalUnits = data.data.reduce((sum, p) => sum + p.sales.unitsOrdered, 0);
        
        console.log(`\n📊 RESUMO TOTAL:`);
        console.log(`   Total de Produtos: ${data.data.length}`);
        console.log(`   Vendas Totais: R$ ${totalSales.toFixed(2)}`);
        console.log(`   Unidades Totais: ${totalUnits}`);
      } else {
        console.log('❌ Nenhum dado encontrado para o período especificado.');
      }
    }

  } catch (error) {
    console.error('❌ Erro ao buscar métricas agregadas:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    }
  }
}

// Executar o teste
testAggregatedMetricsByAsin();

/* 
  COMO USAR ESTE SCRIPT:
  
  1. Instale as dependências se ainda não tiver:
     npm install axios pg
  
  2. Configure a variável DATABASE_URL no .env ou ajuste a connection string
  
  3. Certifique-se de que as credenciais da Amazon estão salvas no banco
  
  4. Execute o script:
     node scripts/testAggregatedMetricsByAsin.js

  PARÂMETROS DISPONÍVEIS:
  
  - aggregationType: 'byAsin' ou 'byDate'
  - marketplace: 'amazon' ou 'mercadolivre'
  - asinLevel: 'PARENT', 'CHILD' ou 'ALL' (apenas para byAsin)
  - startDate: Data inicial (formato: YYYY-MM-DD)
  - endDate: Data final (formato: YYYY-MM-DD)
  - granularity: 'DAY', 'WEEK', 'MONTH' (apenas para byDate)
  
  VANTAGENS:
  - ✅ Usa automaticamente as credenciais da Amazon salvas no banco
  - ✅ Não precisa configurar tokens manualmente
  - ✅ Simula um usuário real do sistema
*/