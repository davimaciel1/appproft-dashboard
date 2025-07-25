PROFIT LEAK DETECTOR - Especificação Técnica Completa v2.0
🎯 Visão Geral do Módulo
Objetivo Principal
Criar um sistema que identifica automaticamente produtos que estão gerando prejuízo ou margem negativa na operação Amazon, considerando TODOS os custos ocultos que sellers normalmente ignoram.
Problema Real que Resolve

70% dos sellers não sabem o lucro real por produto
Custos ocultos como storage de longo prazo são ignorados
Decisões baseadas em "achismo" levam a manter produtos que dão prejuízo
Dinheiro perdido silenciosamente em produtos que parecem lucrativos mas não são

🏗️ Arquitetura do Sistema
mermaidgraph TD
    A[Cron Job - 2x ao dia] --> B[Reports Collector]
    B --> C[PostgreSQL]
    C --> D[Profit Calculator]
    D --> E[Alert System]
    E --> F[Dashboard]
    F --> G[Seller Actions]
    
    H[SP-API] --> B
    I[Data Kiosk] --> B
📊 Coleta de Dados via Amazon SP-API
1. Sistema de Reports (Principal Fonte de Dados)
1.1 Criar Reports Necessários
javascript// Endpoint: POST /reports/2021-06-30/reports
// Rate Limit: 0.0167 req/s, Burst: 15

// Lista de reports necessários para análise completa
const reportsNecessarios = [
  {
    reportType: "GET_SALES_AND_TRAFFIC_REPORT",
    opcoes: {
      dataStartTime: "30 dias atrás",
      dataEndTime: "hoje",
      marketplaceIds: ["A2Q3Y263D00KWC"] // Brasil
    }
  },
  {
    reportType: "GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA",
    opcoes: {
      marketplaceIds: ["A2Q3Y263D00KWC"]
    }
  },
  {
    reportType: "GET_FBA_STORAGE_FEE_CHARGES_DATA",
    opcoes: {
      dataStartTime: "início do mês",
      dataEndTime: "fim do mês"
    }
  },
  {
    reportType: "GET_FBA_INVENTORY_AGED_DATA",
    opcoes: {
      marketplaceIds: ["A2Q3Y263D00KWC"]
    }
  },
  {
    reportType: "GET_FBA_RETURNS_DATA",
    opcoes: {
      dataStartTime: "30 dias atrás",
      dataEndTime: "hoje"
    }
  },
  {
    reportType: "GET_LONG_TERM_STORAGE_FEE_CHARGES_DATA",
    opcoes: {
      dataStartTime: "início do mês",
      dataEndTime: "fim do mês"
    }
  },
  {
    reportType: "GET_REIMBURSEMENTS_DATA",
    opcoes: {
      dataStartTime: "30 dias atrás",
      dataEndTime: "hoje"
    }
  }
];
1.2 Fluxo de Processamento de Reports
javascript// PASSO 1: Criar report
POST /reports/2021-06-30/reports
Body: {
  "reportType": "GET_SALES_AND_TRAFFIC_REPORT",
  "dataStartTime": "2024-01-01T00:00:00Z",
  "dataEndTime": "2024-01-31T23:59:59Z",
  "marketplaceIds": ["A2Q3Y263D00KWC"]
}

// Response:
{
  "reportId": "12345"
}

// PASSO 2: Verificar status
GET /reports/2021-06-30/reports/12345

// Response quando pronto:
{
  "processingStatus": "DONE",
  "reportDocumentId": "DOC-12345"
}

// PASSO 3: Baixar documento
GET /reports/2021-06-30/documents/DOC-12345

// Response:
{
  "url": "https://d34o8swod1owfl.cloudfront.net/report.gz",
  "compressionAlgorithm": "GZIP"
}

// PASSO 4: Fazer download e descompactar o arquivo
// PASSO 5: Processar e salvar no PostgreSQL
2. Dados de Estoque FBA
javascript// Endpoint: GET /fba/inventory/v1/summaries
// Rate Limit: 2 req/s, Burst: 2

// Parâmetros:
{
  "granularityType": "Marketplace",
  "granularityId": "A2Q3Y263D00KWC",
  "marketplaceIds": ["A2Q3Y263D00KWC"],
  "details": true,
  "startDateTime": "2024-01-01T00:00:00Z",
  "sellerSkus": ["SKU1", "SKU2"] // máx 50 por vez
}

// Dados importantes para extrair:
// - totalQuantity (estoque total)
// - fulfillableQuantity (disponível para venda)
// - inboundWorkingQuantity (em trânsito)
// - reservedQuantity (reservado)
3. Dados Financeiros
javascript// Endpoint: GET /finances/v0/financialEvents
// Rate Limit: 0.5 req/s, Burst: 30

// Parâmetros:
{
  "PostedAfter": "2024-01-01T00:00:00Z",
  "PostedBefore": "2024-01-31T23:59:59Z",
  "MaxResultsPerPage": 100
}

// Focar em:
// - ShipmentEventList (vendas)
// - RefundEventList (devoluções)
// - ServiceFeeEventList (taxas diversas)
// - AdjustmentEventList (ajustes)
4. Data Kiosk (Opcional - Para v2.0)
javascript// Endpoint: POST /dataKiosk/2023-11-15/queries
// Rate Limit: 0.0167 req/s (1 por minuto)

// Query GraphQL para economics:
{
  "query": `
    query ProfitAnalysis {
      analytics_salesAndTraffic_2024_04_24 {
        salesAndTrafficByAsin(
          startDate: "2024-01-01"
          endDate: "2024-01-31"
          aggregateBy: ASIN
        ) {
          metrics {
            asin
            sales {
              orderedProductSales { amount }
              unitsOrdered
            }
            traffic {
              sessions
              buyBoxPercentage
              unitSessionPercentage
            }
          }
        }
      }
    }
  `
}
🗄️ Estrutura Completa do Banco de Dados
Tabelas Principais
sql-- 1. Dados mestres de produtos
CREATE TABLE products_master (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) UNIQUE NOT NULL,
    sku VARCHAR(100),
    title TEXT,
    current_price DECIMAL(10,2),
    product_cost DECIMAL(10,2), -- custo do produto (entrada manual)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Dados de vendas (do Sales & Traffic Report)
CREATE TABLE sales_data (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    report_date DATE NOT NULL,
    sessions INTEGER,
    page_views INTEGER,
    buy_box_percentage DECIMAL(5,2),
    units_ordered INTEGER,
    units_ordered_b2b INTEGER,
    total_order_items INTEGER,
    ordered_product_sales DECIMAL(12,2),
    ordered_product_sales_b2b DECIMAL(12,2),
    unit_session_percentage DECIMAL(5,2), -- conversion rate
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asin, report_date)
);

-- 3. Taxas FBA (do FBA Fees Report)
CREATE TABLE fba_fees (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    sku VARCHAR(100),
    report_date DATE NOT NULL,
    price DECIMAL(10,2),
    referral_fee DECIMAL(10,2),
    variable_closing_fee DECIMAL(10,2),
    fba_fees DECIMAL(10,2),
    total_fee_estimate DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asin, report_date)
);

-- 4. Taxas de armazenagem (do Storage Fee Report)
CREATE TABLE storage_fees (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    report_month DATE NOT NULL,
    fulfillment_center VARCHAR(10),
    average_quantity_on_hand DECIMAL(10,2),
    average_quantity_pending_removal DECIMAL(10,2),
    estimated_monthly_storage_fee DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asin, report_month, fulfillment_center)
);

-- 5. Taxas de armazenagem de longo prazo
CREATE TABLE long_term_storage_fees (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    snapshot_date DATE NOT NULL,
    sku VARCHAR(100),
    fnsku VARCHAR(100),
    condition_type VARCHAR(50),
    quantity_charged_12_mo_long_term_storage_fee INTEGER,
    per_unit_volume DECIMAL(10,4),
    currency VARCHAR(3),
    12_mo_long_terms_storage_fee DECIMAL(10,2),
    quantity_charged_6_mo_long_term_storage_fee INTEGER,
    6_mo_long_terms_storage_fee DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Dados de estoque (do Inventory API e Aged Inventory Report)
CREATE TABLE inventory_data (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    sku VARCHAR(100),
    snapshot_date DATE NOT NULL,
    sellable_quantity INTEGER,
    unsellable_quantity INTEGER,
    aged_90_plus_days INTEGER,
    aged_180_plus_days INTEGER,
    aged_270_plus_days INTEGER,
    aged_365_plus_days INTEGER,
    currency VARCHAR(3),
    qty_to_be_charged_ltsf_12_mo INTEGER,
    projected_ltsf_12_mo DECIMAL(10,2),
    qty_to_be_charged_ltsf_6_mo INTEGER,
    projected_ltsf_6_mo DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asin, snapshot_date)
);

-- 7. Dados de devoluções (do Returns Report)
CREATE TABLE returns_data (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    return_date DATE NOT NULL,
    order_id VARCHAR(50),
    sku VARCHAR(100),
    fnsku VARCHAR(100),
    quantity INTEGER,
    fulfillment_center_id VARCHAR(10),
    detailed_disposition VARCHAR(100),
    reason VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Análise consolidada de lucro (tabela calculada)
CREATE TABLE profit_analysis (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    analysis_date DATE DEFAULT CURRENT_DATE,
    period_days INTEGER DEFAULT 30,
    
    -- Receitas
    selling_price DECIMAL(10,2),
    units_sold INTEGER,
    total_revenue DECIMAL(12,2),
    
    -- Custos diretos
    product_cost DECIMAL(10,2),
    total_product_cost DECIMAL(12,2),
    
    -- Taxas Amazon
    referral_fee_total DECIMAL(10,2),
    fba_fee_total DECIMAL(10,2),
    variable_closing_fee_total DECIMAL(10,2),
    
    -- Armazenagem
    monthly_storage_fee_total DECIMAL(10,2),
    long_term_storage_fee_total DECIMAL(10,2),
    aged_inventory_surcharge DECIMAL(10,2),
    
    -- Devoluções
    units_returned INTEGER,
    return_rate DECIMAL(5,2),
    return_processing_cost DECIMAL(10,2),
    
    -- Análise final
    total_costs DECIMAL(12,2),
    gross_profit DECIMAL(12,2),
    profit_margin DECIMAL(5,2),
    profit_per_unit DECIMAL(10,2),
    
    -- Status e classificação
    profit_status VARCHAR(20), -- 'hemorrhage', 'loss', 'danger', 'healthy'
    main_cost_driver VARCHAR(50), -- 'storage', 'returns', 'fees', 'cogs'
    
    -- Recomendações
    recommended_action VARCHAR(100),
    recommended_price DECIMAL(10,2),
    potential_savings_monthly DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_asin_date (asin, analysis_date),
    INDEX idx_profit_status (profit_status),
    INDEX idx_profit_margin (profit_margin)
);

-- 9. Sistema de alertas
CREATE TABLE profit_alerts (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    alert_type VARCHAR(50), -- 'new_loss', 'increasing_loss', 'storage_alert', 'return_spike'
    severity VARCHAR(20), -- 'critical', 'high', 'medium', 'low'
    title VARCHAR(200),
    message TEXT,
    metrics JSONB, -- dados específicos do alerta
    action_url VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    is_actioned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    actioned_at TIMESTAMPTZ,
    
    INDEX idx_asin_unread (asin, is_read),
    INDEX idx_severity_created (severity, created_at)
);

-- 10. Histórico de ações tomadas
CREATE TABLE profit_actions (
    id SERIAL PRIMARY KEY,
    asin VARCHAR(10) NOT NULL,
    action_type VARCHAR(50), -- 'price_change', 'pause_listing', 'create_removal', 'adjust_inventory'
    action_details JSONB,
    previous_state JSONB,
    new_state JSONB,
    estimated_impact DECIMAL(10,2),
    actual_impact DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    
    INDEX idx_asin_action (asin, action_type)
);
🧮 Fórmulas de Cálculo Detalhadas
1. Cálculo do Lucro Real por Unidade
javascript// Fórmula completa considerando TODOS os custos
function calcularLucroReal(dados) {
  const {
    precoVenda,
    custoProduto,
    unidadesVendidas,
    taxaReferencia,
    fbaFee,
    taxaFechamentoVariavel,
    armazenagemMensal,
    armazenagemLongoPrazo,
    unidadesDevolvidas,
    custoDevolucao,
    idadeMediaEstoque
  } = dados;

  // 1. Receita por unidade
  const receitaPorUnidade = precoVenda;

  // 2. Custos diretos por unidade
  const custosProduto = custoProduto;
  const taxasAmazon = taxaReferencia + fbaFee + taxaFechamentoVariavel;

  // 3. Custos de armazenagem rateados
  const custoArmazenagemPorUnidade = armazenagemMensal / unidadesVendidas;
  
  // 4. Custo de armazenagem longo prazo (se aplicável)
  let custoLongoPrazoPorUnidade = 0;
  if (idadeMediaEstoque > 365) {
    custoLongoPrazoPorUnidade = (armazenagemLongoPrazo / unidadesVendidas);
  }

  // 5. Custo de devoluções
  const taxaDevolucao = unidadesDevolvidas / unidadesVendidas;
  const custoDevolucaoPorUnidade = taxaDevolucao * custoDevolucao;

  // 6. Cálculo final
  const custoTotal = custosProduto + 
                     taxasAmazon + 
                     custoArmazenagemPorUnidade + 
                     custoLongoPrazoPorUnidade + 
                     custoDevolucaoPorUnidade;

  const lucroPorUnidade = receitaPorUnidade - custoTotal;
  const margemLucro = (lucroPorUnidade / receitaPorUnidade) * 100;

  return {
    lucroPorUnidade,
    margemLucro,
    custoTotal,
    breakdown: {
      custosProduto,
      taxasAmazon,
      custoArmazenagemPorUnidade,
      custoLongoPrazoPorUnidade,
      custoDevolucaoPorUnidade
    }
  };
}
2. Classificação de Status
javascriptfunction classificarProduto(margemLucro) {
  if (margemLucro < -10) return 'hemorrhage';     // 🔴 Hemorragia
  if (margemLucro < 0) return 'loss';            // 🟠 Prejuízo
  if (margemLucro < 5) return 'danger';          // 🟡 Perigo
  if (margemLucro < 15) return 'low';            // 🟨 Margem Baixa
  return 'healthy';                               // 🟢 Saudável
}
🔄 Fluxo de Processamento
1. Coleta de Dados (2x ao dia: 6h e 18h)
javascript// services/ProfitDataCollector.js

class ProfitDataCollector {
  async executarColetaDiaria() {
    try {
      // 1. Criar todos os reports necessários
      const reportIds = await this.criarReports();
      
      // 2. Aguardar processamento (polling a cada 2 min)
      const reports = await this.aguardarReports(reportIds);
      
      // 3. Baixar e processar cada report
      for (const report of reports) {
        await this.processarReport(report);
      }
      
      // 4. Coletar dados do Inventory API
      await this.coletarDadosEstoque();
      
      // 5. Coletar dados financeiros
      await this.coletarDadosFinanceiros();
      
      // 6. Executar análise de lucro
      await this.executarAnalise();
      
      // 7. Gerar alertas
      await this.gerarAlertas();
      
    } catch (error) {
      console.error('Erro na coleta:', error);
      // Notificar admin
    }
  }

  async criarReports() {
    const reportTypes = [
      'GET_SALES_AND_TRAFFIC_REPORT',
      'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA',
      'GET_FBA_STORAGE_FEE_CHARGES_DATA',
      'GET_FBA_INVENTORY_AGED_DATA',
      'GET_FBA_RETURNS_DATA',
      'GET_LONG_TERM_STORAGE_FEE_CHARGES_DATA'
    ];

    const reportIds = [];
    
    for (const reportType of reportTypes) {
      // Respeitar rate limit: 0.0167 req/s
      await this.delay(60000); // 1 minuto entre requests
      
      const response = await this.spApi.createReport({
        reportType,
        marketplaceIds: ['A2Q3Y263D00KWC'],
        dataStartTime: this.getStartDate(),
        dataEndTime: this.getEndDate()
      });
      
      reportIds.push({
        reportId: response.reportId,
        reportType
      });
    }
    
    return reportIds;
  }

  async processarReport(report) {
    // 1. Baixar arquivo
    const fileData = await this.downloadReport(report.url);
    
    // 2. Descompactar se necessário
    const data = await this.descompactar(fileData);
    
    // 3. Parse do formato (TSV ou JSON)
    const records = await this.parseData(data, report.reportType);
    
    // 4. Salvar no banco
    await this.salvarNoBanco(records, report.reportType);
  }
}
2. Análise de Lucro
javascript// services/ProfitAnalyzer.js

class ProfitAnalyzer {
  async analisarTodosProdutos() {
    // 1. Buscar todos os ASINs ativos
    const produtos = await db.query(
      'SELECT DISTINCT asin FROM products_master WHERE is_active = true'
    );

    for (const produto of produtos.rows) {
      await this.analisarProduto(produto.asin);
    }
  }

  async analisarProduto(asin) {
    // 1. Coletar todos os dados necessários
    const dados = await this.coletarDadosProduto(asin);
    
    // 2. Calcular lucro
    const analise = this.calcularLucroReal(dados);
    
    // 3. Classificar status
    const status = this.classificarProduto(analise.margemLucro);
    
    // 4. Identificar principal sugador de lucro
    const mainCostDriver = this.identificarPrincipalCusto(analise.breakdown);
    
    // 5. Gerar recomendação
    const recomendacao = this.gerarRecomendacao(analise, status, mainCostDriver);
    
    // 6. Salvar análise
    await this.salvarAnalise(asin, analise, status, recomendacao);
  }

  identificarPrincipalCusto(breakdown) {
    const custos = [
      { tipo: 'product_cost', valor: breakdown.custosProduto },
      { tipo: 'amazon_fees', valor: breakdown.taxasAmazon },
      { tipo: 'storage', valor: breakdown.custoArmazenagemPorUnidade + breakdown.custoLongoPrazoPorUnidade },
      { tipo: 'returns', valor: breakdown.custoDevolucaoPorUnidade }
    ];
    
    return custos.sort((a, b) => b.valor - a.valor)[0].tipo;
  }

  gerarRecomendacao(analise, status, mainCostDriver) {
    const recomendacoes = {
      hemorrhage: {
        storage: 'CRIAR ORDEM DE REMOÇÃO URGENTE',
        returns: 'REVISAR QUALIDADE DO PRODUTO',
        amazon_fees: 'PAUSAR VENDAS IMEDIATAMENTE',
        product_cost: 'RENEGOCIAR COM FORNECEDOR OU DESCONTINUAR'
      },
      loss: {
        storage: 'Reduzir estoque em 50%',
        returns: 'Melhorar descrição e fotos',
        amazon_fees: 'Aumentar preço em 15%',
        product_cost: 'Buscar fornecedor alternativo'
      },
      danger: {
        storage: 'Otimizar níveis de estoque',
        returns: 'Adicionar vídeo do produto',
        amazon_fees: 'Aumentar preço em 8%',
        product_cost: 'Negociar desconto por volume'
      }
    };
    
    return recomendacoes[status]?.[mainCostDriver] || 'Monitorar próximas semanas';
  }
}
3. Sistema de Alertas
javascript// services/AlertSystem.js

class AlertSystem {
  async verificarAlertas() {
    // 1. Novos produtos em hemorragia
    await this.alertasHemorragia();
    
    // 2. Produtos piorando
    await this.alertasPiorando();
    
    // 3. Storage de longo prazo iminente
    await this.alertasStorage();
    
    // 4. Spike de devoluções
    await this.alertasDevolucoes();
  }

  async alertasHemorragia() {
    const query = `
      SELECT p.*, pm.title 
      FROM profit_analysis p
      JOIN products_master pm ON p.asin = pm.asin
      WHERE p.profit_status = 'hemorrhage'
      AND p.analysis_date = CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM profit_alerts pa
        WHERE pa.asin = p.asin
        AND pa.alert_type = 'new_hemorrhage'
        AND pa.created_at > CURRENT_DATE - INTERVAL '7 days'
      )
    `;
    
    const produtos = await db.query(query);
    
    for (const produto of produtos.rows) {
      await this.criarAlerta({
        asin: produto.asin,
        alert_type: 'new_hemorrhage',
        severity: 'critical',
        title: `🚨 HEMORRAGIA: ${produto.title}`,
        message: `Produto está com prejuízo de R$ ${Math.abs(produto.profit_per_unit).toFixed(2)} por unidade!`,
        metrics: {
          profit_per_unit: produto.profit_per_unit,
          units_sold: produto.units_sold,
          total_loss_monthly: produto.profit_per_unit * produto.units_sold
        }
      });
      
      // Enviar notificação imediata
      await this.enviarNotificacao(produto);
    }
  }

  async enviarNotificacao(alerta) {
    // WhatsApp (via API de terceiros)
    if (config.whatsapp.enabled) {
      await whatsappApi.send({
        to: user.phone,
        message: alerta.message,
        buttons: ['Ver Análise', 'Pausar Produto']
      });
    }
    
    // Email
    if (config.email.enabled) {
      await emailService.send({
        to: user.email,
        subject: alerta.title,
        template: 'profit-alert',
        data: alerta
      });
    }
    
    // Push notification
    if (config.push.enabled) {
      await pushService.send({
        title: alerta.title,
        body: alerta.message,
        data: { asin: alerta.asin }
      });
    }
  }
}
🖥️ Interface do Usuário Detalhada
1. Dashboard Principal
javascript// pages/ProfitLeakDashboard.jsx

const ProfitLeakDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header com resumo */}
      <div className="bg-red-600 text-white p-6">
        <h1 className="text-3xl font-bold">💸 Profit Leak Detector</h1>
        <div className="mt-4">
          <div className="text-5xl font-bold">R$ {totalPerdaMensal}</div>
          <div className="text-xl">sendo perdidos este mês</div>
          <button className="mt-4 bg-white text-red-600 px-6 py-3 rounded-lg font-bold">
            VER PRODUTOS SUGADORES
          </button>
        </div>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-4 gap-4 p-6">
        <StatusCard 
          status="hemorrhage"
          count={counts.hemorrhage}
          total={totals.hemorrhage}
          color="red"
        />
        <StatusCard 
          status="loss"
          count={counts.loss}
          total={totals.loss}
          color="orange"
        />
        <StatusCard 
          status="danger"
          count={counts.danger}
          total={totals.danger}
          color="yellow"
        />
        <StatusCard 
          status="healthy"
          count={counts.healthy}
          total={totals.healthy}
          color="green"
        />
      </div>

      {/* Tabela de produtos */}
      <div className="p-6">
        <ProfitTable products={products} onAction={handleAction} />
      </div>
    </div>
  );
};
2. Página de Análise Detalhada
javascript// pages/ProductProfitAnalysis.jsx

const ProductProfitAnalysis = ({ asin }) => {
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header do produto */}
      <ProductHeader product={product} />

      {/* Breakdown visual de custos */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h2 className="text-2xl font-bold mb-4">Onde seu dinheiro está vazando</h2>
        <CostBreakdownChart data={costBreakdown} />
      </div>

      {/* Simulador de preço */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h2 className="text-2xl font-bold mb-4">Simulador de Preço</h2>
        <PriceSimulator 
          currentPrice={product.price}
          costs={costs}
          onPriceChange={handlePriceChange}
        />
      </div>

      {/* Ações recomendadas */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <RecommendedActions 
          product={product}
          recommendation={recommendation}
          onAction={handleAction}
        />
      </div>

      {/* Histórico de margem */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h2 className="text-2xl font-bold mb-4">Evolução da Margem</h2>
        <MarginHistoryChart data={marginHistory} />
      </div>
    </div>
  );
};
3. Componentes Específicos
javascript// components/CostBreakdownChart.jsx
// Gráfico de pizza interativo mostrando breakdown de custos

// components/PriceSimulator.jsx
// Slider para simular novo preço com cálculo em tempo real

// components/ActionButton.jsx
// Botões com confirmação para ações críticas

// components/ProfitStatusBadge.jsx
// Badge colorido indicando status do produto
🚀 Implementação por Fases
Fase 1: MVP (2 semanas)

Semana 1:

 Configurar conexão SP-API
 Implementar coleta via Reports API
 Criar estrutura do banco de dados
 Implementar parser de reports


Semana 2:

 Criar calculadora de lucro básica
 Implementar dashboard simples
 Sistema de alertas por email
 Deploy e testes



Fase 2: Versão Completa (+ 3 semanas)

Semana 3:

 Adicionar todos os tipos de custos
 Implementar análise histórica
 Sistema de recomendações


Semana 4:

 Simulador de preço
 Alertas WhatsApp/Push
 Dashboard avançado


Semana 5:

 Otimizações de performance
 Testes com clientes beta
 Ajustes finais



Fase 3: Recursos Avançados (+ 4 semanas)

 Integração com Data Kiosk
 IA para previsões
 Automação de ações
 API para integrações

🔧 Configurações e Variáveis de Ambiente
bash# .env
# SP-API
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_REFRESH_TOKEN=
SP_API_REGION=na
SP_API_MARKETPLACE_ID=A2Q3Y263D00KWC

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/profitleak

# Notificações
SENDGRID_API_KEY=
WHATSAPP_API_KEY=
WHATSAPP_BUSINESS_NUMBER=

# Configurações
ANALYSIS_SCHEDULE="0 6,18 * * *" # 6h e 18h
ALERT_CHECK_INTERVAL=3600000 # 1 hora
📝 Observações Importantes para Implementação

Rate Limits: Respeitar rigorosamente os rate limits da API
Processamento Assíncrono: Reports podem demorar minutos para processar
Caching: Cachear análises por 12 horas para não sobrecarregar
Paginação: Implementar paginação em todas as listagens
Segurança: Criptografar dados financeiros sensíveis
Multi-tenant: Estrutura preparada para múltiplos clientes
Logs: Logar todas as operações para auditoria

🎯 Métricas de Sucesso do MVP

Identificar corretamente 90%+ dos produtos em prejuízo
Tempo de análise < 5 minutos para 100 produtos
Taxa de ação > 50% dos alertas geram ação
Redução de prejuízo > 30% no primeiro mês

💡 Diferenciais Competitivos

Foco em AÇÃO: Não apenas mostrar dados, mas o que fazer
Custos COMPLETOS: Incluir custos que outros ignoram
Alertas INTELIGENTES: Apenas quando realmente importa
Interface SIMPLES: Seller entende em 5 segundos
Resultado MENSURÁVEL: Mostrar dinheiro economizado


INSTRUÇÕES FINAIS PARA O CLAUDE CODE:

Comece pelo básico: Reports API + cálculo simples
Dados reais sempre: Nunca use dados mockados
Mobile-first: Sellers acessam pelo celular
Performance: Otimize queries SQL desde o início
Testes: Crie testes para os cálculos críticos
Documentação: Documente as fórmulas de cálculo

Lembre-se: O objetivo é fazer o seller PARAR DE PERDER DINHEIRO, não impressionar com gráficos bonitos!