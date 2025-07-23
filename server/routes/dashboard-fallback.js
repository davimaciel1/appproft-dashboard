const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const secureLogger = require('../utils/secureLogger');

// Middleware para verificar se as tabelas existem
async function checkTablesExist(req, res, next) {
  try {
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('products', 'orders', 'order_items', 'product_sales_summary')
    `;
    
    const result = await pool.query(tableCheckQuery);
    const existingTables = result.rows.map(row => row.table_name);
    
    if (existingTables.length < 3) { // Pelo menos products, orders e order_items devem existir
      req.tablesExist = false;
    } else {
      req.tablesExist = true;
    }
    
    next();
  } catch (error) {
    secureLogger.error('Erro ao verificar tabelas', { error: error.message });
    req.tablesExist = false;
    next();
  }
}

// Aplicar middleware em todas as rotas
router.use(checkTablesExist);

router.get('/metrics', async (req, res) => {
  try {
    const userId = req.userId;
    
    // Se as tabelas não existirem, retornar dados vazios
    if (!req.tablesExist) {
      return res.json({
        todaysSales: 0,
        ordersCount: 0,
        unitsSold: 0,
        avgUnitsPerOrder: '0',
        netProfit: 0,
        profitMargin: '0',
        acos: '0',
        yesterdayComparison: 0,
        newOrders: 0
      });
    }
    
    // Continuar com a lógica normal se as tabelas existirem
    const existingRoute = require('./dashboard');
    return existingRoute.get('/metrics')(req, res);
  } catch (error) {
    secureLogger.error('Erro ao buscar métricas', { 
      error: error.message,
      userId: req.userId 
    });
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const userId = req.userId;
    
    // Se as tabelas não existirem, retornar array vazio
    if (!req.tablesExist) {
      return res.json({ products: [] });
    }
    
    // Tentar buscar com fallback para a lógica antiga
    const { marketplace = 'all', period = 'all', country = 'all' } = req.query;
    
    // Primeiro tentar a query nova
    try {
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
      
      // Query agrupada por produto com vendas totais
      const query = `
        WITH product_sales AS (
          SELECT 
            p.id,
            p.marketplace,
            p.country_code,
            p.asin,
            p.sku,
            p.name,
            p.image_url,
            COUNT(DISTINCT o.id) as total_orders,
            COALESCE(SUM(oi.quantity), 0) as total_units_sold,
            COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
            COALESCE(SUM((oi.price - COALESCE(oi.cost, 0)) * oi.quantity), 0) as total_profit,
            -- Variação de unidades (comparando com período anterior)
            COALESCE(SUM(CASE WHEN o.order_date >= CURRENT_DATE THEN oi.quantity ELSE 0 END), 0) as today_units,
            COALESCE(SUM(CASE WHEN o.order_date >= CURRENT_DATE - INTERVAL '1 day' 
                          AND o.order_date < CURRENT_DATE THEN oi.quantity ELSE 0 END), 0) as yesterday_units
          FROM products p
          LEFT JOIN order_items oi ON p.id = oi.product_id
          LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'returned')
          WHERE ${whereClauses.join(' AND ')}
          GROUP BY p.id, p.marketplace, p.country_code, p.asin, p.sku, p.name, p.image_url
        )
        SELECT 
          *,
          CASE 
            WHEN total_revenue > 0 THEN ((total_profit / total_revenue) * 100)
            ELSE 0 
          END as profit_margin,
          CASE 
            WHEN total_revenue - total_profit > 0 THEN ((total_profit / (total_revenue - total_profit)) * 100)
            ELSE 0 
          END as roi,
          today_units - yesterday_units as units_variation
        FROM product_sales
        ORDER BY total_units_sold DESC
        LIMIT 100
      `;
      
      const result = await pool.query(query, params);
      
      // Format products for frontend
      const products = result.rows.map((product, index) => ({
        id: `${product.marketplace}_${product.id}`,
        imageUrl: product.image_url || '/placeholder-product.png',
        marketplace: product.marketplace,
        country: product.country_code || 'US',
        name: product.name || 'Produto sem nome',
        sku: product.sku || product.asin || '',
        units: parseInt(product.total_units_sold) || 0,
        unitsVariation: parseInt(product.units_variation) || 0,
        revenue: parseFloat(product.total_revenue) || 0,
        profit: parseFloat(product.total_profit) || 0,
        roi: parseFloat(product.roi) || 0,
        margin: parseFloat(product.profit_margin) || 0,
        acos: product.marketplace === 'amazon' ? 16.7 : 20,
        breakEven: product.marketplace === 'amazon' ? 25 : 30
      }));
      
      return res.json({ products });
    } catch (error) {
      // Se falhar, tentar buscar credenciais e usar lógica antiga
      const AmazonService = require('../services/amazonService');
      const MercadoLivreService = require('../services/mercadolivreService');
      
      const [amazonProducts, mlProducts] = await Promise.all([
        getAmazonProducts(userId).catch(() => []),
        getMercadoLivreProducts(userId).catch(() => [])
      ]);
      
      const products = [...amazonProducts, ...mlProducts];
      
      return res.json({ products });
    }
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
    const result = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = $1 AND marketplace = $2',
      [userId, 'amazon']
    );
    
    if (result.rows.length === 0) {
      return [];
    }
    
    const row = result.rows[0];
    const credentials = {
      clientId: row.client_id,
      clientSecret: row.client_secret,
      refreshToken: row.refresh_token,
      sellerId: row.seller_id,
      marketplaceId: row.marketplace_id || 'ATVPDKIKX0DER'
    };
    
    const AmazonService = require('../services/amazonService');
    const amazonService = new AmazonService(credentials);
    const amazonProducts = await amazonService.getProductsCatalog();
  
    return amazonProducts.map((product, index) => ({
      id: `amazon_${product.ASIN || index}`,
      imageUrl: product.SmallImage?.URL || product.ImageUrl || '/placeholder.png',
      marketplace: 'amazon',
      country: 'US',
      name: product.ProductName || `Produto Amazon ${product.ASIN}`,
      sku: product.ASIN || product.SellerSKU || '',
      units: product.QuantitySold || 0,
      unitsVariation: Math.floor(Math.random() * 20), // TODO: calcular variação real
      revenue: product.Revenue || 0,
      profit: (product.Revenue || 0) * 0.3,
      roi: parseFloat(calculateROI(product)),
      margin: 30,
      acos: product.ACOS || 16.7,
      breakEven: 25
    }));
  } catch (error) {
    secureLogger.error('Erro ao buscar produtos Amazon', { error: error.message, userId });
    return [];
  }
}

async function getMercadoLivreProducts(userId) {
  try {
    const CredentialsService = require('../services/credentialsService');
    const credentialsService = new CredentialsService();
    const credentials = await credentialsService.getCredentials(userId, 'mercadolivre');
    
    if (!credentials) {
      return [];
    }
    
    const MercadoLivreService = require('../services/mercadolivreService');
    const mlService = new MercadoLivreService(credentials);
    const mlProducts = await mlService.getActiveListings();
  
    return mlProducts.map((product, index) => ({
      id: `ml_${product.id}`,
      imageUrl: product.thumbnail || '/placeholder.png',
      marketplace: 'mercadolivre',
      country: 'BR',
      name: product.title || 'Produto sem nome',
      sku: product.id || '',
      units: product.sold_quantity || 0,
      unitsVariation: Math.floor(Math.random() * 20), // TODO: calcular variação real
      revenue: (product.price || 0) * (product.sold_quantity || 0),
      profit: (product.price || 0) * (product.sold_quantity || 0) * 0.3,
      roi: parseFloat(calculateROI(product)),
      margin: 30,
      acos: 20,
      breakEven: 30
    }));
  } catch (error) {
    secureLogger.error('Erro ao buscar produtos ML', { error: error.message, userId });
    return [];
  }
}

function calculateROI(product) {
  const revenue = product.Revenue || (product.price * product.sold_quantity) || 0;
  const cost = revenue * 0.7;
  if (cost === 0) return 0;
  return ((revenue - cost) / cost * 100).toFixed(1);
}

module.exports = router;