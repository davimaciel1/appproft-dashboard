const { Pool } = require('pg');
const { getNotificationSystem } = require('../notificationSystem');

class ProfitAlertSystem {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    this.notificationSystem = getNotificationSystem();
  }

  // Check and generate all types of alerts
  async checkAndGenerateAlerts() {
    console.log('🔔 Checking for profit alerts...');
    
    const client = await this.pool.connect();
    
    try {
      // 1. Check for new hemorrhage products
      await this.checkHemorrhageProducts(client);
      
      // 2. Check for worsening products
      await this.checkWorseningProducts(client);
      
      // 3. Check for long-term storage alerts
      await this.checkLongTermStorageAlerts(client);
      
      // 4. Check for return rate spikes
      await this.checkReturnSpikes(client);
      
      // 5. Check for aged inventory
      await this.checkAgedInventory(client);
      
      console.log('✅ Alert check completed');
      
    } catch (error) {
      console.error('❌ Error checking alerts:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Check for products in hemorrhage status
  async checkHemorrhageProducts(client) {
    const query = `
      SELECT 
        pa.*,
        pm.title,
        pm.sku
      FROM profit_analysis pa
      JOIN products_master pm ON pa.asin = pm.asin
      WHERE pa.profit_status = 'hemorrhage'
      AND pa.analysis_date = CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM profit_alerts pal
        WHERE pal.asin = pa.asin
        AND pal.alert_type = 'new_hemorrhage'
        AND pal.created_at > CURRENT_DATE - INTERVAL '7 days'
      )
    `;
    
    const result = await client.query(query);
    
    for (const product of result.rows) {
      await this.createHemorrhageAlert(client, product);
    }
  }

  // Check for products getting worse
  async checkWorseningProducts(client) {
    const query = `
      WITH profit_trend AS (
        SELECT 
          asin,
          profit_margin,
          profit_per_unit,
          analysis_date,
          LAG(profit_margin, 1) OVER (PARTITION BY asin ORDER BY analysis_date) as prev_margin,
          LAG(profit_per_unit, 1) OVER (PARTITION BY asin ORDER BY analysis_date) as prev_profit_per_unit
        FROM profit_analysis
        WHERE analysis_date >= CURRENT_DATE - INTERVAL '7 days'
      )
      SELECT 
        pt.*,
        pm.title,
        pm.sku
      FROM profit_trend pt
      JOIN products_master pm ON pt.asin = pm.asin
      WHERE pt.analysis_date = CURRENT_DATE
      AND pt.prev_margin IS NOT NULL
      AND pt.profit_margin < pt.prev_margin - 5  -- Margin dropped by 5%+
      AND pt.profit_margin < 10  -- And is now below 10%
    `;
    
    const result = await client.query(query);
    
    for (const product of result.rows) {
      await this.createWorseningAlert(client, product);
    }
  }

  // Check for long-term storage fee risks
  async checkLongTermStorageAlerts(client) {
    const query = `
      SELECT 
        i.*,
        pm.title,
        pm.sku,
        pa.profit_margin
      FROM inventory_data i
      JOIN products_master pm ON i.asin = pm.asin
      LEFT JOIN profit_analysis pa ON i.asin = pa.asin AND pa.analysis_date = CURRENT_DATE
      WHERE i.snapshot_date = (SELECT MAX(snapshot_date) FROM inventory_data WHERE asin = i.asin)
      AND (
        i.aged_270_plus_days > 0  -- Will incur LTSF in 90 days
        OR i.aged_180_plus_days > i.sellable_quantity * 0.3  -- 30%+ inventory is old
      )
      AND NOT EXISTS (
        SELECT 1 FROM profit_alerts pal
        WHERE pal.asin = i.asin
        AND pal.alert_type = 'storage_alert'
        AND pal.created_at > CURRENT_DATE - INTERVAL '30 days'
      )
    `;
    
    const result = await client.query(query);
    
    for (const product of result.rows) {
      await this.createStorageAlert(client, product);
    }
  }

  // Check for return rate spikes
  async checkReturnSpikes(client) {
    const query = `
      WITH return_trends AS (
        SELECT 
          r.asin,
          COUNT(*) as returns_last_7_days,
          s.units_ordered as sales_last_7_days,
          CASE 
            WHEN s.units_ordered > 0 
            THEN (COUNT(*)::float / s.units_ordered * 100) 
            ELSE 0 
          END as return_rate
        FROM returns_data r
        JOIN (
          SELECT asin, SUM(units_ordered) as units_ordered
          FROM sales_data
          WHERE report_date >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY asin
        ) s ON r.asin = s.asin
        WHERE r.return_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY r.asin, s.units_ordered
      )
      SELECT 
        rt.*,
        pm.title,
        pm.sku,
        pa.profit_margin
      FROM return_trends rt
      JOIN products_master pm ON rt.asin = pm.asin
      LEFT JOIN profit_analysis pa ON rt.asin = pa.asin AND pa.analysis_date = CURRENT_DATE
      WHERE rt.return_rate > 10  -- Return rate above 10%
      AND rt.returns_last_7_days >= 5  -- At least 5 returns
    `;
    
    const result = await client.query(query);
    
    for (const product of result.rows) {
      await this.createReturnSpikeAlert(client, product);
    }
  }

  // Check for aged inventory
  async checkAgedInventory(client) {
    const query = `
      SELECT 
        i.*,
        pm.title,
        pm.sku,
        pm.product_cost,
        pa.profit_margin,
        (i.aged_365_plus_days * pm.product_cost) as capital_tied_up
      FROM inventory_data i
      JOIN products_master pm ON i.asin = pm.asin
      LEFT JOIN profit_analysis pa ON i.asin = pa.asin AND pa.analysis_date = CURRENT_DATE
      WHERE i.snapshot_date = (SELECT MAX(snapshot_date) FROM inventory_data WHERE asin = i.asin)
      AND i.aged_365_plus_days > 0
      AND NOT EXISTS (
        SELECT 1 FROM profit_alerts pal
        WHERE pal.asin = i.asin
        AND pal.alert_type = 'aged_inventory'
        AND pal.created_at > CURRENT_DATE - INTERVAL '30 days'
      )
    `;
    
    const result = await client.query(query);
    
    for (const product of result.rows) {
      await this.createAgedInventoryAlert(client, product);
    }
  }

  // Create hemorrhage alert
  async createHemorrhageAlert(client, product) {
    const alert = {
      asin: product.asin,
      alert_type: 'new_hemorrhage',
      severity: 'critical',
      title: `🚨 HEMORRHAGE: ${product.title || product.asin}`,
      message: `This product is losing $${Math.abs(product.profit_per_unit).toFixed(2)} per unit! Total monthly loss: $${Math.abs(product.gross_profit).toFixed(2)}`,
      metrics: {
        profit_per_unit: product.profit_per_unit,
        profit_margin: product.profit_margin,
        units_sold: product.units_sold,
        total_loss: product.gross_profit,
        main_cost_driver: product.main_cost_driver
      },
      action_url: `/profit-analysis/${product.asin}`
    };
    
    await this.saveAlert(client, alert);
    await this.sendNotification(alert, product);
  }

  // Create worsening alert
  async createWorseningAlert(client, product) {
    const marginDrop = product.prev_margin - product.profit_margin;
    
    const alert = {
      asin: product.asin,
      alert_type: 'increasing_loss',
      severity: product.profit_margin < 0 ? 'high' : 'medium',
      title: `📉 Profit Declining: ${product.title || product.asin}`,
      message: `Profit margin dropped ${marginDrop.toFixed(1)}% to ${product.profit_margin.toFixed(1)}%. Now ${product.profit_margin < 0 ? 'LOSING' : 'earning'} $${product.profit_per_unit.toFixed(2)} per unit.`,
      metrics: {
        current_margin: product.profit_margin,
        previous_margin: product.prev_margin,
        margin_drop: marginDrop,
        profit_per_unit: product.profit_per_unit
      },
      action_url: `/profit-analysis/${product.asin}`
    };
    
    await this.saveAlert(client, alert);
    await this.sendNotification(alert, product);
  }

  // Create storage alert
  async createStorageAlert(client, product) {
    const estimatedLTSF = product.aged_270_plus_days * 6.90; // $6.90 per cubic foot
    
    const alert = {
      asin: product.asin,
      alert_type: 'storage_alert',
      severity: product.aged_365_plus_days > 0 ? 'high' : 'medium',
      title: `📦 Storage Fee Risk: ${product.title || product.asin}`,
      message: `${product.aged_270_plus_days} units will incur long-term storage fees (~$${estimatedLTSF.toFixed(2)}) in 90 days. ${product.aged_365_plus_days > 0 ? `${product.aged_365_plus_days} units ALREADY incurring fees!` : ''}`,
      metrics: {
        aged_90_days: product.aged_90_plus_days,
        aged_180_days: product.aged_180_plus_days,
        aged_270_days: product.aged_270_plus_days,
        aged_365_days: product.aged_365_plus_days,
        estimated_ltsf: estimatedLTSF,
        total_inventory: product.sellable_quantity
      },
      action_url: `/inventory/${product.asin}`
    };
    
    await this.saveAlert(client, alert);
    await this.sendNotification(alert, product);
  }

  // Create return spike alert
  async createReturnSpikeAlert(client, product) {
    const alert = {
      asin: product.asin,
      alert_type: 'return_spike',
      severity: product.return_rate > 15 ? 'high' : 'medium',
      title: `🔄 High Returns: ${product.title || product.asin}`,
      message: `Return rate is ${product.return_rate.toFixed(1)}% (${product.returns_last_7_days} returns in 7 days). This is costing approximately $${(product.returns_last_7_days * 5).toFixed(2)} in processing.`,
      metrics: {
        return_rate: product.return_rate,
        returns_count: product.returns_last_7_days,
        sales_count: product.sales_last_7_days,
        estimated_cost: product.returns_last_7_days * 5
      },
      action_url: `/returns/${product.asin}`
    };
    
    await this.saveAlert(client, alert);
    await this.sendNotification(alert, product);
  }

  // Create aged inventory alert
  async createAgedInventoryAlert(client, product) {
    const alert = {
      asin: product.asin,
      alert_type: 'aged_inventory',
      severity: 'medium',
      title: `🕰️ Aged Inventory: ${product.title || product.asin}`,
      message: `${product.aged_365_plus_days} units over 365 days old. Capital tied up: $${product.capital_tied_up.toFixed(2)}. Incurring $1.50/unit monthly surcharge.`,
      metrics: {
        aged_365_days: product.aged_365_plus_days,
        capital_tied_up: product.capital_tied_up,
        monthly_surcharge: product.aged_365_plus_days * 1.50,
        product_cost: product.product_cost
      },
      action_url: `/inventory/${product.asin}`
    };
    
    await this.saveAlert(client, alert);
    await this.sendNotification(alert, product);
  }

  // Save alert to database
  async saveAlert(client, alert) {
    await client.query(`
      INSERT INTO profit_alerts (
        asin, alert_type, severity, title, message, metrics, action_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      alert.asin,
      alert.alert_type,
      alert.severity,
      alert.title,
      alert.message,
      JSON.stringify(alert.metrics),
      alert.action_url
    ]);
  }

  // Send notification through multiple channels
  async sendNotification(alert, product) {
    // Prepare notification data
    const notification = {
      type: `profit_${alert.alert_type}`,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      data: {
        asin: alert.asin,
        sku: product.sku,
        metrics: alert.metrics,
        action_url: alert.action_url
      }
    };
    
    // Send through notification system
    try {
      await this.notificationSystem.send(notification);
      
      // For critical alerts, also send SMS/WhatsApp
      if (alert.severity === 'critical') {
        await this.sendUrgentNotification(alert, product);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Send urgent notifications for critical alerts
  async sendUrgentNotification(alert, product) {
    // This would integrate with SMS/WhatsApp service
    console.log(`🚨 URGENT notification would be sent for ${product.asin}`);
    
    // Example implementation:
    // await smsService.send({
    //   to: user.phone,
    //   message: `URGENT: ${alert.title}. ${alert.message}. Check dashboard immediately.`
    // });
  }

  // Get unread alerts for dashboard
  async getUnreadAlerts(asin = null) {
    let query = `
      SELECT * FROM profit_alerts
      WHERE is_read = FALSE
    `;
    
    const params = [];
    if (asin) {
      query += ' AND asin = $1';
      params.push(asin);
    }
    
    query += ' ORDER BY severity DESC, created_at DESC';
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // Mark alert as read
  async markAlertAsRead(alertId) {
    await this.pool.query(`
      UPDATE profit_alerts
      SET is_read = TRUE, read_at = NOW()
      WHERE id = $1
    `, [alertId]);
  }

  // Mark alert as actioned
  async markAlertAsActioned(alertId) {
    await this.pool.query(`
      UPDATE profit_alerts
      SET is_actioned = TRUE, actioned_at = NOW()
      WHERE id = $1
    `, [alertId]);
  }
}

module.exports = ProfitAlertSystem;