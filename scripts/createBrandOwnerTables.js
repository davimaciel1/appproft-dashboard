// Script para criar tabelas específicas para brand owners definirem competidores manuais

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createBrandOwnerTables() {
  console.log('🏷️ CRIANDO ESTRUTURA PARA BRAND OWNERS');
  console.log('='.repeat(50));
  
  try {
    // 1. Criar tabela de brand owners
    console.log('1️⃣ Criando tabela brand_owners...');
    
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS brand_owners (
        id SERIAL PRIMARY KEY,
        seller_id VARCHAR(100) UNIQUE NOT NULL,
        brand_name VARCHAR(255) NOT NULL,
        is_exclusive BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX idx_brand_owners_seller ON brand_owners(seller_id);
    `);
    
    console.log('✅ Tabela brand_owners criada');
    
    // 2. Criar tabela de ASINs do brand owner
    console.log('\n2️⃣ Criando tabela brand_owner_products...');
    
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS brand_owner_products (
        id SERIAL PRIMARY KEY,
        brand_owner_id INTEGER REFERENCES brand_owners(id),
        asin VARCHAR(20) NOT NULL,
        product_name VARCHAR(500),
        category VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(brand_owner_id, asin)
      );
      
      CREATE INDEX idx_brand_products_asin ON brand_owner_products(asin);
      CREATE INDEX idx_brand_products_owner ON brand_owner_products(brand_owner_id);
    `);
    
    console.log('✅ Tabela brand_owner_products criada');
    
    // 3. Criar tabela de competidores manuais
    console.log('\n3️⃣ Criando tabela manual_competitors...');
    
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS manual_competitors (
        id SERIAL PRIMARY KEY,
        brand_owner_id INTEGER REFERENCES brand_owners(id),
        our_asin VARCHAR(20) NOT NULL,
        competitor_asin VARCHAR(20) NOT NULL,
        competitor_brand VARCHAR(255),
        competitor_seller_name VARCHAR(255),
        competition_level VARCHAR(20) DEFAULT 'direct', -- 'direct', 'indirect', 'substitute'
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(brand_owner_id, our_asin, competitor_asin)
      );
      
      CREATE INDEX idx_manual_competitors_our ON manual_competitors(our_asin);
      CREATE INDEX idx_manual_competitors_comp ON manual_competitors(competitor_asin);
      CREATE INDEX idx_manual_competitors_owner ON manual_competitors(brand_owner_id);
    `);
    
    console.log('✅ Tabela manual_competitors criada');
    
    // 4. Criar tabela de monitoramento de competidores
    console.log('\n4️⃣ Criando tabela competitor_monitoring...');
    
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS competitor_monitoring (
        id SERIAL PRIMARY KEY,
        manual_competitor_id INTEGER REFERENCES manual_competitors(id),
        our_asin VARCHAR(20) NOT NULL,
        competitor_asin VARCHAR(20) NOT NULL,
        our_price DECIMAL(10,2),
        competitor_price DECIMAL(10,2),
        price_difference DECIMAL(10,2),
        price_difference_percent DECIMAL(5,2),
        our_rank INTEGER,
        competitor_rank INTEGER,
        our_reviews_count INTEGER,
        competitor_reviews_count INTEGER,
        our_rating DECIMAL(2,1),
        competitor_rating DECIMAL(2,1),
        monitoring_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX idx_competitor_monitoring_date ON competitor_monitoring(monitoring_date);
      CREATE INDEX idx_competitor_monitoring_asins ON competitor_monitoring(our_asin, competitor_asin);
    `);
    
    console.log('✅ Tabela competitor_monitoring criada');
    
    // 5. Criar view consolidada
    console.log('\n5️⃣ Criando view brand_owner_competition_dashboard...');
    
    await executeSQL(`
      CREATE OR REPLACE VIEW brand_owner_competition_dashboard AS
      SELECT 
        bo.brand_name,
        bop.asin as our_asin,
        bop.product_name as our_product,
        mc.competitor_asin,
        mc.competitor_brand,
        mc.competition_level,
        cm.our_price,
        cm.competitor_price,
        cm.price_difference,
        cm.price_difference_percent,
        CASE 
          WHEN cm.our_price < cm.competitor_price THEN 'Vantagem'
          WHEN cm.our_price = cm.competitor_price THEN 'Empate'
          ELSE 'Desvantagem'
        END as price_position,
        cm.our_rank,
        cm.competitor_rank,
        cm.our_rating,
        cm.competitor_rating,
        cm.monitoring_date
      FROM brand_owners bo
      JOIN brand_owner_products bop ON bo.id = bop.brand_owner_id
      JOIN manual_competitors mc ON bop.asin = mc.our_asin AND bo.id = mc.brand_owner_id
      LEFT JOIN competitor_monitoring cm ON mc.id = cm.manual_competitor_id
        AND cm.monitoring_date = (
          SELECT MAX(monitoring_date) 
          FROM competitor_monitoring cm2 
          WHERE cm2.manual_competitor_id = mc.id
        )
      WHERE mc.is_active = true
      ORDER BY bo.brand_name, bop.asin, cm.price_difference_percent DESC;
    `);
    
    console.log('✅ View brand_owner_competition_dashboard criada');
    
    // 6. Criar função para adicionar competidor manual
    console.log('\n6️⃣ Criando função add_manual_competitor...');
    
    await executeSQL(`
      CREATE OR REPLACE FUNCTION add_manual_competitor(
        p_seller_id VARCHAR,
        p_brand_name VARCHAR,
        p_our_asin VARCHAR,
        p_competitor_asin VARCHAR,
        p_competitor_brand VARCHAR,
        p_competition_level VARCHAR DEFAULT 'direct',
        p_notes TEXT DEFAULT NULL
      ) RETURNS INTEGER AS $$
      DECLARE
        v_brand_owner_id INTEGER;
        v_competitor_id INTEGER;
      BEGIN
        -- Criar ou obter brand owner
        INSERT INTO brand_owners (seller_id, brand_name)
        VALUES (p_seller_id, p_brand_name)
        ON CONFLICT (seller_id) DO UPDATE SET brand_name = p_brand_name
        RETURNING id INTO v_brand_owner_id;
        
        -- Adicionar produto do brand owner se não existir
        INSERT INTO brand_owner_products (brand_owner_id, asin)
        VALUES (v_brand_owner_id, p_our_asin)
        ON CONFLICT (brand_owner_id, asin) DO NOTHING;
        
        -- Adicionar competidor manual
        INSERT INTO manual_competitors (
          brand_owner_id, our_asin, competitor_asin, 
          competitor_brand, competition_level, notes
        )
        VALUES (
          v_brand_owner_id, p_our_asin, p_competitor_asin,
          p_competitor_brand, p_competition_level, p_notes
        )
        ON CONFLICT (brand_owner_id, our_asin, competitor_asin) 
        DO UPDATE SET 
          competitor_brand = p_competitor_brand,
          competition_level = p_competition_level,
          notes = p_notes,
          updated_at = NOW()
        RETURNING id INTO v_competitor_id;
        
        RETURN v_competitor_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Função add_manual_competitor criada');
    
    // 7. Criar trigger para atualizar monitoramento
    console.log('\n7️⃣ Criando trigger para monitoramento automático...');
    
    await executeSQL(`
      CREATE OR REPLACE FUNCTION update_competitor_monitoring() RETURNS TRIGGER AS $$
      BEGIN
        -- Buscar preços e rankings atuais dos produtos
        INSERT INTO competitor_monitoring (
          manual_competitor_id, our_asin, competitor_asin,
          our_price, competitor_price, price_difference, price_difference_percent
        )
        SELECT 
          NEW.id,
          NEW.our_asin,
          NEW.competitor_asin,
          p1.price as our_price,
          p2.price as competitor_price,
          p1.price - p2.price as price_difference,
          CASE 
            WHEN p2.price > 0 THEN ((p1.price - p2.price) / p2.price * 100)
            ELSE 0
          END as price_difference_percent
        FROM products p1
        CROSS JOIN products p2
        WHERE p1.asin = NEW.our_asin
        AND p2.asin = NEW.competitor_asin;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER trigger_monitor_new_competitor
      AFTER INSERT ON manual_competitors
      FOR EACH ROW
      EXECUTE FUNCTION update_competitor_monitoring();
    `);
    
    console.log('✅ Trigger de monitoramento criado');
    
    // 8. Exibir estatísticas
    console.log('\n8️⃣ Verificando estrutura criada...');
    
    const tables = await executeSQL(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_name IN (
        'brand_owners', 'brand_owner_products', 
        'manual_competitors', 'competitor_monitoring'
      )
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Tabelas criadas:');
    console.table(tables.rows);
    
    console.log('\n✅ Estrutura para Brand Owners criada com sucesso!');
    console.log('\n📋 Como usar:');
    console.log('1. Adicionar um brand owner e seus produtos');
    console.log('2. Definir manualmente os ASINs dos competidores');
    console.log('3. O sistema monitorará automaticamente preços e rankings');
    console.log('\n📝 Exemplo de uso:');
    console.log(`
SELECT add_manual_competitor(
  'SELLER123',              -- seller_id
  'Minha Marca',            -- brand_name  
  'B0ABC123',               -- nosso ASIN
  'B0XYZ789',               -- ASIN do competidor
  'Marca Concorrente',      -- marca do competidor
  'direct',                 -- nível de competição
  'Principal competidor'    -- notas
);
    `);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

// Executar
createBrandOwnerTables().catch(console.error);