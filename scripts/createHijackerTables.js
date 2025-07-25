const { executeSQL, ensureConnection } = require('../DATABASE_ACCESS_CONFIG');

async function createHijackerTables() {
  console.log('🚨 Criando sistema de alerta de Hijacker...\n');

  if (!await ensureConnection()) {
    console.error('❌ Não foi possível conectar ao banco de dados');
    process.exit(1);
  }

  try {
    // 1. Criar tabela hijacker_alerts
    console.log('📋 Criando tabela hijacker_alerts...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS hijacker_alerts (
        id SERIAL PRIMARY KEY,
        product_asin VARCHAR(20) NOT NULL,
        product_name VARCHAR(500),
        hijacker_id VARCHAR(50) NOT NULL,
        hijacker_name VARCHAR(255),
        our_price DECIMAL(10,2),
        hijacker_price DECIMAL(10,2),
        detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        alert_sent BOOLEAN DEFAULT false,
        notes TEXT,
        UNIQUE(product_asin, hijacker_id, detected_at)
      )
    `);
    
    // Criar índices
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_hijacker_alerts_asin ON hijacker_alerts(product_asin)`);
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_hijacker_alerts_active ON hijacker_alerts(is_active)`);
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_hijacker_alerts_detected ON hijacker_alerts(detected_at)`);
    
    console.log('✅ Tabela hijacker_alerts criada!');

    // 2. Criar tabela hijacker_history (histórico detalhado)
    console.log('\n📋 Criando tabela hijacker_history...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS hijacker_history (
        id SERIAL PRIMARY KEY,
        alert_id INTEGER REFERENCES hijacker_alerts(id),
        product_asin VARCHAR(20) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        event_type VARCHAR(50) NOT NULL, -- 'detected', 'price_change', 'resolved'
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        old_price DECIMAL(10,2),
        new_price DECIMAL(10,2),
        details JSONB
      )
    `);
    
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_hijacker_history_alert ON hijacker_history(alert_id)`);
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_hijacker_history_timestamp ON hijacker_history(timestamp)`);
    
    console.log('✅ Tabela hijacker_history criada!');

    // 3. Criar view para alertas ativos
    console.log('\n📋 Criando view hijacker_alerts_active...');
    await executeSQL(`
      CREATE OR REPLACE VIEW hijacker_alerts_active AS
      SELECT 
        ha.id,
        ha.product_asin,
        ha.product_name,
        ha.hijacker_id,
        ha.hijacker_name,
        ha.our_price,
        ha.hijacker_price,
        ha.detected_at,
        AGE(NOW(), ha.detected_at) as time_active,
        CASE 
          WHEN ha.hijacker_price < ha.our_price THEN 'UNDERCUTTING'
          WHEN ha.hijacker_price = ha.our_price THEN 'MATCHING'
          ELSE 'OVERPRICED'
        END as price_status,
        ha.alert_sent
      FROM hijacker_alerts ha
      WHERE ha.is_active = true
      ORDER BY ha.detected_at DESC
    `);
    
    console.log('✅ View hijacker_alerts_active criada!');

    // 4. Adicionar trigger para detectar mudanças
    console.log('\n📋 Criando função de detecção de hijacker...');
    await executeSQL(`
      CREATE OR REPLACE FUNCTION detect_hijacker()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Se perdemos o Buy Box (is_winner mudou de true para false)
        IF OLD.is_winner = true AND NEW.is_winner = false AND NEW.buy_box_winner_id IS NOT NULL THEN
          -- Inserir alerta de hijacker
          INSERT INTO hijacker_alerts (
            product_asin,
            product_name,
            hijacker_id,
            hijacker_name,
            our_price,
            hijacker_price,
            detected_at
          )
          SELECT 
            NEW.product_asin,
            p.name,
            NEW.buy_box_winner_id,
            COALESCE(NEW.buy_box_winner_name, NEW.buy_box_winner_id),
            NEW.our_price,
            NEW.buy_box_price,
            NOW()
          FROM products p
          WHERE p.asin = NEW.product_asin
          ON CONFLICT (product_asin, hijacker_id, detected_at) DO NOTHING;
          
          -- Registrar no histórico
          INSERT INTO hijacker_history (
            product_asin,
            event_type,
            old_status,
            new_status,
            old_price,
            new_price,
            details
          ) VALUES (
            NEW.product_asin,
            'detected',
            'WITH_BUYBOX',
            'HIJACKED',
            OLD.buy_box_price,
            NEW.buy_box_price,
            jsonb_build_object(
              'hijacker_id', NEW.buy_box_winner_id,
              'hijacker_name', NEW.buy_box_winner_name
            )
          );
        END IF;
        
        -- Se recuperamos o Buy Box
        IF OLD.is_winner = false AND NEW.is_winner = true THEN
          -- Marcar alertas como resolvidos
          UPDATE hijacker_alerts
          SET is_active = false,
              resolved_at = NOW()
          WHERE product_asin = NEW.product_asin
          AND is_active = true;
          
          -- Registrar resolução
          INSERT INTO hijacker_history (
            product_asin,
            event_type,
            old_status,
            new_status,
            old_price,
            new_price
          ) VALUES (
            NEW.product_asin,
            'resolved',
            'HIJACKED',
            'WITH_BUYBOX',
            OLD.buy_box_price,
            NEW.buy_box_price
          );
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Função detect_hijacker criada!');

    // 5. Criar trigger
    console.log('\n📋 Ativando trigger de detecção...');
    await executeSQL(`
      DROP TRIGGER IF EXISTS hijacker_detection_trigger ON buy_box_winners;
      
      CREATE TRIGGER hijacker_detection_trigger
      AFTER UPDATE ON buy_box_winners
      FOR EACH ROW
      EXECUTE FUNCTION detect_hijacker();
    `);
    
    console.log('✅ Trigger ativado!');

    // 6. Verificar estrutura criada
    console.log('\n📊 Estrutura criada com sucesso:');
    
    const tables = await executeSQL(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = t.table_name) as columns
      FROM information_schema.tables t
      WHERE table_name IN ('hijacker_alerts', 'hijacker_history')
      AND table_schema = 'public'
    `);
    
    console.table(tables.rows);

    // 7. Criar função para gerar relatório de hijackers
    console.log('\n📋 Criando função de relatório...');
    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_hijacker_report()
      RETURNS TABLE (
        product_asin VARCHAR,
        product_name VARCHAR,
        hijacker_name VARCHAR,
        days_active INTEGER,
        our_price DECIMAL,
        hijacker_price DECIMAL,
        price_difference DECIMAL,
        status TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          ha.product_asin,
          ha.product_name,
          ha.hijacker_name,
          EXTRACT(DAY FROM AGE(NOW(), ha.detected_at))::INTEGER as days_active,
          ha.our_price,
          ha.hijacker_price,
          ha.our_price - ha.hijacker_price as price_difference,
          CASE 
            WHEN ha.hijacker_price < ha.our_price THEN 'UNDERCUTTING by $' || (ha.our_price - ha.hijacker_price)::TEXT
            WHEN ha.hijacker_price = ha.our_price THEN 'MATCHING PRICE'
            ELSE 'OVERPRICED by $' || (ha.hijacker_price - ha.our_price)::TEXT
          END as status
        FROM hijacker_alerts ha
        WHERE ha.is_active = true
        ORDER BY ha.detected_at DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Sistema de alerta de Hijacker implementado com sucesso!');
    
    console.log('\n🚨 FUNCIONALIDADES IMPLEMENTADAS:');
    console.log('   ✅ Detecção automática quando perder Buy Box');
    console.log('   ✅ Registro de data/hora da detecção');
    console.log('   ✅ Armazenamento do nome do hijacker');
    console.log('   ✅ Histórico completo de eventos');
    console.log('   ✅ Relatórios de hijackers ativos');
    console.log('   ✅ Trigger automático no banco de dados');

  } catch (error) {
    console.error('❌ Erro ao criar sistema de hijacker:', error.message);
    console.error(error);
  }

  process.exit(0);
}

createHijackerTables();