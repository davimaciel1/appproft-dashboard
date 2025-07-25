# 📚 Guia de Referência das APIs da Amazon SP-API

## 🔑 Informações de Autenticação

### Token de Acesso
```javascript
// Endpoint para obter access token
POST https://api.amazon.com/auth/o2/token

// Body (x-www-form-urlencoded):
{
  grant_type: 'refresh_token',
  refresh_token: process.env.AMAZON_REFRESH_TOKEN,
  client_id: process.env.AMAZON_CLIENT_ID,
  client_secret: process.env.AMAZON_CLIENT_SECRET
}

// Resposta:
{
  access_token: "Atza|...",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "Atzr|..."
}
```

## 📊 APIs Disponíveis e O Que Podemos Obter

### 1. **Sellers API** ✅ FUNCIONANDO
```javascript
GET https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations

// Headers necessários:
{
  'x-amz-access-token': accessToken,
  'Content-Type': 'application/json'
}

// O que conseguimos:
- ✅ Nome da loja (storeName) - "Connect Brands"
- ✅ Marketplaces onde vendemos
- ✅ Status de participação
- ✅ Moeda e idioma padrão de cada marketplace

// Exemplo de resposta:
{
  "payload": [{
    "marketplace": {
      "id": "ATVPDKIKX0DER",
      "countryCode": "US",
      "name": "Amazon.com",
      "defaultCurrencyCode": "USD",
      "defaultLanguageCode": "en_US",
      "domainName": "www.amazon.com"
    },
    "storeName": "Connect Brands", // ⭐ NOME DA EMPRESA AQUI!
    "participation": {
      "isParticipating": true,
      "hasSuspendedListings": false
    }
  }]
}
```

### 2. **Catalog Items API** ⚠️ LIMITADO
```javascript
GET https://sellingpartnerapi-na.amazon.com/catalog/2022-04-01/items/{asin}

// Parâmetros:
?marketplaceIds=ATVPDKIKX0DER
&includedData=summaries,offers,attributes,images

// O que conseguimos:
- ✅ Informações básicas do produto
- ✅ Imagens
- ✅ Atributos
- ❌ Buy Box (requer permissão especial)
- ❌ Preços de competidores

// Status: Erro 400 - problemas com parâmetros
```

### 3. **Pricing API** ❌ BLOQUEADO
```javascript
GET https://sellingpartnerapi-na.amazon.com/products/pricing/v0/competitivePricing

// Status: Erro 403 - Unauthorized
// Motivo: Requer aprovação especial da Amazon
// Alternativa: Usar outras APIs para inferir Buy Box
```

### 4. **FBA Inventory API** ✅ FUNCIONANDO
```javascript
GET https://sellingpartnerapi-na.amazon.com/fba/inventory/v1/summaries

// Parâmetros:
?granularityType=Marketplace
&granularityId=ATVPDKIKX0DER
&marketplaceIds=ATVPDKIKX0DER

// O que conseguimos:
- ✅ Quantidade em estoque FBA
- ✅ ASINs dos produtos
- ✅ SKUs
- ✅ Condição do produto
- 💡 Se tem estoque FBA, provavelmente tem Buy Box

// Exemplo de resposta:
{
  "payload": {
    "inventorySummaries": [{
      "asin": "B0CLBHB46K",
      "fnSku": "X002F5OXYZ",
      "sellerSku": "CB-BOARD-001",
      "totalQuantity": 150,
      "condition": "NewItem"
    }]
  }
}
```

### 5. **Orders API** ✅ FUNCIONANDO
```javascript
GET https://sellingpartnerapi-na.amazon.com/orders/v0/orders

// Parâmetros:
?MarketplaceIds=ATVPDKIKX0DER
&CreatedAfter=2024-01-01T00:00:00Z

// O que conseguimos:
- ✅ Lista de pedidos
- ✅ Status dos pedidos
- ✅ Valores
- ✅ Data e hora
- ✅ Informações do comprador (limitadas)

// Rate Limit: 0.0167 req/seg (1 por minuto!)
```

### 6. **Products API** ⚠️ LIMITADO
```javascript
GET https://sellingpartnerapi-na.amazon.com/products/2022-05-01/items/{asin}

// O que conseguimos:
- ✅ Informações básicas do produto
- ✅ Categoria
- ✅ Ranking de vendas
- ❌ Buy Box winner
- ❌ Preços atuais
```

### 7. **Listings API** ✅ PARCIALMENTE FUNCIONANDO
```javascript
GET https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/{sellerId}/{sku}

// O que conseguimos:
- ✅ Status do listing
- ✅ Preço que DEFINIMOS
- ✅ Quantidade disponível
- ❌ Se temos Buy Box
- ❌ Preço atual do Buy Box
```

### 8. **Reports API** ✅ MELHOR OPÇÃO PARA DADOS EM MASSA
```javascript
POST https://sellingpartnerapi-na.amazon.com/reports/2021-06-30/reports

// Tipos de relatórios úteis:
- GET_MERCHANT_LISTINGS_ALL_DATA - Todos os produtos
- GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA - Inventário FBA
- GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL - Envios

// Vantagem: Dados em massa, menos chamadas de API
```

## 🎯 Estratégia Recomendada para Buy Box

Já que a **Pricing API está bloqueada**, aqui está a melhor abordagem:

### 1. **Identificação do Vendedor**
```javascript
// Usar Sellers API para pegar nome da loja
const storeName = "Connect Brands"; // Do marketplace participations
const sellerId = "A27IMS7TINM85N";
```

### 2. **Inferir Buy Box**
```javascript
// Combinação de dados:
1. FBA Inventory API - Se tem estoque FBA
2. Orders API - Se tem vendas recentes
3. Listings API - Se o listing está ativo

// Lógica:
if (temEstoqueFBA && listingAtivo && vendasRecentes) {
  // Provavelmente temos Buy Box
  buyBoxWinner = "Connect Brands";
}
```

### 3. **Monitoramento de Mudanças**
```javascript
// Comparar snapshots periódicos:
- Inventory levels
- Order velocity
- Listing status

// Se mudanças bruscas → possível hijacker
```

## 📋 Limitações e Alternativas

### ❌ O que NÃO conseguimos diretamente:
1. **Buy Box Winner atual** - Pricing API bloqueada
2. **Preços de competidores** - Pricing API bloqueada
3. **Porcentagem de Buy Box** - Pricing API bloqueada

### ✅ O que CONSEGUIMOS fazer:
1. **Nome da empresa** - Via Sellers API ✅
2. **Produtos que vendemos** - Via Inventory/Listings ✅
3. **Quantidade em estoque** - Via FBA Inventory ✅
4. **Histórico de vendas** - Via Orders API ✅
5. **Inferir Buy Box** - Combinando dados ✅

## 🔧 Código de Exemplo Funcional

```javascript
// Exemplo completo que FUNCIONA:
async function getBuyBoxStatus(asin) {
  const token = await getAccessToken();
  
  // 1. Pegar nome da loja
  const sellerResponse = await axios.get(
    'https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations',
    { headers: { 'x-amz-access-token': token } }
  );
  
  const storeName = sellerResponse.data.payload
    .find(p => p.marketplace.id === 'ATVPDKIKX0DER')
    .storeName; // "Connect Brands"
  
  // 2. Verificar inventário FBA
  const inventoryResponse = await axios.get(
    'https://sellingpartnerapi-na.amazon.com/fba/inventory/v1/summaries',
    { 
      headers: { 'x-amz-access-token': token },
      params: { 
        marketplaceIds: 'ATVPDKIKX0DER',
        granularityType: 'Marketplace',
        granularityId: 'ATVPDKIKX0DER'
      }
    }
  );
  
  const hasInventory = inventoryResponse.data.payload.inventorySummaries
    .some(item => item.asin === asin && item.totalQuantity > 0);
  
  // 3. Inferir Buy Box
  return {
    asin,
    hasInventory,
    probableWinner: hasInventory ? storeName : 'Competidor',
    confidence: hasInventory ? 'Alta' : 'Baixa'
  };
}
```

## 📌 Conclusão

Para o sistema de Buy Box em tempo real, a melhor abordagem é:

1. **Usar Sellers API** para obter o nome correto ("Connect Brands")
2. **Usar FBA Inventory API** para verificar estoque
3. **Usar Orders API** para verificar vendas recentes
4. **Inferir Buy Box** baseado na combinação de dados
5. **Monitorar mudanças** periodicamente para detectar hijackers

Isso contorna a limitação da Pricing API e ainda fornece dados úteis para o monitoramento.