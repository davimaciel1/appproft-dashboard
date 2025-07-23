const express = require('express');
const router = express.Router();

function getMercadoLivreService() {
  if (process.env.USE_MOCK_DATA === 'true') {
    return null; // Don't load ML service when using mock data
  }
  return require('../services/mercadolivreService');
}

router.get('/orders', async (req, res) => {
  try {
    if (process.env.USE_MOCK_DATA === 'true') {
      return res.json({
        orders: [
          {
            orderId: 'ML-001',
            date: new Date(),
            total: 189.90,
            items: 2,
            status: 'delivered'
          },
          {
            orderId: 'ML-002',
            date: new Date(),
            total: 459.90,
            items: 1,
            status: 'shipped'
          }
        ]
      });
    }

    const orders = await mercadolivreService.getOrders();
    res.json({ orders });
  } catch (error) {
    console.error('Erro ao buscar pedidos ML:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

router.get('/products', async (req, res) => {
  try {
    if (process.env.USE_MOCK_DATA === 'true') {
      return res.json({
        items: [
          {
            id: 'MLB001',
            name: 'JBL Go 3 - Caixa de Som Bluetooth',
            sku: 'JBL-GO3-BLK',
            price: 239.90,
            image: 'https://http2.mlstatic.com/D_NQ_NP_2X_835595-MLU72570799223_102023-F.webp',
            inventory: 156,
            marketplace: 'mercadolivre',
            country: 'BR'
          },
          {
            id: 'MLB002',
            name: 'Fone Bluetooth QCY T13',
            sku: 'QCY-T13-WHT',
            price: 99.90,
            image: 'https://http2.mlstatic.com/D_NQ_NP_2X_893269-MLU72748774895_112023-F.webp',
            inventory: 445,
            marketplace: 'mercadolivre',
            country: 'BR'
          },
          {
            id: 'MLB003',
            name: 'Smart Lâmpada RGB WiFi',
            sku: 'LAMP-RGB-WIFI',
            price: 39.90,
            image: 'https://http2.mlstatic.com/D_NQ_NP_2X_987456-MLB51765892234_102022-F.webp',
            inventory: 678,
            marketplace: 'mercadolivre',
            country: 'BR'
          }
        ]
      });
    }

    const products = await mercadolivreService.getProducts();
    res.json({ items: products });
  } catch (error) {
    console.error('Erro ao buscar produtos ML:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    if (process.env.USE_MOCK_DATA === 'true') {
      return res.json({
        todaysSales: 4612.76,
        ordersCount: 53,
        unitsSold: 153,
        growth: 18.3,
        currency: 'BRL'
      });
    }

    const metrics = await mercadolivreService.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Erro ao buscar métricas ML:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

module.exports = router;