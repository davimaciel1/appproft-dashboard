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

async function testAsinChild() {
  try {
    console.log('🔍 Buscando credenciais da Amazon no banco de dados...');
    
    // Buscar credenciais automaticamente do banco
    const credentials = await getAmazonCredentials();
    console.log('✅ Credenciais encontradas para:', credentials.seller_id);
    
    console.log('\n📦 Buscando métricas agregadas por ASIN CHILD...\n');

    // Parâmetros para ASIN CHILD
    const params = {
      aggregationType: 'byAsin',
      marketplace: 'amazon',
      asinLevel: 'CHILD',          // 🎯 CHILD em vez de PARENT
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    };

    // Fazer a requisição
    const response = await axios.get(`${API_BASE_URL}/aggregated-metrics`, {
      params,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': '1' // Simular usuário logado
      }
    });

    // Exibir os resultados
    if (response.data && response.data.salesAndTrafficByAsin) {
      const data = response.data.salesAndTrafficByAsin;
      
      console.log(`📊 Métricas Agregadas por ASIN CHILD`);
      console.log(`📅 Período: ${data.startDate} até ${data.endDate}`);
      console.log(`🏪 Marketplace: ${data.marketplaceId}`);
      console.log(`📦 Nível ASIN: ${data.asinLevel} (Variações de Produtos)`);
      console.log(`\n${'='.repeat(80)}\n`);

      // Exibir dados de cada produto child
      if (data.data && data.data.length > 0) {
        data.data.forEach((product, index) => {
          console.log(`${index + 1}. ${product.productName || 'Produto sem nome'}`);
          console.log(`   🔸 ASIN Child: ${product.childAsin}`);
          console.log(`   🔹 Parent ASIN: ${product.parentAsin || 'N/A'}`);
          console.log(`   📋 SKU: ${product.sku || 'N/A'}`);
          console.log(`   💰 Vendas: R$ ${product.sales.orderedProductSales.amount.toFixed(2)}`);
          console.log(`   📦 Unidades Vendidas: ${product.sales.unitsOrdered}`);
          console.log(`   👁️ Page Views: ${product.traffic.pageViews}`);
          console.log(`   🔄 Sessões: ${product.traffic.sessions}`);
          console.log(`   📊 Buy Box %: ${product.traffic.buyBoxPercentage.toFixed(2)}%`);
          console.log(`   🎯 Taxa de Conversão: ${product.traffic.unitSessionPercentage.toFixed(2)}%`);
          console.log(`   ${'─'.repeat(70)}`);
        });

        // Resumo específico para CHILD ASINs
        const totalSales = data.data.reduce((sum, p) => sum + p.sales.orderedProductSales.amount, 0);
        const totalUnits = data.data.reduce((sum, p) => sum + p.sales.unitsOrdered, 0);
        const uniqueParents = new Set(data.data.map(p => p.parentAsin).filter(p => p)).size;
        
        console.log(`\n📊 RESUMO - ASIN CHILD:`);
        console.log(`   Total de Variações: ${data.data.length}`);
        console.log(`   Produtos Pai Únicos: ${uniqueParents}`);
        console.log(`   Vendas Totais: R$ ${totalSales.toFixed(2)}`);
        console.log(`   Unidades Totais: ${totalUnits}`);
        console.log(`   Média por Variação: R$ ${(totalSales / data.data.length).toFixed(2)}`);
      } else {
        console.log('❌ Nenhum ASIN CHILD encontrado para o período especificado.');
        console.log('💡 Dica: Verifique se existem variações de produtos no seu catálogo Amazon.');
      }
    }

  } catch (error) {
    console.error('❌ Erro ao buscar métricas ASIN CHILD:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

// Executar o teste
testAsinChild();

/* 
  DIFERENÇAS ENTRE ASIN PARENT E CHILD:
  
  🔹 PARENT ASIN:
  - Representa o produto principal/pai
  - Agrupa todas as variações
  - Ideal para visão geral do produto
  
  🔸 CHILD ASIN:
  - Representa cada variação específica
  - Cor, tamanho, modelo específico
  - Ideal para análise detalhada de variações
  
  QUANDO USAR CHILD:
  - Analisar performance de cores/tamanhos específicos
  - Identificar variações mais vendidas
  - Otimizar estoque por variação
  - Ajustar preços de variações específicas
*/