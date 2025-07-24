# 📊 Amazon Data Kiosk - Documentação AppProft

## 🎯 O que é o Data Kiosk?

O Amazon Data Kiosk é uma API GraphQL da Amazon que fornece métricas agregadas de vendas e tráfego. É mais eficiente que a SP-API tradicional para obter analytics e dashboards.

## 🚀 Implementação no AppProft

### Estrutura de Arquivos
```
server/
├── services/
│   ├── dataKiosk/
│   │   ├── dataKioskClient.js     # Cliente para API do Data Kiosk
│   │   ├── dataKioskQueries.js    # Queries GraphQL
│   │   └── dataKioskProcessor.js  # Processador de dados
│   └── amazonService.js           # Atualizado com métodos Data Kiosk
├── routes/
│   └── dataKiosk.js              # Rotas da API
└── scripts/
    └── testDataKiosk.js          # Script de teste
```

## 📍 URLs de Produção

### Endpoints Disponíveis (Requer Autenticação)
```
https://appproft.com/api/data-kiosk/metrics    # Métricas do dashboard
https://appproft.com/api/data-kiosk/products   # Produtos com métricas
https://appproft.com/api/data-kiosk/sync       # Sincronização manual
https://appproft.com/api/data-kiosk/status     # Status da sincronização
```

## 🔄 Como Funciona

### 1. Fluxo de Dados
```
Amazon Data Kiosk API
        ↓
   Query GraphQL
        ↓
  Processamento
        ↓
   PostgreSQL
        ↓
    Dashboard
```

### 2. Dados Disponíveis

#### Métricas Diárias
- Vendas totais (B2C e B2B)
- Unidades vendidas
- Taxa de devolução
- Page views e sessões
- Buy Box percentage
- Taxa de conversão

#### Métricas por Produto
- Vendas por ASIN
- Buy Box por produto
- Tráfego por produto
- Taxa de conversão individual

## 🛠️ Como Usar

### 1. Teste Local
```bash
# Testar sincronização (últimos 7 dias)
node scripts/testDataKiosk.js 1 7

# Testar com mais dias
node scripts/testDataKiosk.js 1 30
```

### 2. Sincronização via API
```bash
# POST para sincronizar
curl -X POST https://appproft.com/api/data-kiosk/sync \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 30}'
```

### 3. Buscar Métricas
```bash
# GET métricas do dashboard
curl https://appproft.com/api/data-kiosk/metrics \
  -H "Authorization: Bearer SEU_TOKEN"
```

## 📊 Estrutura de Resposta

### Métricas do Dashboard
```json
{
  "todaysSales": 15847.32,
  "ordersCount": 142,
  "unitsSold": 387,
  "avgUnitsPerOrder": "2.7",
  "netProfit": 5229.61,
  "profitMargin": "33.0",
  "acos": "15.0",
  "yesterdayComparison": "+23",
  "buyBoxPercentage": "87.5",
  "unitSessionPercentage": "25.3"
}
```

### Produtos
```json
{
  "products": [
    {
      "id": 1,
      "asin": "B08X6P7Q3M",
      "name": "Echo Dot (4ª Geração)",
      "units": 57,
      "revenue": 2847.50,
      "buyBoxPercentage": "92.3",
      "conversionRate": "13.8",
      "pageViews": 892,
      "sessions": 412
    }
  ]
}
```

## ⚙️ Configuração

### Variáveis de Ambiente Necessárias
```bash
# Amazon SP-API
AMAZON_CLIENT_ID=seu_client_id
AMAZON_CLIENT_SECRET=seu_client_secret
AMAZON_REFRESH_TOKEN=seu_refresh_token
AMAZON_SELLER_ID=seu_seller_id
SP_API_MARKETPLACE_ID=A2Q3Y263D00KWC  # Brasil
```

### Permissões Necessárias
O app Amazon deve ter a role:
- `analytics::data-kiosk`

## 🔍 Troubleshooting

### Erro: "Query falhou"
- Verifique se o app tem permissão para Data Kiosk
- Confirme que o período solicitado tem dados

### Erro: "Token expirado"
- O sistema renova tokens automaticamente
- Se persistir, verifique o refresh token

### Sem dados no dashboard
1. Execute a sincronização: `node scripts/testDataKiosk.js`
2. Verifique o status: `GET /api/data-kiosk/status`
3. Confirme que há vendas no período

## 📈 Vantagens do Data Kiosk

1. **Performance**: Queries agregadas são mais rápidas
2. **Limites**: Maior cota que SP-API tradicional
3. **Métricas**: Dados de tráfego não disponíveis em outras APIs
4. **Histórico**: Até 2 anos de dados históricos

## 🚀 Próximos Passos

1. **Configurar Cron**: Sincronização automática diária
2. **Cache**: Implementar cache Redis para queries frequentes
3. **Alertas**: Notificações de anomalias nas métricas
4. **Relatórios**: Geração de PDFs com dados agregados

## 📞 Suporte

Para problemas com Data Kiosk:
- Verifique logs em: `/logs/data-kiosk.log`
- Console Amazon Seller Central
- Documentação oficial: https://developer-docs.amazon.com/sp-api/docs/data-kiosk-api

---

**Data Kiosk está pronto para uso em produção!** 🎉