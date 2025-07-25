const profitDetectorService = require('../server/services/profitDetector');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function testProfitDetector() {
  console.log('🧪 Testing Profit Detector Module...\n');

  try {
    // 1. Test database connection and tables
    console.log('1️⃣ Checking database tables...');
    const tables = await executeSQL(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'products_master', 'sales_data', 'fba_fees', 'profit_analysis', 'profit_alerts'
      )
      ORDER BY table_name;
    `);
    
    console.log('✅ Found tables:', tables.rows.map(r => r.table_name).join(', '));

    // 2. Add sample product cost
    console.log('\n2️⃣ Adding sample product cost...');
    const sampleProduct = {
      asin: 'B08N5WRWNW',
      cost: 25.50,
      title: 'Sample Product - Echo Dot',
      sku: 'ECHO-DOT-4'
    };
    
    await profitDetectorService.updateProductCost(
      sampleProduct.asin, 
      sampleProduct.cost
    );
    console.log('✅ Product cost added');

    // 3. Test profit analysis (without real data)
    console.log('\n3️⃣ Testing profit analysis functions...');
    
    // Check if analyzer is working
    const analyses = await profitDetectorService.getProfitAnalyses();
    console.log(`✅ Analysis function working. Found ${analyses.analyses.length} products analyzed`);
    console.log('📊 Summary:', analyses.summary);

    // 4. Test alerts
    console.log('\n4️⃣ Testing alert system...');
    const alerts = await profitDetectorService.getUnreadAlerts();
    console.log(`✅ Alert system working. Found ${alerts.length} unread alerts`);

    // 5. Check service methods
    console.log('\n5️⃣ Checking service methods...');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(profitDetectorService))
      .filter(method => method !== 'constructor');
    console.log('✅ Available methods:', methods.join(', '));

    // 6. Test integration readiness
    console.log('\n6️⃣ Testing integration readiness...');
    const integration = require('../server/services/profitDetector/persistentSyncIntegration');
    console.log('✅ Integration tasks:', Object.keys(integration.tasks));
    console.log('✅ Scheduled tasks:', Object.keys(integration.schedule));

    console.log('\n✅ All tests passed! Profit Detector module is ready.');
    console.log('\n📝 Next steps:');
    console.log('1. Integrate with PersistentSyncManager by adding the task handlers');
    console.log('2. Add route to server/index.js: app.use("/api/profit-detector", require("./routes/profitDetectorAPI"))');
    console.log('3. Add navigation link in the frontend');
    console.log('4. Configure SP-API credentials for Reports API');
    console.log('5. Run initial sync to populate data');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testProfitDetector();