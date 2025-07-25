const { Pool } = require('pg');

class ProfitAnalyzer {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  // Analyze profit for all active products
  async analyzeAllProducts() {
    console.log('🧮 Starting profit analysis for all products...');
    
    const client = await this.pool.connect();
    
    try {
      // Get all distinct ASINs with recent activity
      const asins = await client.query(`
        SELECT DISTINCT 
          s.asin,
          pm.title,
          pm.product_cost
        FROM sales_data s
        LEFT JOIN products_master pm ON s.asin = pm.asin
        WHERE s.report_date >= CURRENT_DATE - INTERVAL '30 days'
        AND s.units_ordered > 0
        ORDER BY s.asin
      `);
      
      console.log(`📊 Found ${asins.rows.length} products to analyze`);
      
      for (const product of asins.rows) {
        await this.analyzeProduct(client, product.asin, product.product_cost);
      }
      
      console.log('✅ Profit analysis completed!');
      
    } catch (error) {
      console.error('❌ Error in profit analysis:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Analyze profit for a single product
  async analyzeProduct(client, asin, manualProductCost = null) {
    try {
      console.log(`📊 Analyzing ASIN: ${asin}`);
      
      // 1. Collect all necessary data
      const data = await this.collectProductData(client, asin);
      
      if (!data.salesData || data.salesData.length === 0) {
        console.log(`⚠️ No sales data for ASIN ${asin}, skipping...`);
        return;
      }
      
      // 2. Calculate profit metrics
      const analysis = this.calculateProfitMetrics(data, manualProductCost);
      
      // 3. Classify product status
      const status = this.classifyProductStatus(analysis.profitMargin);
      
      // 4. Identify main cost driver
      const mainCostDriver = this.identifyMainCostDriver(analysis.costBreakdown);
      
      // 5. Generate recommendations
      const recommendation = this.generateRecommendation(status, mainCostDriver, analysis);
      
      // 6. Save analysis to database
      await this.saveAnalysis(client, asin, analysis, status, mainCostDriver, recommendation);
      
      console.log(`✅ Analysis complete for ${asin}: Status = ${status}, Margin = ${analysis.profitMargin.toFixed(2)}%`);
      
    } catch (error) {
      console.error(`❌ Error analyzing product ${asin}:`, error);
      throw error;
    }
  }

  // Collect all data needed for profit calculation
  async collectProductData(client, asin) {
    const data = {};
    
    // Sales data (last 30 days aggregated)
    const salesQuery = await client.query(`
      SELECT 
        SUM(units_ordered) as total_units,
        SUM(ordered_product_sales) as total_revenue,
        AVG(CASE WHEN units_ordered > 0 THEN ordered_product_sales / units_ordered ELSE 0 END) as avg_selling_price,
        COUNT(DISTINCT report_date) as days_with_sales
      FROM sales_data
      WHERE asin = $1
      AND report_date >= CURRENT_DATE - INTERVAL '30 days'
    `, [asin]);
    data.salesData = salesQuery.rows[0];
    
    // FBA fees (most recent)
    const feesQuery = await client.query(`
      SELECT 
        price,
        referral_fee,
        variable_closing_fee,
        fba_fees,
        total_fee_estimate
      FROM fba_fees
      WHERE asin = $1
      ORDER BY report_date DESC
      LIMIT 1
    `, [asin]);
    data.fbaFees = feesQuery.rows[0];
    
    // Storage fees (last month)
    const storageQuery = await client.query(`
      SELECT 
        SUM(estimated_monthly_storage_fee) as total_monthly_storage_fee,
        SUM(average_quantity_on_hand) as total_inventory
      FROM storage_fees
      WHERE asin = $1
      AND report_month >= CURRENT_DATE - INTERVAL '1 month'
    `, [asin]);
    data.storageFees = storageQuery.rows[0];
    
    // Long term storage fees
    const ltsfQuery = await client.query(`
      SELECT 
        SUM(twelve_mo_long_term_storage_fee) as ltsf_12_mo,
        SUM(six_mo_long_term_storage_fee) as ltsf_6_mo,
        SUM(quantity_charged_12_mo_long_term_storage_fee + quantity_charged_6_mo_long_term_storage_fee) as ltsf_units
      FROM long_term_storage_fees
      WHERE asin = $1
      AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
    `, [asin]);
    data.longTermStorageFees = ltsfQuery.rows[0];
    
    // Returns data
    const returnsQuery = await client.query(`
      SELECT 
        COUNT(*) as total_returns,
        SUM(quantity) as total_units_returned
      FROM returns_data
      WHERE asin = $1
      AND return_date >= CURRENT_DATE - INTERVAL '30 days'
    `, [asin]);
    data.returns = returnsQuery.rows[0];
    
    // Inventory age
    const inventoryQuery = await client.query(`
      SELECT 
        sellable_quantity,
        aged_90_plus_days,
        aged_180_plus_days,
        aged_270_plus_days,
        aged_365_plus_days
      FROM inventory_data
      WHERE asin = $1
      ORDER BY snapshot_date DESC
      LIMIT 1
    `, [asin]);
    data.inventory = inventoryQuery.rows[0];
    
    return data;
  }

  // Calculate all profit metrics
  calculateProfitMetrics(data, manualProductCost) {
    const {
      salesData,
      fbaFees,
      storageFees,
      longTermStorageFees,
      returns,
      inventory
    } = data;
    
    // Basic metrics
    const unitsOrdered = parseInt(salesData.total_units) || 0;
    const totalRevenue = parseFloat(salesData.total_revenue) || 0;
    const avgSellingPrice = parseFloat(salesData.avg_selling_price) || 0;
    
    // If no sales, return zero analysis
    if (unitsOrdered === 0) {
      return {
        sellingPrice: avgSellingPrice,
        unitsSold: 0,
        totalRevenue: 0,
        productCost: 0,
        totalProductCost: 0,
        referralFeeTotal: 0,
        fbaFeeTotal: 0,
        variableClosingFeeTotal: 0,
        monthlyStorageFeeTotal: 0,
        longTermStorageFeeTotal: 0,
        agedInventorySurcharge: 0,
        unitsReturned: 0,
        returnRate: 0,
        returnProcessingCost: 0,
        totalCosts: 0,
        grossProfit: 0,
        profitMargin: 0,
        profitPerUnit: 0,
        costBreakdown: {
          productCost: 0,
          amazonFees: 0,
          storageCosts: 0,
          returnCosts: 0
        }
      };
    }
    
    // Product cost (use manual if provided, otherwise estimate at 30% of selling price)
    const productCost = manualProductCost || (avgSellingPrice * 0.3);
    const totalProductCost = productCost * unitsOrdered;
    
    // Amazon fees (per unit * units sold)
    const referralFee = (fbaFees?.referral_fee || avgSellingPrice * 0.15);
    const fbaFee = (fbaFees?.fba_fees || 3.00);
    const variableClosingFee = (fbaFees?.variable_closing_fee || 0);
    
    const referralFeeTotal = referralFee * unitsOrdered;
    const fbaFeeTotal = fbaFee * unitsOrdered;
    const variableClosingFeeTotal = variableClosingFee * unitsOrdered;
    
    // Storage costs
    const monthlyStorageFee = parseFloat(storageFees?.total_monthly_storage_fee) || 0;
    const longTermStorageFee = (parseFloat(longTermStorageFees?.ltsf_12_mo) || 0) + 
                              (parseFloat(longTermStorageFees?.ltsf_6_mo) || 0);
    
    // Storage per unit (distribute across units sold)
    const monthlyStorageFeePerUnit = unitsOrdered > 0 ? monthlyStorageFee / unitsOrdered : 0;
    const longTermStorageFeePerUnit = unitsOrdered > 0 ? longTermStorageFee / unitsOrdered : 0;
    
    // Aged inventory surcharge
    let agedInventorySurcharge = 0;
    if (inventory) {
      const aged365Units = parseInt(inventory.aged_365_plus_days) || 0;
      agedInventorySurcharge = aged365Units * 1.50; // $1.50 per unit over 365 days
    }
    
    // Returns costs
    const unitsReturned = parseInt(returns?.total_units_returned) || 0;
    const returnRate = unitsOrdered > 0 ? (unitsReturned / unitsOrdered) * 100 : 0;
    const returnProcessingCost = unitsReturned * 5.00; // Estimated $5 per return
    
    // Calculate totals
    const totalAmazonFees = referralFeeTotal + fbaFeeTotal + variableClosingFeeTotal;
    const totalStorageCosts = monthlyStorageFee + longTermStorageFee + agedInventorySurcharge;
    const totalReturnCosts = returnProcessingCost;
    
    const totalCosts = totalProductCost + totalAmazonFees + totalStorageCosts + totalReturnCosts;
    const grossProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : -100;
    const profitPerUnit = unitsOrdered > 0 ? grossProfit / unitsOrdered : 0;
    
    return {
      sellingPrice: avgSellingPrice,
      unitsSold: unitsOrdered,
      totalRevenue,
      productCost,
      totalProductCost,
      referralFeeTotal,
      fbaFeeTotal,
      variableClosingFeeTotal,
      monthlyStorageFeeTotal: monthlyStorageFee,
      longTermStorageFeeTotal: longTermStorageFee,
      agedInventorySurcharge,
      unitsReturned,
      returnRate,
      returnProcessingCost,
      totalCosts,
      grossProfit,
      profitMargin,
      profitPerUnit,
      costBreakdown: {
        productCost: totalProductCost,
        amazonFees: totalAmazonFees,
        storageCosts: totalStorageCosts,
        returnCosts: totalReturnCosts
      }
    };
  }

  // Classify product based on profit margin
  classifyProductStatus(profitMargin) {
    if (profitMargin < -10) return 'hemorrhage';   // 🔴 Severe loss
    if (profitMargin < 0) return 'loss';          // 🟠 Loss
    if (profitMargin < 5) return 'danger';        // 🟡 Danger zone
    if (profitMargin < 15) return 'low';          // 🟨 Low margin
    return 'healthy';                              // 🟢 Healthy
  }

  // Identify the main cost driver
  identifyMainCostDriver(costBreakdown) {
    const costs = [
      { type: 'product_cost', value: costBreakdown.productCost },
      { type: 'amazon_fees', value: costBreakdown.amazonFees },
      { type: 'storage', value: costBreakdown.storageCosts },
      { type: 'returns', value: costBreakdown.returnCosts }
    ];
    
    // Sort by value descending and return the highest
    costs.sort((a, b) => b.value - a.value);
    return costs[0].type;
  }

  // Generate actionable recommendations
  generateRecommendation(status, mainCostDriver, analysis) {
    const recommendations = {
      hemorrhage: {
        product_cost: 'URGENT: Pause listing immediately. Renegotiate with supplier or discontinue product.',
        amazon_fees: 'URGENT: Pause listing. Product price too low for Amazon fees.',
        storage: 'URGENT: Create removal order NOW. Storage costs exceeding revenue.',
        returns: 'URGENT: Investigate quality issues. Return rate is unsustainable.'
      },
      loss: {
        product_cost: 'Negotiate better pricing with supplier or find alternative source.',
        amazon_fees: 'Increase price by 15-20% to cover Amazon fees.',
        storage: 'Reduce inventory levels by 50%. Consider FBM for slow movers.',
        returns: 'Improve product description and images to reduce returns.'
      },
      danger: {
        product_cost: 'Consider bulk purchasing for better unit cost.',
        amazon_fees: 'Optimize price point. Consider bundling to increase average order value.',
        storage: 'Implement just-in-time inventory management.',
        returns: 'Add product video and detailed size guide.'
      },
      low: {
        product_cost: 'Monitor supplier prices for better deals.',
        amazon_fees: 'Test price increases of 5-8%.',
        storage: 'Optimize reorder points to minimize storage time.',
        returns: 'Monitor return reasons and address common issues.'
      },
      healthy: {
        product_cost: 'Maintain current supplier relationship.',
        amazon_fees: 'Price is well optimized.',
        storage: 'Storage costs are under control.',
        returns: 'Return rate is acceptable.'
      }
    };
    
    const action = recommendations[status]?.[mainCostDriver] || 'Monitor performance weekly.';
    
    // Calculate recommended price for break-even + 15% margin
    const recommendedPrice = this.calculateRecommendedPrice(analysis);
    
    return {
      action,
      recommendedPrice,
      potentialSavings: this.calculatePotentialSavings(analysis, mainCostDriver)
    };
  }

  // Calculate recommended price for target margin
  calculateRecommendedPrice(analysis, targetMargin = 15) {
    const { productCost, unitsSold } = analysis;
    
    if (unitsSold === 0) return 0;
    
    // Total cost per unit (excluding product cost)
    const amazonFeesPerUnit = (analysis.referralFeeTotal + analysis.fbaFeeTotal + analysis.variableClosingFeeTotal) / unitsSold;
    const storageCostPerUnit = (analysis.monthlyStorageFeeTotal + analysis.longTermStorageFeeTotal) / unitsSold;
    const returnCostPerUnit = analysis.returnProcessingCost / unitsSold;
    
    const totalCostPerUnit = productCost + amazonFeesPerUnit + storageCostPerUnit + returnCostPerUnit;
    
    // Price needed for target margin
    // Price = Cost / (1 - Margin%)
    const recommendedPrice = totalCostPerUnit / (1 - (targetMargin / 100));
    
    return Math.round(recommendedPrice * 100) / 100; // Round to 2 decimals
  }

  // Calculate potential monthly savings
  calculatePotentialSavings(analysis, mainCostDriver) {
    let savings = 0;
    
    switch (mainCostDriver) {
      case 'storage':
        // Can save 50% of storage costs with better inventory management
        savings = (analysis.monthlyStorageFeeTotal + analysis.longTermStorageFeeTotal) * 0.5;
        break;
        
      case 'returns':
        // Can reduce returns by 30% with better listings
        savings = analysis.returnProcessingCost * 0.3;
        break;
        
      case 'amazon_fees':
        // Price optimization can improve margin by 5%
        savings = analysis.totalRevenue * 0.05;
        break;
        
      case 'product_cost':
        // Negotiation can reduce costs by 10%
        savings = analysis.totalProductCost * 0.1;
        break;
    }
    
    return Math.round(savings * 100) / 100;
  }

  // Save analysis results to database
  async saveAnalysis(client, asin, analysis, status, mainCostDriver, recommendation) {
    await client.query(`
      INSERT INTO profit_analysis (
        asin, analysis_date, period_days,
        selling_price, units_sold, total_revenue,
        product_cost, total_product_cost,
        referral_fee_total, fba_fee_total, variable_closing_fee_total,
        monthly_storage_fee_total, long_term_storage_fee_total, aged_inventory_surcharge,
        units_returned, return_rate, return_processing_cost,
        total_costs, gross_profit, profit_margin, profit_per_unit,
        profit_status, main_cost_driver,
        recommended_action, recommended_price, potential_savings_monthly
      ) VALUES (
        $1, CURRENT_DATE, 30,
        $2, $3, $4,
        $5, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21,
        $22, $23, $24
      )
      ON CONFLICT (asin, analysis_date) 
      DO UPDATE SET
        selling_price = EXCLUDED.selling_price,
        units_sold = EXCLUDED.units_sold,
        total_revenue = EXCLUDED.total_revenue,
        product_cost = EXCLUDED.product_cost,
        total_product_cost = EXCLUDED.total_product_cost,
        referral_fee_total = EXCLUDED.referral_fee_total,
        fba_fee_total = EXCLUDED.fba_fee_total,
        variable_closing_fee_total = EXCLUDED.variable_closing_fee_total,
        monthly_storage_fee_total = EXCLUDED.monthly_storage_fee_total,
        long_term_storage_fee_total = EXCLUDED.long_term_storage_fee_total,
        aged_inventory_surcharge = EXCLUDED.aged_inventory_surcharge,
        units_returned = EXCLUDED.units_returned,
        return_rate = EXCLUDED.return_rate,
        return_processing_cost = EXCLUDED.return_processing_cost,
        total_costs = EXCLUDED.total_costs,
        gross_profit = EXCLUDED.gross_profit,
        profit_margin = EXCLUDED.profit_margin,
        profit_per_unit = EXCLUDED.profit_per_unit,
        profit_status = EXCLUDED.profit_status,
        main_cost_driver = EXCLUDED.main_cost_driver,
        recommended_action = EXCLUDED.recommended_action,
        recommended_price = EXCLUDED.recommended_price,
        potential_savings_monthly = EXCLUDED.potential_savings_monthly,
        updated_at = NOW()
    `, [
      asin,
      analysis.sellingPrice,
      analysis.unitsSold,
      analysis.totalRevenue,
      analysis.productCost,
      analysis.totalProductCost,
      analysis.referralFeeTotal,
      analysis.fbaFeeTotal,
      analysis.variableClosingFeeTotal,
      analysis.monthlyStorageFeeTotal,
      analysis.longTermStorageFeeTotal,
      analysis.agedInventorySurcharge,
      analysis.unitsReturned,
      analysis.returnRate,
      analysis.returnProcessingCost,
      analysis.totalCosts,
      analysis.grossProfit,
      analysis.profitMargin,
      analysis.profitPerUnit,
      status,
      mainCostDriver,
      recommendation.action,
      recommendation.recommendedPrice,
      recommendation.potentialSavings
    ]);
  }
}

module.exports = ProfitAnalyzer;