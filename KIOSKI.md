🎯 PLANO DE IMPLEMENTAÇÃO DO DATA KIOSK NA ESTRUTURA ATUAL
📋 ANÁLISE DA SITUAÇÃO ATUAL
✅ O QUE JÁ TEMOS:

TokenManager funcionando (/services/tokenManager.js)
AmazonService com SP-API (/services/amazonService.js)
Rotas corretas no backend (/api/dashboard-local/)
Estrutura multi-tenant implementada
PostgreSQL configurado e acessível

❌ PROBLEMAS IDENTIFICADOS:

Frontend chama rota errada (/api/dashboard/ em vez de /api/dashboard-local/)
Sem Data Kiosk implementado
Dashboard mostra dados vazios ou mockados

🔧 IMPLEMENTAÇÃO DO DATA KIOSK - PASSO A PASSO
PASSO 1: CORRIGIR O FRONTEND
typescript// client/src/services/api.ts
// MUDAR DE:
export const dashboardAPI = {
  getProducts: () => api.get('/api/dashboard/products'),
  getMetrics: () => api.get('/api/dashboard/metrics'),
}

// PARA:
export const dashboardAPI = {
  getProducts: () => api.get('/api/dashboard-local/products'),
  getMetrics: () => api.get('/api/dashboard-local/metrics'),
  getAggregatedMetrics: () => api.get('/api/dashboard-local/aggregated-metrics')
}
PASSO 2: CRIAR ESTRUTURA DO DATA KIOSK
bash# Criar novos arquivos na estrutura existente:
server/
├── services/
│   ├── dataKiosk/              # NOVO
│   │   ├── dataKioskClient.js
│   │   ├── dataKioskQueries.js
│   │   └── dataKioskProcessor.js
│   └── amazonService.js        # ATUALIZAR
PASSO 3: IMPLEMENTAR DATA KIOSK CLIENT
javascript// server/services/dataKiosk/dataKioskClient.js

const axios = require('axios');
const tokenManager = require('../tokenManager');

class DataKioskClient {
  constructor() {
    this.baseUrl = 'https://sellingpartnerapi-na.amazon.com';
    this.apiVersion = '2023-11-15';
  }

  async createQuery(query, tenantId) {
    const token = await tokenManager.getAmazonToken(tenantId);
    
    const response = await axios.post(
      `${this.baseUrl}/dataKiosk/${this.apiVersion}/queries`,
      { query },
      {
        headers: {
          'x-amz-access-token': token,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.queryId;
  }

  async checkQueryStatus(queryId, tenantId) {
    const token = await tokenManager.getAmazonToken(tenantId);
    
    const response = await axios.get(
      `${this.baseUrl}/dataKiosk/${this.apiVersion}/queries/${queryId}`,
      {
        headers: { 'x-amz-access-token': token }
      }
    );

    return response.data;
  }

  async getDocument(documentId, tenantId) {
    const token = await tokenManager.getAmazonToken(tenantId);
    
    const response = await axios.get(
      `${this.baseUrl}/dataKiosk/${this.apiVersion}/documents/${documentId}`,
      {
        headers: { 'x-amz-access-token': token }
      }
    );

    return response.data.documentUrl;
  }

  async downloadResults(documentUrl) {
    const response = await axios.get(documentUrl);
    return response.data;
  }
}

module.exports = new DataKioskClient();
PASSO 4: CRIAR QUERIES GRAPHQL
javascript// server/services/dataKiosk/dataKioskQueries.js

class DataKioskQueries {
  static getDailyMetricsQuery(startDate, endDate, marketplaceId) {
    return `
      query DailyMetrics {
        analytics_salesAndTraffic_2024_04_24 {
          salesAndTrafficByDate(
            startDate: "${startDate}"
            endDate: "${endDate}"
            aggregateBy: DAY
            marketplaceIds: ["${marketplaceId}"]
          ) {
            startDate
            endDate
            marketplaceId
            sales {
              orderedProductSales { amount currencyCode }
              unitsOrdered
              totalOrderItems
              averageSellingPrice { amount currencyCode }
              unitsRefunded
              refundRate
            }
            traffic {
              pageViews
              sessions
              buyBoxPercentage
              unitSessionPercentage
            }
          }
        }
      }
    `;
  }

  static getAsinMetricsQuery(startDate, endDate, marketplaceId) {
    return `
      query AsinMetrics {
        analytics_salesAndTraffic_2024_04_24 {
          salesAndTrafficByAsin(
            startDate: "${startDate}"
            endDate: "${endDate}"
            aggregateBy: CHILD
            marketplaceIds: ["${marketplaceId}"]
          ) {
            startDate
            endDate
            marketplaceId
            parentAsin
            childAsin
            sku
            sales {
              orderedProductSales { amount currencyCode }
              unitsOrdered
              totalOrderItems
            }
            traffic {
              pageViews
              sessions
              buyBoxPercentage
              unitSessionPercentage
            }
          }
        }
      }
    `;
  }
}

module.exports = DataKioskQueries;
PASSO 5: CRIAR PROCESSADOR DE DADOS
javascript// server/services/dataKiosk/dataKioskProcessor.js

const pool = require('../../db/pool');

class DataKioskProcessor {
  static async processDailyMetrics(data, tenantId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const metrics = data.data.analytics_salesAndTraffic_2024_04_24.salesAndTrafficByDate;

      for (const dayData of metrics) {
        // Inserir ou atualizar métricas diárias
        await client.query(`
          INSERT INTO daily_metrics (
            tenant_id, date, marketplace,
            ordered_product_sales, units_ordered, total_order_items,
            page_views, sessions, buy_box_percentage, unit_session_percentage
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (tenant_id, date, marketplace) 
          DO UPDATE SET
            ordered_product_sales = EXCLUDED.ordered_product_sales,
            units_ordered = EXCLUDED.units_ordered,
            total_order_items = EXCLUDED.total_order_items,
            page_views = EXCLUDED.page_views,
            sessions = EXCLUDED.sessions,
            buy_box_percentage = EXCLUDED.buy_box_percentage,
            unit_session_percentage = EXCLUDED.unit_session_percentage,
            updated_at = NOW()
        `, [
          tenantId,
          dayData.startDate,
          dayData.marketplaceId,
          dayData.sales.orderedProductSales?.amount || 0,
          dayData.sales.unitsOrdered || 0,
          dayData.sales.totalOrderItems || 0,
          dayData.traffic.pageViews || 0,
          dayData.traffic.sessions || 0,
          dayData.traffic.buyBoxPercentage || 0,
          dayData.traffic.unitSessionPercentage || 0
        ]);
      }

      await client.query('COMMIT');
      return { success: true, processed: metrics.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async processAsinMetrics(data, tenantId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const metrics = data.data.analytics_salesAndTraffic_2024_04_24.salesAndTrafficByAsin;

      for (const asinData of metrics) {
        // Buscar produto correspondente
        const productResult = await client.query(
          'SELECT id FROM products WHERE (sku = $1 OR asin = $2) AND tenant_id = $3',
          [asinData.sku, asinData.childAsin, tenantId]
        );

        if (productResult.rows[0]) {
          const productId = productResult.rows[0].id;

          // Atualizar métricas do produto
          await client.query(`
            UPDATE products SET
              last_units_sold = $1,
              last_revenue = $2,
              buy_box_percentage = $3,
              conversion_rate = $4,
              last_sync_at = NOW()
            WHERE id = $5
          `, [
            asinData.sales.unitsOrdered || 0,
            asinData.sales.orderedProductSales?.amount || 0,
            asinData.traffic.buyBoxPercentage || 0,
            asinData.traffic.unitSessionPercentage || 0,
            productId
          ]);
        }
      }

      await client.query('COMMIT');
      return { success: true, processed: metrics.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = DataKioskProcessor;
PASSO 6: ATUALIZAR AMAZON SERVICE
javascript// server/services/amazonService.js - ADICIONAR no final

const dataKioskClient = require('./dataKiosk/dataKioskClient');
const DataKioskQueries = require('./dataKiosk/dataKioskQueries');
const DataKioskProcessor = require('./dataKiosk/dataKioskProcessor');

// Adicionar métodos ao AmazonService existente
class AmazonService {
  // ... código existente ...

  async syncDataKioskMetrics(tenantId) {
    console.log('📊 Iniciando sincronização Data Kiosk...');
    
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const marketplaceId = process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC';

      // 1. Sincronizar métricas diárias
      const dailyQuery = DataKioskQueries.getDailyMetricsQuery(startDate, endDate, marketplaceId);
      const dailyQueryId = await dataKioskClient.createQuery(dailyQuery, tenantId);
      
      // Aguardar processamento
      let status;
      do {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos
        status = await dataKioskClient.checkQueryStatus(dailyQueryId, tenantId);
      } while (status.status === 'IN_PROGRESS');

      if (status.status === 'COMPLETED') {
        const documentUrl = await dataKioskClient.getDocument(status.documentId, tenantId);
        const results = await dataKioskClient.downloadResults(documentUrl);
        await DataKioskProcessor.processDailyMetrics(results, tenantId);
      }

      // 2. Sincronizar métricas por ASIN
      const asinQuery = DataKioskQueries.getAsinMetricsQuery(startDate, endDate, marketplaceId);
      const asinQueryId = await dataKioskClient.createQuery(asinQuery, tenantId);
      
      // Repetir processo para ASIN
      // ... (mesmo processo acima)

      console.log('✅ Sincronização Data Kiosk concluída');
    } catch (error) {
      console.error('❌ Erro na sincronização Data Kiosk:', error);
      throw error;
    }
  }
}
PASSO 7: CRIAR NOVA MIGRATION
sql-- server/db/migrations/add_data_kiosk_tables.sql

-- Adicionar campos nas tabelas existentes
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_units_sold INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_revenue DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS buy_box_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0;

-- Criar tabela de métricas diárias
CREATE TABLE IF NOT EXISTS daily_metrics (
    id SERIAL PRIMARY KEY,
    tenant_id UUID,
    date DATE NOT NULL,
    marketplace VARCHAR(50) NOT NULL,
    ordered_product_sales DECIMAL(10,2) DEFAULT 0,
    units_ordered INTEGER DEFAULT 0,
    total_order_items INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    buy_box_percentage DECIMAL(5,2) DEFAULT 0,
    unit_session_percentage DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, date, marketplace)
);

-- Criar índices
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_tenant ON daily_metrics(tenant_id);
PASSO 8: ATUALIZAR SCRIPT DE SINCRONIZAÇÃO
javascript// scripts/syncAmazonFullData.js - ADICIONAR

// Após sincronizar pedidos e catálogo
console.log('\n📊 Sincronizando métricas do Data Kiosk...');
await amazonService.syncDataKioskMetrics(tenantId);
PASSO 9: ATUALIZAR ROTA DO DASHBOARD LOCAL
javascript// server/routes/dashboardLocal.js - MODIFICAR getMetrics

router.get('/metrics', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const today = new Date().toISOString().split('T')[0];

    // Buscar métricas do Data Kiosk
    const metricsResult = await pool.query(`
      SELECT 
        COALESCE(dm.ordered_product_sales, 0) as todays_sales,
        COALESCE(dm.total_order_items, 0) as orders,
        COALESCE(dm.units_ordered, 0) as units_sold,
        COALESCE(dm.buy_box_percentage, 0) as buy_box_percentage,
        COALESCE(dm.unit_session_percentage, 0) as conversion_rate,
        0 as acos, -- TODO: Implementar com dados de publicidade
        COALESCE(dm.ordered_product_sales * 0.3, 0) as net_profit -- Estimativa 30%
      FROM daily_metrics dm
      WHERE dm.tenant_id = $1 
        AND dm.date = $2
        AND dm.marketplace = 'amazon'
    `, [tenantId, today]);

    const metrics = metricsResult.rows[0] || {
      todays_sales: 0,
      orders: 0,
      units_sold: 0,
      acos: 0,
      net_profit: 0,
      buy_box_percentage: 0,
      conversion_rate: 0
    };

    res.json(metrics);
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});
PASSO 10: CRIAR COMANDO DE TESTE
bash# scripts/testDataKiosk.js

const amazonService = require('../services/amazonService');

async function testDataKiosk() {
  const tenantId = process.argv[2];
  
  if (!tenantId) {
    console.error('Use: node scripts/testDataKiosk.js <tenant_id>');
    process.exit(1);
  }

  try {
    console.log('🧪 Testando Data Kiosk para tenant:', tenantId);
    await amazonService.syncDataKioskMetrics(tenantId);
    console.log('✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
  
  process.exit(0);
}

testDataKiosk();
📋 COMANDOS PARA O CLAUDE CODE EXECUTAR
bash# 1. Criar estrutura de pastas
mkdir -p server/services/dataKiosk

# 2. Implementar arquivos na ordem
# (criar cada arquivo conforme especificado acima)

# 3. Executar migration
psql $DATABASE_URL < server/db/migrations/add_data_kiosk_tables.sql

# 4. Atualizar frontend
# Modificar client/src/services/api.ts

# 5. Testar Data Kiosk
node scripts/testDataKiosk.js <tenant_id>

# 6. Verificar dados
psql $DATABASE_URL -c "SELECT * FROM daily_metrics ORDER BY date DESC LIMIT 5;"

# 7. Reiniciar servidor
npm run dev

# 8. Testar dashboard
# Acessar http://localhost:3000/dashboard
✅ RESULTADO ESPERADO
Após implementação:

Dashboard mostrará dados REAIS do Data Kiosk
Cards mostrarão métricas agregadas diárias
Tabela mostrará produtos com Buy Box % e conversão
Sincronização incluirá Data Kiosk + SP-API

🚨 PONTOS CRÍTICOS

MUDAR as rotas no frontend para /api/dashboard-local/
EXECUTAR migration antes de testar
AGUARDAR processamento das queries (podem demorar minutos)
VERIFICAR se tenant tem permissão "analytics" na Amazon

Claude Code, siga estes passos na ordem para integrar o Data Kiosk na estrutura existente!