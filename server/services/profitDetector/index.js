const ProfitDataCollector = require('./ProfitDataCollector');
const ProfitAnalyzer = require('./ProfitAnalyzer');
const ProfitAlertSystem = require('./ProfitAlertSystem');

class ProfitDetectorService {
  constructor() {
    this.collector = new ProfitDataCollector();
    this.analyzer = new ProfitAnalyzer();
    this.alertSystem = new ProfitAlertSystem();
  }

  // Main sync method for persistent sync manager
  async syncProfitData(tenantId = 'default') {
    console.log(`💸 Starting Profit Detector sync for tenant: ${tenantId}`);
    
    try {
      // 1. Collect data from SP-API Reports
      await this.collector.executeDailyCollection();
      
      // 2. Analyze profit for all products
      await this.analyzer.analyzeAllProducts();
      
      // 3. Check and generate alerts
      await this.alertSystem.checkAndGenerateAlerts();
      
      console.log('✅ Profit Detector sync completed successfully');
      
      return {
        success: true,
        message: 'Profit analysis completed'
      };
      
    } catch (error) {
      console.error('❌ Error in Profit Detector sync:', error);
      throw error;
    }
  }

  // Analyze specific product
  async analyzeProduct(asin, productCost = null) {
    const client = await this.analyzer.pool.connect();
    try {
      await this.analyzer.analyzeProduct(client, asin, productCost);
      return { success: true, message: `Product ${asin} analyzed` };
    } finally {
      client.release();
    }
  }

  // Get profit analysis for dashboard
  async getProfitAnalyses(filters = {}) {
    const { status, sortBy = 'profit_margin', order = 'ASC' } = filters;
    
    let query = `
      SELECT 
        pa.*,
        pm.title,
        pm.sku
      FROM profit_analysis pa
      LEFT JOIN products_master pm ON pa.asin = pm.asin
      WHERE pa.analysis_date = (
        SELECT MAX(analysis_date) 
        FROM profit_analysis 
        WHERE asin = pa.asin
      )
    `;
    
    const params = [];
    if (status) {
      params.push(status);
      query += ` AND pa.profit_status = $${params.length}`;
    }
    
    query += ` ORDER BY pa.${sortBy} ${order}`;
    
    const result = await this.analyzer.pool.query(query, params);
    
    // Calculate summary
    const summary = await this.calculateSummary();
    
    return {
      analyses: result.rows,
      summary,
      totalMonthlyLoss: summary.hemorrhage.total_loss + summary.loss.total_loss + summary.danger.total_loss
    };
  }

  // Calculate summary statistics
  async calculateSummary() {
    const query = `
      SELECT 
        profit_status,
        COUNT(*) as count,
        SUM(CASE 
          WHEN gross_profit < 0 THEN gross_profit 
          ELSE 0 
        END) as total_loss,
        SUM(CASE 
          WHEN gross_profit > 0 THEN gross_profit 
          ELSE 0 
        END) as total_profit
      FROM profit_analysis
      WHERE analysis_date = (
        SELECT MAX(analysis_date) FROM profit_analysis
      )
      GROUP BY profit_status
    `;
    
    const result = await this.analyzer.pool.query(query);
    
    const summary = {
      hemorrhage: { count: 0, total_loss: 0 },
      loss: { count: 0, total_loss: 0 },
      danger: { count: 0, total_loss: 0 },
      healthy: { count: 0, total_profit: 0 }
    };
    
    result.rows.forEach(row => {
      if (summary[row.profit_status]) {
        summary[row.profit_status] = {
          count: parseInt(row.count),
          total_loss: parseFloat(row.total_loss) || 0,
          total_profit: parseFloat(row.total_profit) || 0
        };
      }
    });
    
    return summary;
  }

  // Get unread alerts
  async getUnreadAlerts(asin = null) {
    return await this.alertSystem.getUnreadAlerts(asin);
  }

  // Mark alert as read
  async markAlertAsRead(alertId) {
    return await this.alertSystem.markAlertAsRead(alertId);
  }

  // Update product cost manually
  async updateProductCost(asin, cost) {
    const query = `
      INSERT INTO products_master (asin, product_cost)
      VALUES ($1, $2)
      ON CONFLICT (asin) 
      DO UPDATE SET 
        product_cost = $2,
        updated_at = NOW()
    `;
    
    await this.analyzer.pool.query(query, [asin, cost]);
    
    // Re-analyze product with new cost
    await this.analyzeProduct(asin, cost);
    
    return { success: true, message: 'Product cost updated and re-analyzed' };
  }

  // Get product details with full breakdown
  async getProductAnalysis(asin) {
    const query = `
      SELECT 
        pa.*,
        pm.title,
        pm.sku,
        pm.current_price
      FROM profit_analysis pa
      LEFT JOIN products_master pm ON pa.asin = pm.asin
      WHERE pa.asin = $1
      AND pa.analysis_date = (
        SELECT MAX(analysis_date) 
        FROM profit_analysis 
        WHERE asin = $1
      )
    `;
    
    const result = await this.analyzer.pool.query(query, [asin]);
    
    if (result.rows.length === 0) {
      throw new Error('Product analysis not found');
    }
    
    const analysis = result.rows[0];
    
    // Get historical data
    const historyQuery = `
      SELECT 
        analysis_date,
        profit_margin,
        profit_per_unit,
        units_sold,
        total_revenue
      FROM profit_analysis
      WHERE asin = $1
      ORDER BY analysis_date DESC
      LIMIT 30
    `;
    
    const history = await this.analyzer.pool.query(historyQuery, [asin]);
    
    // Get recent alerts
    const alertsQuery = `
      SELECT * FROM profit_alerts
      WHERE asin = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const alerts = await this.analyzer.pool.query(alertsQuery, [asin]);
    
    return {
      current: analysis,
      history: history.rows,
      alerts: alerts.rows,
      costBreakdown: {
        productCost: analysis.total_product_cost,
        amazonFees: analysis.referral_fee_total + analysis.fba_fee_total + analysis.variable_closing_fee_total,
        storageCosts: analysis.monthly_storage_fee_total + analysis.long_term_storage_fee_total + analysis.aged_inventory_surcharge,
        returnCosts: analysis.return_processing_cost
      }
    };
  }

  // Bulk update product costs from CSV
  async bulkUpdateProductCosts(products) {
    const client = await this.analyzer.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const product of products) {
        await client.query(`
          INSERT INTO products_master (asin, product_cost, title, sku)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (asin) 
          DO UPDATE SET 
            product_cost = $2,
            title = COALESCE($3, products_master.title),
            sku = COALESCE($4, products_master.sku),
            updated_at = NOW()
        `, [product.asin, product.cost, product.title, product.sku]);
      }
      
      await client.query('COMMIT');
      
      // Re-analyze all updated products
      for (const product of products) {
        await this.analyzeProduct(product.asin, product.cost);
      }
      
      return { 
        success: true, 
        message: `Updated ${products.length} products`,
        count: products.length
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
module.exports = new ProfitDetectorService();