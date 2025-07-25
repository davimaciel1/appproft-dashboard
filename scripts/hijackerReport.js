const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function hijackerReport() {
  console.log('🚨 RELATÓRIO DE HIJACKERS\n');
  console.log('='.repeat(100));
  
  try {
    // 1. Alertas ativos
    const activeAlerts = await executeSQL(`
      SELECT * FROM get_hijacker_report()
    `);

    if (activeAlerts.rows.length > 0) {
      console.log('\n🔴 HIJACKERS ATIVOS:');
      console.log('-'.repeat(100));
      
      activeAlerts.rows.forEach((alert, index) => {
        console.log(`\n${index + 1}. ${alert.product_asin} - ${(alert.product_name || '').substring(0, 50)}...`);
        console.log(`   🏴‍☠️ Hijacker: ${alert.hijacker_name}`);
        console.log(`   📅 Ativo há: ${alert.days_active} dias`);
        console.log(`   💰 Preços: Seu $${alert.our_price} | Hijacker $${alert.hijacker_price}`);
        console.log(`   📊 Status: ${alert.status}`);
      });
    } else {
      console.log('\n✅ Nenhum hijacker ativo no momento!');
    }

    // 2. Histórico recente
    const recentHistory = await executeSQL(`
      SELECT 
        hh.*,
        ha.hijacker_name,
        ha.product_name
      FROM hijacker_history hh
      LEFT JOIN hijacker_alerts ha ON hh.alert_id = ha.id
      ORDER BY hh.timestamp DESC
      LIMIT 10
    `);

    if (recentHistory.rows.length > 0) {
      console.log('\n\n📜 HISTÓRICO RECENTE:');
      console.log('-'.repeat(100));
      
      recentHistory.rows.forEach(event => {
        const icon = event.event_type === 'detected' ? '🚨' : '✅';
        console.log(`${icon} ${new Date(event.timestamp).toLocaleString('pt-BR')} - ${event.product_asin}`);
        console.log(`   Evento: ${event.event_type} | ${event.old_status} → ${event.new_status}`);
        if (event.details) {
          console.log(`   Detalhes: ${JSON.stringify(event.details)}`);
        }
      });
    }

    // 3. Estatísticas gerais
    const stats = await executeSQL(`
      SELECT 
        COUNT(DISTINCT product_asin) as produtos_afetados,
        COUNT(DISTINCT hijacker_id) as hijackers_unicos,
        COUNT(CASE WHEN is_active THEN 1 END) as alertas_ativos,
        COUNT(CASE WHEN NOT is_active THEN 1 END) as alertas_resolvidos,
        AVG(CASE 
          WHEN NOT is_active AND resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - detected_at))/3600 
        END) as media_horas_resolucao
      FROM hijacker_alerts
    `);

    const s = stats.rows[0];
    console.log('\n\n📊 ESTATÍSTICAS GERAIS:');
    console.log('='.repeat(100));
    console.log(`Produtos afetados: ${s.produtos_afetados}`);
    console.log(`Hijackers únicos: ${s.hijackers_unicos}`);
    console.log(`Alertas ativos: ${s.alertas_ativos}`);
    console.log(`Alertas resolvidos: ${s.alertas_resolvidos}`);
    if (s.media_horas_resolucao) {
      console.log(`Tempo médio de resolução: ${Math.round(s.media_horas_resolucao)} horas`);
    }

    // 4. Top hijackers
    const topHijackers = await executeSQL(`
      SELECT 
        hijacker_name,
        hijacker_id,
        COUNT(DISTINCT product_asin) as produtos_hijacked,
        COUNT(*) as total_incidents,
        MIN(detected_at) as primeiro_hijack,
        MAX(detected_at) as ultimo_hijack
      FROM hijacker_alerts
      GROUP BY hijacker_name, hijacker_id
      HAVING COUNT(*) > 0
      ORDER BY total_incidents DESC
      LIMIT 5
    `);

    if (topHijackers.rows.length > 0) {
      console.log('\n\n🏴‍☠️ TOP HIJACKERS:');
      console.log('-'.repeat(100));
      
      topHijackers.rows.forEach((hijacker, index) => {
        console.log(`${index + 1}. ${hijacker.hijacker_name} (${hijacker.hijacker_id})`);
        console.log(`   Produtos afetados: ${hijacker.produtos_hijacked}`);
        console.log(`   Total de incidentes: ${hijacker.total_incidents}`);
        console.log(`   Primeiro hijack: ${new Date(hijacker.primeiro_hijack).toLocaleDateString('pt-BR')}`);
        console.log(`   Último hijack: ${new Date(hijacker.ultimo_hijack).toLocaleDateString('pt-BR')}`);
      });
    }

    // 5. Verificar alertas não enviados
    const pendingAlerts = await executeSQL(`
      SELECT COUNT(*) as pending 
      FROM hijacker_alerts 
      WHERE is_active = true AND alert_sent = false
    `);

    if (pendingAlerts.rows[0].pending > 0) {
      console.log(`\n\n⚠️ ATENÇÃO: ${pendingAlerts.rows[0].pending} alertas pendentes de envio!`);
    }

    console.log('\n' + '='.repeat(100));
    console.log(`📅 Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error.message);
  }

  process.exit(0);
}

hijackerReport();