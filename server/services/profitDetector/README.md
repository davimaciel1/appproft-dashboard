# 💸 Profit Leak Detector Module

## Overview
The Profit Leak Detector is a comprehensive module that analyzes real product profitability on Amazon by considering ALL hidden costs that sellers typically overlook. It identifies products that are hemorrhaging money and provides actionable recommendations.

## Features

### 🎯 Core Functionality
- **Complete Cost Analysis**: Calculates true profit considering product cost, Amazon fees, storage fees, long-term storage fees, and return costs
- **Automated Data Collection**: Uses Amazon SP-API Reports to gather sales, fees, inventory, and returns data
- **Real-time Profit Calculation**: Analyzes profit margins and identifies loss-making products
- **Smart Alerts**: Generates alerts for hemorrhaging products, worsening margins, and storage risks
- **Actionable Recommendations**: Provides specific actions based on the main cost driver

### 📊 Product Status Classification
- 🔴 **Hemorrhage**: Margin < -10% (Severe loss)
- 🟠 **Loss**: Margin < 0% (Losing money)
- 🟡 **Danger**: Margin < 5% (Danger zone)
- 🟨 **Low**: Margin < 15% (Low margin)
- 🟢 **Healthy**: Margin ≥ 15% (Good profit)

## Installation & Setup

### 1. Database Migration
```bash
# Run the migration to create necessary tables
node scripts/runProfitDetectorMigration.js
```

### 2. Integration with PersistentSyncManager
Add these lines to `server/services/persistentSyncManager.js`:

```javascript
// At the top of the file
const profitDetectorIntegration = require('./profitDetector/persistentSyncIntegration');

// In the executeTask method, add these cases:
case 'profit_sync':
  result = await profitDetectorIntegration.tasks['profit_sync'](payload);
  break;
case 'profit_analyze_product':
  result = await profitDetectorIntegration.tasks['profit_analyze_product'](payload);
  break;
// ... (other cases from persistentSyncIntegration.js)
```

### 3. Add API Routes
In `server/index.js`, add:
```javascript
app.use('/api/profit-detector', require('./routes/profitDetectorAPI'));
```

### 4. Frontend Routes
Add routes in your React Router configuration:
```javascript
<Route path="/profit-detector" element={<ProfitLeakDetector />} />
<Route path="/profit-analysis/:asin" element={<ProfitAnalysisDetail />} />
```

## API Endpoints

### Analysis Endpoints
- `GET /api/profit-detector/analyses` - Get all profit analyses with summary
- `GET /api/profit-detector/analyses/:asin` - Get detailed analysis for specific product
- `POST /api/profit-detector/analyses/:asin` - Analyze specific product

### Product Cost Management
- `PUT /api/profit-detector/products/:asin/cost` - Update product cost
- `POST /api/profit-detector/products/bulk-cost` - Bulk update product costs
- `GET /api/profit-detector/products/cost-template` - Download CSV template

### Alerts
- `GET /api/profit-detector/alerts/unread` - Get unread alerts
- `PUT /api/profit-detector/alerts/:alertId/read` - Mark alert as read

### Sync & Export
- `POST /api/profit-detector/sync` - Trigger manual sync
- `GET /api/profit-detector/sync/status` - Get sync status
- `GET /api/profit-detector/export/csv` - Export analysis as CSV

## Usage

### Manual Product Cost Entry
Since product costs are not available via API, you need to manually enter them:

1. **Single Product**:
```javascript
await profitDetectorService.updateProductCost('B08N5WRWNW', 25.50);
```

2. **Bulk Update via CSV**:
```csv
asin,sku,title,cost
B08N5WRWNW,SKU123,Echo Dot (4th Gen),25.50
B07FZ8S74R,SKU456,Echo Show 8,45.00
```

### Scheduled Sync
The module automatically syncs twice daily (6 AM and 6 PM) when integrated with PersistentSyncManager.

### Manual Sync
```bash
# Trigger sync via API
curl -X POST http://localhost:3000/api/profit-detector/sync
```

## Cost Calculation Formula

```javascript
Total Cost per Unit = Product Cost +
                     Amazon Fees (Referral + FBA + Variable Closing) +
                     Storage Costs (Monthly + Long-term) / Units Sold +
                     Return Processing Cost * Return Rate

Profit per Unit = Selling Price - Total Cost per Unit
Profit Margin % = (Profit per Unit / Selling Price) * 100
```

## Alert Types

1. **New Hemorrhage** (Critical)
   - Product losing more than 10% margin
   - Immediate action required

2. **Increasing Loss** (High/Medium)
   - Margin dropped by 5%+ and is now below 10%
   - Trend monitoring needed

3. **Storage Alert** (Medium)
   - Products approaching long-term storage fees
   - Inventory optimization needed

4. **Return Spike** (Medium)
   - Return rate above 10% with 5+ returns
   - Quality investigation needed

5. **Aged Inventory** (Medium)
   - Products over 365 days old
   - Capital tied up in old inventory

## Testing

```bash
# Test the module
node scripts/testProfitDetector.js
```

## Troubleshooting

### No Data Showing
1. Ensure SP-API credentials are configured
2. Check if Reports API access is enabled
3. Verify product costs are entered
4. Run manual sync and check logs

### Incorrect Calculations
1. Verify product costs are accurate
2. Check if all report types are being collected
3. Ensure date ranges are correct

### Missing Alerts
1. Check alert generation frequency
2. Verify notification system is configured
3. Look for errors in logs

## Future Enhancements
- [ ] Integration with Amazon Data Kiosk for advanced analytics
- [ ] Machine learning for demand forecasting
- [ ] Automated pricing recommendations
- [ ] Competitor analysis integration
- [ ] Multi-marketplace support