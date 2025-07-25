const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

/**
 * Script para processar dados de competitor_tracking_advanced
 * e gerar histórico consolidado em buy_box_history
 */
async function generateBuyBoxHistory() {
  try {
    console.log('🔄 Processando histórico de Buy Box...\n');
    
    // Buscar todos os ASINs únicos
    const asinsResult = await executeSQL(`
      SELECT DISTINCT asin 
      FROM competitor_tracking_advanced 
      WHERE asin IS NOT NULL
      ORDER BY asin
    `);
    
    console.log(`📦 Encontrados ${asinsResult.rows.length} ASINs para processar\n`);
    
    let totalRecords = 0;
    
    for (const { asin } of asinsResult.rows) {
      console.log(`\n🏷️ Processando ASIN: ${asin}`);
      
      // Buscar histórico de Buy Box para este ASIN ordenado por tempo
      const history = await executeSQL(`
        SELECT 
          timestamp,
          buy_box_seller as seller_name,
          buy_box_price as price,
          our_has_buy_box
        FROM competitor_tracking_advanced
        WHERE asin = $1
        ORDER BY timestamp ASC
      `, [asin]);
      
      if (history.rows.length === 0) continue;
      
      console.log(`   📊 ${history.rows.length} snapshots encontrados`);
      
      // Processar mudanças de Buy Box
      let currentOwner = null;
      let ownershipStart = null;
      let priceSum = 0;
      let priceCount = 0;
      let minPrice = null;
      let maxPrice = null;
      let recordsGenerated = 0;
      
      for (let i = 0; i < history.rows.length; i++) {
        const record = history.rows[i];
        const seller = record.seller_name || 'Unknown';
        const price = parseFloat(record.price) || 0;
        
        // Se mudou o dono do Buy Box
        if (currentOwner !== seller) {
          // Salvar período anterior se existir
          if (currentOwner && ownershipStart) {
            const endTime = record.timestamp;
            const durationMinutes = Math.floor((new Date(endTime) - new Date(ownershipStart)) / (1000 * 60));
            
            if (durationMinutes > 0) {
              const avgPrice = priceCount > 0 ? (priceSum / priceCount) : 0;
              
              await executeSQL(`
                INSERT INTO buy_box_history 
                (asin, seller_id, seller_name, started_at, ended_at, duration_minutes, avg_price, min_price, max_price)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              `, [
                asin,
                currentOwner, // usando seller_name como seller_id temporariamente
                currentOwner,
                ownershipStart,
                endTime,
                durationMinutes,
                avgPrice.toFixed(2),
                minPrice,
                maxPrice
              ]);
              
              recordsGenerated++;
            }
          }
          
          // Iniciar novo período
          currentOwner = seller;
          ownershipStart = record.timestamp;
          priceSum = price;
          priceCount = 1;
          minPrice = price;
          maxPrice = price;
        } else {
          // Continua com o mesmo dono, acumular estatísticas
          priceSum += price;
          priceCount++;
          if (price < minPrice) minPrice = price;
          if (price > maxPrice) maxPrice = price;
        }
      }
      
      // Processar último período (ainda ativo)
      if (currentOwner && ownershipStart) {
        const now = new Date();
        const durationMinutes = Math.floor((now - new Date(ownershipStart)) / (1000 * 60));
        
        if (durationMinutes > 0) {
          const avgPrice = priceCount > 0 ? (priceSum / priceCount) : 0;
          
          await executeSQL(`
            INSERT INTO buy_box_history 
            (asin, seller_id, seller_name, started_at, ended_at, duration_minutes, avg_price, min_price, max_price)
            VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8)
          `, [
            asin,
            currentOwner,
            currentOwner,
            ownershipStart,
            durationMinutes,
            avgPrice.toFixed(2),
            minPrice,
            maxPrice
          ]);
          
          recordsGenerated++;
        }
      }
      
      console.log(`   ✅ ${recordsGenerated} períodos de Buy Box gerados`);
      totalRecords += recordsGenerated;
    }
    
    console.log(`\n✅ Processamento concluído!`);
    console.log(`📊 Total de registros gerados: ${totalRecords}`);
    
    // Verificar resultado
    const count = await executeSQL('SELECT COUNT(*) as count FROM buy_box_history');
    console.log(`\n📈 Total de registros em buy_box_history: ${count.rows[0].count}`);
    
    // Mostrar estatísticas
    const stats = await executeSQL(`
      SELECT 
        seller_name,
        COUNT(*) as periods,
        SUM(duration_minutes) as total_minutes,
        AVG(avg_price) as avg_price,
        COUNT(DISTINCT asin) as unique_asins
      FROM buy_box_history
      GROUP BY seller_name
      ORDER BY total_minutes DESC
      LIMIT 10
    `);
    
    console.log('\n🏆 Top 10 vendedores por tempo com Buy Box:');
    stats.rows.forEach((seller, i) => {
      const hours = Math.floor(seller.total_minutes / 60);
      const minutes = seller.total_minutes % 60;
      console.log(`   ${i + 1}. ${seller.seller_name}: ${hours}h ${minutes}min em ${seller.unique_asins} ASINs`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar histórico:', error.message);
    console.error(error.stack);
  }
}

// Executar
generateBuyBoxHistory();