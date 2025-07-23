const express = require('express');
const router = express.Router();

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
  return {
    todaysSales: 8234.56,
    ordersCount: 89,
    unitsSold: 234,
    netProfit: 2712.34,
    acos: 16.7,
    newOrders: 18
  };
}

async function getMercadoLivreMetrics() {
  return {
    todaysSales: 4612.76,
    ordersCount: 53,
    unitsSold: 153,
    netProfit: 1519.53,
    acos: 21.2,
    newOrders: 10
  };
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
    
    res.json({ products: mockProducts });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

module.exports = router;