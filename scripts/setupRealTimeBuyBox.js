const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function setupRealTimeBuyBox() {
  console.log('🚀 Configurando sincronização em TEMPO REAL do Buy Box\n');
  
  try {
    // 1. Criar job de sincronização automática
    console.log('📅 Configurando job de sincronização...');
    
    await executeSQL(`
      -- Criar tabela de configuração se não existir
      CREATE TABLE IF NOT EXISTS buy_box_sync_config (
        id SERIAL PRIMARY KEY,
        sync_interval_minutes INTEGER DEFAULT 15,
        last_sync_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Inserir configuração padrão
      INSERT INTO buy_box_sync_config (sync_interval_minutes, is_active)
      VALUES (15, true)
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log('✅ Tabela de configuração criada');
    
    // 2. Criar função para detectar mudanças em tempo real
    console.log('\n🔍 Criando sistema de detecção de mudanças...');
    
    await executeSQL(`
      -- Função para registrar mudanças de Buy Box
      CREATE OR REPLACE FUNCTION log_buy_box_change()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Se houve mudança no winner
        IF OLD.buy_box_winner_id IS DISTINCT FROM NEW.buy_box_winner_id THEN
          INSERT INTO buy_box_change_log (
            product_asin,
            old_winner_id,
            new_winner_id,
            old_winner_name,
            new_winner_name,
            old_price,
            new_price,
            change_type,
            detected_at
          ) VALUES (
            NEW.product_asin,
            OLD.buy_box_winner_id,
            NEW.buy_box_winner_id,
            OLD.buy_box_winner_name,
            NEW.buy_box_winner_name,
            OLD.buy_box_price,
            NEW.buy_box_price,
            CASE
              WHEN OLD.is_winner = true AND NEW.is_winner = false THEN 'LOST'
              WHEN OLD.is_winner = false AND NEW.is_winner = true THEN 'WON'
              ELSE 'CHANGED'
            END,
            NOW()
          );
          
          -- Notificar sistema de alertas
          PERFORM pg_notify('buy_box_change', json_build_object(
            'asin', NEW.product_asin,
            'change_type', CASE
              WHEN OLD.is_winner = true AND NEW.is_winner = false THEN 'LOST'
              WHEN OLD.is_winner = false AND NEW.is_winner = true THEN 'WON'
              ELSE 'CHANGED'
            END,
            'new_winner', NEW.buy_box_winner_name,
            'price', NEW.buy_box_price
          )::text);
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Criar trigger se não existir
      DROP TRIGGER IF EXISTS buy_box_change_trigger ON buy_box_winners;
      
      CREATE TRIGGER buy_box_change_trigger
      AFTER UPDATE ON buy_box_winners
      FOR EACH ROW
      EXECUTE FUNCTION log_buy_box_change();
    `);
    
    console.log('✅ Sistema de detecção de mudanças criado');
    
    // 3. Criar tabela de log de mudanças
    console.log('\n📊 Criando tabela de histórico de mudanças...');
    
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS buy_box_change_log (
        id SERIAL PRIMARY KEY,
        product_asin VARCHAR(20) NOT NULL,
        old_winner_id VARCHAR(50),
        new_winner_id VARCHAR(50),
        old_winner_name VARCHAR(255),
        new_winner_name VARCHAR(255),
        old_price DECIMAL(10,2),
        new_price DECIMAL(10,2),
        change_type VARCHAR(20), -- 'LOST', 'WON', 'CHANGED'
        detected_at TIMESTAMP DEFAULT NOW(),
        notified BOOLEAN DEFAULT false
      );
      
      CREATE INDEX IF NOT EXISTS idx_change_log_asin ON buy_box_change_log(product_asin);
      CREATE INDEX IF NOT EXISTS idx_change_log_time ON buy_box_change_log(detected_at);
      CREATE INDEX IF NOT EXISTS idx_change_log_type ON buy_box_change_log(change_type);
    `);
    
    console.log('✅ Tabela de log criada');
    
    // 4. Criar view para monitoramento em tempo real
    console.log('\n📈 Criando views de monitoramento...');
    
    await executeSQL(`
      CREATE OR REPLACE VIEW buy_box_real_time_status AS
      SELECT 
        bw.product_asin,
        bw.product_name,
        bw.product_image_url,
        bw.is_winner,
        bw.buy_box_winner_name,
        bw.buy_box_price,
        bw.our_price,
        bw.competitor_count,
        bw.checked_at,
        AGE(NOW(), bw.checked_at) as time_since_check,
        CASE 
          WHEN bw.checked_at < NOW() - INTERVAL '30 minutes' THEN '⚠️ Dados desatualizados'
          WHEN bw.is_winner THEN '✅ Temos o Buy Box'
          WHEN bw.buy_box_winner_id IS NOT NULL THEN '❌ Competidor tem'
          ELSE '⏸️ Sem ofertas'
        END as status,
        (
          SELECT COUNT(*) 
          FROM buy_box_change_log 
          WHERE product_asin = bw.product_asin 
          AND detected_at > NOW() - INTERVAL '24 hours'
        ) as changes_24h
      FROM buy_box_winners bw
      ORDER BY bw.checked_at DESC;
    `);
    
    console.log('✅ Views de monitoramento criadas');
    
    // 5. Informações sobre a implementação
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SISTEMA DE SINCRONIZAÇÃO EM TEMPO REAL CONFIGURADO!\n');
    
    console.log('📋 O que foi implementado:');
    console.log('   ✅ Detecção automática de mudanças no Buy Box');
    console.log('   ✅ Log completo de todas as mudanças');
    console.log('   ✅ Notificações em tempo real via PostgreSQL NOTIFY');
    console.log('   ✅ View para monitoramento ao vivo');
    console.log('   ✅ Triggers que detectam mudanças instantaneamente');
    
    console.log('\n🔄 Como funciona:');
    console.log('   1. Sistema sincroniza com Amazon a cada 15 minutos');
    console.log('   2. Qualquer mudança é detectada INSTANTANEAMENTE');
    console.log('   3. Trigger registra a mudança no histórico');
    console.log('   4. Sistema de notificação é acionado em tempo real');
    console.log('   5. Alertas são enviados para Slack/Email automaticamente');
    
    console.log('\n💡 Para ativar a sincronização em tempo real:');
    console.log('   node scripts/startPersistentSync.js');
    
    console.log('\n📊 Para monitorar mudanças:');
    console.log('   SELECT * FROM buy_box_real_time_status;');
    console.log('   SELECT * FROM buy_box_change_log ORDER BY detected_at DESC;');
    
    // Verificar mudanças recentes
    const recentChanges = await executeSQL(`
      SELECT 
        COUNT(*) as total_changes,
        COUNT(CASE WHEN change_type = 'LOST' THEN 1 END) as lost_count,
        COUNT(CASE WHEN change_type = 'WON' THEN 1 END) as won_count
      FROM buy_box_change_log
      WHERE detected_at > NOW() - INTERVAL '24 hours'
    `);
    
    const changes = recentChanges.rows[0];
    console.log('\n📈 Mudanças nas últimas 24 horas:');
    console.log(`   Total: ${changes.total_changes}`);
    console.log(`   ✅ Buy Box ganhos: ${changes.won_count}`);
    console.log(`   ❌ Buy Box perdidos: ${changes.lost_count}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

setupRealTimeBuyBox();