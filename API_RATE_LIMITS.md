# 📊 Amazon SP-API Rate Limits - Guia Completo

## 🚦 Limites Oficiais por Endpoint

### Orders API
- **GET /orders/v0/orders**: 10 req/seg (burst: 40)
- **GET /orders/v0/orders/{orderId}**: 10 req/seg (burst: 40)
- **GET /orders/v0/orders/{orderId}/items**: 10 req/seg (burst: 40)

### Inventory API (FBA)
- **GET /fba/inventory/v1/summaries**: 2 req/seg (burst: 2) ⚠️
- **POST /fba/inventory/v1/items**: 2 req/seg (burst: 2)

### Catalog API
- **GET /catalog/v2022-04-01/items**: 5 req/seg (burst: 10)
- **GET /catalog/v2022-04-01/items/search**: 2 req/seg (burst: 2) ⚠️
- **GET /catalog/v2022-04-01/items/{asin}**: 5 req/seg (burst: 10)

### Products Pricing API
- **GET /products/pricing/v0/price**: 10 req/seg (burst: 20)
- **GET /products/pricing/v0/competitivePricing**: 10 req/seg (burst: 20)
- **POST /batches/products/pricing/v0/itemOffers**: 10 req/seg (burst: 20)

### Sellers API
- **GET /sellers/v1/marketplaceParticipations**: 0.0167 req/seg (1/min) ⚠️

### Reports API
- **POST /reports/2021-06-30/reports**: 0.0222 req/seg (2 req/90seg) ⚠️
- **GET /reports/2021-06-30/documents/{documentId}**: 0.0167 req/seg (1/min) ⚠️

### Notifications API
- **POST /notifications/v1/subscriptions**: 1 req/seg (burst: 5)
- **GET /notifications/v1/subscriptions**: 1 req/seg (burst: 5)

### Finances API
- **GET /finances/v0/financialEvents**: 0.5 req/seg (burst: 30) ⚠️

### Product Fees API
- **POST /products/fees/v0/feesEstimate**: 1 req/seg (burst: 2) ⚠️

## 🔄 Sistema de Rate Limiting Implementado

### Token Bucket Algorithm
```javascript
// Cada endpoint tem seu próprio bucket
{
  rate: 10,    // Tokens adicionados por segundo
  burst: 40,   // Capacidade máxima do bucket
  tokens: 40,  // Tokens disponíveis atualmente
  lastRefill: Date.now()
}
```

### Como Funciona:
1. **Requisição chega** → Verifica se há tokens disponíveis
2. **Se SIM** → Consome 1 token e processa
3. **Se NÃO** → Aguarda até ter tokens (com retry automático)
4. **Tokens regeneram** continuamente na taxa especificada

## ⚠️ Endpoints Críticos (Baixo Limite)

1. **Inventory**: Apenas 2 req/seg - Use com moderação
2. **Catalog Search**: 2 req/seg - Prefira usar ASINs específicos
3. **Sellers**: 1 req/min - Cache por 24h recomendado
4. **Reports**: 2 req/90seg - Use para dados em massa
5. **Finances**: 0.5 req/seg - Agrupe períodos

## 💡 Estratégias para Otimizar

### 1. Use Reports API para Dados em Massa
```javascript
// Ao invés de 1000 chamadas individuais
// Use um report que retorna todos os dados
const report = await createReport({
  reportType: 'GET_MERCHANT_LISTINGS_ALL_DATA',
  marketplaceIds: ['ATVPDKIKX0DER']
});
```

### 2. Implemente Cache Inteligente
```javascript
// Cache por tipo de dado
const cacheConfig = {
  sellers: 24 * 60 * 60 * 1000,      // 24 horas
  catalog: 6 * 60 * 60 * 1000,       // 6 horas  
  inventory: 15 * 60 * 1000,          // 15 minutos
  pricing: 5 * 60 * 1000,             // 5 minutos
  orders: 60 * 1000                   // 1 minuto
};
```

### 3. Agrupe Requisições (Batch)
```javascript
// Pricing API suporta até 20 ASINs por chamada
const batchPricing = await api.post('/batches/products/pricing/v0/itemOffers', {
  requests: asins.map(asin => ({
    uri: `/products/pricing/v0/items/${asin}/offers`,
    method: 'GET',
    marketplaceId: 'ATVPDKIKX0DER'
  }))
});
```

### 4. Implemente Backoff Exponencial
```javascript
async function retryWithBackoff(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s, 8s, 16s
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## 📈 Monitoramento de Rate Limits

### Headers de Resposta Importantes:
- `x-amzn-RateLimit-Limit`: Seu limite atual
- `x-amzn-RequestId`: ID para debug
- `Retry-After`: Quando tentar novamente (em 429)

### Logging Recomendado:
```javascript
// Log de rate limits para análise
logger.info('API Call', {
  endpoint: '/orders/v0/orders',
  remainingTokens: bucket.tokens,
  rateLimit: response.headers['x-amzn-RateLimit-Limit'],
  requestId: response.headers['x-amzn-RequestId']
});
```

## 🛠️ Implementação no AppProft

O sistema já tem implementado:
1. ✅ Rate Limiter com Token Bucket (`/server/services/rateLimiter.js`)
2. ✅ Retry automático com backoff
3. ✅ Controle por endpoint
4. ✅ Persistência de estado

Para usar:
```javascript
const rateLimiter = require('./rateLimiter');

// Antes de cada chamada
await rateLimiter.waitForToken('sp-api', endpoint);

// Fazer a chamada
const response = await spApi.get(endpoint);
```

## 📊 Estimativa de Uso

Para um vendedor típico:
- **1.000 produtos**: ~3 min para sincronizar catalog
- **500 orders/dia**: ~1 min para sincronizar orders  
- **Pricing updates**: ~2 min para todos os produtos
- **Inventory check**: ~10 seg para todos os produtos

**Total**: ~15-20 minutos para sincronização completa respeitando limites