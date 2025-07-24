const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const secureLogger = require('../../utils/secureLogger');

// GET /api/products/summary - Endpoint principal do dashboard
router.get('/', async (req, res) => {
  try {
    const tenantId = req.userId; // Vem do middleware de autenticação
    const { 
      dateRange = 'today', 
      marketplace = 'all', 
      orderType = 'all',
      search = '',
      limit = 100 
    } = req.query;

    // Determinar filtro de data
    let dateFilter = '';
    let dateParams = [];
    let paramIndex = 2; // tenant_id é $1

    if (dateRange !== 'all-time') {
      const startDate = getStartDateFromFilter(dateRange);
      dateFilter = `AND (dp.last_sale_date >= $${paramIndex} OR dp.last_sale_date IS NULL)`;
      dateParams.push(startDate);
      paramIndex++;
    }

    // Filtro de marketplace
    let marketplaceFilter = '';
    if (marketplace !== 'all') {
      marketplaceFilter = `AND dp.marketplace = $${paramIndex}`;
      dateParams.push(marketplace);
      paramIndex++;
    }

    // Filtro de busca
    let searchFilter = '';
    if (search) {
      searchFilter = `AND (dp.name ILIKE $${paramIndex} OR dp.sku ILIKE $${paramIndex} OR dp.marketplace_id ILIKE $${paramIndex})`;
      dateParams.push(`%${search}%`);
      paramIndex++;
    }

    // Query principal - SEMPRE mostra produtos, mesmo com 0 vendas
    const query = `
      SELECT 
        dp.id,
        dp.name,
        dp.sku,
        dp.marketplace_id as asin,
        dp.image_url,
        dp.marketplace,
        dp.brand,
        dp.category,
        dp.total_units_sold,
        dp.total_revenue,
        dp.total_profit,
        dp.roi,
        dp.profit_margin,
        dp.units_variation,
        dp.inventory_quantity,
        dp.last_sale_date,
        dp.synced_at,
        -- Calcular ACOS e Break Even (simulado por enquanto)
        CASE 
          WHEN dp.marketplace = 'amazon' THEN 16.7
          ELSE 20.0
        END as acos,
        CASE 
          WHEN dp.marketplace = 'amazon' THEN 25.0
          ELSE 30.0
        END as break_even
      FROM dashboard_products dp
      WHERE dp.tenant_id = $1
      AND dp.status = 'active'
      ${dateFilter}
      ${marketplaceFilter}
      ${searchFilter}
      ORDER BY dp.total_units_sold DESC, dp.synced_at DESC
      LIMIT $${paramIndex}
    `;

    const params = [tenantId, ...dateParams, limit];
    const result = await pool.query(query, params);

    // Se não houver produtos, verificar se é porque não há sincronização
    if (result.rows.length === 0) {
      const hasAnyProducts = await pool.query(
        'SELECT COUNT(*) as count FROM products WHERE tenant_id = $1',
        [tenantId]
      );

      if (hasAnyProducts.rows[0].count === 0) {
        // Trigger sincronização automática
        try {
          const syncWorker = require('../../../workers/mainSyncWorker');
          syncWorker.triggerSync(tenantId).catch(err => {
            secureLogger.error('Erro ao triggar sync automático', { 
              tenantId, 
              error: err.message 
            });
          });
        } catch (triggerError) {
          // Continuar mesmo se falhar o trigger
        }

        return res.json({
          products: [],
          message: 'sync_needed',
          info: 'Sincronização iniciada automaticamente. Aguarde alguns minutos.'
        });
      }
    }

    // Formatar produtos para o frontend
    const products = result.rows.map(product => ({
      id: `${product.marketplace}_${product.id}`,
      imageUrl: product.image_url || '/placeholder-product.svg',
      marketplace: product.marketplace,
      country: product.marketplace === 'amazon' ? 'US' : 'BR', // Simplificado
      name: product.name || 'Produto sem nome',
      sku: product.sku || product.asin || '',
      units: parseInt(product.total_units_sold) || 0,
      unitsVariation: parseInt(product.units_variation) || 0,
      revenue: parseFloat(product.total_revenue) || 0,
      profit: parseFloat(product.total_profit) || 0,
      roi: parseFloat(product.roi) || 0,
      margin: parseFloat(product.profit_margin) || 0,
      acos: parseFloat(product.acos) || 0,
      breakEven: parseFloat(product.break_even) || 0,
      inventory: parseInt(product.inventory_quantity) || 0,
      lastSale: product.last_sale_date,
      syncedAt: product.synced_at
    }));

    res.json({
      products,
      total: products.length,
      filters: {
        dateRange,
        marketplace,
        orderType,
        search
      },
      lastUpdate: new Date()
    });

  } catch (error) {
    secureLogger.error('Erro ao buscar produtos summary', {
      tenantId: req.userId,
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Erro ao buscar produtos',
      message: error.message
    });
  }
});

function getStartDateFromFilter(dateRange) {
  const now = new Date();
  
  switch (dateRange) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    case 'day-before-yesterday':
      const dayBefore = new Date(now);
      dayBefore.setDate(dayBefore.getDate() - 2);
      return new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate());
    
    case 'this-week':
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      return new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
    
    case 'last-week':
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7 - lastWeek.getDay());
      return new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate());
    
    case 'last-7-days':
      const sevenDays = new Date(now);
      sevenDays.setDate(sevenDays.getDate() - 7);
      return sevenDays;
    
    case 'last-14-days':
      const fourteenDays = new Date(now);
      fourteenDays.setDate(fourteenDays.getDate() - 14);
      return fourteenDays;
    
    case 'this-month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    
    case 'last-month':
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    case 'month-before-last':
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    
    case 'last-30-days':
      const thirtyDays = new Date(now);
      thirtyDays.setDate(thirtyDays.getDate() - 30);
      return thirtyDays;
    
    case 'last-3-months':
      return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    case 'last-6-months':
      return new Date(now.getFullYear(), now.getMonth() - 6, 1);
    
    case 'last-12-months':
      return new Date(now.getFullYear(), now.getMonth() - 12, 1);
    
    case 'year-to-date':
      return new Date(now.getFullYear(), 0, 1);
    
    case 'last-year':
      return new Date(now.getFullYear() - 1, 0, 1);
    
    case 'all-time':
    default:
      return new Date('1970-01-01');
  }
}

module.exports = router;