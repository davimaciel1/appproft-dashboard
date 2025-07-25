const SellingPartnerAPI = require('amazon-sp-api');
const { Pool } = require('pg');
const zlib = require('zlib');
const csv = require('csv-parse');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

class ProfitDataCollector {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Initialize SP-API only if credentials are available
    this.spApi = null;
    this.initializeSpApi();

    // Report types needed for profit analysis
    this.reportTypes = [
      {
        type: 'GET_SALES_AND_TRAFFIC_REPORT',
        table: 'sales_data',
        period: 30 // days
      },
      {
        type: 'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA',
        table: 'fba_fees',
        period: 1 // current snapshot
      },
      {
        type: 'GET_FBA_STORAGE_FEE_CHARGES_DATA',
        table: 'storage_fees',
        period: 'monthly'
      },
      {
        type: 'GET_FBA_INVENTORY_AGED_DATA',
        table: 'inventory_data',
        period: 1 // current snapshot
      },
      {
        type: 'GET_FBA_RETURNS_DATA',
        table: 'returns_data',
        period: 30 // days
      },
      {
        type: 'GET_LONG_TERM_STORAGE_FEE_CHARGES_DATA',
        table: 'long_term_storage_fees',
        period: 'monthly'
      }
    ];
  }

  // Initialize SP-API if credentials are available
  initializeSpApi() {
    try {
      if (process.env.AMAZON_CLIENT_ID && process.env.AMAZON_CLIENT_SECRET && process.env.AMAZON_REFRESH_TOKEN) {
        this.spApi = new SellingPartnerAPI({
          region: 'na',
          refresh_token: process.env.AMAZON_REFRESH_TOKEN,
          credentials: {
            SELLING_PARTNER_APP_CLIENT_ID: process.env.AMAZON_CLIENT_ID,
            SELLING_PARTNER_APP_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET
          }
        });
        console.log('✅ SP-API initialized successfully');
      } else {
        console.log('⚠️ SP-API credentials not found. Data collection will be limited.');
      }
    } catch (error) {
      console.log('⚠️ Failed to initialize SP-API:', error.message);
      this.spApi = null;
    }
  }

  // Main collection method - runs twice daily
  async executeDailyCollection() {
    console.log('🚀 Starting Profit Data Collection...');
    
    if (!this.spApi) {
      console.log('⚠️ SP-API not available. Skipping data collection.');
      return {
        success: false,
        message: 'SP-API credentials not configured'
      };
    }
    
    try {
      // 1. Create all necessary reports
      const reportRequests = await this.createReports();
      
      // 2. Wait for reports to be ready and process them
      for (const request of reportRequests) {
        await this.processReport(request);
      }
      
      // 3. Collect inventory data via API
      await this.collectInventoryData();
      
      // 4. Run profit analysis
      await this.runProfitAnalysis();
      
      // 5. Generate alerts
      await this.generateAlerts();
      
      console.log('✅ Profit Data Collection completed successfully!');
      
      return {
        success: true,
        message: 'Data collection completed'
      };
      
    } catch (error) {
      console.error('❌ Error in profit data collection:', error);
      await this.logError('collection_failed', error);
      throw error;
    }
  }

  // Create reports in SP-API
  async createReports() {
    const reportRequests = [];
    
    for (const reportConfig of this.reportTypes) {
      try {
        // Rate limit: 0.0167 req/s (1 per minute)
        await this.delay(60000);
        
        const params = {
          reportType: reportConfig.type,
          marketplaceIds: [process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC']
        };
        
        // Add date range for time-based reports
        if (reportConfig.period && typeof reportConfig.period === 'number') {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - reportConfig.period);
          
          params.dataStartTime = startDate.toISOString();
          params.dataEndTime = endDate.toISOString();
        }
        
        const response = await this.spApi.callAPI({
          operation: 'createReport',
          endpoint: 'reports',
          body: params
        });
        
        reportRequests.push({
          reportId: response.reportId,
          reportType: reportConfig.type,
          table: reportConfig.table
        });
        
        // Track in database
        await this.trackReport(response.reportId, reportConfig.type);
        
      } catch (error) {
        console.error(`Error creating report ${reportConfig.type}:`, error);
        await this.logError(`create_report_${reportConfig.type}`, error);
      }
    }
    
    return reportRequests;
  }

  // Process a single report
  async processReport(request) {
    console.log(`📊 Processing report ${request.reportType}...`);
    
    try {
      // 1. Wait for report to be ready
      const report = await this.waitForReport(request.reportId);
      
      if (!report || report.processingStatus !== 'DONE') {
        throw new Error(`Report ${request.reportId} failed to process`);
      }
      
      // 2. Get report document
      const document = await this.getReportDocument(report.reportDocumentId);
      
      // 3. Download and parse report
      const data = await this.downloadAndParseReport(document.url, document.compressionAlgorithm);
      
      // 4. Save to appropriate table
      await this.saveReportData(data, request.table, request.reportType);
      
      // 5. Update tracking
      await this.updateReportTracking(request.reportId, 'DONE', data.length);
      
    } catch (error) {
      console.error(`Error processing report ${request.reportId}:`, error);
      await this.updateReportTracking(request.reportId, 'FAILED', 0, error.message);
      throw error;
    }
  }

  // Wait for report to be ready (with polling)
  async waitForReport(reportId, maxAttempts = 30, delayMs = 120000) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await this.spApi.callAPI({
          operation: 'getReport',
          path: `/reports/2021-06-30/reports/${reportId}`
        });
        
        if (response.processingStatus === 'DONE') {
          return response;
        }
        
        if (response.processingStatus === 'CANCELLED' || response.processingStatus === 'FATAL') {
          throw new Error(`Report ${reportId} failed with status: ${response.processingStatus}`);
        }
        
        // Wait before next check
        await this.delay(delayMs);
        
      } catch (error) {
        console.error(`Error checking report status:`, error);
        throw error;
      }
    }
    
    throw new Error(`Report ${reportId} timed out after ${maxAttempts} attempts`);
  }

  // Get report document details
  async getReportDocument(documentId) {
    return await this.spApi.callAPI({
      operation: 'getReportDocument',
      path: `/reports/2021-06-30/documents/${documentId}`
    });
  }

  // Download and parse report
  async downloadAndParseReport(url, compressionAlgorithm) {
    const response = await fetch(url);
    let content = await response.buffer();
    
    // Decompress if needed
    if (compressionAlgorithm === 'GZIP') {
      content = await gunzip(content);
    }
    
    // Parse CSV/TSV
    return new Promise((resolve, reject) => {
      const records = [];
      const parser = csv.parse({
        delimiter: '\t', // Most Amazon reports are TSV
        columns: true,
        skip_empty_lines: true
      });
      
      parser.on('data', (record) => records.push(record));
      parser.on('error', reject);
      parser.on('end', () => resolve(records));
      
      parser.write(content);
      parser.end();
    });
  }

  // Save report data to database
  async saveReportData(data, tableName, reportType) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Different processing for each report type
      switch (reportType) {
        case 'GET_SALES_AND_TRAFFIC_REPORT':
          await this.processSalesData(client, data);
          break;
          
        case 'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA':
          await this.processFBAFeesData(client, data);
          break;
          
        case 'GET_FBA_STORAGE_FEE_CHARGES_DATA':
          await this.processStorageFeesData(client, data);
          break;
          
        case 'GET_FBA_INVENTORY_AGED_DATA':
          await this.processInventoryAgedData(client, data);
          break;
          
        case 'GET_FBA_RETURNS_DATA':
          await this.processReturnsData(client, data);
          break;
          
        case 'GET_LONG_TERM_STORAGE_FEE_CHARGES_DATA':
          await this.processLongTermStorageData(client, data);
          break;
      }
      
      await client.query('COMMIT');
      console.log(`✅ Saved ${data.length} records to ${tableName}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Process Sales & Traffic data
  async processSalesData(client, data) {
    for (const row of data) {
      await client.query(`
        INSERT INTO sales_data (
          asin, report_date, sessions, page_views, buy_box_percentage,
          units_ordered, units_ordered_b2b, total_order_items,
          ordered_product_sales, ordered_product_sales_b2b,
          unit_session_percentage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (asin, report_date) 
        DO UPDATE SET
          sessions = EXCLUDED.sessions,
          page_views = EXCLUDED.page_views,
          buy_box_percentage = EXCLUDED.buy_box_percentage,
          units_ordered = EXCLUDED.units_ordered,
          units_ordered_b2b = EXCLUDED.units_ordered_b2b,
          total_order_items = EXCLUDED.total_order_items,
          ordered_product_sales = EXCLUDED.ordered_product_sales,
          ordered_product_sales_b2b = EXCLUDED.ordered_product_sales_b2b,
          unit_session_percentage = EXCLUDED.unit_session_percentage
      `, [
        row['ASIN'] || row['asin'],
        row['Date'] || new Date(),
        parseInt(row['Sessions']) || 0,
        parseInt(row['Page Views']) || 0,
        parseFloat(row['Buy Box Percentage']) || 0,
        parseInt(row['Units Ordered']) || 0,
        parseInt(row['Units Ordered - B2B']) || 0,
        parseInt(row['Total Order Items']) || 0,
        parseFloat(row['Ordered Product Sales'].replace(/[^0-9.-]/g, '')) || 0,
        parseFloat(row['Ordered Product Sales - B2B'].replace(/[^0-9.-]/g, '')) || 0,
        parseFloat(row['Unit Session Percentage']) || 0
      ]);
    }
  }

  // Process FBA Fees data
  async processFBAFeesData(client, data) {
    for (const row of data) {
      await client.query(`
        INSERT INTO fba_fees (
          asin, sku, report_date, price, referral_fee,
          variable_closing_fee, fba_fees, total_fee_estimate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (asin, report_date) 
        DO UPDATE SET
          sku = EXCLUDED.sku,
          price = EXCLUDED.price,
          referral_fee = EXCLUDED.referral_fee,
          variable_closing_fee = EXCLUDED.variable_closing_fee,
          fba_fees = EXCLUDED.fba_fees,
          total_fee_estimate = EXCLUDED.total_fee_estimate
      `, [
        row['ASIN'],
        row['SKU'],
        new Date(),
        parseFloat(row['Your Price']) || 0,
        parseFloat(row['Referral Fee']) || 0,
        parseFloat(row['Variable Closing Fee']) || 0,
        parseFloat(row['FBA Fees']) || 0,
        parseFloat(row['Total Fee Estimate']) || 0
      ]);
    }
  }

  // Run profit analysis for all products
  async runProfitAnalysis() {
    const client = await this.pool.connect();
    
    try {
      // Get all active ASINs
      const asins = await client.query(`
        SELECT DISTINCT asin 
        FROM sales_data 
        WHERE report_date >= CURRENT_DATE - INTERVAL '30 days'
      `);
      
      for (const { asin } of asins.rows) {
        await this.analyzeProduct(client, asin);
      }
      
    } finally {
      client.release();
    }
  }

  // Analyze profit for a single product
  async analyzeProduct(client, asin) {
    // This is a placeholder - implement full analysis logic
    console.log(`📊 Analyzing profit for ASIN: ${asin}`);
  }

  // Generate alerts based on analysis
  async generateAlerts() {
    const client = await this.pool.connect();
    
    try {
      // Check for products in hemorrhage status
      const hemorrhageProducts = await client.query(`
        SELECT * FROM profit_analysis
        WHERE profit_status = 'hemorrhage'
        AND analysis_date = CURRENT_DATE
      `);
      
      for (const product of hemorrhageProducts.rows) {
        await this.createAlert(client, {
          asin: product.asin,
          alert_type: 'new_hemorrhage',
          severity: 'critical',
          title: `🚨 Product hemorrhaging money: ${product.asin}`,
          message: `Loss of $${Math.abs(product.profit_per_unit)} per unit!`,
          metrics: {
            profit_per_unit: product.profit_per_unit,
            units_sold: product.units_sold,
            total_loss: product.gross_profit
          }
        });
      }
      
    } finally {
      client.release();
    }
  }

  // Helper methods
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async trackReport(reportId, reportType) {
    await this.pool.query(`
      INSERT INTO profit_reports_tracking (report_id, report_type, status)
      VALUES ($1, $2, 'PENDING')
      ON CONFLICT (report_id) DO NOTHING
    `, [reportId, reportType]);
  }

  async updateReportTracking(reportId, status, recordsProcessed, errorMessage = null) {
    await this.pool.query(`
      UPDATE profit_reports_tracking
      SET status = $2, 
          completed_at = CASE WHEN $2 IN ('DONE', 'FAILED') THEN NOW() ELSE NULL END,
          records_processed = $3,
          error_message = $4
      WHERE report_id = $1
    `, [reportId, status, recordsProcessed, errorMessage]);
  }

  async createAlert(client, alertData) {
    await client.query(`
      INSERT INTO profit_alerts (
        asin, alert_type, severity, title, message, metrics
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      alertData.asin,
      alertData.alert_type,
      alertData.severity,
      alertData.title,
      alertData.message,
      JSON.stringify(alertData.metrics)
    ]);
  }

  async logError(context, error) {
    console.error(`[ProfitDataCollector] ${context}:`, error);
    // Could also log to database or monitoring service
  }
}

module.exports = ProfitDataCollector;