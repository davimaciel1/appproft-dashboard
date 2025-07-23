const express = require('express');
const router = express.Router();
const secureLogger = require('../utils/secureLogger');
const AmazonService = require('../services/amazonService');
const MercadoLivreService = require('../services/mercadolivreService');
const CredentialsService = require('../services/credentialsService');

const credentialsService = new CredentialsService();

router.get('/metrics', async (req, res) => {
  try {
    const userId = req.userId;
    const { period = 'today', marketplace = 'all', country = 'all' } = req.query;
    
    const [amazonOrders, mlOrders] = await Promise.all([
      marketplace === 'all' || marketplace === 'amazon' ? getAmazonMetrics(userId, period) : { todaysSales: 0, ordersCount: 0, unitsSold: 0, netProfit: 0, acos: 0, newOrders: 0 },
      marketplace === 'all' || marketplace === 'mercadolivre' ? getMercadoLivreMetrics(userId, period) : { todaysSales: 0, ordersCount: 0, unitsSold: 0, netProfit: 0, acos: 0, newOrders: 0 }
    ]);
    
    const consolidatedMetrics = {
      todaysSales: amazonOrders.todaysSales + mlOrders.todaysSales,
      ordersCount: amazonOrders.ordersCount + mlOrders.ordersCount,
      unitsSold: amazonOrders.unitsSold + mlOrders.unitsSold,
      avgUnitsPerOrder: ((amazonOrders.unitsSold + mlOrders.unitsSold) / (amazonOrders.ordersCount + mlOrders.ordersCount)).toFixed(1),
      netProfit: amazonOrders.netProfit + mlOrders.netProfit,
      profitMargin: ((amazonOrders.netProfit + mlOrders.netProfit) / (amazonOrders.todaysSales + mlOrders.todaysSales) * 100).toFixed(1),
      acos: calculateWeightedACOS(amazonOrders, mlOrders),
      yesterdayComparison: calculateGrowth(amazonOrders, mlOrders),
      newOrders: amazonOrders.newOrders + mlOrders.newOrders
    };
    
    res.json(consolidatedMetrics);
  } catch (error) {
    secureLogger.error('Erro ao buscar métricas', { 
      error: error.message,
      userId: req.userId 
    });
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

async function getAmazonMetrics(userId, period = 'today') {
  try {
    // Busca credenciais do usuário diretamente do banco
    const pool = require('../db/pool');
    const result = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
      [userId, 'amazon']
    );
    
    if (result.rows.length === 0) {
      throw new Error('Credenciais Amazon não encontradas');
    }
    
    const row = result.rows[0];
    const credentials = {
      clientId: row.client_id,
      clientSecret: row.client_secret,
      refreshToken: row.refresh_token,
      sellerId: row.seller_id,
      marketplaceId: row.marketplace_id || 'ATVPDKIKX0DER'
    };
    
    const amazonService = new AmazonService(credentials);
    
    // Calcular data baseada no período
    const startDate = new Date();
    switch (period) {
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'last7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'thisMonth':
        startDate.setDate(1);
        break;
      case 'today':
      default:
        startDate.setHours(0, 0, 0, 0);
        break;
    }
  
    const orders = await amazonService.getOrders(startDate.toISOString());
  
  let todaysSales = 0;
  let unitsSold = 0;
  
  orders.forEach(order => {
    if (order.OrderTotal) {
      todaysSales += parseFloat(order.OrderTotal.Amount || 0);
    }
    unitsSold += order.NumberOfItemsShipped || 0;
  });
  
    return {
      todaysSales,
      ordersCount: orders.length,
      unitsSold,
      netProfit: todaysSales * 0.33,
      acos: await amazonService.getACOS?.() || 16.7,
      newOrders: orders.filter(o => o.OrderStatus === 'Unshipped').length
    };
  } catch (error) {
    secureLogger.error('Erro ao buscar métricas Amazon', { error: error.message, userId });
    return {
      todaysSales: 0,
      ordersCount: 0,
      unitsSold: 0,
      netProfit: 0,
      acos: 0,
      newOrders: 0
    };
  }
}

async function getMercadoLivreMetrics(userId, period = 'today') {
  try {
    // Busca credenciais do usuário
    const credentials = await credentialsService.getCredentials(userId, 'mercadolivre');
    if (!credentials) {
      return { todaysSales: 0, ordersCount: 0, unitsSold: 0, netProfit: 0, acos: 0, newOrders: 0 };
    }
    
    const mlService = new MercadoLivreService(credentials);
    
    // Calcular data baseada no período
    const startDate = new Date();
    switch (period) {
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'last7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'thisMonth':
        startDate.setDate(1);
        break;
      case 'today':
      default:
        startDate.setHours(0, 0, 0, 0);
        break;
    }
  
    const orders = await mlService.getOrders();
  const todayOrders = orders.filter(order => {
    const orderDate = new Date(order.date_created);
    return orderDate >= startDate;
  });
  
  let todaysSales = 0;
  let unitsSold = 0;
  
  todayOrders.forEach(order => {
    todaysSales += order.total_amount || 0;
    order.order_items?.forEach(item => {
      unitsSold += item.quantity || 0;
    });
  });
  
    return {
      todaysSales,
      ordersCount: todayOrders.length,
      unitsSold,
      netProfit: todaysSales * 0.33,
      acos: 21.2,
      newOrders: todayOrders.filter(o => o.status === 'confirmed').length
    };
  } catch (error) {
    secureLogger.error('Erro ao buscar métricas ML', { error: error.message, userId });
    return {
      todaysSales: 0,
      ordersCount: 0,
      unitsSold: 0,
      netProfit: 0,
      acos: 0,
      newOrders: 0
    };
  }
}

function calculateWeightedACOS(amazon, ml) {
  const totalSales = amazon.todaysSales + ml.todaysSales;
  if (totalSales === 0) return '0';
  const weightedACOS = (amazon.acos * amazon.todaysSales + ml.acos * ml.todaysSales) / totalSales;
  return weightedACOS.toFixed(1);
}

function calculateGrowth(amazon, ml) {
  // TODO: Implementar cálculo real baseado em dados históricos
  return 23;
}

router.get('/products', async (req, res) => {
  try {
    const userId = req.userId;
    const { marketplace = 'all', period = 'all', country = 'all' } = req.query;
    
    // Build where clauses
    const whereClauses = ['p.tenant_id = $1'];
    const params = [userId];
    let paramCount = 1;
    
    if (marketplace !== 'all') {
      paramCount++;
      whereClauses.push(`p.marketplace = $${paramCount}`);
      params.push(marketplace);
    }
    
    if (country !== 'all') {
      paramCount++;
      whereClauses.push(`p.country_code = $${paramCount}`);
      params.push(country);
    }
    
    // Add date filter for "today units"
    let dateFilter = '';
    if (period !== 'all') {
      const startDate = new Date();
      switch (period) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'last7days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last30days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'thisMonth':
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }
      paramCount++;
      dateFilter = `AND o.order_date >= $${paramCount}`;
      params.push(startDate.toISOString());
    }
    
    // Query products from materialized view with additional real-time data
    const query = `
      SELECT 
        p.id,
        p.marketplace,
        p.country_code,
        p.asin,
        p.sku,
        p.name,
        p.image_url,
        COALESCE(ps.total_orders, 0) as total_orders,
        COALESCE(ps.total_units_sold, 0) as total_units_sold,
        COALESCE(ps.total_revenue, 0) as total_revenue,
        COALESCE(ps.total_profit, 0) as total_profit,
        COALESCE(ps.roi, 0) as roi,
        COALESCE(ps.sales_rank, 999) as sales_rank,
        COALESCE(i.quantity, 0) as inventory,
        COALESCE(i.alert_level, 10) as alert_level,
        COALESCE(
          (SELECT SUM(oi2.quantity) 
           FROM order_items oi2 
           JOIN orders o2 ON oi2.order_id = o2.id 
           WHERE oi2.product_id = p.id 
           AND DATE(o2.order_date) = CURRENT_DATE), 0
        ) as today_units,
        CASE 
          WHEN ps.total_revenue > 0 
          THEN (ps.total_profit / ps.total_revenue * 100)
          ELSE 0 
        END as profit_margin
      FROM products p
      LEFT JOIN product_sales_summary ps ON p.id = ps.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY COALESCE(ps.total_units_sold, 0) DESC, p.name
      LIMIT 100
    `;
    
    const result = await pool.query(query, params);
    
    // Format products for frontend
    const products = result.rows.map((product, index) => ({
      id: `${product.marketplace}_${product.id}`,
      name: product.name,
      sku: product.sku || product.asin,
      marketplace: product.marketplace,
      country: product.country_code || 'BR',
      image: product.image_url,
      units: product.total_units_sold,
      todayUnits: product.today_units,
      revenue: parseFloat(product.total_revenue),
      profit: parseFloat(product.total_profit),
      profitMargin: parseFloat(product.profit_margin),
      roi: parseFloat(product.roi),
      acos: product.marketplace === 'amazon' ? 16.7 : 20, // Placeholder until we get advertising data
      inventory: product.inventory,
      alertLevel: product.alert_level,
      rank: index + 1,
      totalOrders: product.total_orders
    }));
    
    res.json({ products });
  } catch (error) {
    secureLogger.error('Erro ao buscar produtos', { 
      error: error.message,
      userId: req.userId 
    });
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

async function getAmazonProducts(userId) {
  try {
    // Busca credenciais do usuário diretamente do banco
    const pool = require('../db/pool');
    const result = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
      [userId, 'amazon']
    );
    
    if (result.rows.length === 0) {
      throw new Error('Credenciais Amazon não encontradas');
    }
    
    const row = result.rows[0];
    const credentials = {
      clientId: row.client_id,
      clientSecret: row.client_secret,
      refreshToken: row.refresh_token,
      sellerId: row.seller_id,
      marketplaceId: row.marketplace_id || 'ATVPDKIKX0DER'
    };
    
    const amazonService = new AmazonService(credentials);
    const amazonProducts = await amazonService.getProductsCatalog();
  
    return amazonProducts.map((product, index) => ({
      id: `amazon_${product.ASIN || index}`,
      name: product.ProductName || `Produto Amazon ${product.ASIN}`,
      sku: product.ASIN || product.SellerSKU,
      marketplace: 'amazon',
      country: 'US', // Corrigido para US
      image: product.SmallImage?.URL || product.ImageUrl || null,
      units: product.QuantitySold || 0,
      revenue: product.Revenue || 0,
      profit: (product.Revenue || 0) * 0.3,
      roi: calculateROI(product),
      acos: product.ACOS || 15,
      inventory: product.InStockSupplyQuantity || 0
    }));
  } catch (error) {
    secureLogger.error('Erro ao buscar produtos Amazon', { error: error.message, userId });
    return [];
  }
}

async function getMercadoLivreProducts(userId) {
  try {
    const credentials = await credentialsService.getCredentials(userId, 'mercadolivre');
    const mlService = new MercadoLivreService(credentials);
    const mlProducts = await mlService.getActiveListings();
  
    return mlProducts.map(product => ({
      id: `ml_${product.id}`,
      name: product.title,
      sku: product.id,
      marketplace: 'mercadolivre',
      country: 'BR',
      image: product.thumbnail || null,
      units: product.sold_quantity || 0,
      revenue: (product.price || 0) * (product.sold_quantity || 0),
      profit: (product.price || 0) * (product.sold_quantity || 0) * 0.3,
      roi: calculateROI(product),
      acos: 20,
      inventory: product.available_quantity || 0
    }));
  } catch (error) {
    secureLogger.error('Erro ao buscar produtos ML', { error: error.message, userId });
    return [];
  }
}

function calculateROI(product) {
  const revenue = product.Revenue || (product.price * product.sold_quantity) || 0;
  const cost = revenue * 0.7; // 70% de custo estimado
  if (cost === 0) return 0;
  return ((revenue - cost) / cost * 100).toFixed(1);
}

module.exports = router;