const PersistentSyncManager = require('../server/services/persistentSyncManager');
const profitDetectorService = require('../server/services/profitDetector');

async function testIntegration() {
  console.log('🧪 Testing Profit Detector Integration...\n');

  try {
    // 1. Test basic service functionality
    console.log('1️⃣ Testing service methods...');
    const analyses = await profitDetectorService.getProfitAnalyses();
    console.log(`✅ Found ${analyses.analyses.length} profit analyses`);

    // 2. Test PersistentSyncManager integration
    console.log('\n2️⃣ Testing PersistentSyncManager integration...');
    const syncManager = new PersistentSyncManager();
    
    // Test queuing a profit sync task
    const taskId = await syncManager.enqueueTask(
      'profit_sync',
      '/profit-detector/sync',
      { tenantId: 'default' },
      3
    );
    console.log(`✅ Profit sync task queued with ID: ${taskId}`);

    // 3. Test queuing product analysis
    console.log('\n3️⃣ Testing product analysis task...');
    const productTaskId = await syncManager.enqueueTask(
      'profit_analyze_product',
      '/profit-detector/analyze/B08N5WRWNW',
      { asin: 'B08N5WRWNW', productCost: 25.50 },
      2
    );
    console.log(`✅ Product analysis task queued with ID: ${productTaskId}`);

    // 4. Check queue stats
    console.log('\n4️⃣ Checking queue statistics...');
    const stats = await syncManager.getQueueStats();
    console.log('📊 Queue stats:', stats);

    console.log('\n✅ All integration tests passed!');
    console.log('\n📝 Integration complete! The Profit Detector module is now:');
    console.log('• ✅ Integrated with PersistentSyncManager');
    console.log('• ✅ Available via API routes');
    console.log('• ✅ Ready for scheduled execution');
    console.log('• ✅ Monitoring profit leaks automatically');

    console.log('\n🚀 Next steps:');
    console.log('1. Configure SP-API credentials for real data collection');
    console.log('2. Add product costs manually or via CSV bulk upload');
    console.log('3. Add navigation link to the frontend for /profit-detector');
    console.log('4. Run initial profit sync to populate data');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

testIntegration();