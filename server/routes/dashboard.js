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
    const [amazonOrders, mlOrders] = await Promise.all([
      getAmazonMetrics(userId),
      getMercadoLivreMetrics(userId)
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

async function getAmazonMetrics(userId) {
  try {
    // Busca credenciais do usuário
    const credentials = await credentialsService.getCredentials(userId, 'amazon');
    const amazonService = new AmazonService(credentials);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    const orders = await amazonService.getOrders(today.toISOString());
  
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

async function getMercadoLivreMetrics(userId) {
  try {
    // Busca credenciais do usuário
    const credentials = await credentialsService.getCredentials(userId, 'mercadolivre');
    const mlService = new MercadoLivreService(credentials);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    const orders = await mlService.getOrders();
  const todayOrders = orders.filter(order => {
    const orderDate = new Date(order.date_created);
    return orderDate >= today;
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
    const [amazonProducts, mlProducts] = await Promise.all([
      getAmazonProducts(userId),
      getMercadoLivreProducts(userId)
    ]);
    
    const products = [...amazonProducts, ...mlProducts];
    
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
    const credentials = await credentialsService.getCredentials(userId, 'amazon');
    const amazonService = new AmazonService(credentials);
    const amazonProducts = await amazonService.getProductsCatalog();
  
    return amazonProducts.map((product, index) => ({
      id: `amazon_${product.ASIN || index}`,
      name: product.ProductName || 'Produto Amazon',
      sku: product.ASIN || product.SellerSKU,
      marketplace: 'amazon',
      country: 'BR',
      image: product.SmallImage?.URL || null,
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