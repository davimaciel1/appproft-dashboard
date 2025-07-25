// Script para corrigir constraints do Data Kiosk

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function fixDataKioskConstraints() {
  console.log('🔧 CORRIGINDO CONSTRAINTS DO DATA KIOSK');
  console.log('='.repeat(50));
  
  try {
    // 1. Corrigir tabela daily_metrics
    console.log('1️⃣ Corrigindo daily_metrics...');
    
    // Verificar constraint existente
    const dailyConstraint = await executeSQL(`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'daily_metrics'::regclass 
      AND contype = 'u'
    `);
    
    if (dailyConstraint.rows.length === 0) {
      console.log('   ⚠️ Sem constraint única. Criando...');
      
      // Remover duplicatas
      await executeSQL(`
        DELETE FROM daily_metrics a
        USING daily_metrics b
        WHERE a.id < b.id 
        AND a.tenant_id = b.tenant_id 
        AND a.date = b.date 
        AND a.marketplace = b.marketplace
      `);
      
      // Criar constraint
      await executeSQL(`
        ALTER TABLE daily_metrics 
        ADD CONSTRAINT daily_metrics_unique 
        UNIQUE (tenant_id, date, marketplace)
      `);
      console.log('   ✅ Constraint criada');
    } else {
      console.log('   ✅ Constraint já existe');
    }

    // 2. Corrigir tabela product_metrics_history
    console.log('\n2️⃣ Corrigindo product_metrics_history...');
    
    const productConstraint = await executeSQL(`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'product_metrics_history'::regclass 
      AND contype = 'u'
    `);
    
    if (productConstraint.rows.length === 0) {
      console.log('   ⚠️ Sem constraint única. Criando...');
      
      // Remover duplicatas
      await executeSQL(`
        DELETE FROM product_metrics_history a
        USING product_metrics_history b
        WHERE a.id < b.id 
        AND a.product_id = b.product_id 
        AND a.date = b.date
      `);
      
      // Criar constraint
      await executeSQL(`
        ALTER TABLE product_metrics_history 
        ADD CONSTRAINT product_metrics_history_unique 
        UNIQUE (product_id, date)
      `);
      console.log('   ✅ Constraint criada');
    } else {
      console.log('   ✅ Constraint já existe');
    }

    // 3. Corrigir tabela traffic_metrics
    console.log('\n3️⃣ Corrigindo traffic_metrics...');
    
    const trafficConstraint = await executeSQL(`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'traffic_metrics'::regclass 
      AND contype = 'u'
    `);
    
    if (trafficConstraint.rows.length === 0) {
      console.log('   ⚠️ Sem constraint única. Criando...');
      
      // Remover duplicatas
      await executeSQL(`
        DELETE FROM traffic_metrics a
        USING traffic_metrics b
        WHERE a.id < b.id 
        AND a.user_id = b.user_id 
        AND a.marketplace = b.marketplace 
        AND a.date = b.date
      `);
      
      // Criar constraint
      await executeSQL(`
        ALTER TABLE traffic_metrics 
        ADD CONSTRAINT traffic_metrics_unique 
        UNIQUE (user_id, marketplace, date)
      `);
      console.log('   ✅ Constraint criada');
    } else {
      console.log('   ✅ Constraint já existe');
    }

    // 4. Verificar constraint em marketplace_tokens
    console.log('\n4️⃣ Verificando marketplace_tokens...');
    
    const tokensConstraint = await executeSQL(`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'marketplace_tokens'::regclass 
      AND contype = 'u'
    `);
    
    if (tokensConstraint.rows.length === 0) {
      console.log('   ⚠️ Sem constraint única. Criando...');
      
      // Remover duplicatas
      await executeSQL(`
        DELETE FROM marketplace_tokens a
        USING marketplace_tokens b
        WHERE a.id < b.id 
        AND a.marketplace = b.marketplace 
        AND a.tenant_id = b.tenant_id
      `);
      
      // Criar constraint
      await executeSQL(`
        ALTER TABLE marketplace_tokens 
        ADD CONSTRAINT marketplace_tokens_unique 
        UNIQUE (marketplace, tenant_id)
      `);
      console.log('   ✅ Constraint criada');
    } else {
      console.log('   ✅ Constraint já existe');
    }

    console.log('\n✅ Todas as constraints corrigidas!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixDataKioskConstraints();
}

module.exports = fixDataKioskConstraints;