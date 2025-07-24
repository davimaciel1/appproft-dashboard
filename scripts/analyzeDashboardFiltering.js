const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function analyzeDashboardFiltering() {
  console.log('🔍 ANÁLISE COMPLETA: POR QUE PRODUTOS COM ESTOQUE NÃO APARECEM NO DASHBOARD\n');
  
  try {
    // 1. Produtos com estoque
    console.log('📦 PRODUTOS COM ESTOQUE NO BANCO:');
    console.log('━'.repeat(80));
    
    const stockProducts = await executeSQL(`
      SELECT 
        p.id,
        p.asin,
        p.sku,
        p.name,
        p.inventory,
        COALESCE(SUM(oi.quantity), 0) as vendas_totais,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as receita_total
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.inventory > 0 AND p.marketplace = 'amazon'
      GROUP BY p.id
      ORDER BY p.inventory DESC
    `);
    
    stockProducts.rows.forEach((p, idx) => {
      console.log(`\n${idx + 1}. ${p.name}`);
      console.log(`   ASIN: ${p.asin} | SKU: ${p.sku}`);
      console.log(`   Estoque: ${p.inventory} unidades`);
      console.log(`   Vendas: ${p.vendas_totais} unidades | Receita: R$ ${parseFloat(p.receita_total).toFixed(2)}`);
      console.log(`   ${p.vendas_totais == 0 ? '⚠️ SEM VENDAS - Pode não aparecer no topo do dashboard!' : '✅ Tem vendas'}`)
    });
    
    // 2. Simular query do dashboard com limite
    console.log('\n\n📱 SIMULANDO DASHBOARD (TOP 20 PRODUTOS):');
    console.log('━'.repeat(80));
    
    const dashboardTop20 = await executeSQL(`
      SELECT 
        p.id,
        p.name,
        p.inventory,
        COALESCE(SUM(oi.quantity), 0) as vendas,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) as receita
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.marketplace = 'amazon'
      GROUP BY p.id
      ORDER BY receita DESC
      LIMIT 20
    `);
    
    console.log('Posição | Nome | Vendas | Receita | Estoque');
    console.log('--------|------|--------|---------|--------');
    
    dashboardTop20.rows.forEach((p, idx) => {
      const nome = p.name.substring(0, 35) + '...';
      const temEstoque = p.inventory > 0 ? `✅ ${p.inventory}` : '❌ 0';
      console.log(`#${idx + 1} | ${nome} | ${p.vendas} | R$ ${parseFloat(p.receita).toFixed(2)} | ${temEstoque}`);
    });
    
    // 3. Verificar posição dos produtos com estoque
    console.log('\n\n📊 POSIÇÃO DOS PRODUTOS COM ESTOQUE NO RANKING GERAL:');
    console.log('━'.repeat(80));
    
    const allProductsRanked = await executeSQL(`
      WITH ranked_products AS (
        SELECT 
          p.id,
          p.name,
          p.inventory,
          COALESCE(SUM(oi.quantity * oi.unit_price), 0) as receita,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(oi.quantity * oi.unit_price), 0) DESC) as ranking
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        WHERE p.marketplace = 'amazon'
        GROUP BY p.id
      )
      SELECT * FROM ranked_products
      WHERE inventory > 0
      ORDER BY ranking
    `);
    
    allProductsRanked.rows.forEach(p => {
      console.log(`\nPosição #${p.ranking}: ${p.name}`);
      console.log(`Estoque: ${p.inventory} | Receita: R$ ${parseFloat(p.receita).toFixed(2)}`);
      if (p.ranking > 20) {
        console.log('⚠️ FORA DO TOP 20 - NÃO APARECE NO DASHBOARD PRINCIPAL!');
      } else {
        console.log('✅ Dentro do TOP 20 - Deve aparecer no dashboard');
      }
    });
    
    // 4. Contagem total
    const totalProducts = await executeSQL(`
      SELECT COUNT(*) as total FROM products WHERE marketplace = 'amazon'
    `);
    
    console.log(`\n\n📈 RESUMO:`);
    console.log(`Total de produtos Amazon: ${totalProducts.rows[0].total}`);
    console.log(`Produtos com estoque: ${stockProducts.rows.length}`);
    
    // 5. Solução
    console.log('\n\n💡 PROBLEMA IDENTIFICADO:');
    console.log('━'.repeat(80));
    console.log('❌ O dashboard ordena produtos por RECEITA (vendas x preço)');
    console.log('❌ Produtos com poucas ou zero vendas ficam no final da lista');
    console.log('❌ Produtos com estoque mas sem vendas NÃO aparecem no TOP 20');
    
    console.log('\n✅ SOLUÇÃO: Modificar a query do dashboard para:');
    console.log('1. Incluir um boost para produtos com estoque > 0');
    console.log('2. Ou criar uma seção separada "Produtos em Estoque"');
    console.log('3. Ou ordenar por (tem_estoque DESC, receita DESC)');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

analyzeDashboardFiltering();