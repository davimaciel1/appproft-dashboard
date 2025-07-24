const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function findMissingProducts() {
  console.log('🔍 INVESTIGANDO PRODUTOS QUE NÃO APARECEM NO DASHBOARD\n');
  
  try {
    // 1. Encontrar produtos com tenant_id diferente de 1
    const wrongTenant = await executeSQL(`
      SELECT id, asin, name, tenant_id, inventory
      FROM products 
      WHERE marketplace = 'amazon' AND (tenant_id IS NULL OR tenant_id != 1)
    `);
    
    if (wrongTenant.rows.length > 0) {
      console.log('❌ PRODUTOS COM tenant_id INCORRETO:');
      console.log('━'.repeat(80));
      wrongTenant.rows.forEach(p => {
        console.log(`ID: ${p.id} | ASIN: ${p.asin} | Tenant: ${p.tenant_id || 'NULL'} | Estoque: ${p.inventory}`);
        console.log(`Nome: ${p.name}\n`);
      });
    }
    
    // 2. Verificar os 3 produtos com estoque especificamente
    console.log('\n📦 VERIFICANDO OS 3 PRODUTOS COM ESTOQUE:');
    console.log('━'.repeat(80));
    
    const stockProducts = await executeSQL(`
      SELECT id, asin, sku, name, inventory, tenant_id
      FROM products 
      WHERE inventory > 0 AND marketplace = 'amazon'
      ORDER BY inventory DESC
    `);
    
    stockProducts.rows.forEach(p => {
      console.log(`\n${p.name}`);
      console.log(`ID: ${p.id} | ASIN: ${p.asin} | SKU: ${p.sku}`);
      console.log(`Estoque: ${p.inventory} | Tenant ID: ${p.tenant_id || 'NULL'}`);
      console.log(`${p.tenant_id == 1 ? '✅ Tenant correto' : '❌ TENANT INCORRETO - não aparece no dashboard!'}`);
    });
    
    // 3. Corrigir tenant_id se necessário
    const needsUpdate = await executeSQL(`
      SELECT COUNT(*) as total
      FROM products 
      WHERE marketplace = 'amazon' AND (tenant_id IS NULL OR tenant_id != 1)
    `);
    
    if (needsUpdate.rows[0].total > 0) {
      console.log(`\n\n🔧 CORRIGINDO tenant_id de ${needsUpdate.rows[0].total} produtos...`);
      
      const updateResult = await executeSQL(`
        UPDATE products 
        SET tenant_id = 1 
        WHERE marketplace = 'amazon' AND (tenant_id IS NULL OR tenant_id != 1)
        RETURNING id, asin, name
      `);
      
      console.log(`\n✅ ${updateResult.rowCount} produtos atualizados!`);
      updateResult.rows.forEach(p => {
        console.log(`- ${p.name} (ASIN: ${p.asin})`);
      });
    }
    
    // 4. Verificar novamente
    console.log('\n\n📊 VERIFICAÇÃO FINAL:');
    const finalCheck = await executeSQL(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN tenant_id = 1 THEN 1 END) as with_correct_tenant,
        COUNT(CASE WHEN inventory > 0 THEN 1 END) as with_stock
      FROM products 
      WHERE marketplace = 'amazon'
    `);
    
    const stats = finalCheck.rows[0];
    console.log(`Total de produtos: ${stats.total}`);
    console.log(`Com tenant_id = 1: ${stats.with_correct_tenant}`);
    console.log(`Com estoque > 0: ${stats.with_stock}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

findMissingProducts();