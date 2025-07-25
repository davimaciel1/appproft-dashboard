// Script para adicionar sincronização de brand owners ao PersistentSyncManager

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const fs = require('fs');
const path = require('path');

async function addBrandOwnerSync() {
  console.log('🏷️ ADICIONANDO SINCRONIZAÇÃO DE BRAND OWNERS');
  console.log('='.repeat(50));
  
  try {
    // 1. Atualizar PersistentSyncManager
    console.log('1️⃣ Atualizando PersistentSyncManager...');
    
    const managerPath = path.join(__dirname, '../server/services/persistentSyncManager.js');
    let managerContent = fs.readFileSync(managerPath, 'utf8');
    
    // Verificar se já tem processamento de brand owners
    if (!managerContent.includes('monitor_brand_competitors')) {
      console.log('⚠️ Adicionando processamento de brand owners...');
      
      // Adicionar case para monitor_brand_competitors
      const caseToAdd = `
        case 'monitor_brand_competitors':
          // NOVA TAREFA: Monitorar competidores manuais de brand owners
          result = await this.processBrandOwnerCompetitors(task);
          break;`;
      
      // Encontrar onde adicionar (após check_competitors)
      const insertPoint = managerContent.indexOf("case 'check_competitors':");
      if (insertPoint > -1) {
        const endOfCase = managerContent.indexOf('break;', insertPoint);
        const insertPosition = managerContent.indexOf('\n', endOfCase) + 1;
        
        managerContent = managerContent.slice(0, insertPosition) + caseToAdd + '\n' + managerContent.slice(insertPosition);
      }
      
      // Adicionar método processBrandOwnerCompetitors
      const methodToAdd = `
  /**
   * Processar monitoramento de competidores de brand owners
   */
  async processBrandOwnerCompetitors(task) {
    const { sellerId, tenantId = 'default' } = task.data;
    const pool = require('../db/pool');
    
    try {
      // Verificar se existe algum brand owner para monitorar
      const brandOwners = await pool.query(\`
        SELECT DISTINCT bo.seller_id, bo.brand_name
        FROM brand_owners bo
        JOIN manual_competitors mc ON bo.id = mc.brand_owner_id
        WHERE mc.is_active = true
        \${sellerId ? 'AND bo.seller_id = $1' : ''}
      \`, sellerId ? [sellerId] : []);
      
      if (brandOwners.rows.length === 0) {
        return {
          success: true,
          message: 'Nenhum brand owner com competidores para monitorar'
        };
      }
      
      const BrandOwnerCompetitorService = require('./brandOwnerCompetitorService');
      const amazonService = await this.getAmazonService(tenantId);
      const brandOwnerService = new BrandOwnerCompetitorService(amazonService, pool);
      
      let totalSuccess = 0;
      let totalErrors = 0;
      let totalInsights = 0;
      
      // Processar cada brand owner
      for (const brandOwner of brandOwners.rows) {
        try {
          const result = await brandOwnerService.monitorAllBrandOwnerCompetitors(brandOwner.seller_id);
          totalSuccess += result.success;
          totalErrors += result.errors;
          totalInsights += result.insights;
        } catch (error) {
          console.error(\`Erro ao monitorar brand owner \${brandOwner.seller_id}:\`, error);
          totalErrors++;
        }
      }
      
      return {
        success: true,
        brandOwners: brandOwners.rows.length,
        totalSuccess,
        totalErrors,
        totalInsights,
        message: \`Monitoramento concluído: \${totalSuccess} competidores verificados, \${totalInsights} insights gerados\`
      };
      
    } catch (error) {
      console.error('Erro no processamento de brand owners:', error);
      throw error;
    }
  }`;
      
      // Adicionar antes do getAmazonService
      const getAmazonIndex = managerContent.indexOf('async getAmazonService(');
      if (getAmazonIndex > -1) {
        managerContent = managerContent.slice(0, getAmazonIndex) + methodToAdd + '\n\n  ' + managerContent.slice(getAmazonIndex);
      }
      
      // Salvar arquivo atualizado
      fs.writeFileSync(managerPath, managerContent);
      console.log('✅ PersistentSyncManager atualizado');
    } else {
      console.log('✅ Processamento de brand owners já existe');
    }

    // 2. Adicionar tarefa recorrente
    console.log('\n2️⃣ Adicionando tarefa recorrente...');
    
    await executeSQL(`
      INSERT INTO sync_queue (task_type, endpoint, status, payload, priority, tenant_id)
      VALUES ('monitor_brand_competitors', '/brand-owners/monitor', 'pending', '{"tenantId": "default"}', 5, 'default')
      ON CONFLICT DO NOTHING
    `);
    
    console.log('✅ Tarefa de monitoramento de brand owners adicionada');

    // 3. Verificar brand owners existentes
    console.log('\n3️⃣ Verificando brand owners existentes...');
    
    const stats = await executeSQL(`
      SELECT 
        COUNT(DISTINCT bo.id) as total_brand_owners,
        COUNT(DISTINCT mc.id) as total_competitors,
        COUNT(DISTINCT mc.our_asin) as total_monitored_products,
        COUNT(DISTINCT mc.competitor_asin) as total_competitor_products
      FROM brand_owners bo
      LEFT JOIN manual_competitors mc ON bo.id = mc.brand_owner_id
    `);
    
    console.log('\n📊 Estatísticas atuais:');
    console.table(stats.rows[0]);

    // 4. Criar query para visualização
    console.log('\n4️⃣ Queries úteis para monitoramento:');
    console.log(`
-- Dashboard de competição por brand owner
SELECT * FROM brand_owner_competition_dashboard
ORDER BY brand_name, price_difference_percent DESC;

-- Competidores com maior diferença de preço
SELECT 
  bo.brand_name,
  mc.our_asin,
  mc.competitor_asin,
  cm.our_price,
  cm.competitor_price,
  cm.price_difference_percent,
  cm.monitoring_date
FROM competitor_monitoring cm
JOIN manual_competitors mc ON cm.manual_competitor_id = mc.id
JOIN brand_owners bo ON mc.brand_owner_id = bo.id
WHERE ABS(cm.price_difference_percent) > 10
ORDER BY ABS(cm.price_difference_percent) DESC;

-- Histórico de mudanças de preço
SELECT 
  our_asin,
  competitor_asin,
  DATE(monitoring_date) as date,
  AVG(our_price) as avg_our_price,
  AVG(competitor_price) as avg_competitor_price,
  AVG(price_difference_percent) as avg_diff_percent
FROM competitor_monitoring
GROUP BY our_asin, competitor_asin, DATE(monitoring_date)
ORDER BY date DESC;
    `);

    console.log('\n✅ Sincronização de brand owners ativada com sucesso!');
    console.log('\n📋 Como usar:');
    console.log('1. Execute: node scripts/exampleBrandOwnerSetup.js para adicionar competidores');
    console.log('2. O monitoramento será executado automaticamente a cada 6 horas');
    console.log('3. Para monitorar manualmente: adicione tarefa monitor_brand_competitors');
    console.log('4. Visualize resultados em: brand_owner_competition_dashboard');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

// Executar
addBrandOwnerSync().catch(console.error);