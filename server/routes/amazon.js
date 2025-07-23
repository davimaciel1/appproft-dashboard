const express = require('express');
const router = express.Router();

function getAmazonService() {
  if (process.env.USE_MOCK_DATA === 'true') {
    return null; // Don't load Amazon service when using mock data
  }
  return require('../services/amazonServiceNew');
}

router.get('/orders', async (req, res) => {
  try {
    if (process.env.USE_MOCK_DATA === 'true') {
      return res.json({
        orders: [
          {
            orderId: 'AMZ-001',
            date: new Date(),
            total: 299.90,
            items: 3,
            status: 'shipped'
          },
          {
            orderId: 'AMZ-002',
            date: new Date(),
            total: 149.90,
            items: 1,
            status: 'pending'
          }
        ]
      });
    }

    const amazonService = getAmazonService();
    const orders = await amazonService.getOrders();
    res.json({ orders });
  } catch (error) {
    console.error('Erro ao buscar pedidos Amazon:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

router.get('/products', async (req, res) => {
  try {
    if (process.env.USE_MOCK_DATA === 'true') {
      return res.json({
        products: [
          {
            id: 'AMZ001',
            asin: 'B08N5WRWNW',
            sku: 'ECHO-DOT-4',
            name: 'Echo Dot (4ª Geração)',
            image: 'https://m.media-amazon.com/images/I/714Rq4k05UL._AC_SL1000_.jpg',
            inventory: 234,
            price: 299.00,
            marketplace: 'amazon'
          },
          {
            id: 'AMZ002',
            asin: 'B0BDQ1F6RN',
            sku: 'KINDLE-PW11',
            name: 'Kindle Paperwhite 11ª Geração',
            image: 'https://m.media-amazon.com/images/I/61-T2KhC1BL._AC_SL1000_.jpg',
            inventory: 89,
            price: 599.00,
            marketplace: 'amazon'
          },
          {
            id: 'AMZ003',
            asin: 'B09B8W5FW7',
            sku: 'FIRE-TV-4K',
            name: 'Fire TV Stick 4K',
            image: 'https://m.media-amazon.com/images/I/51c5gJKPBDL._AC_SL1000_.jpg',
            inventory: 156,
            price: 349.00,
            marketplace: 'amazon'
          }
        ]
      });
    }

    const amazonService = getAmazonService();
    const products = await amazonService.getOrders(); // Temporarily use getOrders as products method needs implementation
    res.json({ products });
  } catch (error) {
    console.error('Erro ao buscar produtos Amazon:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    if (process.env.USE_MOCK_DATA === 'true') {
      return res.json({
        todaysSales: 8234.56,
        ordersCount: 89,
        unitsSold: 234,
        growth: 23.5,
        currency: 'BRL'
      });
    }

    const amazonService = getAmazonService();
    const metrics = await amazonService.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Erro ao buscar métricas Amazon:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

module.exports = router;