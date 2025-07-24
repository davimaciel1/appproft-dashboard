O QUE ESSAS FERRAMENTAS DE SALES & TRAFFIC FORNECEM
Este arquivo TypeScript registra ferramentas MCP para acessar dados de vendas e tráfego da Amazon através do GraphQL. Aqui está o que você pode obter:
1. DADOS AGREGADOS POR DATA (salesAndTrafficByDate)
Métricas de Vendas:

orderedProductSales: Valor total de vendas (com moeda)
orderedProductSalesB2B: Vendas B2B
averageSalesPerOrderItem: Ticket médio por item
averageSellingPrice: Preço médio de venda
unitsOrdered: Unidades vendidas
totalOrderItems: Total de itens pedidos
unitsRefunded: Unidades devolvidas
unitsShipped: Unidades enviadas
refundRate: Taxa de devolução
claimsAmount: Valor de reclamações A-to-Z

Métricas de Tráfego:

pageViews: Total de visualizações de página
sessions: Total de sessões
browserPageViews: Visualizações via navegador
mobileAppPageViews: Visualizações via app mobile
buyBoxPercentage: % de vezes que você ganhou o Buy Box
unitSessionPercentage: Taxa de conversão (unidades/sessões)
feedbackReceived: Feedbacks recebidos
negativeFeedbackReceived: Feedbacks negativos

2. DADOS AGREGADOS POR ASIN (salesAndTrafficByAsin)
Para cada produto (ASIN), você obtém:

parentAsin: ASIN pai (família de produtos)
childAsin: ASIN filho (variação específica)
sku: SKU do vendedor
orderedProductSales: Vendas do produto
unitsOrdered: Unidades vendidas
pageViews: Visualizações do produto
buyBoxPercentage: % Buy Box do produto
unitSessionPercentage: Conversão do produto

3. NÍVEIS DE AGREGAÇÃO
Por Data:

DAY: Dados diários
WEEK: Dados semanais
MONTH: Dados mensais

Por Produto:

PARENT: Nível de ASIN pai
CHILD: Nível de ASIN filho
SKU: Nível de SKU

4. EXEMPLO DE DADOS RETORNADOS
json{
  "salesAndTrafficByDate": {
    "startDate": "2025-03-01",
    "endDate": "2025-03-31",
    "marketplaceId": "ATVPDKIKX0DER",
    "sales": {
      "orderedProductSales": {
        "amount": 125847.32,
        "currencyCode": "USD"
      },
      "unitsOrdered": 3847,
      "refundRate": 2.3
    },
    "traffic": {
      "pageViews": 45832,
      "sessions": 12947,
      "buyBoxPercentage": 87.5,
      "unitSessionPercentage": 29.7
    }
  }
}
🎯 PARA QUE SERVEM ESSES DADOS NO SEU DASHBOARD
1. Cards de Métricas Principais
javascript// Today's Sales
const todaysSales = data.orderedProductSales.amount;

// Orders
const orders = data.totalOrderItems;

// Units Sold
const unitsSold = data.unitsOrdered;

// ACOS (se tiver dados de publicidade)
const acos = calculateACOS(adSpend, sales);

// Net Profit
const netProfit = sales - costs - fees;
2. Tabela de Produtos
javascript// Para cada ASIN
const productMetrics = {
  name: product.name,
  units: data.unitsOrdered,
  revenue: data.orderedProductSales.amount,
  buyBox: data.buyBoxPercentage,
  conversion: data.unitSessionPercentage
};
3. Análises Avançadas

Tendências de vendas: Compare DAY vs WEEK vs MONTH
Performance por produto: Identifique best sellers
Conversão: Analise taxa de conversão por produto
Buy Box: Monitore competitividade

🔧 COMO INTEGRAR COM SEU SISTEMA
javascript// Exemplo de sincronização
async function syncAmazonSalesData() {
  // 1. Construir query
  const query = buildSalesAndTrafficQuery(
    'byDate',
    '2025-03-01',
    '2025-03-31',
    'DAY',
    ['ATVPDKIKX0DER'], // US marketplace
    false
  );

  // 2. Executar query
  const salesData = await executeSalesQuery(query);

  // 3. Salvar no PostgreSQL
  for (const dayData of salesData) {
    await db.query(`
      INSERT INTO daily_metrics (
        date, marketplace, revenue, units_sold, 
        page_views, sessions, buy_box_percentage, conversion_rate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (date, marketplace) DO UPDATE SET
        revenue = EXCLUDED.revenue,
        units_sold = EXCLUDED.units_sold
    `, [
      dayData.date,
      'amazon',
      dayData.sales.orderedProductSales.amount,
      dayData.sales.unitsOrdered,
      dayData.traffic.pageViews,
      dayData.traffic.sessions,
      dayData.traffic.buyBoxPercentage,
      dayData.traffic.unitSessionPercentage
    ]);
  }
}
IMPORTANTE: Estes dados de vendas e tráfego são ESSENCIAIS para popular os cards principais do seu dashboard (Today's Sales, Orders, Units Sold, etc.) com dados REAIS da Amazon!