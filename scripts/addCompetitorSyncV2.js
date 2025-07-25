// Script para adicionar sincronização de competidores V2 ao PersistentSyncManager

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const fs = require('fs');
const path = require('path');

async function addCompetitorSyncV2() {
  console.log('🔧 ADICIONANDO SINCRONIZAÇÃO DE COMPETIDORES V2');
  console.log('='.repeat(50));
  
  try {
    // 1. Atualizar PersistentSyncManager
    console.log('1️⃣ Atualizando PersistentSyncManager...');
    
    const managerPath = path.join(__dirname, '../server/services/persistentSyncManager.js');
    let managerContent = fs.readFileSync(managerPath, 'utf8');
    
    // Verificar se já tem processamento de competidores
    if (!managerContent.includes('check_competitors')) {
      console.log('⚠️ Adicionando processamento de competidores V2...');
      
      // Adicionar case para check_competitors
      const caseToAdd = `
      case 'check_competitors':
        return await this.processCompetitorCheck(task);`;
      
      // Encontrar onde adicionar (após check_hijackers ou outro case)
      const switchMatch = managerContent.match(/switch\s*\(task\.task_type\)\s*{[^}]+}/s);
      if (switchMatch) {
        const switchContent = switchMatch[0];
        const lastCaseEnd = switchContent.lastIndexOf('return await');
        if (lastCaseEnd > -1) {
          const insertPoint = switchContent.indexOf('\n', lastCaseEnd);
          const newSwitchContent = switchContent.slice(0, insertPoint) + caseToAdd + switchContent.slice(insertPoint);
          managerContent = managerContent.replace(switchContent, newSwitchContent);
        }
      }
      
      // Adicionar método processCompetitorCheck
      const methodToAdd = `
  /**
   * Processar verificação de competidores com rate limiting robusto
   */
  async processCompetitorCheck(task) {
    const { tenantId = 'default' } = task.data;
    
    try {
      // Usar o novo serviço V2 com rate limiting integrado
      const CompetitorPricingServiceV2 = require('./amazon/competitorPricingServiceV2');
      const amazonService = await this.getAmazonService(tenantId);
      const competitorService = new CompetitorPricingServiceV2(amazonService, pool);
      
      // O novo serviço collectAllCompetitorData já gerencia rate limiting e retry
      const result = await competitorService.collectAllCompetitorData(tenantId);
      
      return {
        success: true,
        processed: result.success,
        errors: result.errors,
        message: \`Competidores verificados: \${result.success}/\${result.products} produtos em \${result.duration?.toFixed(2)}s\`,
        details: result.details
      };
      
    } catch (error) {
      console.error('Erro no processamento de competidores:', error);
      throw error;
    }
  }`;
      
      // Adicionar antes do último fechamento de classe
      const classEnd = managerContent.lastIndexOf('}');
      managerContent = managerContent.slice(0, classEnd) + methodToAdd + '\n' + managerContent.slice(classEnd);
      
      // Salvar arquivo atualizado
      fs.writeFileSync(managerPath, managerContent);
      console.log('✅ PersistentSyncManager atualizado com V2');
    } else {
      console.log('✅ Processamento de competidores já existe');
    }

    // 2. Adicionar constraint única na tabela competitor_pricing se não existir
    console.log('\n2️⃣ Verificando estrutura da tabela competitor_tracking...');
    
    // Verificar se a tabela existe
    const tableExists = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'competitor_tracking'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('⚠️ Criando tabela competitor_tracking...');
      
      await executeSQL(`
        CREATE TABLE IF NOT EXISTS competitor_tracking (
          id SERIAL PRIMARY KEY,
          asin VARCHAR(20) NOT NULL,
          competitor_seller_id VARCHAR(100) NOT NULL,
          seller_name VARCHAR(255),
          timestamp TIMESTAMP NOT NULL,
          price DECIMAL(10,2),
          shipping_price DECIMAL(10,2),
          is_buy_box_winner BOOLEAN DEFAULT false,
          is_fba BOOLEAN DEFAULT false,
          feedback_count INTEGER,
          feedback_rating DECIMAL(5,2),
          price_difference DECIMAL(10,2),
          price_percentile DECIMAL(5,2),
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX idx_competitor_tracking_asin ON competitor_tracking(asin);
        CREATE INDEX idx_competitor_tracking_timestamp ON competitor_tracking(timestamp);
        CREATE INDEX idx_competitor_tracking_buy_box ON competitor_tracking(is_buy_box_winner);
      `);
      
      console.log('✅ Tabela competitor_tracking criada');
    }

    // 3. Adicionar tarefa recorrente
    console.log('\n3️⃣ Adicionando tarefa recorrente...');
    
    await executeSQL(`
      INSERT INTO sync_queue (task_type, endpoint, status, payload, priority, tenant_id)
      VALUES ('check_competitors', '/products/pricing/v0/items/{asin}/offers', 'pending', '{"tenantId": "default"}', 5, 'default')
      ON CONFLICT DO NOTHING
    `);
    
    console.log('✅ Tarefa de verificação de competidores adicionada');

    // 4. Atualizar agendamento
    console.log('\n4️⃣ Configurando agendamento automático...');
    
    const schedulerPath = path.join(__dirname, '../server/services/schedulerService.js');
    if (fs.existsSync(schedulerPath)) {
      let schedulerContent = fs.readFileSync(schedulerPath, 'utf8');
      
      if (!schedulerContent.includes('check_competitors')) {
        // Adicionar agendamento a cada 4 horas
        const scheduleToAdd = `
    // Verificar competidores a cada 4 horas
    scheduleTask('check_competitors', '0 */4 * * *', { 
      priority: 5,
      description: 'Verificação de preços de competidores V2 com rate limiting robusto'
    });`;
        
        // Adicionar após outros agendamentos
        const lastSchedule = schedulerContent.lastIndexOf('scheduleTask');
        if (lastSchedule > -1) {
          const lineEnd = schedulerContent.indexOf('\n', lastSchedule + 100);
          schedulerContent = schedulerContent.slice(0, lineEnd + 1) + scheduleToAdd + '\n' + schedulerContent.slice(lineEnd + 1);
          
          fs.writeFileSync(schedulerPath, schedulerContent);
          console.log('✅ Agendamento automático configurado (a cada 4 horas)');
        }
      } else {
        console.log('✅ Agendamento já existe');
      }
    }

    // 5. Verificar estatísticas atuais
    console.log('\n5️⃣ Verificando estatísticas atuais...');
    
    const stats = await executeSQL(`
      SELECT 
        COUNT(DISTINCT asin) as produtos_monitorados,
        COUNT(DISTINCT competitor_seller_id) as competidores_totais,
        COUNT(*) as total_registros,
        COUNT(CASE WHEN is_buy_box_winner THEN 1 END) as buy_box_winners,
        MAX(timestamp) as ultima_coleta
      FROM competitor_tracking
    `);
    
    console.log('\n📊 Estatísticas atuais da tabela:');
    console.table(stats.rows[0]);

    console.log('\n✅ Sincronização de competidores V2 ativada com sucesso!');
    console.log('\n📋 Melhorias da V2:');
    console.log('   ✅ Rate limiting automático integrado');
    console.log('   ✅ Retry com backoff exponencial');
    console.log('   ✅ Processamento em lotes paralelos');
    console.log('   ✅ Melhor tratamento de erros 429');
    console.log('   ✅ Logs detalhados de progresso');
    
    console.log('\n📋 Próximos passos:');
    console.log('1. Testar com: node scripts/testCompetitorPricingV2.js');
    console.log('2. Reiniciar o PersistentSyncManager');
    console.log('3. A coleta será executada automaticamente a cada 4 horas');
    console.log('4. Monitorar logs para verificar funcionamento');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

// Executar
addCompetitorSyncV2().catch(console.error);