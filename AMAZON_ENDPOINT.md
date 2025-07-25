# Documentação Técnica Completa: Amazon SP-API e Data Kiosk - Todos os Endpoints (2024/2025)

## Índice Geral
1. [Informações Base e Autenticação](#informações-base-e-autenticação)
2. [Orders API](#orders-api)
3. [Catalog Items API](#catalog-items-api)
4. [Product Pricing API](#product-pricing-api)
5. [Inventory API](#inventory-api)
6. [Reports API](#reports-api)
7. [Notifications API](#notifications-api)
8. [Fulfillment API](#fulfillment-api)
9. [Finances API](#finances-api)
10. [Sellers API](#sellers-api)
11. [Tokens API](#tokens-api)
12. [Authorization API](#authorization-api)
13. [Data Kiosk Analytics API](#data-kiosk-analytics-api)

---

## Informações Base e Autenticação

### URLs Base por Região
- **América do Norte**: `https://sellingpartnerapi-na.amazon.com`
- **Europa**: `https://sellingpartnerapi-eu.amazon.com`
- **Extremo Oriente**: `https://sellingpartnerapi-fe.amazon.com`

### Headers Obrigatórios para Todas as Requisições
```http
Authorization: AWS4-HMAC-SHA256 Credential=ACCESS_KEY/date/region/execute-api/aws4_request, SignedHeaders=host;x-amz-access-token;x-amz-date, Signature=signature
x-amz-access-token: Atza|LWA_ACCESS_TOKEN
x-amz-date: 20241201T123000Z
host: sellingpartnerapi-na.amazon.com
user-agent: YourApplication/1.0
```

---

## Orders API

### 1. getOrders
- **URL**: `GET /orders/v0/orders`
- **Método HTTP**: GET
- **Rate Limit**: 0.0167 req/s, Burst: 20

**Parâmetros Obrigatórios**:
- `MarketplaceIds` (array): Lista de IDs de marketplace (máx 50)
- `CreatedAfter` (ISO 8601) OU `LastUpdatedAfter` (ISO 8601)

**Parâmetros Opcionais**:
- `CreatedBefore`, `LastUpdatedBefore` (ISO 8601)
- `OrderStatuses`: PendingAvailability, Pending, Unshipped, PartiallyShipped, Shipped, InvoiceUnconfirmed, Canceled, Unfulfillable
- `FulfillmentChannels`: AFN, MFN
- `PaymentMethods`: COD, CVS, Other
- `BuyerEmail`, `SellerOrderId`, `MaxResultsPerPage` (1-100), `NextToken`
- `AmazonOrderIds` (array, máx 50)
- `ActualFulfillmentSupplySourceId`, `IsISPU`, `StoreChainStoreId`
- `ItemApprovalTypes`, `ItemApprovalStatus`
- `EarliestDeliveryDateBefore/After`, `LatestDeliveryDateBefore/After`

**Exemplo de Response**:
```json
{
  "payload": {
    "Orders": [{
      "AmazonOrderId": "123-4567890-1234567",
      "SellerOrderId": "SEL-123",
      "PurchaseDate": "2024-12-01T10:00:00Z",
      "LastUpdateDate": "2024-12-01T11:00:00Z",
      "OrderStatus": "Shipped",
      "FulfillmentChannel": "AFN",
      "OrderTotal": {
        "CurrencyCode": "USD",
        "Amount": "99.99"
      }
    }],
    "NextToken": "token123"
  }
}
```

### 2. getOrder
- **URL**: `GET /orders/v0/orders/{orderId}`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30
- **Parâmetro Obrigatório**: `orderId` (path) - Formato 3-7-7

### 3. getOrderBuyerInfo
- **URL**: `GET /orders/v0/orders/{orderId}/buyerInfo`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30
- **Requer**: Restricted Data Token (RDT)

### 4. getOrderAddress
- **URL**: `GET /orders/v0/orders/{orderId}/address`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30
- **Requer**: Restricted Data Token (RDT)

### 5. getOrderItems
- **URL**: `GET /orders/v0/orders/{orderId}/orderItems`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30

### 6. getOrderItemsBuyerInfo
- **URL**: `GET /orders/v0/orders/{orderId}/orderItems/buyerInfo`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30
- **Requer**: Restricted Data Token (RDT)

### 7. updateShipmentStatus
- **URL**: `POST /orders/v0/orders/{orderId}/shipment`
- **Método HTTP**: POST
- **Rate Limit**: 5 req/s, Burst: 15

**Request Body**:
```json
{
  "marketplaceId": "ATVPDKIKX0DER",
  "shipmentStatus": "ReadyForPickup",
  "orderItems": [{
    "orderItemId": "123456789",
    "quantity": 1
  }]
}
```

### 8. getOrderRegulatedInfo
- **URL**: `GET /orders/v0/orders/{orderId}/regulatedInfo`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30

### 9. updateVerificationStatus
- **URL**: `PATCH /orders/v0/orders/{orderId}/regulatedInfo`
- **Método HTTP**: PATCH
- **Rate Limit**: 0.5 req/s, Burst: 30

### 10. confirmShipment
- **URL**: `POST /orders/v0/orders/{orderId}/shipmentConfirmation`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 10

---

## Catalog Items API

### Versão 2022-04-01 (Mais Recente)

#### 1. searchCatalogItems
- **URL**: `GET /catalog/2022-04-01/items`
- **Método HTTP**: GET
- **Rate Limit**: 5 req/s, Burst: 5 (conta-aplicação)

**Parâmetros Obrigatórios**:
- `marketplaceIds`: Lista de IDs de marketplace (máx 1)

**Parâmetros Opcionais**:
- `identifiers`: Identificadores de produto (máx 20)
- `identifiersType`: ASIN, EAN, GTIN, ISBN, JAN, MINSAN, SKU, UPC
- `keywords`: Palavras-chave de busca (máx 20)
- `keywordsLocale`: Locale das palavras-chave
- `includedData`: summaries, attributes, browseClassifications, dimensions, identifiers, images, productTypes, relationships, salesRanks, vendorDetails
- `locale`: Locale para propriedades localizadas
- `sellerId`: Obrigatório quando identifiersType é SKU
- `pageSize`: 1-20 (padrão 10)
- `pageToken`: Token de paginação

**Exemplo de Response**:
```json
{
  "numberOfResults": 1000,
  "pagination": {
    "nextToken": "string"
  },
  "items": [{
    "asin": "B08N5WRWNW",
    "summaries": [{
      "marketplaceId": "ATVPDKIKX0DER",
      "itemName": "Example Product",
      "brandName": "Example Brand",
      "mainImage": {
        "link": "https://m.media-amazon.com/images/I/example.jpg",
        "height": 500,
        "width": 500
      }
    }]
  }]
}
```

#### 2. getCatalogItem
- **URL**: `GET /catalog/2022-04-01/items/{asin}`
- **Método HTTP**: GET
- **Rate Limit**: 5 req/s, Burst: 5
- **Parâmetros Obrigatórios**: `asin` (path), `marketplaceIds` (query)

---

## Product Pricing API

### Versão v0 (Legacy)

#### 1. getPricing
- **URL**: `GET /products/pricing/v0/price`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 1

**Parâmetros Obrigatórios**:
- `MarketplaceId`: ID do marketplace
- `ItemType`: "Asin" ou "Sku"

**Parâmetros Opcionais**:
- `Asins`: Lista de ASINs (máx 20)
- `Skus`: Lista de SKUs (máx 20)
- `ItemCondition`: New, Used, Collectible, Refurbished, Club
- `OfferType`: B2C (padrão), B2B

#### 2. getCompetitivePricing
- **URL**: `GET /products/pricing/v0/competitivePrice`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 1

#### 3. getListingOffers
- **URL**: `GET /products/pricing/v0/listings/{SellerSKU}/offers`
- **Método HTTP**: GET
- **Rate Limit**: 1 req/s, Burst: 2

#### 4. getItemOffers
- **URL**: `GET /products/pricing/v0/items/{Asin}/offers`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 1

#### 5. getItemOffersBatch
- **URL**: `POST /batches/products/pricing/v0/itemOffers`
- **Método HTTP**: POST
- **Rate Limit**: 0.1 req/s, Burst: 1

#### 6. getListingOffersBatch
- **URL**: `POST /batches/products/pricing/v0/listingOffers`
- **Método HTTP**: POST
- **Rate Limit**: 0.5 req/s, Burst: 1

### Versão v2022-05-01 (Recomendada)

#### 1. getFeaturedOfferExpectedPriceBatch
- **URL**: `POST /batches/products/pricing/2022-05-01/offer/featuredOfferExpectedPrice`
- **Método HTTP**: POST
- **Rate Limit**: 0.033 req/s, Burst: 1

**Request Body**:
```json
{
  "requests": [{
    "uri": "/products/pricing/2022-05-01/offer/featuredOfferExpectedPrice",
    "method": "POST",
    "marketplaceId": "ATVPDKIKX0DER",
    "sku": "MY-SKU-123"
  }]
}
```

#### 2. getCompetitiveSummary
- **URL**: `POST /batches/products/pricing/2022-05-01/items/competitiveSummary`
- **Método HTTP**: POST
- **Rate Limit**: 0.033 req/s, Burst: 1

---

## Inventory API

### FBA Inventory API v1

#### 1. getInventorySummaries
- **URL**: `GET /fba/inventory/v1/summaries`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 2

**Parâmetros Obrigatórios**:
- `granularityType`: "Marketplace"
- `granularityId`: ID do marketplace

**Parâmetros Opcionais**:
- `details`: Boolean para detalhes adicionais
- `startDateTime`: ISO 8601
- `sellerSkus`: Array de SKUs (máx 50)
- `sellerSku`: SKU único
- `nextToken`: Token de paginação

**Exemplo de Response**:
```json
{
  "payload": {
    "inventorySummaries": [{
      "asin": "B00AAG2MHY",
      "fnSku": "X00123456",
      "sellerSku": "MY-SKU-001",
      "condition": "NewItem",
      "inventoryDetails": {
        "fulfillableQuantity": 100,
        "inboundWorkingQuantity": 10,
        "inboundShippedQuantity": 5,
        "inboundReceivingQuantity": 3,
        "reservedQuantity": {
          "totalReservedQuantity": 2,
          "pendingCustomerOrderQuantity": 1
        }
      },
      "totalQuantity": 105
    }]
  }
}
```

#### 2. createInventoryItem (Sandbox Only)
- **URL**: `POST /fba/inventory/v1/items`
- **Método HTTP**: POST

#### 3. deleteInventoryItem (Sandbox Only)
- **URL**: `DELETE /fba/inventory/v1/items/{sellerSku}`
- **Método HTTP**: DELETE

#### 4. addInventory (Sandbox Only)
- **URL**: `POST /fba/inventory/v1/items/inventory`
- **Método HTTP**: POST

---

## Reports API

### Versão 2021-06-30

#### 1. getReports
- **URL**: `GET /reports/2021-06-30/reports`
- **Método HTTP**: GET
- **Rate Limit**: 0.0222 req/s, Burst: 10

**Parâmetros Opcionais**:
- `reportTypes`: Array de tipos de relatório (1-10)
- `processingStatuses`: CANCELLED, DONE, FATAL, IN_PROGRESS, IN_QUEUE
- `marketplaceIds`: Array de IDs (1-10)
- `pageSize`: 1-100 (padrão 10)
- `createdSince`: ISO 8601 (padrão 90 dias atrás)
- `createdUntil`: ISO 8601
- `nextToken`: Token de paginação

#### 2. createReport
- **URL**: `POST /reports/2021-06-30/reports`
- **Método HTTP**: POST
- **Rate Limit**: 0.0167 req/s, Burst: 15

**Request Body**:
```json
{
  "reportType": "GET_MERCHANT_LISTINGS_ALL_DATA",
  "dataStartTime": "2024-12-01T00:00:00Z",
  "dataEndTime": "2024-12-01T23:59:59Z",
  "marketplaceIds": ["ATVPDKIKX0DER"],
  "reportOptions": {
    "custom": "true"
  }
}
```

#### 3. getReport
- **URL**: `GET /reports/2021-06-30/reports/{reportId}`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 15

#### 4. cancelReport
- **URL**: `DELETE /reports/2021-06-30/reports/{reportId}`
- **Método HTTP**: DELETE
- **Rate Limit**: 0.0222 req/s, Burst: 10

#### 5. getReportSchedules
- **URL**: `GET /reports/2021-06-30/schedules`
- **Método HTTP**: GET
- **Rate Limit**: 0.0222 req/s, Burst: 10

#### 6. createReportSchedule
- **URL**: `POST /reports/2021-06-30/schedules`
- **Método HTTP**: POST
- **Rate Limit**: 0.0222 req/s, Burst: 10

**Valores de Period**:
- `PT5M`, `PT15M`, `PT30M`: 5, 15, 30 minutos
- `PT1H`, `PT2H`, `PT4H`, `PT8H`, `PT12H`: 1-12 horas
- `P1D`, `P2D`, `P3D`, `P7D`, `P14D`, `P30D`: 1-30 dias
- `P1M`: 1 mês

#### 7. getReportSchedule
- **URL**: `GET /reports/2021-06-30/schedules/{reportScheduleId}`
- **Método HTTP**: GET

#### 8. cancelReportSchedule
- **URL**: `DELETE /reports/2021-06-30/schedules/{reportScheduleId}`
- **Método HTTP**: DELETE

#### 9. getReportDocument
- **URL**: `GET /reports/2021-06-30/documents/{reportDocumentId}`
- **Método HTTP**: GET
- **Rate Limit**: 0.0167 req/s, Burst: 15

**Response**:
```json
{
  "reportDocumentId": "DOC-b8b0-4226-b4b9-0ee058ea5760",
  "url": "https://d34o8swod1owfl.cloudfront.net/SampleResult",
  "compressionAlgorithm": "GZIP"
}
```

### Tipos de Relatórios de Inventário

1. **GET_FLAT_FILE_OPEN_LISTINGS_DATA**: Resumo de listagens com preço e quantidade
2. **GET_MERCHANT_LISTINGS_ALL_DATA**: Relatório detalhado de todas as listagens
3. **GET_MERCHANT_LISTINGS_DATA**: Relatório de listagens ativas
4. **GET_MERCHANT_LISTINGS_INACTIVE_DATA**: Relatório de listagens inativas
5. **GET_MERCHANT_LISTINGS_DATA_LITE**: SKU, ASIN, Preço e Quantidade
6. **GET_MERCHANT_LISTINGS_DATA_LITER**: Apenas SKU e Quantidade
7. **GET_MERCHANTS_LISTINGS_FYP_REPORT**: Listagens suprimidas
8. **GET_REFERRAL_FEE_PREVIEW_REPORT**: Taxas de referência estimadas

---

## Notifications API

### Versão v1

#### 1. getSubscription
- **URL**: `GET /notifications/v1/subscriptions/{notificationType}`
- **Método HTTP**: GET
- **Rate Limit**: 1 req/s, Burst: 5

**Parâmetros**:
- `notificationType` (path): Tipo de notificação
- `payloadVersion` (query): Versão do payload

#### 2. createSubscription
- **URL**: `POST /notifications/v1/subscriptions/{notificationType}`
- **Método HTTP**: POST
- **Rate Limit**: 1 req/s, Burst: 5

**Request Body**:
```json
{
  "payloadVersion": "1.0",
  "destinationId": "destination-id-456",
  "processingDirective": {
    "eventFilter": {
      "marketplaceIds": ["ATVPDKIKX0DER"],
      "eventFilterType": "ANY_OFFER_CHANGED",
      "aggregationSettings": {
        "aggregationTimePeriod": "FiveMinutes"
      }
    }
  }
}
```

#### 3. getSubscriptionById
- **URL**: `GET /notifications/v1/subscriptions/{notificationType}/{subscriptionId}`
- **Método HTTP**: GET
- **Rate Limit**: 1 req/s, Burst: 5

#### 4. deleteSubscription
- **URL**: `DELETE /notifications/v1/subscriptions/{notificationType}/{subscriptionId}`
- **Método HTTP**: DELETE
- **Rate Limit**: 1 req/s, Burst: 5

#### 5. getDestinations
- **URL**: `GET /notifications/v1/destinations`
- **Método HTTP**: GET
- **Rate Limit**: 1 req/s, Burst: 5

#### 6. createDestination
- **URL**: `POST /notifications/v1/destinations`
- **Método HTTP**: POST
- **Rate Limit**: 1 req/s, Burst: 5

**Request Body (SQS)**:
```json
{
  "name": "MyDestination",
  "resourceSpecification": {
    "sqs": {
      "arn": "arn:aws:sqs:us-east-1:123456789012:MyQueue"
    }
  }
}
```

**Request Body (EventBridge)**:
```json
{
  "name": "MyEventBridgeDestination",
  "resourceSpecification": {
    "eventBridge": {
      "region": "us-east-1",
      "accountId": "123456789012"
    }
  }
}
```

#### 7. getDestination
- **URL**: `GET /notifications/v1/destinations/{destinationId}`
- **Método HTTP**: GET
- **Rate Limit**: 1 req/s, Burst: 5

#### 8. deleteDestination
- **URL**: `DELETE /notifications/v1/destinations/{destinationId}`
- **Método HTTP**: DELETE
- **Rate Limit**: 1 req/s, Burst: 5

### Tipos de Notificação Suportados

1. **ANY_OFFER_CHANGED**: Mudanças em ofertas
2. **ORDER_CHANGE**: Mudanças em pedidos
3. **PRICING_HEALTH**: Saúde de preços
4. **FBA_INVENTORY_AVAILABILITY_CHANGES**: Mudanças na disponibilidade FBA
5. **BRANDED_ITEM_CONTENT_CHANGE**: Mudanças em conteúdo de marca
6. **LISTINGS_ITEM_STATUS_CHANGE**: Mudanças no status de listagens
7. **LISTINGS_ITEM_ISSUES_CHANGE**: Mudanças em problemas de listagens
8. **FEED_PROCESSING_FINISHED**: Processamento de feed concluído
9. **REPORT_PROCESSING_FINISHED**: Processamento de relatório concluído

---

## Fulfillment API

### Fulfillment Outbound API v2020-07-01

#### 1. getFulfillmentPreview
- **URL**: `POST /fba/outbound/2020-07-01/fulfillmentOrders/preview`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

**Request Body**:
```json
{
  "marketplaceId": "ATVPDKIKX0DER",
  "address": {
    "name": "John Doe",
    "addressLine1": "123 Main St",
    "city": "Seattle",
    "stateOrRegion": "WA",
    "postalCode": "98101",
    "countryCode": "US"
  },
  "items": [{
    "sellerSku": "SKU123",
    "quantity": 1,
    "sellerFulfillmentOrderItemId": "ITEM123"
  }]
}
```

#### 2. deliveryOffers
- **URL**: `POST /fba/outbound/2020-07-01/deliveryOffers`
- **Método HTTP**: POST
- **Rate Limit**: 5 req/s, Burst: 30

#### 3. listAllFulfillmentOrders
- **URL**: `GET /fba/outbound/2020-07-01/fulfillmentOrders`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 4. createFulfillmentOrder
- **URL**: `POST /fba/outbound/2020-07-01/fulfillmentOrders`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

**Request Body**:
```json
{
  "sellerFulfillmentOrderId": "ORDER123",
  "displayableOrderId": "DISPLAY123",
  "displayableOrderDate": "2024-12-01T10:00:00Z",
  "shippingSpeedCategory": "Standard",
  "destinationAddress": {
    "name": "John Doe",
    "addressLine1": "123 Main St",
    "city": "Seattle",
    "stateOrRegion": "WA",
    "postalCode": "98101",
    "countryCode": "US"
  },
  "fulfillmentAction": "Ship",
  "fulfillmentPolicy": "FillAll",
  "items": [{
    "sellerSku": "SKU123",
    "sellerFulfillmentOrderItemId": "ITEM123",
    "quantity": 1
  }]
}
```

#### 5. getPackageTrackingDetails
- **URL**: `GET /fba/outbound/2020-07-01/tracking`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 6. listReturnReasonCodes
- **URL**: `GET /fba/outbound/2020-07-01/returnReasonCodes`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 7. createFulfillmentReturn
- **URL**: `PUT /fba/outbound/2020-07-01/fulfillmentOrders/{sellerFulfillmentOrderId}/return`
- **Método HTTP**: PUT
- **Rate Limit**: 2 req/s, Burst: 30

#### 8. getFulfillmentOrder
- **URL**: `GET /fba/outbound/2020-07-01/fulfillmentOrders/{sellerFulfillmentOrderId}`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 9. updateFulfillmentOrder
- **URL**: `PUT /fba/outbound/2020-07-01/fulfillmentOrders/{sellerFulfillmentOrderId}`
- **Método HTTP**: PUT
- **Rate Limit**: 2 req/s, Burst: 30

#### 10. cancelFulfillmentOrder
- **URL**: `PUT /fba/outbound/2020-07-01/fulfillmentOrders/{sellerFulfillmentOrderId}/cancel`
- **Método HTTP**: PUT
- **Rate Limit**: 2 req/s, Burst: 30

#### 11. getFeatures
- **URL**: `GET /fba/outbound/2020-07-01/features`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 12. getFeatureInventory
- **URL**: `GET /fba/outbound/2020-07-01/features/inventory/{featureName}`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 13. getFeatureSKU
- **URL**: `GET /fba/outbound/2020-07-01/features/inventory/{featureName}/{sellerSku}`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

### Fulfillment Inbound API v2024-03-20

#### 1. listInboundPlans
- **URL**: `GET /inbound/fba/2024-03-20/inboundPlans`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 2. createInboundPlan
- **URL**: `POST /inbound/fba/2024-03-20/inboundPlans`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

**Request Body**:
```json
{
  "name": "My Inbound Plan",
  "sourceAddress": {
    "name": "Warehouse",
    "addressLine1": "123 Industrial Blvd",
    "city": "Los Angeles",
    "stateOrProvinceCode": "CA",
    "countryCode": "US",
    "postalCode": "90001"
  },
  "destinationMarketplaces": ["ATVPDKIKX0DER"],
  "items": [{
    "msku": "MY-SKU-001",
    "quantity": 100,
    "prepOwner": "AMAZON",
    "labelOwner": "AMAZON"
  }]
}
```

#### 3. getInboundPlan
- **URL**: `GET /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 4. listPackingOptions
- **URL**: `GET /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/packingOptions`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 5. generatePackingOptions
- **URL**: `POST /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/packingOptions`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

#### 6. confirmPackingOption
- **URL**: `POST /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/packingOptions/{packingOptionId}/confirmation`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

#### 7. listPlacementOptions
- **URL**: `GET /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/placementOptions`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 8. generatePlacementOptions
- **URL**: `POST /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/placementOptions`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

#### 9. confirmPlacementOption
- **URL**: `POST /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/placementOptions/{placementOptionId}/confirmation`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

#### 10. getShipment
- **URL**: `GET /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/shipments/{shipmentId}`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 11. listTransportationOptions
- **URL**: `GET /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/shipments/{shipmentId}/transportationOptions`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

#### 12. generateTransportationOptions
- **URL**: `POST /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/shipments/{shipmentId}/transportationOptions`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

#### 13. confirmTransportationOptions
- **URL**: `POST /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/shipments/{shipmentId}/transportationOptions/{transportationOptionId}/confirmation`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

#### 14. getLabels
- **URL**: `GET /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/shipments/{shipmentId}/labels`
- **Método HTTP**: GET
- **Rate Limit**: 2 req/s, Burst: 30

**Parâmetros Obrigatórios**:
- `pageType`: LETTER, LEGAL, A4
- `labelType`: BARCODE_2D, UNIQUE

#### 15. generateLabels
- **URL**: `POST /inbound/fba/2024-03-20/inboundPlans/{inboundPlanId}/shipments/{shipmentId}/labels`
- **Método HTTP**: POST
- **Rate Limit**: 2 req/s, Burst: 30

---

## Finances API

### Versão v0

#### 1. listFinancialEventGroups
- **URL**: `GET /finances/v0/financialEventGroups`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30

**Parâmetros Opcionais**:
- `MaxResultsPerPage`: 1-100
- `FinancialEventGroupStartedBefore`: ISO 8601
- `FinancialEventGroupStartedAfter`: ISO 8601
- `NextToken`: Token de paginação

**Response**:
```json
{
  "payload": {
    "FinancialEventGroupList": [{
      "FinancialEventGroupId": "group-id-123",
      "ProcessingStatus": "Open",
      "FundTransferStatus": "Processing",
      "OriginalTotal": {
        "CurrencyAmount": 1000.50,
        "CurrencyCode": "USD"
      },
      "FundTransferDate": "2024-07-25T12:00:00Z",
      "FinancialEventGroupStart": "2024-07-24T00:00:00Z",
      "FinancialEventGroupEnd": "2024-07-25T00:00:00Z"
    }]
  }
}
```

#### 2. listFinancialEventsByGroupId
- **URL**: `GET /finances/v0/financialEventGroups/{eventGroupId}/financialEvents`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30

#### 3. listFinancialEventsByOrderId
- **URL**: `GET /finances/v0/orders/{orderId}/financialEvents`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30

#### 4. listFinancialEvents
- **URL**: `GET /finances/v0/financialEvents`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 30

**Parâmetros Opcionais**:
- `MaxResultsPerPage`: 1-100
- `PostedAfter`: ISO 8601
- `PostedBefore`: ISO 8601
- `NextToken`: Token de paginação

---

## Sellers API

### Versão v1

#### 1. getMarketplaceParticipations
- **URL**: `GET /sellers/v1/marketplaceParticipations`
- **Método HTTP**: GET
- **Rate Limit**: Varia por parceiro de vendas

**Response**:
```json
{
  "payload": {
    "marketplaceParticipations": [{
      "marketplace": {
        "id": "ATVPDKIKX0DER",
        "name": "Amazon.com",
        "countryCode": "US",
        "defaultCurrencyCode": "USD",
        "defaultLanguageCode": "en_US",
        "domainName": "www.amazon.com"
      },
      "participation": {
        "isParticipating": true,
        "hasSuspendedListings": false
      }
    }]
  }
}
```

**Roles Requeridas**: Selling Partner Insights

---

## Tokens API

### Versão 2021-03-01

#### 1. createRestrictedDataToken
- **URL**: `POST /tokens/2021-03-01/restrictedDataToken`
- **Método HTTP**: POST
- **Rate Limit**: Varia por parceiro de vendas

**Request Body**:
```json
{
  "restrictedResources": [{
    "method": "GET",
    "path": "/orders/v0/orders/{orderId}/address",
    "dataElements": ["shippingAddress"]
  }, {
    "method": "GET",
    "path": "/orders/v0/orders",
    "dataElements": ["buyerInfo", "shippingAddress"]
  }],
  "targetApplication": "amzn1.application-oa2-client.{client_id}"
}
```

**Response**:
```json
{
  "restrictedDataToken": "Atz.sprdt|IQEBLjAsAhRmHjNgHpi0U-Dme37rR6CuUpSREXAMPLE",
  "expiresIn": 3600
}
```

**Operações que Requerem RDT**:
- Orders API: getOrders, getOrder, getOrderItems, getOrderAddress, getOrderBuyerInfo, getOrderItemsBuyerInfo
- Reports API: getReportDocument (para tipos de relatório restritos)
- Direct Fulfillment APIs: getOrders, getOrder, getShippingLabel, getPackingSlip, getCustomerInvoice
- Merchant Fulfillment API: getShipment, cancelShipment, createShipment

---

## Authorization API

### Login with Amazon (LWA)

#### 1. Access Token Endpoint
- **URL**: `https://api.amazon.com/auth/o2/token`
- **Método HTTP**: POST

**Para Autorização de Parceiro de Vendas**:
```
grant_type=refresh_token&
refresh_token=Atzr|IQEBLzAtAhexample&
client_id=foodev&
client_secret=Y76SDl2F
```

**Para Operações Grantless**:
```
grant_type=client_credentials&
scope=sellingpartnerapi::notifications&
client_id=foodev&
client_secret=Y76SDl2F
```

**Response**:
```json
{
  "access_token": "Atza|IQEBLjAsAhRmHjNgHpi0U-Dme37rR6CuUpSREXAMPLE",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "Atzr|IQEBLzAtAhRPpMJxdwVz2Nn6f2y-tpJX2DeXEXAMPLE"
}
```

#### 2. OAuth Authorization Flow
**URI de Autorização**:
```
https://sellercentral.amazon.com/apps/authorize/consent?
application_id={your_application_id}&
state={state_value}&
version=beta
```

---

## Data Kiosk Analytics API

### Versão 2023-11-15

#### URLs Base Completas
- **América do Norte**: `https://sellingpartnerapi-na.amazon.com/dataKiosk/2023-11-15/`
- **Europa**: `https://sellingpartnerapi-eu.amazon.com/dataKiosk/2023-11-15/`
- **Extremo Oriente**: `https://sellingpartnerapi-fe.amazon.com/dataKiosk/2023-11-15/`

#### 1. createQuery
- **URL**: `POST /dataKiosk/2023-11-15/queries`
- **Método HTTP**: POST
- **Rate Limit**: 0.0167 req/s (1 por minuto), Burst: 15

**Request Body**:
```json
{
  "query": "query MyQuery { analytics_salesAndTraffic_2024_04_24 { salesAndTrafficByAsin(startDate: \"2024-01-01\", endDate: \"2024-01-31\", aggregateBy: ASIN) { metrics { groupByKey { asin } metrics { sales { orderedProductSales { amount currencyCode } } } } } } }"
}
```

#### 2. getQueries
- **URL**: `GET /dataKiosk/2023-11-15/queries`
- **Método HTTP**: GET
- **Rate Limit**: 0.5 req/s, Burst: 10

**Query Parameters**:
- `createdSince`: ISO 8601 (padrão: 90 dias atrás)
- `createdUntil`: ISO 8601
- `processingStatuses`: Array de status
- `pageSize`: Integer
- `nextToken`: String

#### 3. getQuery
- **URL**: `GET /dataKiosk/2023-11-15/queries/{queryId}`
- **Método HTTP**: GET
- **Rate Limit**: 2.0 req/s, Burst: 20

#### 4. cancelQuery
- **URL**: `DELETE /dataKiosk/2023-11-15/queries/{queryId}`
- **Método HTTP**: DELETE
- **Rate Limit**: 0.5 req/s, Burst: 10

#### 5. getDocument
- **URL**: `GET /dataKiosk/2023-11-15/documents/{documentId}`
- **Método HTTP**: GET
- **Rate Limit**: 0.0167 req/s, Burst: 15

**Response**:
```json
{
  "documentUrl": "https://s3.amazonaws.com/...",
  "compressionAlgorithm": "GZIP"
}
```

### Datasets Disponíveis

#### 1. Sales and Traffic Dataset
**Queries Disponíveis**:
- `salesAndTrafficByAsin`: Agregado por ASIN (PARENT, CHILD, SKU)
- `salesAndTrafficByDate`: Agregado por data (DAY, WEEK, MONTH)

**Métricas Principais**:
- Sales: orderedProductSales, unitsOrdered, averageSellingPrice
- Traffic: browserPageViews, sessions, buyBoxPercentage

#### 2. Economics Dataset
**Componentes**:
- `ads`: Dados de gastos com publicidade
- `cost`: Custo por unidade fora da Amazon
- `fees`: Taxas aplicadas
- `fnsku`: Fulfillment Network SKU
- `msku`: Merchant SKU
- `netProceeds`: Receitas líquidas
- `sales`: Dados de vendas

#### 3. Vendor Analytics Dataset
**Views Disponíveis**:
- `manufacturingView`: Produtos fabricados pelo vendor
- `sourcingView`: Produtos fornecidos diretamente para Amazon

**Grupos de Métricas**:
- Orders: orderedUnitsWithRevenue, unfilledOrderedUnits
- Costs: netPPM, salesDiscount, shippedCogs
- Inventory: sellableOnHandInventory, unsellableOnHandInventory
- Traffic: glanceViews (apenas manufacturing view)
- Forecasting: previsões de demanda (apenas manufacturing view)

### Exemplo de Query GraphQL
```graphql
query MyQuery {
  analytics_salesAndTraffic_2024_04_24 {
    salesAndTrafficByDate(
      startDate: "2024-01-01"
      endDate: "2024-01-31"
      aggregateBy: DAY
    ) {
      startDate
      endDate
      metrics {
        sales {
          orderedProductSales { amount currencyCode }
          unitsOrdered
        }
        traffic {
          browserPageViews
          sessions
        }
      }
    }
  }
}
```

### Integração com Notificações
- **Tipo de Notificação**: `DATA_KIOSK_QUERY_PROCESSING_FINISHED`
- **Serviço**: Amazon SQS
- **Payload de Notificação**:
```json
{
  "notificationType": "DATA_KIOSK_QUERY_PROCESSING_FINISHED",
  "payload": {
    "queryId": "amzn1.datakiosk.query.12345...",
    "processingStatus": "DONE",
    "dataDocumentId": "amzn1.datakiosk.document.67890...",
    "accountId": "amzn1.account.123456"
  }
}
```

---

## Atualizações 2024/2025

### Principais Mudanças e Novos Recursos

1. **Depreciações Importantes**:
   - Catalog Items API v0: Será removida em 31 de março de 2025
   - Reports API v2 Settlement: Depreciada em 17 de março de 2025, remoção em 25 de março de 2026
   - Migração obrigatória para Solution Provider Portal até 31 de agosto de 2025

2. **Novos Recursos**:
   - Data Kiosk: Lançamento geral em novembro de 2023 como substituto do Reports API
   - Vendor Analytics: Novas métricas incluindo sellableInTransitInventory
   - Fulfillment Inbound API v2024-03-20: Nova versão com melhor gerenciamento de remessas
   - Product Pricing v2022-05-01: Featured Offer Expected Price (FOEP)

3. **Melhorias de Segurança**:
   - Política de Proteção de Dados (DPP) atualizada em junho de 2024
   - Novos requisitos de segurança para aplicações públicas
   - Controles aprimorados de acesso a dados PII

4. **Otimizações de Performance**:
   - Rate limits dinâmicos baseados em padrões de uso
   - Suporte para operações em batch em mais APIs
   - SDKs pré-construídos para Java e PHP

### Melhores Práticas para 2024/2025

1. **Gerenciamento de Rate Limits**:
   - Implementar exponential backoff com jitter
   - Monitorar headers de rate limit
   - Usar operações batch quando disponível
   - Preferir arquitetura orientada a eventos sobre polling

2. **Segurança**:
   - Armazenar refresh tokens criptografados
   - Rotacionar tokens antes da expiração
   - Implementar validação adequada de certificados
   - Usar RDT tokens apenas quando necessário

3. **Migração e Compatibilidade**:
   - Migrar de APIs v0 para versões mais recentes
   - Testar em sandbox antes de produção
   - Manter compatibilidade com múltiplas versões durante transição
   - Documentar todas as dependências de API

Esta documentação técnica completa fornece todas as especificações necessárias para implementar integrações com Amazon SP-API e Data Kiosk, incluindo todos os endpoints, parâmetros, exemplos e atualizações para 2024/2025.