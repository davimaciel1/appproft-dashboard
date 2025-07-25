const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function simulateHijacker() {
  console.log('🎭 Simulando perda de Buy Box para teste de Hijacker Alert...\n');

  try {
    // Buscar um produto que atualmente temos o Buy Box
    const currentWinners = await executeSQL(`
      SELECT * FROM buy_box_winners 
      WHERE is_winner = true 
      AND buy_box_price IS NOT NULL
      LIMIT 1
    `);

    if (currentWinners.rows.length === 0) {
      console.log('❌ Nenhum produto com Buy Box encontrado para simular');
      process.exit(1);
    }

    const product = currentWinners.rows[0];
    console.log(`📦 Produto selecionado: ${product.product_asin}`);
    console.log(`💰 Preço atual: $${product.buy_box_price}\n`);

    // Simular perda do Buy Box
    console.log('🏴‍☠️ Simulando hijacker...');
    
    const hijackerPrice = (parseFloat(product.buy_box_price) - 0.50).toFixed(2); // $0.50 mais barato
    
    await executeSQL(`
      UPDATE buy_box_winners
      SET 
        is_winner = false,
        buy_box_winner_id = 'TEST_HIJACKER_123',
        buy_box_winner_name = 'Hijacker Test Company',
        buy_box_price = $1,
        checked_at = NOW()
      WHERE product_asin = $2
    `, [hijackerPrice, product.product_asin]);

    console.log('✅ Simulação executada!');
    console.log(`   Hijacker: Hijacker Test Company`);
    console.log(`   Novo preço Buy Box: $${hijackerPrice} (undercutting por $0.50)\n`);

    // Verificar se o alerta foi criado
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar trigger

    const alerts = await executeSQL(`
      SELECT * FROM hijacker_alerts 
      WHERE product_asin = $1 
      AND is_active = true
      ORDER BY detected_at DESC
      LIMIT 1
    `, [product.product_asin]);

    if (alerts.rows.length > 0) {
      console.log('🚨 ALERTA DE HIJACKER CRIADO COM SUCESSO!');
      const alert = alerts.rows[0];
      console.log(`   ID do alerta: ${alert.id}`);
      console.log(`   Hijacker: ${alert.hijacker_name}`);
      console.log(`   Detectado em: ${new Date(alert.detected_at).toLocaleString('pt-BR')}`);
    } else {
      console.log('⚠️ Alerta não foi criado automaticamente');
    }

    // Verificar histórico
    const history = await executeSQL(`
      SELECT * FROM hijacker_history 
      WHERE product_asin = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [product.product_asin]);

    if (history.rows.length > 0) {
      console.log('\n📜 HISTÓRICO REGISTRADO:');
      const h = history.rows[0];
      console.log(`   Evento: ${h.event_type}`);
      console.log(`   Status: ${h.old_status} → ${h.new_status}`);
      console.log(`   Detalhes: ${JSON.stringify(h.details)}`);
    }

    console.log('\n💡 Para reverter a simulação, execute: node scripts/restoreBuyBox.js');

  } catch (error) {
    console.error('❌ Erro na simulação:', error.message);
  }

  process.exit(0);
}

simulateHijacker();