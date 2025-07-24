const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

/**
 * Amazon SP-API Robust Sync Service
 * Implements best practices for handling API changes
 */
class AmazonRobustSync {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    this.credentials = {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: process.env.SP_API_MARKETPLACE_ID || 'ATVPDKIKX0DER',
      region: process.env.AMAZON_REGION || 'us-east-1'
    };
    
    this.baseUrl = 'https://sellingpartnerapi-na.amazon.com';
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Log unrecognized fields
    this.unrecognizedFields = new Map();
    this.logPath = path.join(__dirname, '../logs/sp-api-changes.log');
  }

  /**
   * Safe field extractor - handles new/unknown fields gracefully
   */
  safeExtract(obj, path, defaultValue = null) {
    try {
      const keys = path.split('.');
      let current = obj;
      
      for (const key of keys) {
        if (current === null || current === undefined) {
          return defaultValue;
        }
        current = current[key];
      }
      
      return current !== undefined ? current : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * Log unrecognized fields for future analysis
   */
  async logUnrecognizedField(context, field, value) {
    const key = `${context}.${field}`;
    
    if (!this.unrecognizedFields.has(key)) {
      this.unrecognizedFields.set(key, {
        firstSeen: new Date(),
        count: 0,
        examples: []
      });
    }
    
    const entry = this.unrecognizedFields.get(key);
    entry.count++;
    entry.lastSeen = new Date();
    
    // Keep up to 5 examples
    if (entry.examples.length < 5) {
      entry.examples.push({
        value: value,
        timestamp: new Date()
      });
    }
    
    // Write to log file
    const logEntry = `[${new Date().toISOString()}] NEW FIELD: ${key} = ${JSON.stringify(value)}\n`;
    await fs.appendFile(this.logPath, logEntry).catch(() => {});
  }

  /**
   * Flexible order parser - handles new fields automatically
   */
  async parseOrder(orderData) {
    // Known fields with safe extraction
    const order = {
      amazonOrderId: this.safeExtract(orderData, 'AmazonOrderId'),
      purchaseDate: this.safeExtract(orderData, 'PurchaseDate'),
      orderStatus: this.safeExtract(orderData, 'OrderStatus'),
      fulfillmentChannel: this.safeExtract(orderData, 'FulfillmentChannel'),
      salesChannel: this.safeExtract(orderData, 'SalesChannel'),
      shipServiceLevel: this.safeExtract(orderData, 'ShipServiceLevel'),
      totalAmount: this.safeExtract(orderData, 'OrderTotal.Amount', 0),
      currencyCode: this.safeExtract(orderData, 'OrderTotal.CurrencyCode', 'USD'),
      numberOfItems: this.safeExtract(orderData, 'NumberOfItemsShipped', 0) + 
                     this.safeExtract(orderData, 'NumberOfItemsUnshipped', 0),
      paymentMethod: this.safeExtract(orderData, 'PaymentMethod'),
      marketplaceId: this.safeExtract(orderData, 'MarketplaceId'),
      buyerEmail: this.safeExtract(orderData, 'BuyerEmail'),
      buyerName: this.safeExtract(orderData, 'BuyerName'),
      shipmentServiceLevelCategory: this.safeExtract(orderData, 'ShipmentServiceLevelCategory'),
      orderType: this.safeExtract(orderData, 'OrderType'),
      earliestShipDate: this.safeExtract(orderData, 'EarliestShipDate'),
      latestShipDate: this.safeExtract(orderData, 'LatestShipDate'),
      isBusinessOrder: this.safeExtract(orderData, 'IsBusinessOrder', false),
      isPrime: this.safeExtract(orderData, 'IsPrime', false),
      isPremiumOrder: this.safeExtract(orderData, 'IsPremiumOrder', false),
      isGlobalExpressEnabled: this.safeExtract(orderData, 'IsGlobalExpressEnabled', false)
    };
    
    // Store any additional fields dynamically
    order.additionalFields = {};
    
    // Check for new/unknown fields
    const knownFields = new Set([
      'AmazonOrderId', 'PurchaseDate', 'OrderStatus', 'FulfillmentChannel',
      'SalesChannel', 'ShipServiceLevel', 'OrderTotal', 'NumberOfItemsShipped',
      'NumberOfItemsUnshipped', 'PaymentMethod', 'MarketplaceId', 'BuyerEmail',
      'BuyerName', 'ShipmentServiceLevelCategory', 'OrderType', 'EarliestShipDate',
      'LatestShipDate', 'IsBusinessOrder', 'IsPrime', 'IsPremiumOrder',
      'IsGlobalExpressEnabled', 'LastUpdateDate', 'ShippingAddress',
      'DefaultShipFromLocationAddress', 'PaymentMethodDetails'
    ]);
    
    for (const [key, value] of Object.entries(orderData)) {
      if (!knownFields.has(key) && value !== null && value !== undefined) {
        order.additionalFields[key] = value;
        await this.logUnrecognizedField('Order', key, value);
      }
    }
    
    return order;
  }

  /**
   * Flexible order item parser
   */
  async parseOrderItem(itemData) {
    const item = {
      asin: this.safeExtract(itemData, 'ASIN'),
      orderItemId: this.safeExtract(itemData, 'OrderItemId'),
      sellerSKU: this.safeExtract(itemData, 'SellerSKU'),
      title: this.safeExtract(itemData, 'Title'),
      quantityOrdered: this.safeExtract(itemData, 'QuantityOrdered', 0),
      quantityShipped: this.safeExtract(itemData, 'QuantityShipped', 0),
      itemPrice: this.safeExtract(itemData, 'ItemPrice.Amount', 0),
      itemPriceCurrency: this.safeExtract(itemData, 'ItemPrice.CurrencyCode', 'USD'),
      promotionDiscount: this.safeExtract(itemData, 'PromotionDiscount.Amount', 0),
      itemTax: this.safeExtract(itemData, 'ItemTax.Amount', 0),
      shippingPrice: this.safeExtract(itemData, 'ShippingPrice.Amount', 0),
      shippingDiscount: this.safeExtract(itemData, 'ShippingDiscount.Amount', 0),
      giftWrapPrice: this.safeExtract(itemData, 'GiftWrapPrice.Amount', 0),
      conditionId: this.safeExtract(itemData, 'ConditionId'),
      conditionSubtypeId: this.safeExtract(itemData, 'ConditionSubtypeId'),
      isGift: this.safeExtract(itemData, 'IsGift', false),
      priceDesignation: this.safeExtract(itemData, 'PriceDesignation'),
      serialNumber: this.safeExtract(itemData, 'SerialNumber')
    };
    
    // Store additional fields
    item.additionalFields = {};
    
    const knownItemFields = new Set([
      'ASIN', 'OrderItemId', 'SellerSKU', 'Title', 'QuantityOrdered',
      'QuantityShipped', 'ItemPrice', 'PromotionDiscount', 'ItemTax',
      'ShippingPrice', 'ShippingDiscount', 'GiftWrapPrice', 'ConditionId',
      'ConditionSubtypeId', 'IsGift', 'PriceDesignation', 'SerialNumber',
      'ScheduledDeliveryStartDate', 'ScheduledDeliveryEndDate', 'CODFee',
      'CODFeeDiscount', 'GiftMessageText', 'GiftWrapLevel'
    ]);
    
    for (const [key, value] of Object.entries(itemData)) {
      if (!knownItemFields.has(key) && value !== null && value !== undefined) {
        item.additionalFields[key] = value;
        await this.logUnrecognizedField('OrderItem', key, value);
      }
    }
    
    return item;
  }

  /**
   * Flexible product catalog parser
   */
  async parseProduct(productData) {
    const product = {
      asin: this.safeExtract(productData, 'asin'),
      // Handle multiple possible locations for product title
      title: this.safeExtract(productData, 'summaries[0].itemName') ||
             this.safeExtract(productData, 'attributes.item_name[0].value') ||
             this.safeExtract(productData, 'attributes.title[0].value') ||
             `Product ${productData.asin}`,
      
      // Handle multiple image formats
      imageUrl: this.extractMainImage(productData),
      
      // Extract various attributes flexibly
      brand: this.safeExtract(productData, 'attributes.brand[0].value') ||
             this.safeExtract(productData, 'attributes.brand_name[0].value'),
      
      manufacturer: this.safeExtract(productData, 'attributes.manufacturer[0].value'),
      
      // Price might come from different sources
      listPrice: this.safeExtract(productData, 'attributes.list_price[0].value') ||
                 this.safeExtract(productData, 'salesRanks[0].displayGroupRanks[0].title'),
      
      // Categories and classifications
      productGroup: this.safeExtract(productData, 'productTypes[0].productType'),
      category: this.safeExtract(productData, 'classifications[0].displayName'),
      
      // Physical attributes
      color: this.safeExtract(productData, 'attributes.color[0].value'),
      size: this.safeExtract(productData, 'attributes.size[0].value'),
      weight: this.safeExtract(productData, 'attributes.item_weight[0].value'),
      
      // Additional identifiers
      ean: this.safeExtract(productData, 'identifiers[0].identifiers[0].identifier'),
      upc: this.safeExtract(productData, 'identifiers[1].identifiers[0].identifier'),
      
      // Sales rank
      salesRank: this.safeExtract(productData, 'salesRanks[0].displayGroupRanks[0].rank'),
      
      // Dimensions
      dimensions: {
        length: this.safeExtract(productData, 'attributes.item_dimensions.length[0].value'),
        width: this.safeExtract(productData, 'attributes.item_dimensions.width[0].value'),
        height: this.safeExtract(productData, 'attributes.item_dimensions.height[0].value')
      }
    };
    
    // Store all attributes for future use
    product.allAttributes = {};
    
    if (productData.attributes) {
      for (const [key, value] of Object.entries(productData.attributes)) {
        if (value && Array.isArray(value) && value.length > 0) {
          product.allAttributes[key] = value[0].value || value[0];
          
          // Log new attributes
          const commonAttributes = new Set([
            'item_name', 'brand', 'manufacturer', 'color', 'size',
            'item_weight', 'list_price', 'title', 'brand_name'
          ]);
          
          if (!commonAttributes.has(key)) {
            await this.logUnrecognizedField('ProductAttribute', key, value[0]);
          }
        }
      }
    }
    
    return product;
  }

  /**
   * Extract main image from various possible structures
   */
  extractMainImage(productData) {
    // Try different image locations
    const imagePaths = [
      'images[0].images',
      'images.primary.large',
      'images.main[0].link',
      'attributes.main_image_url[0].value'
    ];
    
    for (const path of imagePaths) {
      const images = this.safeExtract(productData, path);
      if (images) {
        if (Array.isArray(images)) {
          const mainImage = images.find(img => img.variant === 'MAIN');
          if (mainImage && mainImage.link) return mainImage.link;
          if (images[0] && images[0].link) return images[0].link;
        } else if (typeof images === 'string') {
          return images;
        }
      }
    }
    
    // Fallback to ASIN-based image URL
    return productData.asin ? 
      `https://images-na.ssl-images-amazon.com/images/P/${productData.asin}.jpg` : 
      null;
  }

  /**
   * Save order with flexible schema
   */
  async saveOrder(orderData, userId = 1) {
    try {
      const order = await this.parseOrder(orderData);
      
      // Save core fields
      const result = await this.pool.query(`
        INSERT INTO orders (
          user_id, tenant_id, marketplace, marketplace_order_id,
          status, total, order_date, buyer_email, buyer_name,
          items_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (user_id, marketplace, marketplace_order_id) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          total = EXCLUDED.total,
          updated_at = NOW()
        RETURNING id
      `, [
        userId, userId, 'amazon', order.amazonOrderId,
        order.orderStatus?.toLowerCase() || 'pending',
        parseFloat(order.totalAmount || 0),
        order.purchaseDate ? new Date(order.purchaseDate) : new Date(),
        order.buyerEmail, order.buyerName, order.numberOfItems
      ]);
      
      const orderId = result.rows[0].id;
      
      // Save additional fields in a separate metadata table
      if (Object.keys(order.additionalFields).length > 0) {
        await this.pool.query(`
          INSERT INTO order_metadata (order_id, metadata)
          VALUES ($1, $2)
          ON CONFLICT (order_id) DO UPDATE
          SET metadata = EXCLUDED.metadata
        `, [orderId, JSON.stringify(order.additionalFields)]);
      }
      
      return orderId;
    } catch (error) {
      console.error('Error saving order:', error.message);
      return null;
    }
  }

  /**
   * Save product with flexible schema
   */
  async saveProduct(productData, userId = 1) {
    try {
      const product = await this.parseProduct(productData);
      
      const result = await this.pool.query(`
        INSERT INTO products (
          user_id, tenant_id, marketplace, marketplace_product_id,
          sku, asin, name, price, cost, image_url, 
          brand, category, country_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (marketplace, marketplace_product_id) 
        DO UPDATE SET 
          name = COALESCE(EXCLUDED.name, products.name),
          image_url = COALESCE(EXCLUDED.image_url, products.image_url),
          brand = COALESCE(EXCLUDED.brand, products.brand),
          category = COALESCE(EXCLUDED.category, products.category),
          updated_at = NOW()
        RETURNING id
      `, [
        userId, userId, 'amazon', product.asin,
        product.asin, product.asin, product.title,
        parseFloat(product.listPrice || 0), 0, product.imageUrl,
        product.brand, product.category, 'US'
      ]);
      
      const productId = result.rows[0].id;
      
      // Save all attributes for future reference
      if (Object.keys(product.allAttributes).length > 0) {
        await this.pool.query(`
          INSERT INTO product_attributes (product_id, attributes)
          VALUES ($1, $2)
          ON CONFLICT (product_id) DO UPDATE
          SET attributes = EXCLUDED.attributes
        `, [productId, JSON.stringify(product.allAttributes)]);
      }
      
      return productId;
    } catch (error) {
      console.error('Error saving product:', error.message);
      return null;
    }
  }

  /**
   * Create metadata tables if they don't exist
   */
  async ensureMetadataTables() {
    try {
      // Create order metadata table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS order_metadata (
          order_id INTEGER REFERENCES orders(id) PRIMARY KEY,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create product attributes table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS product_attributes (
          product_id INTEGER REFERENCES products(id) PRIMARY KEY,
          attributes JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      console.log('✅ Metadata tables ready');
    } catch (error) {
      console.error('Error creating metadata tables:', error.message);
    }
  }

  /**
   * Generate report of unrecognized fields
   */
  async generateFieldReport() {
    if (this.unrecognizedFields.size === 0) {
      console.log('No unrecognized fields found.');
      return;
    }
    
    console.log('\n📊 Unrecognized Fields Report:');
    console.log('================================\n');
    
    for (const [field, data] of this.unrecognizedFields.entries()) {
      console.log(`Field: ${field}`);
      console.log(`First seen: ${data.firstSeen.toLocaleString()}`);
      console.log(`Occurrences: ${data.count}`);
      console.log(`Example values:`);
      data.examples.forEach(ex => {
        console.log(`  - ${JSON.stringify(ex.value)}`);
      });
      console.log('');
    }
    
    // Save report to file
    const report = {
      generatedAt: new Date(),
      fields: Object.fromEntries(this.unrecognizedFields)
    };
    
    await fs.writeFile(
      path.join(__dirname, '../logs/field-report.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

module.exports = AmazonRobustSync;