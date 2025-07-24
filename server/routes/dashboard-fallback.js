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
    const tenantId = req.tenantId || userId; // Para compatibilidade
    
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

// Rota para buscar métricas agregadas (baseado em VENDAS_AGREGADAS.md)
router.get('/aggregated-metrics', async (req, res) => {
  try {
    const userId = req.userId || 1;
    const { 
      aggregationType = 'byDate', 
      granularity = 'DAY',
      startDate,
      endDate,
      marketplace = 'amazon',
      asinLevel = 'PARENT'
    } = req.query;
    
    console.log('Aggregated Metrics Request:', { aggregationType, granularity, startDate, endDate, marketplace });
    
    // Calcular datas padrão se não fornecidas
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 dias atrás
    
    if (aggregationType === 'byDate') {
      // Métricas agregadas por data
      let query = `
        WITH daily_metrics AS (
          SELECT 
            DATE_TRUNC($1, o.order_date) as metric_date,
            COUNT(DISTINCT o.id) as orders_count,
            COALESCE(SUM(oi.quantity), 0) as units_ordered,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) as ordered_product_sales,
            COALESCE(SUM(CASE WHEN o.is_business_order = true THEN oi.quantity * oi.unit_price ELSE 0 END), 0) as ordered_product_sales_b2b,
            COALESCE(AVG(oi.unit_price), 0) as average_selling_price,
            COALESCE(SUM(oi.quantity) / NULLIF(COUNT(DISTINCT o.id), 0), 0) as average_units_per_order,
            COUNT(DISTINCT oi.id) as total_order_items,
            COALESCE(SUM(CASE WHEN oi.is_refunded = true THEN oi.quantity ELSE 0 END), 0) as units_refunded,
            COALESCE(SUM(CASE WHEN o.status = 'shipped' THEN oi.quantity ELSE 0 END), 0) as units_shipped
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.user_id = $2
            AND o.marketplace = $3
            AND o.order_date >= $4
            AND o.order_date <= $5
          GROUP BY metric_date
        ),
        traffic_metrics AS (
          SELECT 
            DATE_TRUNC($1, tm.date) as metric_date,
            COALESCE(SUM(tm.page_views), 0) as page_views,
            COALESCE(SUM(tm.sessions), 0) as sessions,
            COALESCE(SUM(tm.browser_page_views), 0) as browser_page_views,
            COALESCE(SUM(tm.mobile_app_page_views), 0) as mobile_app_page_views,
            COALESCE(AVG(tm.buy_box_percentage), 0) as buy_box_percentage,
            COALESCE(AVG(tm.unit_session_percentage), 0) as unit_session_percentage,
            COALESCE(SUM(tm.feedback_received), 0) as feedback_received,
            COALESCE(SUM(tm.negative_feedback_received), 0) as negative_feedback_received
          FROM traffic_metrics tm
          WHERE tm.user_id = $2
            AND tm.marketplace = $3
            AND tm.date >= $4
            AND tm.date <= $5
          GROUP BY metric_date
        )
        SELECT 
          dm.metric_date as date,
          dm.orders_count,
          dm.units_ordered,
          dm.ordered_product_sales,
          dm.ordered_product_sales_b2b,
          dm.average_selling_price,
          dm.average_units_per_order,
          dm.total_order_items,
          dm.units_refunded,
          dm.units_shipped,
          CASE WHEN dm.units_ordered > 0 
            THEN (dm.units_refunded::decimal / dm.units_ordered * 100) 
            ELSE 0 
          END as refund_rate,
          COALESCE(tm.page_views, 0) as page_views,
          COALESCE(tm.sessions, 0) as sessions,
          COALESCE(tm.browser_page_views, 0) as browser_page_views,
          COALESCE(tm.mobile_app_page_views, 0) as mobile_app_page_views,
          COALESCE(tm.buy_box_percentage, 0) as buy_box_percentage,
          COALESCE(tm.unit_session_percentage, 0) as unit_session_percentage,
          COALESCE(tm.feedback_received, 0) as feedback_received,
          COALESCE(tm.negative_feedback_received, 0) as negative_feedback_received
        FROM daily_metrics dm
        LEFT JOIN traffic_metrics tm ON dm.metric_date = tm.metric_date
        ORDER BY dm.metric_date DESC
      `;
      
      const result = await pool.query(query, [granularity.toLowerCase(), userId, marketplace, start, end]);
      
      const formattedData = result.rows.map(row => ({
        date: row.date,
        sales: {
          orderedProductSales: {
            amount: parseFloat(row.ordered_product_sales),
            currencyCode: 'BRL'
          },
          orderedProductSalesB2B: {
            amount: parseFloat(row.ordered_product_sales_b2b),
            currencyCode: 'BRL'
          },
          averageSalesPerOrderItem: parseFloat(row.average_selling_price),
          averageSellingPrice: parseFloat(row.average_selling_price),
          unitsOrdered: parseInt(row.units_ordered),
          totalOrderItems: parseInt(row.total_order_items),
          unitsRefunded: parseInt(row.units_refunded),
          unitsShipped: parseInt(row.units_shipped),
          refundRate: parseFloat(row.refund_rate)
        },
        traffic: {
          pageViews: parseInt(row.page_views),
          sessions: parseInt(row.sessions),
          browserPageViews: parseInt(row.browser_page_views),
          mobileAppPageViews: parseInt(row.mobile_app_page_views),
          buyBoxPercentage: parseFloat(row.buy_box_percentage),
          unitSessionPercentage: parseFloat(row.unit_session_percentage),
          feedbackReceived: parseInt(row.feedback_received),
          negativeFeedbackReceived: parseInt(row.negative_feedback_received)
        }
      }));
      
      res.json({
        salesAndTrafficByDate: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          marketplaceId: marketplace === 'amazon' ? 'A2Q3Y263D00KWC' : 'MLB',
          granularity,
          data: formattedData
        }
      });
      
    } else if (aggregationType === 'byAsin') {
      // Métricas agregadas por ASIN/Produto
      let query = `
        SELECT 
          p.marketplace_product_id as asin,
          p.parent_asin,
          p.sku,
          p.name,
          COALESCE(SUM(oi.quantity), 0) as units_ordered,
          COALESCE(SUM(oi.quantity * oi.unit_price), 0) as ordered_product_sales,
          COALESCE(COUNT(DISTINCT pv.session_id), 0) as sessions,
          COALESCE(SUM(pv.page_views), 0) as page_views,
          COALESCE(AVG(p.buy_box_percentage), 0) as buy_box_percentage,
          CASE WHEN COUNT(DISTINCT pv.session_id) > 0 
            THEN (SUM(oi.quantity)::decimal / COUNT(DISTINCT pv.session_id) * 100) 
            ELSE 0 
          END as unit_session_percentage
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id
        LEFT JOIN product_page_views pv ON p.id = pv.product_id
        WHERE p.user_id = $1
          AND p.marketplace = $2
          AND (o.order_date >= $3 OR o.order_date IS NULL)
          AND (o.order_date <= $4 OR o.order_date IS NULL)
      `;
      
      // Filtrar por nível de ASIN se especificado
      if (asinLevel === 'PARENT') {
        query += ' AND p.parent_asin IS NOT NULL';
      } else if (asinLevel === 'CHILD') {
        query += ' AND p.parent_asin IS NULL';
      }
      
      query += `
        GROUP BY p.id, p.marketplace_product_id, p.parent_asin, p.sku, p.name
        HAVING SUM(oi.quantity) > 0
        ORDER BY ordered_product_sales DESC
        LIMIT 100
      `;
      
      const result = await pool.query(query, [userId, marketplace, start, end]);
      
      const formattedData = result.rows.map(row => ({
        parentAsin: row.parent_asin || row.asin,
        childAsin: row.asin,
        sku: row.sku,
        productName: row.name,
        sales: {
          orderedProductSales: {
            amount: parseFloat(row.ordered_product_sales),
            currencyCode: 'BRL'
          },
          unitsOrdered: parseInt(row.units_ordered)
        },
        traffic: {
          pageViews: parseInt(row.page_views),
          sessions: parseInt(row.sessions),
          buyBoxPercentage: parseFloat(row.buy_box_percentage),
          unitSessionPercentage: parseFloat(row.unit_session_percentage)
        }
      }));
      
      res.json({
        salesAndTrafficByAsin: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          marketplaceId: marketplace === 'amazon' ? 'A2Q3Y263D00KWC' : 'MLB',
          asinLevel,
          data: formattedData
        }
      });
    }
    
  } catch (error) {
    console.error('Error fetching aggregated metrics:', error);
    res.status(500).json({ error: 'Error fetching aggregated metrics', details: error.message });
  }
});

module.exports = router;