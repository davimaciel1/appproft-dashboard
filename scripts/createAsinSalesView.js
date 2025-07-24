const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createAsinSalesView() {
  try {
    console.log('=== CRIANDO VIEW DE VENDAS POR ASIN ===\n');
    
    // Verificar estrutura das tabelas
    console.log('Verificando estrutura das tabelas...');
    
    const checkProducts = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('asin', 'sku', 'image_url', 'name')
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas em products:', checkProducts.rows);
    
    const checkOrderItems = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'order_items'
      AND column_name IN ('product_id', 'quantity', 'asin', 'sku')
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas em order_items:', checkOrderItems.rows);
    
    // Criar a view
    console.log('\nCriando view de vendas por ASIN...');
    
    const createViewQuery = `
      CREATE OR REPLACE VIEW vendas_por_asin AS
      SELECT 
        p.asin,
        p.image_url,
        p.name as product_name,
        COALESCE(SUM(oi.quantity), 0) as total_vendas,
        COUNT(DISTINCT oi.order_id) as total_pedidos,
        p.marketplace,
        p.country_code
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.asin IS NOT NULL 
      AND p.asin != ''
      GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
      ORDER BY total_vendas DESC
    `;
    
    await executeSQL(createViewQuery);
    console.log('✅ View criada com sucesso!');
    
    // Buscar dados da view
    console.log('\nBuscando dados da view...');
    const viewData = await executeSQL('SELECT * FROM vendas_por_asin LIMIT 10');
    
    console.log('\nPrimeiros 10 produtos por vendas:');
    console.table(viewData.rows.map(row => ({
      ASIN: row.asin,
      Produto: row.product_name ? row.product_name.substring(0, 50) + '...' : 'N/A',
      'Total Vendas': row.total_vendas,
      'Total Pedidos': row.total_pedidos,
      Marketplace: row.marketplace,
      'Tem Imagem': row.image_url ? 'Sim' : 'Não'
    })));
    
    // Estatísticas
    const stats = await executeSQL(`
      SELECT 
        COUNT(*) as total_asins,
        SUM(total_vendas) as vendas_totais,
        AVG(total_vendas) as media_vendas_por_asin,
        COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as asins_com_imagem
      FROM vendas_por_asin
    `);
    
    console.log('\nEstatísticas:');
    console.log('Total de ASINs únicos:', stats.rows[0].total_asins);
    console.log('Total de vendas:', stats.rows[0].vendas_totais);
    console.log('Média de vendas por ASIN:', parseFloat(stats.rows[0].media_vendas_por_asin).toFixed(2));
    console.log('ASINs com imagem:', stats.rows[0].asins_com_imagem);
    
    // Query para usar no Database Viewer
    console.log('\n=== QUERY PARA USAR NO DATABASE VIEWER ===');
    console.log('SELECT * FROM vendas_por_asin ORDER BY total_vendas DESC LIMIT 50');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

createAsinSalesView();