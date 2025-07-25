const hijackerAlertService = require('../server/services/hijackerAlertService');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function startHijackerMonitoring() {
  console.log('🚨 INICIANDO MONITORAMENTO DE HIJACKERS\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar configuração
    console.log('\n🔧 Verificando configuração...');
    
    const hasSlack = !!process.env.SLACK_WEBHOOK_URL;
    const hasEmail = !!process.env.NOTIFICATION_EMAIL && !!process.env.SENDGRID_API_KEY;
    
    console.log(`   Slack: ${hasSlack ? '✅ Configurado' : '❌ Não configurado'}`);
    console.log(`   Email: ${hasEmail ? '✅ Configurado' : '❌ Não configurado'}`);
    
    if (!hasSlack && !hasEmail) {
      console.log('\n⚠️  AVISO: Nenhum canal de notificação configurado!');
      console.log('   Configure SLACK_WEBHOOK_URL ou NOTIFICATION_EMAIL no .env');
    }

    // 2. Verificar estado atual
    console.log('\n📊 Estado atual do sistema:');
    
    const stats = await executeSQL(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true) as alertas_ativos,
        COUNT(*) FILTER (WHERE is_active = true AND alert_sent = false) as alertas_pendentes,
        COUNT(DISTINCT product_asin) FILTER (WHERE is_active = true) as produtos_afetados,
        COUNT(DISTINCT hijacker_id) FILTER (WHERE is_active = true) as hijackers_ativos
      FROM hijacker_alerts
    `);
    
    const s = stats.rows[0];
    console.log(`   Alertas ativos: ${s.alertas_ativos}`);
    console.log(`   Alertas pendentes de envio: ${s.alertas_pendentes}`);
    console.log(`   Produtos afetados: ${s.produtos_afetados}`);
    console.log(`   Hijackers únicos ativos: ${s.hijackers_ativos}`);

    // 3. Mostrar hijackers ativos
    if (s.alertas_ativos > 0) {
      console.log('\n🏴‍☠️ Hijackers ativos:');
      
      const activeHijackers = await executeSQL(`
        SELECT 
          product_asin,
          hijacker_name,
          hijacker_price,
          detected_at,
          alert_sent
        FROM hijacker_alerts
        WHERE is_active = true
        ORDER BY detected_at DESC
        LIMIT 10
      `);
      
      activeHijackers.rows.forEach(h => {
        const status = h.alert_sent ? '📧' : '⏳';
        console.log(`   ${status} ${h.product_asin} - ${h.hijacker_name} ($${h.hijacker_price})`);
      });
    }

    // 4. Iniciar monitoramento
    console.log('\n🚀 Iniciando serviço de monitoramento...\n');
    console.log('   Intervalo de verificação: 5 minutos');
    console.log('   Pressione Ctrl+C para parar\n');
    
    hijackerAlertService.start();

    // 5. Mostrar logs em tempo real
    console.log('📡 Monitorando hijackers...\n');
    
    // Configurar saída ao encerrar
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Parando monitoramento...');
      hijackerAlertService.stop();
      
      // Mostrar resumo final
      executeSQL(`
        SELECT 
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as alertas_ultima_hora,
          COUNT(*) FILTER (WHERE alert_sent = true AND created_at >= NOW() - INTERVAL '1 hour') as enviados_ultima_hora
        FROM hijacker_alerts
      `).then(result => {
        const r = result.rows[0];
        console.log(`\n📊 Resumo da sessão:`);
        console.log(`   Alertas detectados na última hora: ${r.alertas_ultima_hora}`);
        console.log(`   Alertas enviados na última hora: ${r.enviados_ultima_hora}`);
        console.log('\n✅ Monitoramento encerrado.');
        process.exit(0);
      });
    });

    // Manter processo rodando
    setInterval(() => {
      // Mostrar heartbeat a cada minuto
      process.stdout.write('.');
    }, 60000);

  } catch (error) {
    console.error('❌ Erro ao iniciar monitoramento:', error.message);
    process.exit(1);
  }
}

startHijackerMonitoring();