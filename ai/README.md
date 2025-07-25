# 🤖 Sistema de IA do AppProft

Este diretório contém todos os componentes de Machine Learning e Inteligência Artificial do AppProft, que extraem insights acionáveis dos dados coletados das APIs da Amazon.

## 📊 Visão Geral

O sistema de IA do AppProft oferece:

1. **📈 Previsão de Demanda** - Usando Prophet para prever vendas dos próximos 30 dias
2. **💰 Otimização de Preços** - ML para encontrar preço ótimo considerando elasticidade e Buy Box
3. **🎯 Análise de Campanhas** - Clustering e ML para otimizar advertising
4. **🧠 Insights Automáticos** - Detecta stockouts, novos competidores, perdas de Buy Box

## 🚀 Setup Rápido

```bash
# 1. Entrar no diretório AI
cd ai

# 2. Executar script de setup
python setup.py

# 3. Ativar ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 4. Testar sistema
cd ..
node scripts/testAISystem.js
```

## 📁 Estrutura de Arquivos

```
ai/
├── requirements.txt      # Dependências Python (Prophet, Scikit-learn, etc)
├── setup.py             # Script de instalação e configuração
├── README.md            # Este arquivo
└── scripts/
    ├── analyze_all.py       # Gerador de insights automáticos
    ├── demand_forecast.py   # Previsão de demanda com Prophet
    ├── price_optimization.py # Otimização de preços com ML
    └── campaign_analysis.py  # Análise de campanhas e keywords
```

## 🔧 Scripts Disponíveis

### 1. analyze_all.py - Gerador de Insights

Analisa todos os dados e gera insights acionáveis:

- **Risco de Stockout**: Produtos que vão acabar antes do lead time
- **Oportunidades de Pricing**: Quando ajustar preços para recuperar Buy Box
- **Novos Competidores**: Detecta sellers entrando no mercado
- **Perdas de Buy Box**: Alerta quando perde Buy Box recentemente

**Uso via Node.js:**
```javascript
const result = await executePythonScript('analyze_all.py', {
  command: 'generate_insights',
  params: {
    lookback_days: 30,
    confidence_threshold: 0.7
  }
});
```

### 2. demand_forecast.py - Previsão de Demanda

Usa Prophet do Facebook para prever vendas:

- Considera sazonalidade (semanal e anual)
- Inclui feriados brasileiros
- Detecta Black Friday e Prime Day
- Calcula níveis de reorder e safety stock

**Uso via Node.js:**
```javascript
const result = await executePythonScript('demand_forecast.py', {
  command: 'forecast_all',
  params: {
    forecast_days: 30,
    include_seasonality: true,
    include_holidays: true
  }
});
```

### 3. price_optimization.py - Otimização de Preços

Usa ML para encontrar preço ótimo:

- Calcula elasticidade de preço própria
- Considera preços dos competidores
- Simula probabilidade de Buy Box
- Maximiza lucro respeitando margem mínima

**Uso via Node.js:**
```javascript
const result = await executePythonScript('price_optimization.py', {
  command: 'optimize_all_prices',
  params: {
    elasticity_window: 90,
    min_margin: 0.15,
    buy_box_weight: 0.7
  }
});
```

### 4. campaign_analysis.py - Análise de Campanhas

Analisa performance de advertising:

- Clustering de keywords similares
- Identificação de negative keywords
- Otimização de bids com ML
- Sugestões de dayparting
- Recomendações de estrutura

**Uso via Node.js:**
```javascript
const result = await executePythonScript('campaign_analysis.py', {
  command: 'analyze_campaigns',
  params: {
    lookback_days: 30,
    min_impressions: 1000,
    acos_target: 0.25
  }
});
```

## 🗄️ Tabelas do Banco de Dados

O sistema de IA usa as seguintes tabelas principais:

### Tabelas de ML
- `products_ml` - Features dos produtos para ML
- `sales_metrics` - Métricas de vendas agregadas
- `inventory_snapshots` - Histórico de inventory
- `competitor_tracking_advanced` - Dados de competidores

### Tabelas de Resultados
- `ai_insights_advanced` - Insights gerados pela IA
- `demand_forecasts` - Previsões de demanda
- `price_optimization` - Sugestões de preços
- `keywords_performance` - Performance de keywords

## 🤝 Integração com o Worker

O worker principal (`aiDataCollectionWorker.js`) orquestra tudo:

```javascript
// Executa a cada 6 horas
await this.runAIAnalysis();

// Previsão diária às 2h
await this.runDemandForecasting();

// Otimização de preços às 3h
await this.runPriceOptimization();

// Análise de campanhas às 4h
await this.runCampaignAnalysis();
```

## 📊 Exemplos de Insights Gerados

### Risco de Stockout
```json
{
  "type": "restock",
  "priority": "critical",
  "title": "Risco de Stockout: Produto XYZ",
  "description": "Estoque acabará em 5 dias. Lead time: 21 dias.",
  "recommendation": "Enviar 450 unidades para FBA imediatamente.",
  "potential_impact": 2500.00
}
```

### Otimização de Preço
```json
{
  "type": "pricing",
  "priority": "high",
  "title": "Otimizar Preço: Produto ABC",
  "description": "Buy Box em 45%. Preço 15% acima do competidor.",
  "recommendation": "Reduzir de R$ 89.90 para R$ 79.90",
  "expected_profit_change": 1200.00
}
```

## 🔍 Troubleshooting

### Erro: "No module named 'prophet'"
```bash
cd ai
source venv/bin/activate  # ou venv\Scripts\activate no Windows
pip install -r requirements.txt
```

### Erro: "Connection refused" no PostgreSQL
- Verificar se o túnel SSH está ativo
- Conferir credenciais no .env
- Testar com: `node scripts/testAISystem.js`

### Previsões com baixa acurácia
- Necessário pelo menos 30 dias de dados históricos
- Verificar se há outliers nos dados
- Ajustar parâmetros de sazonalidade

## 📈 Métricas de Performance

O sistema monitora sua própria performance:

- **MAPE** (Mean Absolute Percentage Error) nas previsões
- **Confidence Score** em cada insight
- **Processing Time** de cada análise
- **Success Rate** das otimizações aplicadas

## 🚦 Próximos Passos

1. **Implementar Advertising API** - Para dados reais de campanhas
2. **Adicionar pgvector** - Para embeddings de títulos/descrições
3. **Implementar A/B Testing** - Para validar sugestões de preço
4. **Deep Learning** - Para análise de imagens de produtos
5. **NLP Avançado** - Para otimização de listings

## 📞 Suporte

Em caso de dúvidas sobre o sistema de IA:

1. Verificar logs: `tail -f logs/ai-worker.log`
2. Executar teste: `node scripts/testAISystem.js`
3. Consultar documentação dos modelos:
   - [Prophet](https://facebook.github.io/prophet/)
   - [Scikit-learn](https://scikit-learn.org/)
   - [Pandas](https://pandas.pydata.org/)

---

🤖 **Lembre-se**: O sistema de IA é tão bom quanto os dados que recebe. Mantenha a coleta de dados sempre ativa!