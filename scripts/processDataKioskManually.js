// Script para processar manualmente os dados do Data Kiosk

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');
const fs = require('fs');

async function processDataKioskManually() {
  console.log('🔧 PROCESSAMENTO MANUAL DO DATA KIOSK');
  console.log('='.repeat(50));
  
  try {
    // 1. Ler arquivo de resultado
    const filename = 'dataKiosk_902720020294_result.json';
    console.log(`1️⃣ Lendo arquivo ${filename}...`);
    
    const content = fs.readFileSync(filename, 'utf8');
    
    // O arquivo foi salvo como JSON string, então precisa parsear primeiro
    let rawData;
    try {
      rawData = JSON.parse(content);
    } catch (e) {
      // Se falhar, tentar como NDJSON
      rawData = content;
    }
    
    // Se for string (NDJSON), dividir em linhas
    const lines = typeof rawData === 'string' ? rawData.trim().split('\n') : [rawData];
    
    console.log(`✅ ${lines.length} linhas encontradas`);

    // 2. Processar cada linha
    console.log('\n2️⃣ Processando dados...');
    let processedCount = 0;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const data = JSON.parse(line);
        
        // Inserir em daily_metrics
        await executeSQL(`
          INSERT INTO daily_metrics (
            tenant_id, date, marketplace,
            ordered_product_sales, units_ordered, total_order_items,
            page_views, sessions, buy_box_percentage, unit_session_percentage,
            average_selling_price, units_refunded, refund_rate
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (tenant_id, date, marketplace) 
          DO UPDATE SET
            ordered_product_sales = EXCLUDED.ordered_product_sales,
            units_ordered = EXCLUDED.units_ordered,
            total_order_items = EXCLUDED.total_order_items,
            page_views = EXCLUDED.page_views,
            sessions = EXCLUDED.sessions,
            buy_box_percentage = EXCLUDED.buy_box_percentage,
            unit_session_percentage = EXCLUDED.unit_session_percentage,
            updated_at = NOW()
        `, [
          'default',
          data.startDate,
          'amazon',
          data.sales?.orderedProductSales?.amount || 0,
          data.sales?.unitsOrdered || 0,
          data.sales?.totalOrderItems || 0,
          data.traffic?.pageViews || 0,
          data.traffic?.sessions || 0,
          data.traffic?.buyBoxPercentage || 0,
          data.traffic?.unitSessionPercentage || 0,
          0, // average_selling_price - calcular se necessário
          0, // units_refunded
          0  // refund_rate
        ]);
        
        processedCount++;
        
      } catch (error) {
        console.error('❌ Erro ao processar linha:', error.message);
      }
    }
    
    console.log(`✅ ${processedCount} registros processados`);

    // 3. Verificar dados salvos
    console.log('\n3️⃣ Verificando dados salvos...');
    
    const dailyCount = await executeSQL('SELECT COUNT(*) FROM daily_metrics');
    console.log(`📊 daily_metrics: ${dailyCount.rows[0].count} registros`);
    
    // Mostrar últimos 5 registros
    const recentData = await executeSQL(`
      SELECT date, ordered_product_sales, units_ordered, page_views, sessions
      FROM daily_metrics
      ORDER BY date DESC
      LIMIT 5
    `);
    
    console.log('\nÚltimos 5 registros:');
    console.log('Data       | Vendas | Unidades | Views | Sessões');
    console.log('-'.repeat(50));
    
    for (const row of recentData.rows) {
      console.log(
        `${row.date.toISOString().split('T')[0]} | $${row.ordered_product_sales.padEnd(6)} | ${row.units_ordered.toString().padEnd(8)} | ${row.page_views.toString().padEnd(5)} | ${row.sessions}`
      );
    }

    // 4. Processar produtos se houver arquivo
    const productFile = 'dataKiosk_902721020294_result.json';
    if (fs.existsSync(productFile)) {
      console.log(`\n4️⃣ Processando arquivo de produtos...`);
      
      const productContent = fs.readFileSync(productFile, 'utf8');
      const productLines = productContent.trim().split('\n');
      
      console.log(`✅ ${productLines.length} produtos encontrados`);
      
      // Por enquanto, apenas mostrar o conteúdo
      for (const line of productLines) {
        if (!line.trim()) continue;
        const product = JSON.parse(line);
        console.log(`ASIN: ${product.childAsin || product.parentAsin}, SKU: ${product.sku}, Vendas: ${product.sales?.unitsOrdered || 0}`);
      }
    }

    console.log('\n✅ Processamento concluído!');
    
  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
  }
}

// Executar
processDataKioskManually().catch(console.error);