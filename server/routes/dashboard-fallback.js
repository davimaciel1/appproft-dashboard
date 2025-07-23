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
      
      // Query simplificada sem materialized view
      const query = `
        SELECT 
          p.id,
          p.marketplace,
          p.country_code,
          p.asin,
          p.sku,
          p.name,
          p.image_url,
          0 as total_orders,
          0 as total_units_sold,
          0 as total_revenue,
          0 as total_profit,
          0 as roi,
          1 as sales_rank,
          0 as inventory,
          10 as alert_level,
          0 as today_units,
          0 as profit_margin
        FROM products p
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY p.name
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
        acos: product.marketplace === 'amazon' ? 16.7 : 20,
        inventory: product.inventory,
        alertLevel: product.alert_level,
        rank: index + 1,
        totalOrders: product.total_orders
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
      name: product.ProductName || `Produto Amazon ${product.ASIN}`,
      sku: product.ASIN || product.SellerSKU,
      marketplace: 'amazon',
      country: 'US',
      image: product.SmallImage?.URL || product.ImageUrl || null,
      units: product.QuantitySold || 0,
      todayUnits: 0,
      revenue: product.Revenue || 0,
      profit: (product.Revenue || 0) * 0.3,
      profitMargin: 30,
      roi: calculateROI(product),
      acos: product.ACOS || 15,
      inventory: product.InStockSupplyQuantity || 0,
      alertLevel: 10,
      rank: index + 1,
      totalOrders: 0
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
      name: product.title,
      sku: product.id,
      marketplace: 'mercadolivre',
      country: 'BR',
      image: product.thumbnail || null,
      units: product.sold_quantity || 0,
      todayUnits: 0,
      revenue: (product.price || 0) * (product.sold_quantity || 0),
      profit: (product.price || 0) * (product.sold_quantity || 0) * 0.3,
      profitMargin: 30,
      roi: calculateROI(product),
      acos: 20,
      inventory: product.available_quantity || 0,
      alertLevel: 10,
      rank: index + 1,
      totalOrders: 0
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