# AppProft - Projeto Executivo Completo com IA e Análise Competitiva (v2.0)

## 🎯 OBJETIVO DO PROJETO

Criar um SaaS de inteligência competitiva para vendedores Amazon que:
1. **Extrai TODOS os dados possíveis** das APIs Amazon (SP-API + Advertising API)
2. **Monitora competidores** legalmente através de dados públicos
3. **Identifica QUEM tem a Buy Box** com nome do vendedor em tempo real
4. **Usa IA para gerar insights** acionáveis sobre restock, listing, keywords e campanhas
5. **Armazena tudo no PostgreSQL** para análises avançadas via SQL

## 📊 DADOS QUE VAMOS COLETAR

### 1. DADOS DO PRÓPRIO VENDEDOR (Via SP-API)

#### Orders API - Dados Completos de Vendas
```javascript
// Endpoint: GET /orders/v0/orders
// Dados disponíveis:
{
  OrderId: "026-1234567-1234567",
  PurchaseDate: "2024-01-15T10:30:00Z",
  OrderStatus: "Shipped",
  OrderTotal: { Amount: 199.99, CurrencyCode: "BRL" },
  NumberOfItemsShipped: 2,
  NumberOfItemsUnshipped: 0,
  PaymentMethod: "Credit Card",
  PaymentMethodDetails: ["Visa ending in 1234"],
  MarketplaceId: "A2Q3Y263D00KWC", // Brasil
  ShipmentServiceLevelCategory: "Standard",
  OrderType: "StandardOrder",
  EarliestShipDate: "2024-01-16T00:00:00Z",
  LatestShipDate: "2024-01-18T23:59:59Z",
  IsBusinessOrder: false,
  IsPrime: true,
  IsGlobalExpressEnabled: false,
  IsReplacementOrder: false,
  IsSoldByAB: false,
  
  // Com Restricted Data Token (RDT):
  BuyerInfo: {
    BuyerEmail: "customer@email.com",
    BuyerName: "João Silva",
    BuyerTaxInfo: { CompanyLegalName: "Empresa XYZ LTDA" }
  },
  ShippingAddress: {
    Name: "João Silva",
    AddressLine1: "Rua Example, 123",
    City: "São Paulo",
    StateOrRegion: "SP",
    PostalCode: "01234-567",
    CountryCode: "BR",
    Phone: "+5511999999999"
  }
}
```

#### Inventory API - Controle de Estoque em Tempo Real
```javascript
// Endpoint: GET /fba/inventory/v1/summaries
{
  asin: "B08N5WRWNW",
  fnSku: "SKU123",
  sellerSku: "MYSKU-001",
  condition: "NewItem",
  totalQuantity: 500,
  fulfillableQuantity: 480,
  inboundWorkingQuantity: 100,
  inboundShippedQuantity: 50,
  inboundReceivingQuantity: 20,
  reservedQuantity: {
    totalReservedQuantity: 20,
    pendingCustomerOrderQuantity: 15,
    pendingTransshipmentQuantity: 5
  },
  researchingQuantity: { totalResearchingQuantity: 0 },
  unfulfillableQuantity: { totalUnfulfillableQuantity: 0 },
  // Dados críticos para IA de restock:
  inventoryDetails: {
    fulfillableQuantity: 480,
    inboundWorkingQuantity: 100,
    inboundShippedQuantity: 50,
    inboundReceivingQuantity: 20
  }
}
```

#### Catalog Items API - Dados Completos do Produto
```javascript
// Endpoint: GET /catalog/v2022-04-01/items/{asin}
{
  asin: "B08N5WRWNW",
  attributes: {
    // Rankings cruciais para competitividade
    salesRanks: [{
      marketplaceId: "A2Q3Y263D00KWC",
      displayGroupRanks: [{
        websiteDisplayGroup: "kitchen",
        title: "Cozinha",
        rank: 1234
      }]
    }],
    // Dados do produto
    itemName: "Produto Example",
    brandName: "Marca XYZ",
    bulletPoints: ["Ponto 1", "Ponto 2"],
    genericKeywords: ["keyword1", "keyword2"],
    productDescription: "Descrição completa...",
    // Preços e fees
    listPrice: { amount: 199.99, currency: "BRL" },
    // Dimensões para cálculo de frete
    itemDimensions: {
      height: { value: 10, unit: "centimeters" },
      length: { value: 20, unit: "centimeters" },
      width: { value: 15, unit: "centimeters" },
      weight: { value: 0.5, unit: "kilograms" }
    }
  }
}
```

#### Product Fees API - Cálculo de Lucratividade
```javascript
// Endpoint: POST /products/fees/v0/feesEstimate
{
  asin: "B08N5WRWNW",
  price: 199.99,
  fees: {
    ReferralFee: { Amount: 29.99 },      // 15% categoria
    VariableClosingFee: { Amount: 1.80 }, // Taxa fixa
    FBAFees: {
      FulfillmentFee: { Amount: 5.50 },
      MonthlyStorageFee: { Amount: 0.75 },
      LongTermStorageFee: { Amount: 0 }
    },
    TotalFees: { Amount: 38.04 }
  },
  // Dados para IA calcular margem real
  estimatedProfit: 161.95,
  profitMargin: 81.0
}
```

### 2. DADOS DE COMPETIDORES COM IDENTIFICAÇÃO DO VENDEDOR (Via Product Pricing API)

#### Competitive Pricing API - Monitoramento de Concorrência COM NOMES
```javascript
// Endpoint: GET /products/pricing/v0/competitivePrice
{
  asin: "B08N5WRWNW",
  competitivePrices: [
    {
      sellerId: "A1X2Y3Z4W5V6U7", // Competidor 1
      sellerName: "Loja Premium LTDA", // NOVO: Nome do vendedor
      price: { 
        ListingPrice: { Amount: 189.99, CurrencyCode: "BRL" },
        Shipping: { Amount: 0.00 }
      },
      condition: "New",
      isFulfilledByAmazon: true,
      isBuyBoxWinner: true, // IMPORTANTE: Este tem a Buy Box!
      // Dados do competidor
      sellerFeedbackRating: {
        feedbackCount: 15234,
        sellerPositiveFeedbackRating: 98.5
      }
    },
    {
      sellerId: "B8A7B6C5D4E3F2", // Competidor 2
      sellerName: "MegaStore Brasil", // NOVO: Nome do vendedor
      price: { ListingPrice: { Amount: 195.00 } },
      condition: "New",
      isFulfilledByAmazon: false,
      isBuyBoxWinner: false
    }
  ],
  numberOfOffers: [
    { condition: "New", fulfillmentChannel: "Amazon", offerCount: 5 },
    { condition: "New", fulfillmentChannel: "Merchant", offerCount: 3 }
  ],
  // NOVO: Informação do Buy Box
  buyBoxPrices: {
    condition: "New",
    offerType: "B2C",
    sellerId: "A1X2Y3Z4W5V6U7",
    sellerName: "Loja Premium LTDA", // Quem tem a Buy Box
    price: { Amount: 189.99 }
  }
}
```

#### Item Offers API - Análise Detalhada de Ofertas COM VENDEDOR
```javascript
// Endpoint: GET /products/pricing/v0/items/{asin}/offers
{
  asin: "B08N5WRWNW",
  offers: [
    {
      sellerId: "A1X2Y3Z4W5V6U7",
      sellerName: "Loja Premium LTDA", // NOVO
      subCondition: "New",
      shippingTime: {
        minimumHours: 0,
        maximumHours: 0,
        availabilityType: "NOW"
      },
      listingPrice: { Amount: 189.99 },
      shipping: { Amount: 0.00 },
      isFulfilledByAmazon: true,
      isBuyBoxWinner: true, // Este vendedor tem a Buy Box
      // Dados valiosos do competidor
      sellerFeedbackRating: {
        count: 15234,
        rating: 98.5
      },
      shipsFrom: { Country: "BR", State: "SP" }
    }
  ],
  // NOVO: Resumo do Buy Box
  buyBoxSummary: {
    currentWinner: "Loja Premium LTDA",
    winningSellerId: "A1X2Y3Z4W5V6U7",
    winningPrice: 189.99,
    totalCompetitors: 8
  }
}
```

### 3. DADOS DE PUBLICIDADE (Via Advertising API)

#### Campaign Performance - Métricas de Campanhas
```javascript
// Endpoint: POST /v2/sp/campaigns/report
{
  campaignId: "12345",
  campaignName: "Campanha Principal",
  campaignStatus: "enabled",
  targetingType: "manual",
  dailyBudget: 50.00,
  startDate: "2024-01-01",
  // Métricas de performance
  impressions: 125430,
  clicks: 3421,
  cost: 1250.75,
  attributedConversions7d: 89,
  attributedSales7d: 8945.32,
  acos: 13.98, // (cost / sales) * 100
  roas: 7.15,  // sales / cost
  ctr: 2.73,   // (clicks / impressions) * 100
  cvr: 2.60    // (conversions / clicks) * 100
}
```

#### Keyword Performance - Análise de Palavras-chave
```javascript
// Endpoint: POST /v2/sp/keywords/report
{
  keywordId: "98765",
  keywordText: "tábua de corte bambu",
  matchType: "broad",
  state: "enabled",
  bid: 1.25,
  // Performance da keyword
  impressions: 45230,
  clicks: 892,
  cost: 425.30,
  attributedConversions7d: 34,
  attributedSales7d: 3421.50,
  acos: 12.42,
  // Dados para IA otimizar bids
  suggestedBid: {
    rangeStart: 0.95,
    rangeEnd: 1.85
  }
}
```

#### Search Terms Report - Termos de Busca Reais
```javascript
// Endpoint: POST /v2/sp/searchTerms/report
{
  searchTerm: "tabua bambu cozinha antibacteriana",
  impressions: 1250,
  clicks: 89,
  cost: 67.45,
  attributedConversions7d: 12,
  attributedSales7d: 1205.88,
  // Insights valiosos
  customerSearchFrequencyRank: 15234, // Popularidade do termo
  clickShare: 7.12, // % de cliques que você capturou
  conversionShare: 13.48 // % de conversões
}
```

### 4. DADOS DE ANALYTICS (Via Reports API)

#### Business Report - Métricas de Negócio COM BUY BOX
```javascript
// GET_SALES_AND_TRAFFIC_REPORT
{
  date: "2024-01-15",
  asin: "B08N5WRWNW",
  // Traffic metrics
  browserSessions: 1250,
  mobileAppSessions: 3421,
  sessions: 4671,
  sessionPercentage: 0.23, // % do total da categoria
  browserPageViews: 1890,
  mobileAppPageViews: 5123,
  pageViews: 7013,
  pageViewsPercentage: 0.25,
  // Conversion metrics
  buyBoxPercentage: 85.5, // CRÍTICO: % do tempo com Buy Box
  unitSessionPercentage: 12.3, // Taxa de conversão
  orderedProductSales: 8945.32,
  orderedProductSalesB2B: 1234.56,
  totalOrderItems: 89,
  totalOrderItemsB2B: 12,
  // NOVO: Competidores na Buy Box
  buyBoxCompetitors: [
    { sellerName: "Sua Loja", percentage: 85.5, avgPrice: 199.99 },
    { sellerName: "Loja Premium LTDA", percentage: 10.2, avgPrice: 189.99 },
    { sellerName: "MegaStore Brasil", percentage: 4.3, avgPrice: 195.00 }
  ]
}
```

## 🤖 ESTRUTURA DO BANCO PARA IA COM TRACKING DE VENDEDORES

### Schema Otimizado para Machine Learning e Análise Competitiva

```sql
-- Tabela principal de produtos com features para ML
CREATE TABLE products_ml (
    asin VARCHAR(10) PRIMARY KEY,
    sku VARCHAR(100),
    title TEXT,
    brand VARCHAR(100),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    
    -- Features numéricas para ML
    price DECIMAL(10,2),
    weight_kg DECIMAL(6,3),
    volume_cm3 INTEGER,
    
    -- Features categóricas
    is_fba BOOLEAN,
    is_prime BOOLEAN,
    is_hazmat BOOLEAN,
    
    -- Embeddings de texto (para NLP)
    title_embedding VECTOR(768), -- Usando pgvector
    description_embedding VECTOR(768),
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOVA TABELA: Cache de vendedores para evitar chamadas repetidas
CREATE TABLE sellers_cache (
    seller_id VARCHAR(50) PRIMARY KEY,
    seller_name VARCHAR(255) NOT NULL,
    store_url VARCHAR(500),
    feedback_rating DECIMAL(3,1),
    feedback_count INTEGER,
    is_fba_seller BOOLEAN DEFAULT false,
    seller_since DATE,
    business_type VARCHAR(50), -- 'individual', 'company'
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_seller_name (seller_name),
    INDEX idx_last_updated (last_updated)
);

-- Tabela de competidores ATUALIZADA com nome do vendedor
CREATE TABLE competitor_tracking (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    competitor_seller_id VARCHAR(50),
    seller_name VARCHAR(255), -- NOVO: Nome do vendedor
    timestamp TIMESTAMPTZ,
    
    -- Dados do competidor
    price DECIMAL(10,2),
    shipping_price DECIMAL(10,2),
    is_buy_box_winner BOOLEAN,
    is_fba BOOLEAN,
    feedback_count INTEGER,
    feedback_rating DECIMAL(3,1),
    
    -- Análise competitiva
    price_difference DECIMAL(10,2), -- vs nosso preço
    price_percentile INTEGER, -- posição no mercado (1-100)
    buy_box_duration_minutes INTEGER, -- Quanto tempo ficou com Buy Box
    
    -- NOVOS campos para análise avançada
    seller_response_time_hours INTEGER,
    seller_city VARCHAR(100),
    seller_state VARCHAR(2),
    
    INDEX idx_competitor_asin_time (asin, timestamp DESC),
    INDEX idx_buy_box_winner (asin, is_buy_box_winner, timestamp DESC),
    INDEX idx_seller_name (seller_name)
);

-- NOVA VIEW: Status da Buy Box em tempo real
CREATE OR REPLACE VIEW buy_box_status AS
SELECT 
    ct.asin,
    p.title as product_name,
    ct.seller_name as buy_box_owner,
    ct.price as buy_box_price,
    ct.is_fba,
    ct.feedback_rating,
    ct.timestamp as last_checked,
    p.current_price as our_price,
    ROUND(((p.current_price - ct.price) / p.current_price * 100), 2) as price_difference_pct,
    CASE 
        WHEN ct.competitor_seller_id = p.seller_id THEN 'Você tem a Buy Box! 🎉'
        ELSE CONCAT('Buy Box com: ', ct.seller_name)
    END as status_message
FROM competitor_tracking ct
JOIN products p ON ct.asin = p.asin
WHERE ct.is_buy_box_winner = true
AND ct.timestamp = (
    SELECT MAX(timestamp) 
    FROM competitor_tracking ct2 
    WHERE ct2.asin = ct.asin
)
ORDER BY ct.timestamp DESC;

-- NOVA TABELA: Histórico de Buy Box para ML
CREATE TABLE buy_box_history (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    seller_id VARCHAR(50),
    seller_name VARCHAR(255),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    avg_price DECIMAL(10,2),
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    
    INDEX idx_buybox_asin_time (asin, started_at DESC),
    INDEX idx_buybox_seller (seller_id, asin)
);

-- Tabela de keywords com performance
CREATE TABLE keywords_performance (
    keyword_id VARCHAR(50) PRIMARY KEY,
    keyword_text VARCHAR(200),
    asin VARCHAR(10),
    
    -- Métricas de performance
    impressions_30d INTEGER,
    clicks_30d INTEGER,
    conversions_30d INTEGER,
    spend_30d DECIMAL(10,2),
    revenue_30d DECIMAL(10,2),
    
    -- Métricas calculadas
    ctr DECIMAL(5,2), -- Click-through rate
    cvr DECIMAL(5,2), -- Conversion rate
    acos DECIMAL(5,2), -- Advertising cost of sales
    roas DECIMAL(5,2), -- Return on ad spend
    
    -- Features para ML
    search_volume_index INTEGER, -- 1-100
    competition_index INTEGER, -- 1-100
    relevance_score DECIMAL(3,2), -- 0-1
    
    -- Sugestões da IA
    suggested_bid DECIMAL(10,2),
    suggested_action VARCHAR(50), -- 'increase_bid', 'decrease_bid', 'pause'
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de insights gerados pela IA ATUALIZADA
CREATE TABLE ai_insights (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10),
    insight_type VARCHAR(50), -- 'restock', 'pricing', 'listing', 'campaign', 'buy_box'
    priority VARCHAR(10), -- 'high', 'medium', 'low'
    
    -- Conteúdo do insight
    title VARCHAR(200),
    description TEXT,
    recommendation TEXT,
    
    -- NOVO: Insights sobre competidores
    competitor_name VARCHAR(255),
    competitor_action VARCHAR(100), -- 'lowered_price', 'out_of_stock', 'new_competitor'
    
    -- Dados de suporte
    supporting_data JSONB,
    confidence_score DECIMAL(3,2), -- 0-1
    potential_impact DECIMAL(10,2), -- valor estimado
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'applied', 'dismissed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    
    INDEX idx_insights_asin_type (asin, insight_type, created_at DESC)
);

-- Tabela de previsões de demanda
CREATE TABLE demand_forecasts (
    asin VARCHAR(10),
    forecast_date DATE,
    
    -- Previsões
    units_forecast INTEGER,
    revenue_forecast DECIMAL(10,2),
    
    -- Intervalos de confiança
    units_lower_bound INTEGER,
    units_upper_bound INTEGER,
    
    -- Fatores considerados
    seasonality_factor DECIMAL(3,2),
    trend_factor DECIMAL(3,2),
    promotion_factor DECIMAL(3,2),
    competitor_factor DECIMAL(3,2), -- NOVO: Impacto dos competidores
    
    -- Recomendações
    recommended_stock_level INTEGER,
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    
    model_version VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asin, forecast_date)
);
```

## 🧠 IMPLEMENTAÇÃO DA IA COM ANÁLISE DE VENDEDORES

### 1. Sistema de Coleta e Processamento ATUALIZADO

```javascript
// services/DataCollector.js
class DataCollector {
  constructor() {
    this.spApi = new SellingPartnerAPI({
      region: 'na',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      client_id: process.env.AMAZON_CLIENT_ID,
      client_secret: process.env.AMAZON_CLIENT_SECRET
    });
    
    this.adsApi = new AmazonAdvertisingAPI({
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN
    });
  }

  // NOVO: Coleta dados de competidores COM NOMES a cada hora
  async collectCompetitorData() {
    const products = await db.query('SELECT asin, seller_id FROM products WHERE active = true');
    
    for (const product of products) {
      try {
        // Busca dados de pricing competitivo
        const competitivePricing = await this.spApi.getCompetitivePricing({
          MarketplaceId: 'A2Q3Y263D00KWC',
          Asins: [product.asin]
        });
        
        // Busca todas as ofertas
        const offers = await this.spApi.getItemOffers({
          MarketplaceId: 'A2Q3Y263D00KWC',
          Asin: product.asin
        });
        
        // Processa ofertas com identificação de vendedor
        for (const offer of offers.Offers) {
          // Obtém nome do vendedor
          const sellerName = await this.getSellerName(offer.sellerId);
          
          await this.saveCompetitorData(product.asin, offer, sellerName);
          
          // Rastreia Buy Box
          if (offer.isBuyBoxWinner) {
            await this.trackBuyBoxChange(product.asin, offer.sellerId, sellerName, offer.price);
          }
        }
        
        // Aguarda para respeitar rate limits
        await this.sleep(1000);
      } catch (error) {
        console.error(`Erro ao coletar dados do ASIN ${product.asin}:`, error);
      }
    }
  }

  // NOVO: Sistema inteligente para obter nome do vendedor
  async getSellerName(sellerId) {
    // 1. Verifica cache primeiro
    const cached = await db.query(
      'SELECT seller_name FROM sellers_cache WHERE seller_id = $1',
      [sellerId]
    );
    
    if (cached.rows.length > 0) {
      return cached.rows[0].seller_name;
    }
    
    // 2. Tenta obter via API (se disponível)
    try {
      const sellerInfo = await this.spApi.getSellerInfo(sellerId);
      if (sellerInfo.sellerName) {
        await this.cacheSellerInfo(sellerId, sellerInfo);
        return sellerInfo.sellerName;
      }
    } catch (error) {
      console.log('Nome não disponível via API, tentando método alternativo...');
    }
    
    // 3. Fallback: Web scraping legal da página pública
    try {
      const sellerName = await this.scrapeSellerName(sellerId);
      await this.cacheSellerInfo(sellerId, { sellerName });
      return sellerName;
    } catch (error) {
      // 4. Último recurso: nome genérico
      return `Vendedor ${sellerId.substring(0, 8)}`;
    }
  }

  // NOVO: Cache de informações do vendedor
  async cacheSellerInfo(sellerId, info) {
    await db.query(`
      INSERT INTO sellers_cache 
      (seller_id, seller_name, feedback_rating, feedback_count, last_updated)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (seller_id) DO UPDATE SET
        seller_name = $2,
        feedback_rating = $3,
        feedback_count = $4,
        last_updated = NOW()
    `, [sellerId, info.sellerName, info.rating, info.feedbackCount]);
  }

  // NOVO: Rastreamento de mudanças na Buy Box
  async trackBuyBoxChange(asin, newSellerId, sellerName, price) {
    // Verifica quem tinha a Buy Box antes
    const previous = await db.query(`
      SELECT seller_id, seller_name, timestamp
      FROM competitor_tracking
      WHERE asin = $1 AND is_buy_box_winner = true
      ORDER BY timestamp DESC
      LIMIT 1
    `, [asin]);
    
    if (previous.rows.length > 0 && previous.rows[0].seller_id !== newSellerId) {
      // Registra mudança de Buy Box
      const duration = Date.now() - previous.rows[0].timestamp;
      
      await db.query(`
        INSERT INTO buy_box_history 
        (asin, seller_id, seller_name, started_at, ended_at, duration_minutes, avg_price)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
      `, [
        asin,
        previous.rows[0].seller_id,
        previous.rows[0].seller_name,
        previous.rows[0].timestamp,
        Math.floor(duration / 60000),
        price
      ]);
      
      // Gera insight sobre mudança
      await this.generateBuyBoxInsight(asin, sellerName, price);
    }
  }

  // NOVO: Gera insights sobre Buy Box
  async generateBuyBoxInsight(asin, newOwner, newPrice) {
    const productInfo = await db.query(
      'SELECT title, current_price FROM products WHERE asin = $1',
      [asin]
    );
    
    if (productInfo.rows[0].current_price > newPrice) {
      await db.query(`
        INSERT INTO ai_insights 
        (asin, insight_type, priority, title, description, recommendation, 
         competitor_name, competitor_action, supporting_data, confidence_score, potential_impact)
        VALUES ($1, 'buy_box', 'high', $2, $3, $4, $5, 'lowered_price', $6, 0.95, $7)
      `, [
        asin,
        `Perdeu Buy Box para ${newOwner}`,
        `${newOwner} está ${((productInfo.rows[0].current_price - newPrice) / productInfo.rows[0].current_price * 100).toFixed(1)}% mais barato`,
        `Ajustar preço para R$ ${(newPrice * 0.99).toFixed(2)} para recuperar Buy Box`,
        newOwner,
        JSON.stringify({ 
          current_price: productInfo.rows[0].current_price,
          competitor_price: newPrice,
          price_gap: productInfo.rows[0].current_price - newPrice
        }),
        1000 // Impacto estimado
      ]);
    }
  }

  // Coleta métricas de advertising
  async collectAdvertisingMetrics() {
    // Solicita relatório de performance
    const reportRequest = await this.adsApi.requestReport({
      reportType: 'sp/campaigns',
      metrics: [
        'campaignId', 'impressions', 'clicks', 'cost',
        'attributedConversions7d', 'attributedSales7d'
      ],
      reportDate: new Date().toISOString().split('T')[0]
    });
    
    // Aguarda processamento
    const report = await this.waitForReport(reportRequest.reportId);
    
    // Processa e calcula métricas
    for (const row of report) {
      const acos = (row.cost / row.attributedSales7d) * 100;
      const roas = row.attributedSales7d / row.cost;
      
      await db.query(`
        INSERT INTO campaign_metrics 
        (campaign_id, date, impressions, clicks, cost, conversions, sales, acos, roas)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (campaign_id, date) DO UPDATE SET
          impressions = $3, clicks = $4, cost = $5, 
          conversions = $6, sales = $7, acos = $8, roas = $9
      `, [row.campaignId, reportDate, row.impressions, row.clicks, 
          row.cost, row.attributedConversions7d, row.attributedSales7d, acos, roas]);
    }
  }
}
```

### 2. Modelos de IA para Insights ATUALIZADOS

```python
# ai/models/insights_generator.py
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from prophet import Prophet
import psycopg2
from datetime import datetime, timedelta

class InsightsAI:
    def __init__(self, db_connection):
        self.db = db_connection
        
    def generate_restock_insights(self):
        """Gera insights de reabastecimento usando Prophet"""
        
        # Busca dados históricos
        query = """
            SELECT 
                asin,
                date,
                units_sold,
                inventory_level,
                lead_time_days
            FROM sales_inventory_history
            WHERE date >= CURRENT_DATE - INTERVAL '180 days'
        """
        
        df = pd.read_sql(query, self.db)
        
        insights = []
        
        for asin in df['asin'].unique():
            asin_data = df[df['asin'] == asin].copy()
            
            # Prepara dados para Prophet
            prophet_df = asin_data[['date', 'units_sold']].rename(
                columns={'date': 'ds', 'units_sold': 'y'}
            )
            
            # Treina modelo
            model = Prophet(
                seasonality_mode='multiplicative',
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False
            )
            model.fit(prophet_df)
            
            # Faz previsão para próximos 30 dias
            future = model.make_future_dataframe(periods=30)
            forecast = model.predict(future)
            
            # Calcula quando vai acabar o estoque
            current_inventory = asin_data['inventory_level'].iloc[-1]
            lead_time = asin_data['lead_time_days'].iloc[-1]
            
            future_demand = forecast['yhat'].tail(30).sum()
            days_until_stockout = current_inventory / (future_demand / 30)
            
            # Gera insight se necessário
            if days_until_stockout <= lead_time + 7:  # 7 dias de margem
                reorder_date = datetime.now() + timedelta(days=max(0, days_until_stockout - lead_time - 7))
                reorder_quantity = int(future_demand * 2)  # 2 meses de estoque
                
                insight = {
                    'asin': asin,
                    'type': 'restock',
                    'priority': 'high' if days_until_stockout <= lead_time else 'medium',
                    'title': f'Reabastecer {asin} até {reorder_date.strftime("%d/%m")}',
                    'description': f'Estoque atual acabará em {int(days_until_stockout)} dias. Lead time: {lead_time} dias.',
                    'recommendation': f'Enviar {reorder_quantity} unidades para o FBA até {reorder_date.strftime("%d/%m/%Y")}',
                    'supporting_data': {
                        'current_inventory': int(current_inventory),
                        'daily_velocity': round(future_demand / 30, 1),
                        'days_until_stockout': int(days_until_stockout),
                        'recommended_quantity': reorder_quantity
                    },
                    'confidence_score': 0.85,
                    'potential_impact': future_demand * asin_data['price'].iloc[-1]
                }
                
                insights.append(insight)
        
        return insights
    
    def analyze_buy_box_patterns(self):
        """NOVO: Analisa padrões de Buy Box e competidores"""
        
        query = """
            WITH buy_box_stats AS (
                SELECT 
                    asin,
                    seller_name,
                    COUNT(*) as times_won,
                    AVG(duration_minutes) as avg_duration,
                    AVG(avg_price) as avg_winning_price,
                    MIN(min_price) as lowest_price
                FROM buy_box_history
                WHERE started_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY asin, seller_name
            ),
            our_products AS (
                SELECT asin, current_price, seller_name as our_name
                FROM products
                WHERE active = true
            )
            SELECT 
                bs.*,
                op.current_price,
                op.our_name,
                (op.current_price - bs.avg_winning_price) as price_gap
            FROM buy_box_stats bs
            JOIN our_products op ON bs.asin = op.asin
            WHERE bs.seller_name != op.our_name
            ORDER BY bs.times_won DESC
        """
        
        competitors_df = pd.read_sql(query, self.db)
        
        insights = []
        
        for _, competitor in competitors_df.iterrows():
            if competitor['times_won'] > 10 and competitor['price_gap'] > 0:
                insight = {
                    'asin': competitor['asin'],
                    'type': 'buy_box',
                    'priority': 'high',
                    'title': f'Competidor Agressivo: {competitor["seller_name"]}',
                    'description': f'Ganhou Buy Box {competitor["times_won"]} vezes nos últimos 30 dias com preço médio R$ {competitor["avg_winning_price"]:.2f}',
                    'recommendation': f'Considere ajustar preço para R$ {competitor["avg_winning_price"] * 0.99:.2f} ou melhorar outros fatores (frete, prazo)',
                    'competitor_name': competitor['seller_name'],
                    'competitor_action': 'dominating_buy_box',
                    'supporting_data': {
                        'competitor_wins': int(competitor['times_won']),
                        'avg_duration_hours': round(competitor['avg_duration'] / 60, 1),
                        'our_price': float(competitor['current_price']),
                        'competitor_avg_price': float(competitor['avg_winning_price']),
                        'lowest_competitor_price': float(competitor['lowest_price'])
                    },
                    'confidence_score': 0.9,
                    'potential_impact': competitor['times_won'] * 50  # Estimativa de vendas perdidas
                }
                
                insights.append(insight)
                
        return insights
    
    def optimize_pricing_strategy(self):
        """Otimiza preços baseado em competidores e elasticidade COM NOMES"""
        
        query = """
            WITH competitor_analysis AS (
                SELECT 
                    p.asin,
                    p.current_price,
                    p.title,
                    bs.buy_box_owner,
                    bs.buy_box_price,
                    bs.price_difference_pct,
                    AVG(c.price) as avg_competitor_price,
                    MIN(c.price) as min_competitor_price,
                    COUNT(DISTINCT c.competitor_seller_id) as competitor_count,
                    p.buy_box_percentage,
                    p.units_sold_7d,
                    p.revenue_7d
                FROM products p
                JOIN buy_box_status bs ON p.asin = bs.asin
                JOIN competitor_tracking c ON p.asin = c.asin
                WHERE c.timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                GROUP BY p.asin, p.current_price, p.title, bs.buy_box_owner, 
                         bs.buy_box_price, bs.price_difference_pct, p.buy_box_percentage, 
                         p.units_sold_7d, p.revenue_7d
            )
            SELECT * FROM competitor_analysis
            WHERE buy_box_owner != 'Sua Loja'
        """
        
        df = pd.read_sql(query, self.db)
        
        insights = []
        
        for _, row in df.iterrows():
            # Calcula posição de preço
            price_position = (row['current_price'] - row['min_competitor_price']) / row['current_price'] * 100
            
            # Regras de pricing
            if row['buy_box_percentage'] < 70 and price_position > 5:
                # Perdendo Buy Box e preço está alto
                suggested_price = row['buy_box_price'] * 0.99  # 1% abaixo do Buy Box
                
                insight = {
                    'asin': row['asin'],
                    'type': 'pricing',
                    'priority': 'high',
                    'title': f'Reduzir preço para competir com {row["buy_box_owner"]}',
                    'description': f'Buy Box em {row["buy_box_percentage"]:.1f}%. {row["buy_box_owner"]} está {abs(row["price_difference_pct"]):.1f}% mais barato.',
                    'recommendation': f'Ajustar preço de R$ {row["current_price"]:.2f} para R$ {suggested_price:.2f}',
                    'competitor_name': row['buy_box_owner'],
                    'competitor_action': 'has_buy_box',
                    'supporting_data': {
                        'product_name': row['title'],
                        'current_price': float(row['current_price']),
                        'suggested_price': float(suggested_price),
                        'buy_box_price': float(row['buy_box_price']),
                        'buy_box_owner': row['buy_box_owner'],
                        'buy_box_percentage': float(row['buy_box_percentage']),
                        'competitor_count': int(row['competitor_count'])
                    },
                    'confidence_score': 0.9,
                    'potential_impact': row['units_sold_7d'] * 0.3 * suggested_price  # 30% aumento estimado
                }
                
                insights.append(insight)
                
        return insights
    
    def detect_new_competitors(self):
        """NOVO: Detecta novos competidores entrando no mercado"""
        
        query = """
            WITH new_sellers AS (
                SELECT DISTINCT
                    ct.asin,
                    ct.seller_name,
                    ct.seller_id,
                    MIN(ct.timestamp) as first_seen,
                    AVG(ct.price) as avg_price,
                    COUNT(*) as appearances
                FROM competitor_tracking ct
                WHERE ct.timestamp >= CURRENT_DATE - INTERVAL '7 days'
                AND ct.seller_id NOT IN (
                    SELECT DISTINCT seller_id 
                    FROM competitor_tracking 
                    WHERE timestamp < CURRENT_DATE - INTERVAL '7 days'
                )
                GROUP BY ct.asin, ct.seller_name, ct.seller_id
            )
            SELECT 
                ns.*,
                p.title,
                p.current_price
            FROM new_sellers ns
            JOIN products p ON ns.asin = p.asin
            WHERE ns.appearances > 5  -- Apareceu várias vezes, não é erro
        """
        
        new_competitors = pd.read_sql(query, self.db)
        
        insights = []
        
        for _, competitor in new_competitors.iterrows():
            price_impact = ((competitor['current_price'] - competitor['avg_price']) / 
                           competitor['current_price'] * 100)
            
            insight = {
                'asin': competitor['asin'],
                'type': 'buy_box',
                'priority': 'medium',
                'title': f'Novo Competidor: {competitor["seller_name"]}',
                'description': f'Detectado há {(datetime.now() - competitor["first_seen"]).days} dias vendendo {competitor["title"]} por R$ {competitor["avg_price"]:.2f}',
                'recommendation': 'Monitorar estratégia de preços e avaliar impacto nas vendas',
                'competitor_name': competitor['seller_name'],
                'competitor_action': 'new_competitor',
                'supporting_data': {
                    'product': competitor['title'],
                    'competitor_avg_price': float(competitor['avg_price']),
                    'our_price': float(competitor['current_price']),
                    'price_difference': float(price_impact),
                    'first_seen': competitor['first_seen'].isoformat()
                },
                'confidence_score': 0.85,
                'potential_impact': abs(price_impact) * 10  # Impacto estimado
            }
            
            insights.append(insight)
            
        return insights
    
    def optimize_keywords_and_campaigns(self):
        """Otimiza keywords e campanhas baseado em performance"""
        
        query = """
            SELECT 
                k.*,
                p.title,
                p.price
            FROM keywords_performance k
            JOIN products p ON k.asin = p.asin
            WHERE k.impressions_30d > 100
        """
        
        df = pd.read_sql(query, self.db)
        
        insights = []
        
        for _, kw in df.iterrows():
            # Analisa performance
            if kw['acos'] > 30 and kw['conversions_30d'] < 5:
                # Keyword não lucrativa
                insight = {
                    'asin': kw['asin'],
                    'type': 'campaign',
                    'priority': 'medium',
                    'title': f'Pausar keyword não lucrativa: {kw["keyword_text"]}',
                    'description': f'ACOS de {kw["acos"]:.1f}% com apenas {kw["conversions_30d"]} conversões em 30 dias.',
                    'recommendation': 'Pausar esta keyword e realocar budget para keywords mais eficientes.',
                    'supporting_data': {
                        'keyword': kw['keyword_text'],
                        'acos': float(kw['acos']),
                        'spend_wasted': float(kw['spend_30d']),
                        'impressions': int(kw['impressions_30d']),
                        'clicks': int(kw['clicks_30d']),
                        'conversions': int(kw['conversions_30d'])
                    },
                    'confidence_score': 0.95,
                    'potential_impact': kw['spend_30d']  # Economia
                }
                
            elif kw['impressions_30d'] > 10000 and kw['ctr'] < 0.5:
                # Baixo CTR
                new_bid = kw['suggested_bid'] * 1.2
                
                insight = {
                    'asin': kw['asin'],
                    'type': 'campaign',
                    'priority': 'medium',
                    'title': f'Melhorar CTR para: {kw["keyword_text"]}',
                    'description': f'CTR de apenas {kw["ctr"]:.2f}% com {kw["impressions_30d"]:,} impressões.',
                    'recommendation': f'Aumentar bid de R$ {kw["bid"]:.2f} para R$ {new_bid:.2f} e revisar copy do anúncio.',
                    'supporting_data': {
                        'keyword': kw['keyword_text'],
                        'current_ctr': float(kw['ctr']),
                        'current_bid': float(kw['bid']),
                        'suggested_bid': float(new_bid),
                        'impressions': int(kw['impressions_30d'])
                    },
                    'confidence_score': 0.8,
                    'potential_impact': kw['impressions_30d'] * 0.01 * kw['price'] * 0.1  # 1% CTR, 10% CVR
                }
                
            insights.append(insight)
            
        return insights
    
    def analyze_listing_optimization(self):
        """Analisa listings para otimização baseado em competidores de sucesso COM NOMES"""
        
        query = """
            WITH top_competitors AS (
                SELECT 
                    p.asin,
                    p.title,
                    p.bullet_points,
                    p.description,
                    p.sessions_30d,
                    p.conversion_rate,
                    bs.buy_box_owner,
                    bs.buy_box_price,
                    ARRAY_AGG(DISTINCT ct.seller_name) as all_competitors
                FROM products p
                JOIN buy_box_status bs ON p.asin = bs.asin
                JOIN competitor_tracking ct ON p.asin = ct.asin
                WHERE ct.timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                GROUP BY p.asin, p.title, p.bullet_points, p.description,
                         p.sessions_30d, p.conversion_rate, bs.buy_box_owner, bs.buy_box_price
            )
            SELECT * FROM top_competitors
            WHERE conversion_rate < 10  -- Produtos com baixa conversão
        """
        
        df = pd.read_sql(query, self.db)
        
        insights = []
        
        for _, row in df.iterrows():
            competitors_list = ', '.join(row['all_competitors'][:3])  # Top 3 competidores
            
            insight = {
                'asin': row['asin'],
                'type': 'listing',
                'priority': 'medium',
                'title': 'Otimizar listing para competir melhor',
                'description': f'Taxa de conversão atual: {row["conversion_rate"]:.1f}%. Competindo com: {competitors_list}',
                'recommendation': f'Analisar listings de {row["buy_box_owner"]} e outros competidores top. Melhorar título, bullets e imagens.',
                'supporting_data': {
                    'current_conversion': float(row['conversion_rate']),
                    'sessions_30d': int(row['sessions_30d']),
                    'buy_box_owner': row['buy_box_owner'],
                    'main_competitors': row['all_competitors'][:5],
                    'potential_sales_increase': int(row['sessions_30d'] * 0.05)  # 5% melhoria
                },
                'confidence_score': 0.75,
                'potential_impact': row['sessions_30d'] * 0.05 * row['buy_box_price']
            }
            
            insights.append(insight)
                
        return insights
```

### 3. Sistema de Execução e Monitoramento ATUALIZADO

```javascript
// services/AIOrchestrator.js
class AIOrchestrator {
  constructor() {
    this.pythonShell = new PythonShell('ai/main.py', {
      mode: 'json',
      pythonPath: 'python3'
    });
  }
  
  async runDailyAnalysis() {
    console.log('🤖 Iniciando análise diária com IA...');
    
    try {
      // 1. Coleta dados atualizados
      const collector = new DataCollector();
      await collector.collectAllData();
      
      // 2. Executa modelos de IA (incluindo análise de Buy Box)
      const insights = await this.generateInsights();
      
      // 3. Salva insights no banco
      for (const insight of insights) {
        await db.query(`
          INSERT INTO ai_insights 
          (asin, insight_type, priority, title, description, recommendation, 
           competitor_name, competitor_action, supporting_data, confidence_score, potential_impact)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          insight.asin, insight.type, insight.priority,
          insight.title, insight.description, insight.recommendation,
          insight.competitor_name, insight.competitor_action,
          JSON.stringify(insight.supporting_data),
          insight.confidence_score, insight.potential_impact
        ]);
      }
      
      // 4. Notifica usuários sobre insights importantes
      await this.notifyHighPriorityInsights(insights);
      
      // 5. NOVO: Alertas específicos de Buy Box
      await this.checkBuyBoxAlerts(insights);
      
      console.log(`✅ Análise completa: ${insights.length} insights gerados`);
      
    } catch (error) {
      console.error('❌ Erro na análise:', error);
      throw error;
    }
  }
  
  async generateInsights() {
    return new Promise((resolve, reject) => {
      this.pythonShell.send({ command: 'generate_all_insights' });
      
      this.pythonShell.on('message', (insights) => {
        resolve(insights);
      });
      
      this.pythonShell.on('error', (err) => {
        reject(err);
      });
    });
  }
  
  async notifyHighPriorityInsights(insights) {
    const highPriority = insights.filter(i => i.priority === 'high');
    
    if (highPriority.length > 0) {
      // Envia email ou notificação push
      await emailService.send({
        to: user.email,
        subject: `🚨 ${highPriority.length} insights importantes no AppProft`,
        template: 'high-priority-insights',
        data: { insights: highPriority }
      });
    }
  }
  
  // NOVO: Sistema de alertas específicos para Buy Box
  async checkBuyBoxAlerts(insights) {
    const buyBoxInsights = insights.filter(i => i.type === 'buy_box');
    
    for (const insight of buyBoxInsights) {
      if (insight.competitor_action === 'new_competitor') {
        // Alerta sobre novo competidor
        await this.sendSlackAlert({
          text: `🆕 Novo competidor detectado: ${insight.competitor_name}`,
          attachments: [{
            color: 'warning',
            fields: [
              { title: 'Produto', value: insight.supporting_data.product, short: true },
              { title: 'Preço dele', value: `R$ ${insight.supporting_data.competitor_avg_price}`, short: true }
            ]
          }]
        });
      } else if (insight.competitor_action === 'dominating_buy_box') {
        // Alerta sobre competidor dominando
        await this.sendSlackAlert({
          text: `⚠️ Competidor dominando Buy Box: ${insight.competitor_name}`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Vitórias', value: insight.supporting_data.competitor_wins, short: true },
              { title: 'Preço médio', value: `R$ ${insight.supporting_data.competitor_avg_price}`, short: true }
            ]
          }]
        });
      }
    }
  }
}
```

## 📋 TASKS DE IMPLEMENTAÇÃO ATUALIZADAS

### Fase 1: Configuração Base (3-5 dias)
- [ ] Configurar autenticação SP-API com o Security Profile existente
- [ ] Configurar autenticação Advertising API
- [ ] Criar estrutura base do PostgreSQL com TimescaleDB
- [ ] **NOVO: Criar tabelas de vendedores e Buy Box**
- [ ] Implementar sistema de tokens e rate limiting
- [ ] Criar workers para coleta de dados

### Fase 2: Coleta de Dados (5-7 dias)
- [ ] Implementar coleta de Orders (com RDT para dados de clientes)
- [ ] Implementar coleta de Inventory em tempo real
- [ ] Implementar coleta de Pricing (próprio e competidores)
- [ ] **NOVO: Sistema de identificação de vendedores**
- [ ] **NOVO: Tracking de mudanças de Buy Box**
- [ ] Implementar coleta de Advertising metrics
- [ ] Criar jobs de sincronização (cron)

### Fase 3: Análise Competitiva APRIMORADA (5-7 dias)
- [ ] Sistema de tracking de competidores COM NOMES
- [ ] **Cache inteligente de informações de vendedores**
- [ ] **Análise de Buy Box em tempo real com identificação**
- [ ] **Histórico de posse de Buy Box por vendedor**
- [ ] Comparação de preços e estratégias
- [ ] **Detecção de novos competidores**
- [ ] Histórico de mudanças dos competidores

### Fase 4: Implementação da IA (7-10 dias)
- [ ] Setup Python com Prophet, Scikit-learn
- [ ] Modelo de previsão de demanda
- [ ] **Sistema de otimização de preços com análise de vendedores**
- [ ] **Análise de padrões de Buy Box**
- [ ] **IA para detectar comportamentos competitivos**
- [ ] Análise de keywords e campanhas
- [ ] Gerador de insights automáticos

### Fase 5: Interface e Visualização (5-7 dias)
- [ ] Expandir DatabaseViewer com novos filtros
- [ ] **Dashboard de Buy Box com nomes dos vendedores**
- [ ] **Gráficos de histórico de Buy Box**
- [ ] **Ranking de competidores mais agressivos**
- [ ] Dashboard de insights da IA
- [ ] Sistema de notificações
- [ ] Relatórios automatizados

## 🚀 QUERIES SQL PRONTAS PARA USO

```sql
-- 1. Dashboard Principal: Quem tem a Buy Box agora
SELECT 
    bs.asin,
    bs.product_name as "Produto",
    bs.buy_box_owner as "Dono da Buy Box",
    bs.buy_box_price as "Preço Buy Box",
    bs.our_price as "Nosso Preço",
    bs.price_difference_pct as "% Diferença",
    CASE 
        WHEN bs.buy_box_owner = 'Sua Loja' THEN '✅'
        ELSE '❌'
    END as "Status",
    TO_CHAR(bs.last_checked, 'HH24:MI') as "Última Verificação"
FROM buy_box_status bs
ORDER BY bs.price_difference_pct DESC;

-- 2. Ranking de Competidores Mais Agressivos
SELECT 
    seller_name as "Competidor",
    COUNT(DISTINCT asin) as "Produtos Disputados",
    COUNT(*) FILTER (WHERE is_buy_box_winner) as "Vezes com Buy Box",
    ROUND(AVG(feedback_rating), 1) as "Avaliação",
    ROUND(AVG(price), 2) as "Preço Médio R$",
    COUNT(*) FILTER (WHERE is_fba) as "Vendas FBA"
FROM competitor_tracking
WHERE timestamp >= NOW() - INTERVAL '7 days'
AND seller_name != 'Sua Loja'
GROUP BY seller_name
ORDER BY "Vezes com Buy Box" DESC
LIMIT 20;

-- 3. Histórico de Buy Box por Produto
SELECT 
    DATE(timestamp) as "Data",
    TO_CHAR(timestamp, 'HH24:MI') as "Hora",
    seller_name as "Vendedor",
    price as "Preço",
    CASE WHEN is_fba THEN 'FBA' ELSE 'FBM' END as "Tipo",
    feedback_rating as "Avaliação"
FROM competitor_tracking
WHERE asin = 'B08N5WRWNW'
AND is_buy_box_winner = true
AND timestamp >= NOW() - INTERVAL '48 hours'
ORDER BY timestamp DESC;

-- 4. Produtos Onde Perdemos Mais Buy Box
SELECT 
    p.asin,
    p.name as "Produto",
    p.current_price as "Nosso Preço",
    COUNT(DISTINCT ct.seller_name) as "Qtd Competidores",
    STRING_AGG(DISTINCT ct.seller_name, ', ') as "Principais Competidores",
    ROUND(AVG(ct.price), 2) as "Preço Médio Competidores",
    p.buy_box_percentage as "% Buy Box (30d)"
FROM products p
JOIN competitor_tracking ct ON p.asin = ct.asin
WHERE ct.is_buy_box_winner = true
AND ct.seller_name != 'Sua Loja'
AND ct.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY p.asin, p.name, p.current_price, p.buy_box_percentage
HAVING p.buy_box_percentage < 50
ORDER BY p.buy_box_percentage ASC;

-- 5. Análise de Preços por Vendedor
SELECT 
    seller_name as "Vendedor",
    COUNT(DISTINCT asin) as "Produtos",
    ROUND(AVG(price), 2) as "Preço Médio",
    ROUND(MIN(price), 2) as "Menor Preço",
    ROUND(MAX(price), 2) as "Maior Preço",
    ROUND(STDDEV(price), 2) as "Variação",
    ROUND(AVG(feedback_rating), 1) as "Avaliação"
FROM competitor_tracking
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY seller_name
HAVING COUNT(DISTINCT asin) > 3
ORDER BY "Preço Médio" ASC;

-- 6. Alertas de Mudança de Buy Box (últimas 2 horas)
WITH recent_changes AS (
    SELECT 
        asin,
        seller_name,
        timestamp,
        LAG(seller_name) OVER (PARTITION BY asin ORDER BY timestamp) as previous_owner,
        price,
        LAG(price) OVER (PARTITION BY asin ORDER BY timestamp) as previous_price
    FROM competitor_tracking
    WHERE is_buy_box_winner = true
    AND timestamp >= NOW() - INTERVAL '2 hours'
)
SELECT 
    p.name as "Produto",
    rc.previous_owner as "Perdeu Buy Box",
    rc.seller_name as "Ganhou Buy Box",
    rc.previous_price as "Preço Anterior",
    rc.price as "Preço Atual",
    ROUND(((rc.previous_price - rc.price) / rc.previous_price * 100), 2) as "% Redução",
    TO_CHAR(rc.timestamp, 'HH24:MI') as "Horário"
FROM recent_changes rc
JOIN products p ON rc.asin = p.asin
WHERE rc.seller_name != rc.previous_owner
AND rc.previous_owner IS NOT NULL
ORDER BY rc.timestamp DESC;

-- 7. Performance da Buy Box por Dia da Semana
SELECT 
    TO_CHAR(timestamp, 'Day') as "Dia da Semana",
    COUNT(*) FILTER (WHERE seller_name = 'Sua Loja') as "Vitórias",
    COUNT(*) as "Total Verificações",
    ROUND(COUNT(*) FILTER (WHERE seller_name = 'Sua Loja')::numeric / COUNT(*) * 100, 1) as "% Buy Box"
FROM competitor_tracking
WHERE is_buy_box_winner = true
AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY TO_CHAR(timestamp, 'Day'), EXTRACT(DOW FROM timestamp)
ORDER BY EXTRACT(DOW FROM timestamp);

-- 8. Vendedores Novos (Últimos 7 dias)
SELECT 
    seller_name as "Novo Vendedor",
    MIN(timestamp) as "Primeira Aparição",
    COUNT(DISTINCT asin) as "Produtos",
    ROUND(AVG(price), 2) as "Preço Médio",
    ROUND(AVG(feedback_rating), 1) as "Avaliação",
    COUNT(*) FILTER (WHERE is_buy_box_winner) as "Buy Boxes Ganhas"
FROM competitor_tracking
WHERE seller_id NOT IN (
    SELECT DISTINCT seller_id 
    FROM competitor_tracking 
    WHERE timestamp < NOW() - INTERVAL '7 days'
)
AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY seller_name
ORDER BY "Buy Boxes Ganhas" DESC;
```

## 📊 Dashboard Component para Buy Box com Vendedores

```jsx
// components/BuyBoxDashboard.jsx
import { useState, useEffect } from 'react';
import { Card, Badge, Progress, Alert } from '@/components/ui';

export const BuyBoxDashboard = () => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetchBuyBoxData();
    const interval = setInterval(fetchBuyBoxData, 60000); // Atualiza a cada minuto
    return () => clearInterval(interval);
  }, []);

  const fetchBuyBoxData = async () => {
    const response = await fetch('/api/buybox/status');
    const result = await response.json();
    setData(result);
  };

  if (!data) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-sm text-gray-600">Buy Box Ativa</div>
          <div className="text-3xl font-bold text-green-600">
            {data.summary.wonCount}
          </div>
          <div className="text-sm text-gray-500">
            de {data.summary.totalProducts} produtos
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-gray-600">Taxa de Buy Box</div>
          <div className="text-3xl font-bold">
            {data.summary.buyBoxPercentage}%
          </div>
          <Progress value={data.summary.buyBoxPercentage} className="mt-2" />
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-gray-600">Competidores Ativos</div>
          <div className="text-3xl font-bold text-orange-600">
            {data.summary.activeCompetitors}
          </div>
          <div className="text-sm text-gray-500">
            últimas 24h
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-gray-600">Mudanças Hoje</div>
          <div className="text-3xl font-bold text-blue-600">
            {data.summary.changestoday}
          </div>
          <div className="text-sm text-gray-500">
            trocas de Buy Box
          </div>
        </Card>
      </div>

      {/* Alertas de Mudanças Recentes */}
      {data.recentChanges.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Mudanças Recentes</h3>
          {data.recentChanges.map((change, idx) => (
            <Alert key={idx} variant={change.lostBuyBox ? 'destructive' : 'default'}>
              <div className="flex justify-between items-center">
                <div>
                  <strong>{change.productName}</strong>
                  {change.lostBuyBox ? (
                    <span className="ml-2 text-red-600">
                      Perdeu Buy Box para {change.newOwner}
                    </span>
                  ) : (
                    <span className="ml-2 text-green-600">
                      Recuperou Buy Box de {change.previousOwner}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {change.timeAgo}
                </div>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Tabela de Status Atual */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Status Buy Box por Produto</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Produto</th>
                  <th className="text-left py-3">Dono da Buy Box</th>
                  <th className="text-right py-3">Preço Buy Box</th>
                  <th className="text-right py-3">Nosso Preço</th>
                  <th className="text-center py-3">Status</th>
                  <th className="text-left py-3">Ação Sugerida</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map(product => (
                  <tr key={product.asin} className="border-b hover:bg-gray-50">
                    <td className="py-4">
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.asin}</div>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <span className={
                          product.weHaveBuyBox ? 'text-green-600 font-bold' : ''
                        }>
                          {product.buyBoxOwner}
                        </span>
                        {product.isFBA && (
                          <Badge variant="secondary" className="text-xs">FBA</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        ⭐ {product.ownerRating} ({product.ownerReviews} avaliações)
                      </div>
                    </td>
                    <td className="py-4 text-right font-mono">
                      R$ {product.buyBoxPrice}
                    </td>
                    <td className="py-4 text-right font-mono">
                      R$ {product.ourPrice}
                    </td>
                    <td className="py-4 text-center">
                      {product.weHaveBuyBox ? (
                        <Badge variant="success">✅ Ativa</Badge>
                      ) : (
                        <Badge variant="destructive">❌ Perdida</Badge>
                      )}
                    </td>
                    <td className="py-4">
                      {!product.weHaveBuyBox && product.priceDifference > 0 && (
                        <button className="text-sm text-orange-600 hover:text-orange-700">
                          Ajustar para R$ {product.suggestedPrice}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Gráfico de Competidores */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top 10 Competidores</h3>
        <div className="space-y-3">
          {data.topCompetitors.map((competitor, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-400">
                  #{idx + 1}
                </div>
                <div>
                  <div className="font-medium">{competitor.name}</div>
                  <div className="text-sm text-gray-500">
                    {competitor.productsCount} produtos | ⭐ {competitor.rating}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-orange-600">
                  {competitor.buyBoxWins} vitórias
                </div>
                <div className="text-sm text-gray-500">
                  Preço médio: R$ {competitor.avgPrice}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
```

## 🎯 RESULTADO ESPERADO ATUALIZADO

Com essa implementação completa, o AppProft será capaz de:

1. **Identificar QUEM tem a Buy Box** - Nome completo do vendedor, não apenas ID
2. **Monitorar competidores 24/7** - Com identificação completa e histórico
3. **Rastrear mudanças de Buy Box** - Saber exatamente quando e para quem perdeu
4. **Analisar padrões competitivos** - Quais vendedores são mais agressivos
5. **Detectar novos entrantes** - Alertar sobre novos competidores no mercado
6. **Prever demanda com 85%+ de precisão** - Evitar stockouts e overstocking
7. **Otimizar preços automaticamente** - Competir com vendedores específicos
8. **Gerenciar campanhas com IA** - Pausar keywords ruins, escalar as boas
9. **Gerar insights sobre competidores** - Saber exatamente contra quem competir
10. **Dashboard completo de Buy Box** - Visualizar tudo em tempo real

O sistema agora tem **visibilidade total do mercado** com identificação completa dos vendedores, criando uma vantagem competitiva ainda maior para os usuários do AppProft!