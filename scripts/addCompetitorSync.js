// Script para adicionar sincronização de competidores ao PersistentSyncManager

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const fs = require('fs');
const path = require('path');

async function addCompetitorSync() {
  console.log('🔧 ADICIONANDO SINCRONIZAÇÃO DE COMPETIDORES');
  console.log('='.repeat(50));
  
  try {
    // 1. Verificar se já existe o tipo de tarefa
    console.log('1️⃣ Verificando tipos de tarefa existentes...');
    
    const existingTypes = await executeSQL(`
      SELECT DISTINCT task_type FROM sync_queue 
      WHERE task_type LIKE '%competitor%'
      ORDER BY task_type
    `);
    
    if (existingTypes.rows.length > 0) {
      console.log('✅ Tipos relacionados a competidores encontrados:');
      existingTypes.rows.forEach(row => console.log(`   - ${row.task_type}`));
    } else {
      console.log('⚠️ Nenhum tipo de sincronização de competidores encontrado');
    }

    // 2. Adicionar método no PersistentSyncManager
    console.log('\n2️⃣ Atualizando PersistentSyncManager...');
    
    const managerPath = path.join(__dirname, '../server/services/persistentSyncManager.js');
    let managerContent = fs.readFileSync(managerPath, 'utf8');
    
    // Verificar se já tem processamento de competidores
    if (!managerContent.includes('check_competitors')) {
      console.log('⚠️ Adicionando processamento de competidores...');
      
      // Adicionar case para check_competitors
      const caseToAdd = `
      case 'check_competitors':
        return await this.processCompetitorCheck(task);`;
      
      // Encontrar onde adicionar (após check_hijackers)
      const insertPoint = managerContent.indexOf("case 'check_hijackers':");
      if (insertPoint > -1) {
        const endOfCase = managerContent.indexOf('return await this.processHijackerCheck(task);', insertPoint);
        const insertPosition = managerContent.indexOf('\n', endOfCase) + 1;
        
        managerContent = managerContent.slice(0, insertPosition) + caseToAdd + '\n' + managerContent.slice(insertPosition);
      }
      
      // Adicionar método processCompetitorCheck
      const methodToAdd = `
  /**
   * Processar verificação de competidores
   */
  async processCompetitorCheck(task) {
    const { tenantId = 'default' } = task.data;
    
    try {
      // Buscar produtos para verificar
      const products = await pool.query(\`
        SELECT DISTINCT p.asin, p.name 
        FROM products p
        WHERE p.asin IS NOT NULL 
        AND p.asin != ''
        AND p.user_id = 1
        LIMIT 10
      \`);
      
      if (products.rows.length === 0) {
        return { 
          success: true, 
          message: 'Nenhum produto para verificar competidores' 
        };
      }
      
      const CompetitorPricingService = require('./amazon/competitorPricingService');
      const amazonService = await this.getAmazonService(tenantId);
      const competitorService = new CompetitorPricingService(amazonService, pool);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const product of products.rows) {
        try {
          await this.rateLimiter.waitForToken('sp-api', 'pricing');
          
          const competitorData = await competitorService.getCompetitivePricing(
            product.asin,
            process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC'
          );
          
          if (competitorData.offers && competitorData.offers.length > 0) {
            // Salvar em competitor_pricing
            for (const offer of competitorData.offers) {
              await pool.query(\`
                INSERT INTO competitor_pricing (
                  product_asin, seller_id, seller_name, price, 
                  shipping_cost, is_fba, is_buy_box, condition, collected_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (product_asin, seller_id, collected_at) DO NOTHING
              \`, [
                product.asin,
                offer.sellerId,
                offer.sellerName || 'Unknown',
                offer.price || 0,
                offer.shippingPrice || 0,
                offer.isFulfilledByAmazon || false,
                offer.isBuyBoxWinner || false,
                offer.condition || 'new'
              ]);
            }
            
            successCount++;
          }
          
          // Aguardar entre requisições
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(\`Erro ao verificar competidores para \${product.asin}:\`, error.message);
          errorCount++;
        }
      }
      
      return {
        success: true,
        processed: successCount,
        errors: errorCount,
        message: \`Competidores verificados: \${successCount} produtos, \${errorCount} erros\`
      };
      
    } catch (error) {
      console.error('Erro no processamento de competidores:', error);
      throw error;
    }
  }
`;
      
      // Adicionar antes do último fechamento de classe
      const classEnd = managerContent.lastIndexOf('}');
      managerContent = managerContent.slice(0, classEnd) + methodToAdd + '\n' + managerContent.slice(classEnd);
      
      // Salvar arquivo atualizado
      fs.writeFileSync(managerPath, managerContent);
      console.log('✅ PersistentSyncManager atualizado');
    } else {
      console.log('✅ Processamento de competidores já existe');
    }

    // 3. Adicionar constraint única na tabela competitor_pricing
    console.log('\n3️⃣ Verificando constraints da tabela...');
    
    const constraints = await executeSQL(`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'competitor_pricing'::regclass 
      AND contype = 'u'
    `);
    
    if (constraints.rows.length === 0) {
      console.log('⚠️ Adicionando constraint única...');
      
      // Primeiro remover duplicatas
      await executeSQL(`
        DELETE FROM competitor_pricing a
        USING competitor_pricing b
        WHERE a.id < b.id 
        AND a.product_asin = b.product_asin 
        AND a.seller_id = b.seller_id
        AND DATE(a.collected_at) = DATE(b.collected_at)
      `);
      
      // Adicionar constraint
      await executeSQL(`
        ALTER TABLE competitor_pricing 
        ADD CONSTRAINT competitor_pricing_unique 
        UNIQUE (product_asin, seller_id, collected_at)
      `);
      
      console.log('✅ Constraint única adicionada');
    }

    // 4. Adicionar tarefa recorrente
    console.log('\n4️⃣ Adicionando tarefa recorrente...');
    
    await executeSQL(`
      INSERT INTO sync_queue (task_type, status, payload, priority, tenant_id)
      VALUES ('check_competitors', 'pending', '{"tenantId": "default"}', 5, 'default')
      ON CONFLICT DO NOTHING
    `);
    
    console.log('✅ Tarefa de verificação de competidores adicionada');

    // 5. Atualizar agendamento
    console.log('\n5️⃣ Configurando agendamento automático...');
    
    const schedulerPath = path.join(__dirname, '../server/services/schedulerService.js');
    if (fs.existsSync(schedulerPath)) {
      let schedulerContent = fs.readFileSync(schedulerPath, 'utf8');
      
      if (!schedulerContent.includes('check_competitors')) {
        // Adicionar agendamento a cada 4 horas
        const scheduleToAdd = `
    // Verificar competidores a cada 4 horas
    scheduleTask('check_competitors', '0 */4 * * *', { 
      priority: 5,
      description: 'Verificação de preços de competidores'
    });`;
        
        // Adicionar após outros agendamentos
        const insertPoint = schedulerContent.indexOf('// Verificar hijackers');
        if (insertPoint > -1) {
          const lineEnd = schedulerContent.indexOf('\n', insertPoint + 100);
          schedulerContent = schedulerContent.slice(0, lineEnd + 1) + scheduleToAdd + '\n' + schedulerContent.slice(lineEnd + 1);
          
          fs.writeFileSync(schedulerPath, schedulerContent);
          console.log('✅ Agendamento automático configurado (a cada 4 horas)');
        }
      } else {
        console.log('✅ Agendamento já existe');
      }
    }

    console.log('\n✅ Sincronização de competidores ativada com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Reiniciar o PersistentSyncManager');
    console.log('2. A coleta será executada automaticamente a cada 4 horas');
    console.log('3. Para testar agora: node scripts/testCompetitorPricing.js');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Executar
addCompetitorSync().catch(console.error);