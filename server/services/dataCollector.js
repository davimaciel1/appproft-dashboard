/**
 * Data Collector Principal
 * Coleta todos os dados possíveis das APIs Amazon e Mercado Livre
 */

const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');
const secureLogger = require('../utils/secureLogger');
const tokenManager = require('./tokenManager');
const { getRateLimiter } = require('./rateLimiter');
const AmazonService = require('./amazonService');
const CompetitorPricingService = require('./amazon/competitorPricingService');

class DataCollector {
  constructor() {
    this.rateLimiter = getRateLimiter();
    this.amazonService = new AmazonService();
    this.competitorService = new CompetitorPricingService(this.amazonService, {
      query: executeSQL,
      connect: () => ({ 
        query: executeSQL,
        release: () => {}
      })
    });
  }
  
  /**
   * Coleta completa de dados para um tenant
   */
  async collectAllData(tenantId = 'default') {
    secureLogger.info('🚀 Iniciando coleta completa de dados', { tenantId });
    
    const startTime = Date.now();
    const results = {
      orders: { success: 0, errors: 0 },
      inventory: { success: 0, errors: 0 },
      pricing: { success: 0, errors: 0 },
      competitors: { success: 0, errors: 0 },
      advertising: { success: 0, errors: 0 },
      catalog: { success: 0, errors: 0 }
    };
    
    try {
      // 1. Coletar Orders
      await this.collectOrders(tenantId, results.orders);
      
      // 2. Coletar Inventory
      await this.collectInventory(tenantId, results.inventory);
      
      // 3. Coletar Pricing e Competitors
      await this.collectPricingAndCompetitors(tenantId, results.pricing, results.competitors);
      
      // 4. Coletar Catalog Info
      await this.collectCatalogInfo(tenantId, results.catalog);
      
      // 5. Coletar Advertising Metrics
      await this.collectAdvertisingMetrics(tenantId, results.advertising);
      
      // 6. Gerar métricas agregadas
      await this.generateAggregatedMetrics(tenantId);
      
      const duration = (Date.now() - startTime) / 1000;
      
      // Registrar no log de sincronização
      await this.logSyncJob(tenantId, 'complete', 'completed', results, duration);
      
      secureLogger.info('✅ Coleta completa finalizada', {
        tenantId,
        duration: `${duration.toFixed(1)}s`,
        results
      });
      
      return results;
      
    } catch (error) {
      secureLogger.error('❌ Erro na coleta completa', {
        tenantId,
        error: error.message
      });
      
      await this.logSyncJob(tenantId, 'complete', 'failed', results, 0, error.message);
      throw error;
    }
  }
  
  /**
   * Coleta de Orders com dados completos
   */
  async collectOrders(tenantId, stats) {
    secureLogger.info('📦 Coletando orders...', { tenantId });
    
    try {
      const token = await tokenManager.getAmazonToken();
      
      // Definir período de coleta (últimos 7 dias)
      const createdAfter = new Date();
      createdAfter.setDate(createdAfter.getDate() - 7);
      
      // Endpoint de orders
      const endpoint = `/orders/v0/orders`;
      const params = new URLSearchParams({
        MarketplaceIds: process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC',
        CreatedAfter: createdAfter.toISOString(),
        MaxResultsPerPage: 100
      });
      
      let nextToken = null;
      let totalOrders = 0;
      
      do {
        // Aguardar rate limit
        await this.rateLimiter.waitForToken('sp-api', endpoint, tenantId);
        
        const url = `https://sellingpartnerapi-na.amazon.com${endpoint}?${params}`;
        if (nextToken) {
          params.set('NextToken', nextToken);
        }
        
        const response = await fetch(url, {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Orders API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Processar cada order
        for (const order of data.payload.Orders || []) {
          try {
            await this.saveOrder(order, tenantId);
            stats.success++;
            totalOrders++;
          } catch (error) {
            stats.errors++;
            secureLogger.error('Erro ao salvar order', {
              orderId: order.AmazonOrderId,
              error: error.message
            });
          }
        }
        
        nextToken = data.payload.NextToken;
        
      } while (nextToken);
      
      secureLogger.info(`✅ Orders coletados: ${totalOrders}`, { tenantId });
      
    } catch (error) {
      secureLogger.error('Erro na coleta de orders', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Salva order no banco de dados
   */
  async saveOrder(orderData, tenantId) {
    const sql = `
      INSERT INTO orders (
        tenant_id, marketplace, order_id, purchase_date, order_status,
        order_total, currency_code, number_of_items_shipped, number_of_items_unshipped,
        payment_method, is_business_order, is_prime, is_replacement_order,
        ship_service_level, marketplace_id, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (tenant_id, marketplace, order_id) DO UPDATE SET
        order_status = EXCLUDED.order_status,
        number_of_items_shipped = EXCLUDED.number_of_items_shipped,
        number_of_items_unshipped = EXCLUDED.number_of_items_unshipped,
        updated_at = NOW()
    `;
    
    await executeSQL(sql, [
      tenantId,
      'amazon',
      orderData.AmazonOrderId,
      orderData.PurchaseDate,
      orderData.OrderStatus,
      orderData.OrderTotal?.Amount || 0,
      orderData.OrderTotal?.CurrencyCode || 'BRL',
      orderData.NumberOfItemsShipped || 0,
      orderData.NumberOfItemsUnshipped || 0,
      orderData.PaymentMethod || 'Other',
      orderData.IsBusinessOrder || false,
      orderData.IsPrime || false,
      orderData.IsReplacementOrder || false,
      orderData.ShipmentServiceLevelCategory,
      orderData.MarketplaceId,
      JSON.stringify(orderData)
    ]);
    
    // Buscar e salvar items do order
    await this.collectOrderItems(orderData.AmazonOrderId, tenantId);
  }
  
  /**
   * Coleta items de um order
   */
  async collectOrderItems(orderId, tenantId) {
    try {
      const token = await tokenManager.getAmazonToken();
      const endpoint = `/orders/v0/orders/${orderId}/items`;
      
      await this.rateLimiter.waitForToken('sp-api', endpoint, tenantId);
      
      const response = await fetch(`https://sellingpartnerapi-na.amazon.com${endpoint}`, {
        headers: {
          'x-amz-access-token': token,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Order items API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      for (const item of data.payload.OrderItems || []) {
        await this.saveOrderItem(orderId, item, tenantId);
      }
      
    } catch (error) {
      secureLogger.error('Erro ao coletar items do order', {
        orderId,
        error: error.message
      });
    }
  }
  
  /**
   * Salva item do order
   */
  async saveOrderItem(orderId, itemData, tenantId) {
    const sql = `
      INSERT INTO order_items (
        tenant_id, order_id, order_item_id, asin, sku, title,
        quantity_ordered, quantity_shipped, item_price, item_tax,
        shipping_price, shipping_tax, shipping_discount, promotion_discount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (tenant_id, order_id, order_item_id) DO UPDATE SET
        quantity_shipped = EXCLUDED.quantity_shipped,
        updated_at = NOW()
    `;
    
    await executeSQL(sql, [
      tenantId,
      orderId,
      itemData.OrderItemId,
      itemData.ASIN,
      itemData.SellerSKU,
      itemData.Title,
      itemData.QuantityOrdered || 0,
      itemData.QuantityShipped || 0,
      itemData.ItemPrice?.Amount || 0,
      itemData.ItemTax?.Amount || 0,
      itemData.ShippingPrice?.Amount || 0,
      itemData.ShippingTax?.Amount || 0,
      itemData.ShippingDiscount?.Amount || 0,
      itemData.PromotionDiscount?.Amount || 0
    ]);
  }
  
  /**
   * Coleta de Inventory FBA
   */
  async collectInventory(tenantId, stats) {
    secureLogger.info('📊 Coletando inventory FBA...', { tenantId });
    
    try {
      const token = await tokenManager.getAmazonToken();
      const endpoint = '/fba/inventory/v1/summaries';
      
      const params = new URLSearchParams({
        granularityType: 'Marketplace',
        granularityId: process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC',
        marketplaceIds: process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC'
      });
      
      let nextToken = null;
      
      do {
        await this.rateLimiter.waitForToken('sp-api', endpoint, tenantId);
        
        const url = `https://sellingpartnerapi-na.amazon.com${endpoint}?${params}`;
        if (nextToken) {
          params.set('nextToken', nextToken);
        }
        
        const response = await fetch(url, {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Inventory API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Processar inventory items
        for (const item of data.payload.inventorySummaries || []) {
          try {
            await this.saveInventorySnapshot(item, tenantId);
            stats.success++;
          } catch (error) {
            stats.errors++;
            secureLogger.error('Erro ao salvar inventory', {
              asin: item.asin,
              error: error.message
            });
          }
        }
        
        nextToken = data.payload.nextToken;
        
      } while (nextToken);
      
      secureLogger.info(`✅ Inventory coletado`, { tenantId });
      
    } catch (error) {
      secureLogger.error('Erro na coleta de inventory', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Salva snapshot de inventory
   */
  async saveInventorySnapshot(inventoryData, tenantId) {
    // Calcular days of supply
    const totalQuantity = inventoryData.totalQuantity || 0;
    const reservedQuantity = (inventoryData.reservedQuantity?.totalReservedQuantity || 0);
    const availableQuantity = totalQuantity - reservedQuantity;
    
    // Buscar velocidade de vendas para calcular days of supply
    const velocityResult = await executeSQL(`
      SELECT AVG(units_ordered) as daily_velocity
      FROM sales_metrics
      WHERE asin = $1 AND date >= CURRENT_DATE - 30
    `, [inventoryData.asin]);
    
    const dailyVelocity = velocityResult.rows[0]?.daily_velocity || 1;
    const daysOfSupply = Math.floor(availableQuantity / dailyVelocity);
    
    // Determinar status
    let alertStatus = 'healthy';
    if (daysOfSupply < 7) alertStatus = 'critical';
    else if (daysOfSupply < 14) alertStatus = 'low';
    else if (daysOfSupply > 90) alertStatus = 'overstock';
    
    const sql = `
      INSERT INTO inventory_snapshots (
        asin, sku, snapshot_time, tenant_id,
        fulfillable_quantity, total_quantity, inbound_working_quantity,
        inbound_shipped_quantity, inbound_receiving_quantity,
        reserved_quantity, researching_quantity, unfulfillable_quantity,
        days_of_supply, alert_status
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;
    
    await executeSQL(sql, [
      inventoryData.asin,
      inventoryData.fnSku,
      tenantId,
      inventoryData.inventoryDetails?.fulfillableQuantity || 0,
      inventoryData.totalQuantity || 0,
      inventoryData.inventoryDetails?.inboundWorkingQuantity || 0,
      inventoryData.inventoryDetails?.inboundShippedQuantity || 0,
      inventoryData.inventoryDetails?.inboundReceivingQuantity || 0,
      inventoryData.reservedQuantity?.totalReservedQuantity || 0,
      inventoryData.researchingQuantity?.totalResearchingQuantity || 0,
      inventoryData.unfulfillableQuantity?.totalUnfulfillableQuantity || 0,
      daysOfSupply,
      alertStatus
    ]);
  }
  
  /**
   * Coleta de Pricing e Competitors
   */
  async collectPricingAndCompetitors(tenantId, pricingStats, competitorStats) {
    secureLogger.info('💰 Coletando pricing e competidores...', { tenantId });
    
    try {
      // Buscar ASINs ativos
      const products = await executeSQL(`
        SELECT DISTINCT asin 
        FROM products 
        WHERE tenant_id = $1 
        AND marketplace = 'amazon' 
        AND asin IS NOT NULL
        LIMIT 50
      `, [tenantId]);
      
      for (const product of products.rows) {
        try {
          // Usar o serviço de competidores existente
          const competitorData = await this.competitorService.getCompetitivePricing(
            product.asin,
            process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC'
          );
          
          if (competitorData.offers && competitorData.offers.length > 0) {
            competitorStats.success++;
            pricingStats.success++;
          }
          
          // Aguardar para respeitar rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          competitorStats.errors++;
          pricingStats.errors++;
          secureLogger.error('Erro ao coletar pricing', {
            asin: product.asin,
            error: error.message
          });
        }
      }
      
      secureLogger.info(`✅ Pricing e competidores coletados`, { tenantId });
      
    } catch (error) {
      secureLogger.error('Erro na coleta de pricing', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Coleta informações do catálogo
   */
  async collectCatalogInfo(tenantId, stats) {
    secureLogger.info('📚 Coletando informações do catálogo...', { tenantId });
    
    try {
      const token = await tokenManager.getAmazonToken();
      
      // Buscar ASINs sem informações completas
      const products = await executeSQL(`
        SELECT asin 
        FROM products 
        WHERE tenant_id = $1 
        AND marketplace = 'amazon'
        AND (brand IS NULL OR category IS NULL OR weight_kg IS NULL)
        LIMIT 20
      `, [tenantId]);
      
      for (const product of products.rows) {
        try {
          const endpoint = `/catalog/v2022-04-01/items/${product.asin}`;
          
          await this.rateLimiter.waitForToken('sp-api', endpoint, tenantId);
          
          const params = new URLSearchParams({
            marketplaceIds: process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC',
            includedData: 'attributes,dimensions,identifiers,images,productTypes,salesRanks,summaries'
          });
          
          const response = await fetch(
            `https://sellingpartnerapi-na.amazon.com${endpoint}?${params}`,
            {
              headers: {
                'x-amz-access-token': token,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (!response.ok) {
            throw new Error(`Catalog API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          await this.saveCatalogInfo(product.asin, data, tenantId);
          stats.success++;
          
        } catch (error) {
          stats.errors++;
          secureLogger.error('Erro ao coletar catalog info', {
            asin: product.asin,
            error: error.message
          });
        }
      }
      
      secureLogger.info(`✅ Catalog info coletado`, { tenantId });
      
    } catch (error) {
      secureLogger.error('Erro na coleta de catalog', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Salva informações do catálogo
   */
  async saveCatalogInfo(asin, catalogData, tenantId) {
    const attributes = catalogData.attributes || {};
    const dimensions = attributes.itemDimensions || {};
    const salesRanks = catalogData.salesRanks || [];
    
    // Extrair sales rank principal
    let salesRank = null;
    let salesRankCategory = null;
    
    if (salesRanks.length > 0) {
      const mainRank = salesRanks[0].displayGroupRanks?.[0];
      if (mainRank) {
        salesRank = mainRank.rank;
        salesRankCategory = mainRank.title;
      }
    }
    
    // Calcular volume
    const length = dimensions.length?.value || 0;
    const width = dimensions.width?.value || 0;
    const height = dimensions.height?.value || 0;
    const volume = length * width * height;
    
    const sql = `
      INSERT INTO products_ml (
        asin, sku, title, brand, category, subcategory,
        price, weight_kg, volume_cm3, package_quantity,
        is_fba, is_prime, is_hazmat, is_oversized,
        sales_rank, sales_rank_category, review_count, review_rating,
        tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (asin) DO UPDATE SET
        title = EXCLUDED.title,
        brand = EXCLUDED.brand,
        category = EXCLUDED.category,
        weight_kg = EXCLUDED.weight_kg,
        volume_cm3 = EXCLUDED.volume_cm3,
        sales_rank = EXCLUDED.sales_rank,
        sales_rank_category = EXCLUDED.sales_rank_category,
        updated_at = NOW()
    `;
    
    await executeSQL(sql, [
      asin,
      attributes.genericKeywords?.[0] || asin, // SKU fallback
      attributes.itemName?.[0]?.value || attributes.title?.[0]?.value,
      attributes.brandName?.[0]?.value,
      attributes.productCategory?.[0]?.value,
      attributes.productSubcategory?.[0]?.value,
      attributes.listPrice?.[0]?.value || 0,
      dimensions.weight?.value || 0,
      volume,
      attributes.numberOfItems?.[0]?.value || 1,
      true, // is_fba (assumindo que estamos rastreando produtos FBA)
      attributes.isPrimeEligible || false,
      attributes.isHazmat || false,
      volume > 150000, // is_oversized (>150000 cm³)
      salesRank,
      salesRankCategory,
      attributes.customerReviews?.count || 0,
      attributes.customerReviews?.rating || 0,
      tenantId
    ]);
  }
  
  /**
   * Coleta métricas de advertising (simplificado)
   */
  async collectAdvertisingMetrics(tenantId, stats) {
    secureLogger.info('📈 Coletando métricas de advertising...', { tenantId });
    
    // TODO: Implementar quando tiver acesso à Advertising API
    // Por enquanto, apenas registrar que foi tentado
    
    secureLogger.info('⚠️ Advertising API não implementada ainda', { tenantId });
  }
  
  /**
   * Gera métricas agregadas
   */
  async generateAggregatedMetrics(tenantId) {
    secureLogger.info('📊 Gerando métricas agregadas...', { tenantId });
    
    try {
      // Agregar vendas por dia/hora
      await executeSQL(`
        INSERT INTO sales_metrics (asin, date, hour, tenant_id,
          units_ordered, ordered_product_sales, sessions, page_views,
          unit_session_percentage, buy_box_percentage)
        SELECT 
          oi.asin,
          DATE(o.purchase_date) as date,
          EXTRACT(HOUR FROM o.purchase_date) as hour,
          o.tenant_id,
          SUM(oi.quantity_ordered) as units_ordered,
          SUM(oi.item_price) as ordered_product_sales,
          0 as sessions, -- Será preenchido por outro processo
          0 as page_views,
          0 as unit_session_percentage,
          0 as buy_box_percentage
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id AND o.tenant_id = oi.tenant_id
        WHERE o.tenant_id = $1
        AND o.purchase_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY oi.asin, DATE(o.purchase_date), EXTRACT(HOUR FROM o.purchase_date), o.tenant_id
        ON CONFLICT (asin, date, hour) DO UPDATE SET
          units_ordered = EXCLUDED.units_ordered,
          ordered_product_sales = EXCLUDED.ordered_product_sales
      `, [tenantId]);
      
      secureLogger.info('✅ Métricas agregadas geradas', { tenantId });
      
    } catch (error) {
      secureLogger.error('Erro ao gerar métricas agregadas', {
        tenantId,
        error: error.message
      });
    }
  }
  
  /**
   * Registra job de sincronização
   */
  async logSyncJob(tenantId, jobType, status, stats, duration, errorMessage = null) {
    const totalProcessed = Object.values(stats).reduce((sum, stat) => sum + stat.success + stat.errors, 0);
    const totalSuccess = Object.values(stats).reduce((sum, stat) => sum + stat.success, 0);
    const totalErrors = Object.values(stats).reduce((sum, stat) => sum + stat.errors, 0);
    
    await executeSQL(`
      INSERT INTO sync_jobs (
        tenant_id, job_type, status, started_at, completed_at,
        records_processed, records_created, records_updated, records_failed,
        error_message, error_details
      ) VALUES ($1, $2, $3, NOW() - INTERVAL '${duration} seconds', NOW(), $4, $5, $6, $7, $8, $9)
    `, [
      tenantId,
      jobType,
      status,
      totalProcessed,
      totalSuccess,
      0, // records_updated (não estamos rastreando separadamente)
      totalErrors,
      errorMessage,
      JSON.stringify(stats)
    ]);
  }
}

// Singleton
let instance = null;

module.exports = {
  getDataCollector: () => {
    if (!instance) {
      instance = new DataCollector();
    }
    return instance;
  },
  
  DataCollector
};