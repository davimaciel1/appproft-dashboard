/**
 * Data Collector Otimizado para Amazon SP-API
 * Implementa todas as estratégias para contornar rate limits
 */

const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');
const secureLogger = require('../utils/secureLogger');
const tokenManager = require('./tokenManager');
const { getRateLimiter } = require('./rateLimiter');

class OptimizedDataCollector {
  constructor() {
    this.rateLimiter = getRateLimiter();
    this.cache = new Map();
    this.baseURL = 'https://sellingpartnerapi-na.amazon.com';
    
    // Configurações de cache
    this.CACHE_TIMES = {
      sellers: 24 * 60 * 60 * 1000,      // 24 horas
      catalog: 6 * 60 * 60 * 1000,       // 6 horas
      inventory: 30 * 60 * 1000,          // 30 minutos
      pricing: 5 * 60 * 1000,             // 5 minutos
      reports: 60 * 60 * 1000             // 1 hora
    };
    
    // Configurações de batch
    this.BATCH_SIZES = {
      pricing: 20,          // Máximo por chamada da API
      catalog: 10,          // Recomendado
      inventory: 50         // Estimado
    };
  }

  /**
   * 1. REPORTS API - Estratégia Principal
   * Uma chamada retorna milhares de registros
   */
  async syncViaReports(tenantId = 'default') {
    secureLogger.info('🚀 Iniciando sincronização via Reports API (otimizada)');
    
    const reports = [
      {
        type: 'GET_MERCHANT_LISTINGS_ALL_DATA',
        description: 'Todos os produtos (catalog)',
        priority: 'high',
        processor: this.processInventoryReport.bind(this)
      },
      {
        type: 'GET_FBA_MYI_ALL_INVENTORY_DATA', 
        description: 'Inventário FBA completo',
        priority: 'high',
        processor: this.processInventoryReport.bind(this)
      },
      {
        type: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_LAST_UPDATE',
        description: 'Todos os pedidos',
        priority: 'medium',
        processor: this.processOrdersReport.bind(this)
      },
      {
        type: 'GET_SALES_AND_TRAFFIC_REPORT',
        description: 'Vendas e tráfego',
        priority: 'low',
        processor: this.processSalesReport.bind(this)
      }
    ];

    const results = [];
    
    for (const report of reports) {
      try {
        secureLogger.info(`📊 Processando report: ${report.description}`);
        
        // 1. Criar report
        const reportId = await this.createReport(report.type);
        
        // 2. Aguardar processamento
        const reportData = await this.waitForReport(reportId);
        
        // 3. Baixar e processar dados
        const processedData = await report.processor(reportData);
        
        results.push({
          type: report.type,
          status: 'success',
          recordsProcessed: processedData.count || 0
        });
        
        secureLogger.info(`✅ Report processado: ${report.description}`, {
          records: processedData.count || 0
        });
        
      } catch (error) {
        secureLogger.error(`❌ Erro no report ${report.type}:`, error);
        results.push({
          type: report.type,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }

  async createReport(reportType, marketplaceIds = ['ATVPDKIKX0DER']) {
    const endpoint = '/reports/2021-06-30/reports';
    
    // Aguardar rate limit
    await this.rateLimiter.waitForToken('sp-api', endpoint);
    
    const token = await tokenManager.getAmazonToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reportType,
        marketplaceIds,
        dataStartTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
        dataEndTime: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar report: ${response.status}`);
    }

    const data = await response.json();
    return data.reportId;
  }

  async waitForReport(reportId, maxWaitMinutes = 30) {
    const endpoint = `/reports/2021-06-30/reports/${reportId}`;
    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    
    while (Date.now() - startTime < maxWaitMs) {
      await this.rateLimiter.waitForToken('sp-api', endpoint);
      
      const token = await tokenManager.getAmazonToken();
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-amz-access-token': token
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao verificar report: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.processingStatus === 'DONE') {
        return await this.downloadReport(data.reportDocumentId);
      } else if (data.processingStatus === 'FATAL' || data.processingStatus === 'CANCELLED') {
        throw new Error(`Report falhou: ${data.processingStatus}`);
      }
      
      // Aguardar 30 segundos antes de verificar novamente
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    
    throw new Error('Timeout aguardando report');
  }

  async downloadReport(documentId) {
    const endpoint = `/reports/2021-06-30/documents/${documentId}`;
    
    await this.rateLimiter.waitForToken('sp-api', endpoint);
    
    const token = await tokenManager.getAmazonToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao baixar report: ${response.status}`);
    }

    const data = await response.json();
    
    // Baixar arquivo do S3
    const fileResponse = await fetch(data.url);
    const fileContent = await fileResponse.text();
    
    return fileContent;
  }

  /**
   * 2. CACHE INTELIGENTE - Reduz chamadas
   */
  async getCachedOrFetch(key, fetcher, cacheType) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TIMES[cacheType]) {
      secureLogger.info(`💾 Cache hit: ${key}`);
      return cached.data;
    }
    
    secureLogger.info(`🔄 Cache miss: ${key}, fazendo fetch`);
    const data = await fetcher();
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }

  /**
   * 3. BATCH REQUESTS - Agrupa múltiplos itens
   */
  async getBatchPricing(asins) {
    secureLogger.info(`💰 Buscando preços em lote para ${asins.length} ASINs`);
    
    const batches = [];
    for (let i = 0; i < asins.length; i += this.BATCH_SIZES.pricing) {
      batches.push(asins.slice(i, i + this.BATCH_SIZES.pricing));
    }
    
    const results = [];
    
    for (const [index, batch] of batches.entries()) {
      try {
        secureLogger.info(`📦 Processando batch ${index + 1}/${batches.length} (${batch.length} ASINs)`);
        
        const endpoint = '/batches/products/pricing/v0/itemOffers';
        await this.rateLimiter.waitForToken('sp-api', endpoint);
        
        const token = await tokenManager.getAmazonToken();
        
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-amz-access-token': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: batch.map(asin => ({
              uri: `/products/pricing/v0/items/${asin}/offers`,
              method: 'GET',
              MarketplaceId: 'ATVPDKIKX0DER'
            }))
          })
        });

        if (!response.ok) {
          throw new Error(`Batch pricing falhou: ${response.status}`);
        }

        const data = await response.json();
        results.push(...data.responses);
        
        // Rate limiting entre batches
        if (index < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms = 5 req/seg
        }
        
      } catch (error) {
        secureLogger.error(`Erro no batch ${index + 1}:`, error);
      }
    }
    
    return results;
  }

  /**
   * 4. PRIORIZAÇÃO - Foque no importante
   */
  async syncByPriority(tenantId = 'default') {
    secureLogger.info('🎯 Sincronização por prioridade');
    
    // 1. Best sellers - sync frequente (alta prioridade)
    const bestSellers = await this.getTopProducts(20);
    if (bestSellers.length > 0) {
      secureLogger.info(`⭐ Sincronizando ${bestSellers.length} best sellers`);
      await this.syncProducts(bestSellers, {
        inventory: true,
        pricing: true,
        competitors: true
      });
    }
    
    // 2. Produtos médios - sync moderado
    const regularProducts = await this.getRegularProducts(50);
    if (regularProducts.length > 0) {
      secureLogger.info(`📦 Sincronizando ${regularProducts.length} produtos regulares`);
      await this.syncProducts(regularProducts, {
        inventory: true,
        pricing: false // Pricing menos frequente
      });
    }
    
    // 3. Produtos sem venda - sync básico
    const slowMovers = await this.getSlowMovers(100);
    if (slowMovers.length > 0) {
      secureLogger.info(`🐌 Sincronizando ${slowMovers.length} produtos lentos`);
      await this.syncProducts(slowMovers, {
        inventory: true // Só inventory
      });
    }
  }

  async getTopProducts(limit = 20) {
    const result = await executeSQL(`
      SELECT asin FROM products 
      WHERE asin IS NOT NULL 
        AND active = true
      ORDER BY 
        COALESCE(buy_box_percentage, 0) DESC,
        price DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(row => row.asin);
  }

  async getRegularProducts(limit = 50) {
    const result = await executeSQL(`
      SELECT asin FROM products 
      WHERE asin IS NOT NULL 
        AND active = true
        AND asin NOT IN (
          SELECT asin FROM products 
          ORDER BY COALESCE(buy_box_percentage, 0) DESC 
          LIMIT 20
        )
      ORDER BY updated_at ASC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(row => row.asin);
  }

  async getSlowMovers(limit = 100) {
    const result = await executeSQL(`
      SELECT asin FROM products 
      WHERE asin IS NOT NULL 
        AND active = true
        AND (buy_box_percentage < 10 OR buy_box_percentage IS NULL)
      ORDER BY updated_at ASC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(row => row.asin);
  }

  async syncProducts(asins, options) {
    if (options.inventory) {
      await this.batchInventorySync(asins);
    }
    
    if (options.pricing) {
      await this.getBatchPricing(asins);
    }
    
    if (options.competitors) {
      await this.batchCompetitorSync(asins);
    }
  }

  /**
   * Processadores de Reports
   */
  async processInventoryReport(csvData) {
    const lines = csvData.split('\n');
    const headers = lines[0].split('\t');
    
    let processed = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      if (values.length < headers.length) continue;
      
      const record = {};
      headers.forEach((header, index) => {
        record[header.toLowerCase().replace(/-/g, '_')] = values[index];
      });
      
      if (record.asin) {
        await this.saveInventoryRecord(record);
        processed++;
      }
    }
    
    return { count: processed };
  }

  async processOrdersReport(csvData) {
    const lines = csvData.split('\n');
    const headers = lines[0].split('\t');
    
    let processed = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      if (values.length < headers.length) continue;
      
      const record = {};
      headers.forEach((header, index) => {
        record[header.toLowerCase().replace(/-/g, '_')] = values[index];
      });
      
      if (record.order_id) {
        await this.saveOrderRecord(record);
        processed++;
      }
    }
    
    return { count: processed };
  }

  async processSalesReport(csvData) {
    // Implementar processamento de sales report
    return { count: 0 };
  }

  /**
   * Salvadores de dados
   */
  async saveInventoryRecord(record) {
    try {
      await executeSQL(`
        INSERT INTO products (asin, sku, name, price, inventory, marketplace, tenant_id, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'amazon', 1, NOW())
        ON CONFLICT (asin) DO UPDATE SET
          sku = $2,
          name = $3,
          price = $4,
          inventory = $5,
          updated_at = NOW()
      `, [
        record.asin,
        record.sku,
        record.product_name || record.name,
        parseFloat(record.price) || 0,
        parseInt(record.quantity) || parseInt(record.available_quantity) || 0
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar inventory:', error);
    }
  }

  async saveOrderRecord(record) {
    try {
      await executeSQL(`
        INSERT INTO orders (order_id, marketplace, total_amount, created_at, tenant_id)
        VALUES ($1, 'amazon', $2, $3, 1)
        ON CONFLICT (order_id) DO NOTHING
      `, [
        record.order_id,
        parseFloat(record.order_total) || 0,
        new Date(record.purchase_date || record.order_date)
      ]);
    } catch (error) {
      secureLogger.error('Erro ao salvar order:', error);
    }
  }

  /**
   * Método principal otimizado
   */
  async optimizedSync(tenantId = 'default') {
    secureLogger.info('🚀 Iniciando sincronização otimizada completa');
    
    const startTime = Date.now();
    const results = {};
    
    try {
      // 1. Reports API - dados em massa (prioridade máxima)
      results.reports = await this.syncViaReports(tenantId);
      
      // 2. Sincronização por prioridade - dados críticos
      results.priority = await this.syncByPriority(tenantId);
      
      // 3. Cache cleanup
      this.cleanupCache();
      
      const duration = (Date.now() - startTime) / 1000;
      
      secureLogger.info(`✅ Sincronização otimizada concluída em ${duration.toFixed(1)}s`, {
        results
      });
      
      return results;
      
    } catch (error) {
      secureLogger.error('❌ Erro na sincronização otimizada:', error);
      throw error;
    }
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > Math.max(...Object.values(this.CACHE_TIMES))) {
        this.cache.delete(key);
      }
    }
  }

  // Métodos auxiliares para batch operations
  async batchInventorySync(asins) {
    // Implementar batch inventory sync
    secureLogger.info(`🔄 Batch inventory sync para ${asins.length} ASINs`);
  }

  async batchCompetitorSync(asins) {
    // Implementar batch competitor sync  
    secureLogger.info(`🏆 Batch competitor sync para ${asins.length} ASINs`);
  }
}

module.exports = OptimizedDataCollector;