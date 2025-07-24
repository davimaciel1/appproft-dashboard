# Como Acessar as Métricas Agregadas de Vendas

## 📊 Visão Geral

O sistema oferece uma API completa para visualizar métricas agregadas de vendas, tanto por data quanto por ASIN/produto.

## 🔗 Endpoint Principal

```
GET https://appproft.com/api/dashboard/aggregated-metrics
```

## 📦 Para Visualizar Vendas Agregadas por ASIN

### 1. Via Navegador (Método Mais Simples)

Acesse diretamente no navegador:
```
https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byAsin&marketplace=amazon&asinLevel=PARENT&startDate=2024-01-01&endDate=2024-12-31
```

### 2. Via cURL

```bash
curl -X GET "https://appproft.com/api/dashboard/aggregated-metrics" \
  -H "Content-Type: application/json" \
  -G \
  --data-urlencode "aggregationType=byAsin" \
  --data-urlencode "marketplace=amazon" \
  --data-urlencode "asinLevel=PARENT" \
  --data-urlencode "startDate=2024-01-01" \
  --data-urlencode "endDate=2024-12-31"
```

### 3. Via JavaScript/Axios

```javascript
const axios = require('axios');

const response = await axios.get('https://appproft.com/api/dashboard/aggregated-metrics', {
  params: {
    aggregationType: 'byAsin',
    marketplace: 'amazon',
    asinLevel: 'PARENT',
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

console.log(response.data);
```

### 4. Via Script de Teste Pronto

Execute o script que foi criado:
```bash
node scripts/testAggregatedMetricsByAsin.js
```

## 📋 Parâmetros Disponíveis

### Para Agregação por ASIN (`aggregationType=byAsin`)

| Parâmetro | Tipo | Valores | Descrição |
|-----------|------|---------|-----------|
| `aggregationType` | string | `byAsin` | Define agregação por produto/ASIN |
| `marketplace` | string | `amazon`, `mercadolivre` | Marketplace a consultar |
| `asinLevel` | string | `PARENT`, `CHILD`, `ALL` | Nível de agregação do ASIN |
| `startDate` | string | YYYY-MM-DD | Data inicial do período |
| `endDate` | string | YYYY-MM-DD | Data final do período |

### Para Agregação por Data (`aggregationType=byDate`)

| Parâmetro | Tipo | Valores | Descrição |
|-----------|------|---------|-----------|
| `aggregationType` | string | `byDate` | Define agregação por data |
| `marketplace` | string | `amazon`, `mercadolivre` | Marketplace a consultar |
| `granularity` | string | `DAY`, `WEEK`, `MONTH` | Granularidade temporal |
| `startDate` | string | YYYY-MM-DD | Data inicial do período |
| `endDate` | string | YYYY-MM-DD | Data final do período |

## 📊 Exemplo de Resposta (Por ASIN)

```json
{
  "salesAndTrafficByAsin": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "marketplaceId": "A2Q3Y263D00KWC",
    "asinLevel": "PARENT",
    "data": [
      {
        "parentAsin": "B08XYZ123",
        "childAsin": "B08XYZ123",
        "sku": "SKU-001",
        "productName": "Produto Exemplo",
        "sales": {
          "orderedProductSales": {
            "amount": 15420.50,
            "currencyCode": "BRL"
          },
          "unitsOrdered": 245
        },
        "traffic": {
          "pageViews": 3420,
          "sessions": 1250,
          "buyBoxPercentage": 87.5,
          "unitSessionPercentage": 19.6
        }
      }
    ]
  }
}
```

## 🚀 Dicas Úteis

1. **Filtrar por Período**: Ajuste `startDate` e `endDate` para o período desejado
2. **Nível de ASIN**: 
   - `PARENT`: Mostra apenas ASINs principais (produtos pai)
   - `CHILD`: Mostra apenas variações (produtos filho)
   - `ALL`: Mostra todos os produtos
3. **Marketplace**: Você pode alternar entre `amazon` e `mercadolivre`

## 🔧 Solução de Problemas

### Erro 401 - Não Autorizado
- Verifique se está enviando o token de autenticação correto
- Confirme se está logado no sistema

### Erro 500 - Erro Interno
- Verifique se o banco de dados está conectado
- Confirme se existem dados para o período solicitado

### Sem Dados Retornados
- Verifique se há vendas no período especificado
- Confirme se a sincronização com Amazon/ML foi executada

## 📝 Notas Importantes

- As métricas são calculadas em tempo real baseadas nos dados sincronizados
- Os dados de tráfego (page views, sessions) dependem da disponibilidade na API da Amazon
- Para Mercado Livre, algumas métricas de tráfego podem não estar disponíveis