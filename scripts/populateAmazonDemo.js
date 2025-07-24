const { Pool } = require('pg');
require('dotenv').config();

class AmazonDemoData {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@localhost:5433/postgres'
    });
    
    // Produtos populares da Amazon Brasil com imagens reais
    this.products = [
      {
        asin: 'B0C5BG5T48',
        name: 'Echo Dot (5ª geração) - Smart Speaker com Alexa - Cor Preta',
        price: 299.00,
        image: 'https://m.media-amazon.com/images/I/71xoR4A6q2L._AC_SL1500_.jpg'
      },
      {
        asin: 'B0C5BCDWTQ',
        name: 'Fire TV Stick 4K - Streaming em 4K com Alexa Voice Remote',
        price: 379.00,
        image: 'https://m.media-amazon.com/images/I/51IgZL1U7ZL._AC_SL1000_.jpg'
      },
      {
        asin: 'B08N3TCP4K',
        name: 'Kindle Paperwhite (8GB) - À prova d\'água, tela de 6.8"',
        price: 599.00,
        image: 'https://m.media-amazon.com/images/I/61eAq6gg-XL._AC_SL1000_.jpg'
      },
      {
        asin: 'B0BDJ8SRHK',
        name: 'Echo Show 5 (2ª Geração) - Smart Display com Alexa',
        price: 549.00,
        image: 'https://m.media-amazon.com/images/I/71frcHD0KiL._AC_SL1500_.jpg'
      },
      {
        asin: 'B0BDJ89KTD',
        name: 'Fire TV Stick Lite - Streaming em Full HD com Alexa',
        price: 279.00,
        image: 'https://m.media-amazon.com/images/I/51i7M5YEJWL._AC_SL1000_.jpg'
      },
      {
        asin: 'B09B8V1LZ3',
        name: 'Echo Dot (4ª geração) com Relógio - Smart Speaker com Alexa',
        price: 399.00,
        image: 'https://m.media-amazon.com/images/I/81pqRLVYDqL._AC_SL1500_.jpg'
      },
      {
        asin: 'B08MQZXN1X',
        name: 'Kindle 10ª geração - Com iluminação embutida',
        price: 449.00,
        image: 'https://m.media-amazon.com/images/I/61X0ISBpD-L._AC_SL1000_.jpg'
      },
      {
        asin: 'B09B96TG33',
        name: 'Echo Studio - Smart Speaker com áudio de alta fidelidade',
        price: 1699.00,
        image: 'https://m.media-amazon.com/images/I/71RguylgEqL._AC_SL1500_.jpg'
      },
      {
        asin: 'B08N3J6QKK',
        name: 'Fire HD 8 - Tablet de 8" HD, 32 GB',
        price: 579.00,
        image: 'https://m.media-amazon.com/images/I/61GE4QelKjL._AC_SL1000_.jpg'
      },
      {
        asin: 'B07FZ8S74R',
        name: 'Echo Dot (3ª geração) - Smart Speaker com Alexa',
        price: 249.00,
        image: 'https://m.media-amazon.com/images/I/61MHLKG4U0L._AC_SL1000_.jpg'
      }
    ];
  }

  // Verificar e adicionar campos faltantes
  async checkAndAddColumns() {
    console.log('🔧 Verificando estrutura das tabelas...');
    
    try {
      // Adicionar campos faltantes em order_items
      await this.pool.query(`
        ALTER TABLE order_items 
        ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0
      `);
      
      // Garantir que products tem todos os campos necessários
      await this.pool.query(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS asin VARCHAR(50),
        ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'BR',
        ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tenant_id INTEGER
      `);
      
      // Atualizar tenant_id com user_id se estiver NULL
      await this.pool.query(`
        UPDATE products 
        SET tenant_id = user_id 
        WHERE tenant_id IS NULL
      `);
      
      console.log('✅ Estrutura das tabelas verificada!');
    } catch (error) {
      console.error('❌ Erro ao verificar estrutura:', error.message);
    }
  }

  // Salvar produto
  async saveProduct(productData, userId = 1) {
    try {
      const result = await this.pool.query(`
        INSERT INTO products (
          user_id,
          tenant_id,
          marketplace,
          marketplace_product_id,
          sku,
          asin,
          name,
          price,
          cost,
          image_url,
          inventory,
          country_code,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (marketplace, marketplace_product_id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          cost = EXCLUDED.cost,
          image_url = EXCLUDED.image_url,
          asin = EXCLUDED.asin,
          updated_at = NOW()
        RETURNING id
      `, [
        userId,
        userId,
        'amazon',
        productData.asin,
        productData.asin,
        productData.asin,
        productData.name,
        productData.price,
        productData.price * 0.6,
        productData.image,
        Math.floor(Math.random() * 200) + 50,
        'BR'
      ]);
      
      console.log(`  ✅ ${productData.name.substring(0, 50)}...`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Erro ao salvar produto:', error.message);
      return null;
    }
  }

  // Criar vendas realistas dos últimos 2 anos
  async createSalesHistory(productId, productPrice, productName) {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    // Padrão de vendas sazonal (mais vendas em datas comerciais)
    const salesPatterns = {
      'Echo Dot': { base: 15, blackFriday: 50, christmas: 40, motherDay: 25 },
      'Fire TV': { base: 10, blackFriday: 35, christmas: 30, motherDay: 15 },
      'Kindle': { base: 8, blackFriday: 25, christmas: 20, motherDay: 18 },
      'Echo Show': { base: 5, blackFriday: 15, christmas: 12, motherDay: 10 },
      'Fire HD': { base: 6, blackFriday: 18, christmas: 15, motherDay: 8 },
      'default': { base: 5, blackFriday: 15, christmas: 12, motherDay: 8 }
    };
    
    // Determinar padrão baseado no nome do produto
    let pattern = salesPatterns.default;
    for (const [key, value] of Object.entries(salesPatterns)) {
      if (productName.includes(key)) {
        pattern = value;
        break;
      }
    }
    
    let totalOrders = 0;
    const currentDate = new Date();
    
    // Gerar vendas para cada mês dos últimos 2 anos
    for (let d = new Date(twoYearsAgo); d < currentDate; d.setMonth(d.getMonth() + 1)) {
      const month = d.getMonth();
      const year = d.getFullYear();
      
      // Determinar número de vendas baseado no mês
      let salesThisMonth = pattern.base;
      
      // Black Friday (Novembro)
      if (month === 10) salesThisMonth = pattern.blackFriday;
      // Dezembro (Natal)
      else if (month === 11) salesThisMonth = pattern.christmas;
      // Maio (Dia das Mães)
      else if (month === 4) salesThisMonth = pattern.motherDay;
      // Janeiro-Fevereiro (pós-festas, menos vendas)
      else if (month <= 1) salesThisMonth = Math.floor(pattern.base * 0.7);
      
      // Adicionar variação aleatória (+/- 30%)
      salesThisMonth = Math.floor(salesThisMonth * (0.7 + Math.random() * 0.6));
      
      // Criar pedidos distribuídos no mês
      for (let i = 0; i < salesThisMonth; i++) {
        const orderDate = new Date(year, month, Math.floor(Math.random() * 28) + 1);
        const quantity = Math.random() > 0.8 ? 2 : 1; // 20% de chance de comprar 2 unidades
        
        try {
          // Criar pedido
          const orderResult = await this.pool.query(`
            INSERT INTO orders (
              user_id,
              tenant_id,
              marketplace,
              order_id,
              status,
              total_amount,
              order_date,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [
            1,
            1,
            'amazon',
            `AMZN-${year}-${month}-${productId}-${i}`,
            'completed',
            productPrice * quantity,
            orderDate,
            orderDate
          ]);
          
          // Criar item do pedido
          await this.pool.query(`
            INSERT INTO order_items (
              order_id,
              product_id,
              quantity,
              unit_price,
              cost
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            orderResult.rows[0].id,
            productId,
            quantity,
            productPrice,
            productPrice * 0.6
          ]);
          
          totalOrders++;
        } catch (error) {
          // Ignorar erros de duplicação
        }
      }
    }
    
    return totalOrders;
  }

  // Popular banco com dados de demonstração
  async populateDemo() {
    console.log('🚀 Populando banco com dados de demonstração da Amazon...\n');
    
    try {
      // Verificar estrutura das tabelas
      await this.checkAndAddColumns();
      
      console.log('\n📦 Inserindo produtos Amazon populares:');
      
      let totalProducts = 0;
      let totalOrders = 0;
      
      for (const product of this.products) {
        const productId = await this.saveProduct(product);
        
        if (productId) {
          totalProducts++;
          
          // Criar histórico de vendas
          const orders = await this.createSalesHistory(productId, product.price, product.name);
          totalOrders += orders;
          
          console.log(`    📊 ${orders} vendas criadas`);
        }
      }
      
      console.log(`\n✅ Dados de demonstração criados com sucesso!`);
      console.log(`   - Produtos: ${totalProducts}`);
      console.log(`   - Pedidos: ${totalOrders}`);
      
      // Mostrar resumo
      await this.showSummary();
      
    } catch (error) {
      console.error('❌ Erro ao popular dados:', error.message);
    } finally {
      await this.pool.end();
    }
  }

  // Mostrar resumo dos dados
  async showSummary() {
    console.log('\n📊 Resumo dos dados no banco:');
    
    try {
      const summary = await this.pool.query(`
        SELECT 
          COUNT(DISTINCT p.id) as total_produtos,
          COUNT(DISTINCT o.id) as total_pedidos,
          COALESCE(SUM(oi.quantity), 0) as total_unidades,
          COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue_total,
          MIN(o.order_date) as primeira_venda,
          MAX(o.order_date) as ultima_venda,
          COUNT(DISTINCT DATE_TRUNC('month', o.order_date)) as meses_com_vendas
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id
        WHERE p.marketplace = 'amazon'
      `);
      
      const result = summary.rows[0];
      console.table({
        'Total de Produtos': result.total_produtos || 0,
        'Total de Pedidos': result.total_pedidos || 0,
        'Unidades Vendidas': result.total_unidades || 0,
        'Revenue Total': `R$ ${parseFloat(result.revenue_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        'Primeira Venda': result.primeira_venda ? new Date(result.primeira_venda).toLocaleDateString('pt-BR') : 'N/A',
        'Última Venda': result.ultima_venda ? new Date(result.ultima_venda).toLocaleDateString('pt-BR') : 'N/A',
        'Meses com Vendas': result.meses_com_vendas || 0
      });
      
      // Top 5 produtos mais vendidos
      console.log('\n🏆 Top 5 Produtos Mais Vendidos:');
      const topProducts = await this.pool.query(`
        SELECT 
          p.name,
          p.asin,
          COUNT(DISTINCT o.id) as total_pedidos,
          SUM(oi.quantity) as unidades_vendidas,
          SUM(oi.quantity * oi.unit_price) as revenue
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE p.marketplace = 'amazon'
        GROUP BY p.id, p.name, p.asin
        ORDER BY unidades_vendidas DESC
        LIMIT 5
      `);
      
      console.table(topProducts.rows.map((p, i) => ({
        'Pos': i + 1,
        'Produto': p.name.substring(0, 50) + '...',
        'ASIN': p.asin,
        'Vendas': p.total_pedidos,
        'Unidades': p.unidades_vendidas,
        'Revenue': `R$ ${parseFloat(p.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      })));
      
    } catch (error) {
      console.error('❌ Erro ao mostrar resumo:', error.message);
    }
  }
}

// Executar
const demo = new AmazonDemoData();
demo.populateDemo();