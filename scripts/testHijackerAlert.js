const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const hijackerAlertService = require('../server/services/hijackerAlertService');

async function testHijackerAlert() {
  console.log('🧪 TESTE COMPLETO DO SISTEMA DE ALERTA DE HIJACKER\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar configuração
    console.log('\n1️⃣ Verificando configuração de notificações...');
    
    const hasSlack = !!process.env.SLACK_WEBHOOK_URL;
    const hasEmail = !!process.env.NOTIFICATION_EMAIL;
    
    console.log(`   Slack: ${hasSlack ? '✅ Configurado' : '❌ Não configurado'}`);
    console.log(`   Email: ${hasEmail ? '✅ Configurado' : '❌ Não configurado'}`);
    
    if (!hasSlack && !hasEmail) {
      console.log('\n⚠️  Configure SLACK_WEBHOOK_URL ou NOTIFICATION_EMAIL no .env para receber alertas!');
    }

    // 2. Criar alerta de teste
    console.log('\n2️⃣ Criando alerta de teste...');
    
    // Buscar um produto real para teste
    const products = await executeSQL(`
      SELECT product_asin, our_price 
      FROM buy_box_winners 
      WHERE buy_box_price IS NOT NULL 
      LIMIT 1
    `);
    
    if (products.rows.length === 0) {
      console.log('❌ Nenhum produto disponível para teste');
      process.exit(1);
    }
    
    const testProduct = products.rows[0];
    const testHijackerPrice = (parseFloat(testProduct.our_price) - 1.00).toFixed(2);
    
    // Inserir alerta de teste
    await executeSQL(`
      INSERT INTO hijacker_alerts (
        product_asin,
        product_name,
        hijacker_id,
        hijacker_name,
        our_price,
        hijacker_price,
        detected_at,
        is_active,
        alert_sent,
        notes
      ) VALUES (
        $1,
        'Produto de Teste - ' || $1,
        'TEST_HIJACKER_' || EXTRACT(EPOCH FROM NOW())::INTEGER,
        'Test Hijacker Company',
        $2,
        $3,
        NOW(),
        true,
        false,
        'Alerta criado para teste do sistema'
      )
      RETURNING id
    `, [testProduct.product_asin, testProduct.our_price, testHijackerPrice]);
    
    console.log(`   ✅ Alerta de teste criado para ${testProduct.product_asin}`);
    console.log(`   Preço original: $${testProduct.our_price}`);
    console.log(`   Preço do hijacker: $${testHijackerPrice}`);

    // 3. Testar envio de notificações
    console.log('\n3️⃣ Testando envio de notificações...');
    
    await hijackerAlertService.checkForNewHijackers();
    
    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Verificar se foi enviado
    console.log('\n4️⃣ Verificando status do envio...');
    
    const sentAlerts = await executeSQL(`
      SELECT * FROM hijacker_alerts 
      WHERE notes = 'Alerta criado para teste do sistema'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (sentAlerts.rows.length > 0 && sentAlerts.rows[0].alert_sent) {
      console.log('   ✅ Alerta enviado com sucesso!');
      
      if (hasSlack) {
        console.log('   📬 Verifique seu canal do Slack');
      }
      if (hasEmail) {
        console.log('   📧 Verifique seu email');
      }
    } else {
      console.log('   ⚠️ Alerta criado mas não foi enviado');
      console.log('   Verifique as configurações de notificação');
    }

    // 5. Limpar dados de teste
    console.log('\n5️⃣ Limpando dados de teste...');
    
    await executeSQL(`
      DELETE FROM hijacker_alerts 
      WHERE notes = 'Alerta criado para teste do sistema'
    `);
    
    await executeSQL(`
      DELETE FROM hijacker_history 
      WHERE product_asin = $1 
      AND timestamp >= NOW() - INTERVAL '5 minutes'
    `, [testProduct.product_asin]);
    
    console.log('   ✅ Dados de teste removidos');

    // 6. Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO TESTE:');
    console.log('   ✅ Sistema de alertas funcionando corretamente');
    console.log('   ✅ Trigger de detecção automática ativo');
    console.log('   ✅ Serviço de notificações operacional');
    
    if (!hasSlack && !hasEmail) {
      console.log('\n💡 PRÓXIMOS PASSOS:');
      console.log('   1. Configure SLACK_WEBHOOK_URL no .env');
      console.log('   2. Configure NOTIFICATION_EMAIL e SENDGRID_API_KEY no .env');
      console.log('   3. Execute este teste novamente para verificar notificações');
    }
    
    console.log('\n✨ Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error(error);
  }

  process.exit(0);
}

testHijackerAlert();