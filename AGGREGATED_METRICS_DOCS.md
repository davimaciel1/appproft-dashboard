# 📊 Documentação - Métricas Agregadas AppProft

## 🌐 URLs de Produção

### Base URL
```
https://appproft.com/api/dashboard/aggregated-metrics
```

## 📍 Endpoints Disponíveis

### 1. Métricas Agregadas por Data

#### Diário (últimos 30 dias)
```
https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byDate&granularity=DAY
```

#### Semanal
```
https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byDate&granularity=WEEK
```

#### Mensal
```
https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byDate&granularity=MONTH
```

#### Período Específico
```
https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byDate&startDate=2025-01-01&endDate=2025-01-31
```

### 2. Métricas Agregadas por Produto/ASIN

#### Por ASIN Pai (produtos principais)
```
https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byAsin&asinLevel=PARENT
```

#### Por ASIN Filho (variações)
```
https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byAsin&asinLevel=CHILD
```

#### Por SKU
```
https://appproft.com/api/dashboard/aggregated-metrics?aggregationType=byAsin&asinLevel=SKU
```

## 📊 Estrutura de Resposta

### Métricas por Data
```json
{
  "salesAndTrafficByDate": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "marketplaceId": "A2Q3Y263D00KWC",
    "granularity": "DAY",
    "data": [
      {
        "date": "2025-01-31",
        "sales": {
          "orderedProductSales": {
            "amount": 15847.32,
            "currencyCode": "BRL"
          },
          "orderedProductSalesB2B": {
            "amount": 3200.00,
            "currencyCode": "BRL"
          },
          "unitsOrdered": 487,
          "totalOrderItems": 142,
          "unitsRefunded": 12,
          "unitsShipped": 475,
          "refundRate": 2.46,
          "averageSellingPrice": 32.54,
          "averageSalesPerOrderItem": 111.67
        },
        "traffic": {
          "pageViews": 4832,
          "sessions": 1947,
          "browserPageViews": 3200,
          "mobileAppPageViews": 1632,
          "buyBoxPercentage": 87.5,
          "unitSessionPercentage": 25.3,
          "feedbackReceived": 23,
          "negativeFeedbackReceived": 1
        }
      }
    ]
  }
}
```

### Métricas por Produto
```json
{
  "salesAndTrafficByAsin": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "marketplaceId": "A2Q3Y263D00KWC",
    "asinLevel": "PARENT",
    "data": [
      {
        "parentAsin": "B08X6P7Q3M",
        "childAsin": "B08X6P7Q3M",
        "sku": "PROD-001",
        "productName": "Echo Dot (4ª Geração)",
        "sales": {
          "orderedProductSales": {
            "amount": 2847.50,
            "currencyCode": "BRL"
          },
          "unitsOrdered": 57
        },
        "traffic": {
          "pageViews": 892,
          "sessions": 412,
          "buyBoxPercentage": 92.3,
          "unitSessionPercentage": 13.8
        }
      }
    ]
  }
}
```

## 🔄 Sincronização Automática

### Configuração do Cron (Linux/macOS)
```bash
# Editar crontab
crontab -e

# Adicionar linhas:
# Sincronização a cada 6 horas (últimos 30 dias)
0 */6 * * * cd /path/to/project && node services/aggregatedMetricsSync.js

# Sincronização completa diária às 2h (últimos 90 dias)
0 2 * * * cd /path/to/project && node services/aggregatedMetricsSync.js --full
```

### Configuração do Task Scheduler (Windows)
1. Abrir Task Scheduler
2. Criar nova tarefa
3. Configurar trigger: A cada 6 horas
4. Ação: `node C:\path\to\project\services\aggregatedMetricsSync.js`

## 🔐 Autenticação

A API usa autenticação OAuth 2.0 com refresh token automático:

1. **Access Token**: Renovado automaticamente quando expira
2. **Refresh Token**: Armazenado no `.env` (não expira)
3. **Rate Limiting**: 1 requisição por segundo (respeitado automaticamente)

## 📈 Métricas Disponíveis

### Métricas de Vendas
- `orderedProductSales`: Valor total de vendas
- `orderedProductSalesB2B`: Vendas B2B
- `unitsOrdered`: Unidades vendidas
- `totalOrderItems`: Total de itens
- `unitsRefunded`: Unidades devolvidas
- `refundRate`: Taxa de devolução (%)
- `averageSellingPrice`: Preço médio de venda
- `averageSalesPerOrderItem`: Ticket médio

### Métricas de Tráfego
- `pageViews`: Visualizações de página
- `sessions`: Sessões únicas
- `browserPageViews`: Visualizações via navegador
- `mobileAppPageViews`: Visualizações via app
- `buyBoxPercentage`: % de Buy Box ganho
- `unitSessionPercentage`: Taxa de conversão (%)
- `feedbackReceived`: Feedbacks totais
- `negativeFeedbackReceived`: Feedbacks negativos

## 🛠️ Solução de Problemas

### Erro de Autenticação
```bash
# Verificar credenciais
node -e "console.log(process.env.AMAZON_REFRESH_TOKEN ? 'Token configurado' : 'Token faltando')"

# Testar conexão
node -e "const s = require('./services/amazonGraphQLService'); new s().testConnection()"
```

### Dados não Aparecem
1. Verificar se a sincronização foi executada
2. Conferir logs de erro
3. Verificar período de dados solicitado

### Rate Limit Excedido
- O sistema já implementa retry automático com backoff exponencial
- Se persistir, aguarde alguns minutos

## 📞 Suporte

Para dúvidas ou problemas:
- Email: support@appproft.com
- Documentação: https://docs.appproft.com
- Status da API: https://status.appproft.com