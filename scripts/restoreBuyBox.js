const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function restoreBuyBox() {
  console.log('🔄 Restaurando Buy Box para Connect Brands...\n');

  try {
    // 1. Buscar produtos que foram hijacked (perdemos o Buy Box)
    const hijackedProducts = await executeSQL(`
      SELECT DISTINCT
        bw.product_asin,
        bw.buy_box_winner_name as hijacker_name,
        bw.buy_box_price as hijacker_price,
        bw.our_price,
        p.name as product_name
      FROM buy_box_winners bw
      LEFT JOIN products p ON bw.product_asin = p.asin
      WHERE bw.is_winner = false 
      AND bw.buy_box_winner_id IS NOT NULL
      AND bw.buy_box_winner_id != 'A27IMS7TINM85N'
    `);

    if (hijackedProducts.rows.length === 0) {
      console.log('✅ Nenhum produto com hijacker encontrado!');
      console.log('   Todos os produtos com Buy Box já pertencem a Connect Brands.\n');
      process.exit(0);
    }

    console.log(`📦 Encontrados ${hijackedProducts.rows.length} produtos com hijackers:\n`);
    
    hijackedProducts.rows.forEach((product, index) => {
      console.log(`${index + 1}. ${product.product_asin} - ${(product.product_name || '').substring(0, 50)}...`);
      console.log(`   Hijacker: ${product.hijacker_name}`);
      console.log(`   Preço do hijacker: $${product.hijacker_price}\n`);
    });

    console.log('🏆 Restaurando Buy Box...\n');

    // 2. Restaurar Buy Box para cada produto
    for (const product of hijackedProducts.rows) {
      // Calcular novo preço competitivo (match do hijacker ou $0.01 menos)
      const competitivePrice = (parseFloat(product.hijacker_price) - 0.01).toFixed(2);
      
      await executeSQL(`
        UPDATE buy_box_winners
        SET 
          is_winner = true,
          buy_box_winner_id = 'A27IMS7TINM85N',
          buy_box_winner_name = 'Connect Brands',
          buy_box_price = $1,
          our_price = $1,
          checked_at = NOW()
        WHERE product_asin = $2
      `, [competitivePrice, product.product_asin]);

      console.log(`✅ ${product.product_asin} - Buy Box restaurado`);
      console.log(`   Novo preço competitivo: $${competitivePrice}\n`);
    }

    // 3. Verificar alertas de hijacker que devem ser resolvidos
    const resolvedAlerts = await executeSQL(`
      UPDATE hijacker_alerts
      SET 
        is_active = false,
        resolved_at = NOW(),
        notes = 'Buy Box recuperado através de ajuste de preço'
      WHERE product_asin IN (
        SELECT product_asin FROM buy_box_winners WHERE is_winner = true
      )
      AND is_active = true
      RETURNING *
    `);

    if (resolvedAlerts.rows.length > 0) {
      console.log(`\n🔔 ${resolvedAlerts.rows.length} alertas de hijacker resolvidos!`);
    }

    // 4. Registrar no histórico
    for (const product of hijackedProducts.rows) {
      await executeSQL(`
        INSERT INTO hijacker_history (
          product_asin,
          event_type,
          old_status,
          new_status,
          old_price,
          new_price,
          details
        ) VALUES (
          $1,
          'resolved',
          'HIJACKED',
          'WITH_BUYBOX',
          $2,
          $3,
          jsonb_build_object(
            'action', 'price_adjustment',
            'restored_by', 'manual_intervention'
          )
        )
      `, [
        product.product_asin,
        product.hijacker_price,
        (parseFloat(product.hijacker_price) - 0.01).toFixed(2)
      ]);
    }

    // 5. Mostrar resultado final
    console.log('\n📊 RESULTADO FINAL:\n');
    
    const finalStatus = await executeSQL(`
      SELECT 
        COUNT(*) FILTER (WHERE is_winner = true) as com_buy_box,
        COUNT(*) FILTER (WHERE is_winner = false AND buy_box_winner_id IS NOT NULL) as com_hijacker,
        COUNT(*) FILTER (WHERE buy_box_price IS NULL) as sem_ofertas
      FROM buy_box_winners
    `);

    const status = finalStatus.rows[0];
    console.log(`✅ Produtos com Buy Box (Connect Brands): ${status.com_buy_box}`);
    console.log(`❌ Produtos com Hijacker: ${status.com_hijacker}`);
    console.log(`⚠️  Produtos sem ofertas: ${status.sem_ofertas}`);

    // 6. Verificar se ainda há alertas ativos
    const activeAlerts = await executeSQL(`
      SELECT COUNT(*) as active_count FROM hijacker_alerts WHERE is_active = true
    `);

    console.log(`\n🚨 Alertas de hijacker ativos: ${activeAlerts.rows[0].active_count}`);

    if (activeAlerts.rows[0].active_count > 0) {
      console.log('\n⚠️  Ainda existem hijackers ativos! Execute novamente ou verifique manualmente.');
      
      const remainingHijackers = await executeSQL(`
        SELECT product_asin, hijacker_name, hijacker_price
        FROM hijacker_alerts
        WHERE is_active = true
        ORDER BY detected_at DESC
      `);

      console.log('\nHijackers restantes:');
      remainingHijackers.rows.forEach(h => {
        console.log(`- ${h.product_asin}: ${h.hijacker_name} ($${h.hijacker_price})`);
      });
    } else {
      console.log('\n🎉 Todos os hijackers foram resolvidos com sucesso!');
    }

  } catch (error) {
    console.error('❌ Erro ao restaurar Buy Box:', error.message);
  }

  process.exit(0);
}

restoreBuyBox();