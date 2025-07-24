const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function investigateProducts() {
  console.log('=== INVESTIGAÇÃO DE PRODUTOS - ESTOQUE E IMAGENS ===\n');
  
  try {
    // 1. Verificar estrutura completa da tabela products
    console.log('📋 ESTRUTURA DA TABELA PRODUCTS:');
    console.log('━'.repeat(50));
    
    const structure = await executeSQL(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    
    structure.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(25)} | ${col.data_type.padEnd(20)} | ${col.is_nullable}`);
    });
    
    // 2. Verificar produtos com estoque e imagens
    console.log('\n\n📦 ANÁLISE DE ESTOQUE E IMAGENS:');
    console.log('━'.repeat(50));
    
    const stockAnalysis = await executeSQL(`
      SELECT 
        COUNT(*) as total_produtos,
        COUNT(CASE WHEN inventory > 0 THEN 1 END) as produtos_com_estoque,
        COUNT(CASE WHEN inventory = 0 THEN 1 END) as produtos_sem_estoque,
        COUNT(CASE WHEN inventory IS NULL THEN 1 END) as estoque_nulo,
        SUM(inventory) as estoque_total,
        COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as produtos_com_imagem,
        COUNT(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 END) as produtos_sem_imagem
      FROM products
    `);
    
    const stats = stockAnalysis.rows[0];
    console.log(`Total de produtos: ${stats.total_produtos}`);
    console.log(`Produtos COM estoque: ${stats.produtos_com_estoque}`);
    console.log(`Produtos SEM estoque: ${stats.produtos_sem_estoque}`);
    console.log(`Produtos com estoque NULL: ${stats.estoque_nulo}`);
    console.log(`Estoque total: ${stats.estoque_total || 0} unidades`);
    console.log(`\nProdutos COM imagem: ${stats.produtos_com_imagem}`);
    console.log(`Produtos SEM imagem: ${stats.produtos_sem_imagem}`);
    
    // 3. Listar alguns produtos com seus dados completos
    console.log('\n\n📸 AMOSTRA DE PRODUTOS (ESTOQUE E IMAGENS):');
    console.log('━'.repeat(50));
    
    const sampleProducts = await executeSQL(`
      SELECT 
        id,
        asin,
        sku,
        name,
        inventory,
        price,
        image_url,
        marketplace,
        updated_at
      FROM products
      ORDER BY 
        CASE WHEN inventory > 0 THEN 0 ELSE 1 END,
        inventory DESC,
        id DESC
      LIMIT 15
    `);
    
    console.log('\nID | ASIN | SKU | Nome | Estoque | Preço | Tem Imagem? | Atualizado');
    console.log('---|------|-----|------|---------|-------|-------------|------------');
    
    sampleProducts.rows.forEach(product => {
      const nome = product.name ? product.name.substring(0, 25) + '...' : 'N/A';
      const temImagem = product.image_url ? '✅ SIM' : '❌ NÃO';
      const atualizado = product.updated_at ? new Date(product.updated_at).toLocaleDateString('pt-BR') : 'Nunca';
      
      console.log(
        `${product.id} | ${product.asin || 'N/A'} | ${product.sku || 'N/A'} | ${nome} | ${product.inventory || 0} | R$ ${product.price || 0} | ${temImagem} | ${atualizado}`
      );
    });
    
    // 4. Verificar URLs de imagens
    console.log('\n\n🖼️ EXEMPLOS DE URLs DE IMAGENS:');
    console.log('━'.repeat(50));
    
    const imagesExample = await executeSQL(`
      SELECT 
        id,
        name,
        image_url
      FROM products
      WHERE image_url IS NOT NULL AND image_url != ''
      LIMIT 5
    `);
    
    if (imagesExample.rows.length > 0) {
      imagesExample.rows.forEach(product => {
        console.log(`\n📦 Produto: ${product.name}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   URL da Imagem: ${product.image_url}`);
      });
    } else {
      console.log('❌ Nenhum produto com URL de imagem encontrado!');
    }
    
    // 5. Investigar processo de sincronização
    console.log('\n\n🔄 INVESTIGANDO SINCRONIZAÇÃO:');
    console.log('━'.repeat(50));
    
    // Verificar últimas atualizações
    const recentUpdates = await executeSQL(`
      SELECT 
        marketplace,
        COUNT(*) as total,
        MAX(updated_at) as ultima_atualizacao,
        MIN(updated_at) as primeira_atualizacao
      FROM products
      GROUP BY marketplace
    `);
    
    recentUpdates.rows.forEach(row => {
      console.log(`\n${row.marketplace.toUpperCase()}`);
      console.log(`   Total de produtos: ${row.total}`);
      console.log(`   Primeira atualização: ${row.primeira_atualizacao ? new Date(row.primeira_atualizacao).toLocaleString('pt-BR') : 'Nunca'}`);
      console.log(`   Última atualização: ${row.ultima_atualizacao ? new Date(row.ultima_atualizacao).toLocaleString('pt-BR') : 'Nunca'}`);
    });
    
    // 6. Verificar se há algum produto específico com estoque
    console.log('\n\n🎯 PRODUTOS COM ESTOQUE > 0:');
    console.log('━'.repeat(50));
    
    const productsWithStock = await executeSQL(`
      SELECT 
        asin,
        sku,
        name,
        inventory,
        price
      FROM products
      WHERE inventory > 0
      ORDER BY inventory DESC
      LIMIT 10
    `);
    
    if (productsWithStock.rows.length > 0) {
      console.log('\nASIN | SKU | Nome | Estoque | Preço');
      console.log('-----|-----|------|---------|------');
      productsWithStock.rows.forEach(product => {
        const nome = product.name ? product.name.substring(0, 30) + '...' : 'N/A';
        console.log(`${product.asin} | ${product.sku} | ${nome} | ${product.inventory} | R$ ${product.price}`);
      });
    } else {
      console.log('❌ Nenhum produto com estoque > 0 encontrado!');
      console.log('\n💡 Possíveis causas:');
      console.log('   1. A sincronização de inventário não foi executada');
      console.log('   2. A API não está retornando dados de estoque');
      console.log('   3. Os produtos estão realmente sem estoque na Amazon');
    }
    
    // 7. Verificar campos específicos de inventário
    console.log('\n\n🔍 ANÁLISE DETALHADA DO CAMPO INVENTORY:');
    console.log('━'.repeat(50));
    
    const inventoryDistribution = await executeSQL(`
      SELECT 
        inventory,
        COUNT(*) as quantidade_produtos
      FROM products
      GROUP BY inventory
      ORDER BY inventory DESC
    `);
    
    console.log('\nEstoque | Qtd de Produtos');
    console.log('--------|----------------');
    inventoryDistribution.rows.forEach(row => {
      console.log(`${row.inventory === null ? 'NULL' : row.inventory.toString().padStart(7)} | ${row.quantidade_produtos}`);
    });
    
  } catch (error) {
    console.error('❌ Erro na investigação:', error.message);
  }
}

// Executar investigação
investigateProducts();