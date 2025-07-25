// Integration patch for PersistentSyncManager to add Profit Detector tasks

const profitDetectorService = require('./index');

// Add these case handlers to the executeTask method in persistentSyncManager.js:

const profitDetectorTasks = {
  // Full profit analysis sync (runs twice daily)
  'profit_sync': async (payload) => {
    return await profitDetectorService.syncProfitData(payload.tenantId || 'default');
  },
  
  // Analyze specific product
  'profit_analyze_product': async (payload) => {
    if (!payload.asin) throw new Error('ASIN is required');
    return await profitDetectorService.analyzeProduct(payload.asin, payload.productCost);
  },
  
  // Check for profit alerts
  'profit_check_alerts': async (payload) => {
    return await profitDetectorService.alertSystem.checkAndGenerateAlerts();
  },
  
  // Collect profit reports from SP-API
  'profit_collect_reports': async (payload) => {
    return await profitDetectorService.collector.executeDailyCollection();
  },
  
  // Run profit analysis on all products
  'profit_analyze_all': async (payload) => {
    return await profitDetectorService.analyzer.analyzeAllProducts();
  }
};

// Schedule configuration for persistent sync
const profitDetectorSchedule = {
  // Run full sync twice daily at 6 AM and 6 PM
  'profit_sync': {
    cron: '0 6,18 * * *',
    priority: 3,
    description: 'Full profit analysis sync'
  },
  
  // Check alerts every hour
  'profit_check_alerts': {
    cron: '0 * * * *',
    priority: 2,
    description: 'Check for profit leak alerts'
  }
};

// Export integration functions
module.exports = {
  tasks: profitDetectorTasks,
  schedule: profitDetectorSchedule,
  
  // Helper to add profit sync to queue
  async queueProfitSync(syncManager, tenantId = 'default') {
    return await syncManager.addToQueue('profit_sync', '/profit-detector/sync', {
      tenantId,
      timestamp: new Date().toISOString()
    });
  },
  
  // Helper to analyze specific product
  async queueProductAnalysis(syncManager, asin, productCost = null) {
    return await syncManager.addToQueue('profit_analyze_product', `/profit-detector/analyze/${asin}`, {
      asin,
      productCost,
      timestamp: new Date().toISOString()
    });
  }
};

// Instructions to integrate into persistentSyncManager.js:
/*
1. Add at the top of the file:
   const profitDetectorIntegration = require('./profitDetector/persistentSyncIntegration');

2. In the executeTask method, add these cases:
   case 'profit_sync':
     result = await profitDetectorIntegration.tasks['profit_sync'](payload);
     break;
   case 'profit_analyze_product':
     result = await profitDetectorIntegration.tasks['profit_analyze_product'](payload);
     break;
   case 'profit_check_alerts':
     result = await profitDetectorIntegration.tasks['profit_check_alerts'](payload);
     break;
   case 'profit_collect_reports':
     result = await profitDetectorIntegration.tasks['profit_collect_reports'](payload);
     break;
   case 'profit_analyze_all':
     result = await profitDetectorIntegration.tasks['profit_analyze_all'](payload);
     break;

3. In the initializeScheduledTasks method, add:
   // Schedule profit detector tasks
   for (const [taskType, config] of Object.entries(profitDetectorIntegration.schedule)) {
     await this.scheduleRecurringTask(taskType, config.cron, config.priority);
   }
*/