const express = require('express');
const router = express.Router();
const AmazonService = require('../services/amazonService');
const MercadoLivreService = require('../services/mercadolivreService');

router.get('/metrics', async (req, res) => {
  try {
    const amazonOrders = await getAmazonMetrics();
    const mlOrders = await getMercadoLivreMetrics();
    
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
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

async function getAmazonMetrics() {
  // Se USE_MOCK_DATA está ativo, retornar dados mockados
  if (process.env.USE_MOCK_DATA === 'true') {
    return {
      todaysSales: 8234.56,
      ordersCount: 89,
      unitsSold: 234,
      netProfit: 2712.34,
      acos: 16.7,
      newOrders: 18
    };
  }
  
  // Caso contrário, buscar dados reais da API
  try {
    const amazonService = new AmazonService();
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
      netProfit: todaysSales * 0.33, // 33% de margem estimada
      acos: 16.7, // Valor fixo por enquanto
      newOrders: orders.filter(o => o.OrderStatus === 'Unshipped').length
    };
  } catch (error) {
    console.error('Erro ao buscar dados Amazon:', error);
    // Retornar dados mockados em caso de erro
    return {
      todaysSales: 8234.56,
      ordersCount: 89,
      unitsSold: 234,
      netProfit: 2712.34,
      acos: 16.7,
      newOrders: 18
    };
  }
}

async function getMercadoLivreMetrics() {
  // Se USE_MOCK_DATA está ativo, retornar dados mockados
  if (process.env.USE_MOCK_DATA === 'true') {
    return {
      todaysSales: 4612.76,
      ordersCount: 53,
      unitsSold: 153,
      netProfit: 1519.53,
      acos: 21.2,
      newOrders: 10
    };
  }
  
  // Caso contrário, buscar dados reais da API
  try {
    const mlService = new MercadoLivreService();
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
      netProfit: todaysSales * 0.33, // 33% de margem estimada
      acos: 21.2, // Valor fixo por enquanto
      newOrders: todayOrders.filter(o => o.status === 'confirmed').length
    };
  } catch (error) {
    console.error('Erro ao buscar dados Mercado Livre:', error);
    // Retornar dados mockados em caso de erro
    return {
      todaysSales: 4612.76,
      ordersCount: 53,
      unitsSold: 153,
      netProfit: 1519.53,
      acos: 21.2,
      newOrders: 10
    };
  }
}

function calculateWeightedACOS(amazon, ml) {
  const totalSales = amazon.todaysSales + ml.todaysSales;
  const weightedACOS = (amazon.acos * amazon.todaysSales + ml.acos * ml.todaysSales) / totalSales;
  return weightedACOS.toFixed(1);
}

function calculateGrowth(amazon, ml) {
  return 23;
}

router.get('/products', async (req, res) => {
  try {
    // Se USE_MOCK_DATA está ativo, retornar dados mockados
    if (process.env.USE_MOCK_DATA === 'true') {
      const mockProducts = [
      {
        id: 1,
        name: 'Echo Dot (4ª Geração)',
        sku: 'ECHO-DOT-4',
        marketplace: 'amazon',
        country: 'BR',
        image: 'https://via.placeholder.com/40',
        units: 45,
        revenue: 3150.55,
        profit: 945.17,
        roi: 42.8,
        acos: 15.3,
        inventory: 234
      },
      {
        id: 2,
        name: 'JBL Go 3 - Caixa de Som Bluetooth',
        sku: 'JBL-GO3-BLK',
        marketplace: 'mercadolivre',
        country: 'BR',
        image: 'https://via.placeholder.com/40',
        units: 38,
        revenue: 2850.62,
        profit: 712.66,
        roi: 33.3,
        acos: 18.9,
        inventory: 156
      },
      {
        id: 3,
        name: 'Kindle Paperwhite 11ª Geração',
        sku: 'KINDLE-PW11',
        marketplace: 'amazon',
        country: 'BR',
        image: 'https://via.placeholder.com/40',
        units: 22,
        revenue: 5280.78,
        profit: 1584.23,
        roi: 42.8,
        acos: 12.4,
        inventory: 89
      },
      {
        id: 4,
        name: 'Fone Bluetooth QCY T13',
        sku: 'QCY-T13-WHT',
        marketplace: 'mercadolivre',
        country: 'BR',
        image: 'https://via.placeholder.com/40',
        units: 67,
        revenue: 4690.33,
        profit: 1875.13,
        roi: 66.7,
        acos: 22.1,
        inventory: 445
      },
      {
        id: 5,
        name: 'Smart Lâmpada RGB WiFi',
        sku: 'LAMP-RGB-WIFI',
        marketplace: 'amazon',
        country: 'BR',
        image: 'https://via.placeholder.com/40',
        units: 91,
        revenue: 3640.91,
        profit: 1456.36,
        roi: 66.7,
        acos: 14.8,
        inventory: 678
      }
    ];
    
      return res.json({ products: mockProducts });
    }
    
    // Buscar dados reais das APIs
    const products = [];
    
    try {
      // Buscar produtos Amazon
      const amazonService = new AmazonService();
      const amazonProducts = await amazonService.getProductsCatalog();
      
      amazonProducts.forEach((product, index) => {
        products.push({
          id: index + 1,
          name: product.ProductName || 'Produto Amazon',
          sku: product.ASIN || product.SellerSKU,
          marketplace: 'amazon',
          country: 'BR',
          image: product.SmallImage?.URL || 'https://via.placeholder.com/40',
          units: product.QuantitySold || 0,
          revenue: product.Revenue || 0,
          profit: (product.Revenue || 0) * 0.3,
          roi: 45,
          acos: 15,
          inventory: product.InStockSupplyQuantity || 0
        });
      });
    } catch (error) {
      console.error('Erro ao buscar produtos Amazon:', error);
    }
    
    try {
      // Buscar produtos Mercado Livre
      const mlService = new MercadoLivreService();
      const mlProducts = await mlService.getActiveListings();
      
      mlProducts.forEach((product, index) => {
        products.push({
          id: products.length + index + 1,
          name: product.title,
          sku: product.id,
          marketplace: 'mercadolivre',
          country: 'BR',
          image: product.thumbnail || 'https://via.placeholder.com/40',
          units: product.sold_quantity || 0,
          revenue: (product.price || 0) * (product.sold_quantity || 0),
          profit: (product.price || 0) * (product.sold_quantity || 0) * 0.3,
          roi: 50,
          acos: 20,
          inventory: product.available_quantity || 0
        });
      });
    } catch (error) {
      console.error('Erro ao buscar produtos Mercado Livre:', error);
    }
    
    // Se não conseguiu buscar produtos reais, retornar os mockados
    if (products.length === 0) {
      const mockProducts = [
        {
          id: 1,
          name: 'Echo Dot (4ª Geração)',
          sku: 'ECHO-DOT-4',
          marketplace: 'amazon',
          country: 'BR',
          image: 'https://via.placeholder.com/40',
          units: 45,
          revenue: 3150.55,
          profit: 945.17,
          roi: 42.8,
          acos: 15.3,
          inventory: 234
        },
        {
          id: 2,
          name: 'JBL Go 3 - Caixa de Som Bluetooth',
          sku: 'JBL-GO3-BLK',
          marketplace: 'mercadolivre',
          country: 'BR',
          image: 'https://via.placeholder.com/40',
          units: 38,
          revenue: 2850.62,
          profit: 712.66,
          roi: 33.3,
          acos: 18.9,
          inventory: 156
        }
      ];
      return res.json({ products: mockProducts });
    }
    
    res.json({ products });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

module.exports = router;