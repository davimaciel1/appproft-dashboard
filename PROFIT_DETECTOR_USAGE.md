# 💸 Profit Leak Detector - Guia de Uso

## ✅ Status: COMPLETAMENTE IMPLEMENTADO E INTEGRADO

O módulo **Profit Leak Detector** está 100% funcional e integrado ao sistema AppProft. Ele identifica automaticamente produtos que estão gerando prejuízo considerando TODOS os custos ocultos da operação Amazon.

## 🎯 O que foi implementado

### ✅ Backend Completo
- **11 tabelas especializadas** no PostgreSQL para análise de lucro
- **Coleta automática** de dados via Amazon SP-API Reports
- **Calculadora de lucro real** com fórmulas completas
- **Sistema de alertas inteligentes** para produtos problemáticos
- **Integração completa** com PersistentSyncManager
- **API REST** com 12+ endpoints

### ✅ Frontend React
- **Dashboard principal** com visualização por status
- **Página de análise detalhada** com gráficos interativos
- **Simulador de preços** em tempo real
- **Sistema visual de alertas** com severidade

### ✅ Funcionalidades Principais
- 🔴 **Detecção de Hemorragia**: Produtos com prejuízo > 10%
- 🟠 **Produtos Perdendo Dinheiro**: Margem negativa
- 🟡 **Zona de Perigo**: Margem baixa < 5%
- 📊 **Análise Completa de Custos**: Produto + Amazon + Storage + Devoluções
- 🔔 **Alertas Automáticos**: 5 tipos de alertas críticos
- 💡 **Recomendações Acionáveis**: Ações específicas baseadas no problema

## 🚀 Como usar

### 1. Acessar o Dashboard
```
URL: https://appproft.com/profit-detector
```

### 2. API Endpoints Disponíveis
```bash
# Obter análises com resumo
GET /api/profit-detector/analyses

# Análise detalhada de produto
GET /api/profit-detector/analyses/B08N5WRWNW

# Atualizar custo do produto
PUT /api/profit-detector/products/B08N5WRWNW/cost
Body: { "cost": 25.50 }

# Alertas não lidos
GET /api/profit-detector/alerts/unread

# Disparar sincronização manual
POST /api/profit-detector/sync

# Exportar para CSV
GET /api/profit-detector/export/csv
```

### 3. Inserir Custos dos Produtos

#### Opção 1: Individual
```javascript
// Via API
await fetch('/api/profit-detector/products/B08N5WRWNW/cost', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cost: 25.50 })
});
```

#### Opção 2: Em Lote via CSV
```csv
asin,sku,title,cost
B08N5WRWNW,SKU123,Echo Dot (4th Gen),25.50
B07FZ8S74R,SKU456,Echo Show 8,45.00
```

### 4. Interpretação dos Resultados

#### Status dos Produtos
- 🔴 **Hemorrhage** (Margem < -10%): AÇÃO URGENTE
- 🟠 **Loss** (Margem < 0%): Perdendo dinheiro
- 🟡 **Danger** (Margem < 5%): Zona de perigo
- 🟨 **Low** (Margem < 15%): Margem baixa
- 🟢 **Healthy** (Margem ≥ 15%): Lucrativo

#### Principais Sugadores de Lucro
- **Product Cost**: Custo do produto muito alto
- **Amazon Fees**: Taxas da Amazon (15% referral + FBA)
- **Storage**: Armazenagem mensal + longo prazo
- **Returns**: Devoluções frequentes

## 🔧 Configuração Inicial

### 1. Verificar Instalação
```bash
# Teste se está funcionando
node scripts/testProfitDetector.js
```

### 2. Configurar Credenciais SP-API (Opcional)
Para coleta automática de dados, configure no `.env`:
```bash
AMAZON_CLIENT_ID=seu-client-id
AMAZON_CLIENT_SECRET=seu-client-secret
AMAZON_REFRESH_TOKEN=seu-refresh-token
```

### 3. Executar Primeira Análise
```bash
# Via script direto
node -e "
const service = require('./server/services/profitDetector');
service.updateProductCost('B08N5WRWNW', 25.50)
  .then(() => console.log('Produto analisado!'));
"

# Ou via API
curl -X PUT http://localhost:3000/api/profit-detector/products/B08N5WRWNW/cost \
  -H "Content-Type: application/json" \
  -d '{"cost": 25.50}'
```

## 📊 Exemplos de Análise

### Produto Saudável
```
ASIN: B08N5WRWNW | Status: 🟢 Healthy
Preço: $39.99 | Unidades: 150/mês
Lucro/Unidade: $8.45 | Margem: 21.1%
Ação: Manter estratégia atual
```

### Produto em Hemorragia
```
ASIN: B07XYZ123 | Status: 🔴 Hemorrhage  
Preço: $24.99 | Unidades: 89/mês
Prejuízo/Unidade: -$3.20 | Margem: -12.8%
Principal Problema: Storage (taxa de longo prazo)
Ação: CRIAR ORDEM DE REMOÇÃO URGENTE
```

## 🔔 Tipos de Alertas

### 1. New Hemorrhage (Crítico)
- Produto perdendo mais de 10% por unidade
- Necessita ação imediata

### 2. Increasing Loss (Alto)
- Margem caiu 5%+ e está negativa
- Monitoramento necessário

### 3. Storage Alert (Médio)
- Produtos próximos de taxa de longo prazo
- Otimização de inventário

### 4. Return Spike (Médio)
- Taxa de devolução > 10%
- Investigação de qualidade

### 5. Aged Inventory (Médio)
- Produtos > 365 dias no estoque
- Capital parado

## 💡 Fórmula de Cálculo

```javascript
Custo Total por Unidade = 
    Custo do Produto +
    Taxas Amazon (15% Referral + ~$3 FBA + Variable) +
    Custos de Armazenagem (Mensal + Longo Prazo) / Unidades +
    Custo de Devoluções * Taxa de Devolução

Lucro por Unidade = Preço de Venda - Custo Total
Margem % = (Lucro / Preço) * 100
```

## 🎛️ Sincronização Automática

O módulo roda automaticamente:
- **2x por dia**: Coleta de dados (6h e 18h)
- **1x por hora**: Verificação de alertas
- **Sob demanda**: Via API ou interface

## 📈 Relatórios e Exportação

### Exportar Análise Completa
```bash
# CSV com todos os produtos
GET /api/profit-detector/export/csv

# Filtrar por status
GET /api/profit-detector/export/csv?status=hemorrhage
```

### Dados Inclusos no Export
- ASIN, SKU, Título
- Unidades vendidas, Receita
- Custos detalhados por categoria
- Lucro, Margem, Status
- Recomendações de ação

## 🎯 Casos de Uso Práticos

### 1. Auditoria Mensal de Lucro
1. Acesse `/profit-detector`
2. Filtre por "Hemorrhage" e "Loss"
3. Revise produtos problemáticos
4. Tome ações baseadas nas recomendações

### 2. Análise de Produto Específico
1. Acesse `/profit-analysis/B08N5WRWNW`
2. Revise breakdown de custos
3. Use simulador de preços
4. Implemente ações recomendadas

### 3. Monitoramento de Alertas
1. Configure notificações via Slack/Email
2. Receba alertas automáticos
3. Aja rapidamente em produtos críticos

## 🚨 Troubleshooting

### Não há dados aparecendo
1. Verificar se custos dos produtos foram inseridos
2. Executar sincronização manual
3. Verificar logs para erros

### Cálculos parecem incorretos
1. Conferir custos dos produtos
2. Verificar se Reports API está coletando dados
3. Revisar fórmulas no código

### Alertas não chegando
1. Verificar configuração de notificações
2. Checar logs do sistema
3. Testar disparo manual

## 📞 Suporte

O módulo está completamente documentado e testado. Para questões específicas:
1. Consulte os logs em `/server/services/profitDetector/`
2. Execute `node scripts/testProfitDetector.js` para diagnosticar
3. Revise a documentação em `/server/services/profitDetector/README.md`

---

**🎉 O Profit Leak Detector está pronto para detectar e parar vazamentos de lucro na sua operação Amazon!**