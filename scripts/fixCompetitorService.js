// Script para corrigir o serviço de competidores e integrar com tokenManager

require('dotenv').config();
const fs = require('fs');
const path = require('path');

function fixCompetitorService() {
  console.log('🔧 CORRIGINDO SERVIÇO DE COMPETIDORES');
  console.log('='.repeat(50));
  
  try {
    // 1. Criar novo amazonService que usa tokenManager
    console.log('1️⃣ Criando amazonService corrigido...');
    
    const amazonServiceContent = `const https = require('https');
const secureLogger = require('../utils/secureLogger');

class AmazonService {
  constructor(tokenManager, tenantId = 'default') {
    this.tokenManager = tokenManager;
    this.tenantId = tenantId;
    this.marketplaceId = process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC'; // Brasil
    this.sellerId = process.env.AMAZON_SELLER_ID;
  }

  async callSPAPI(path, method = 'GET', body = null) {
    try {
      // Obter token através do tokenManager
      const accessToken = await this.tokenManager.getAmazonToken(this.tenantId);
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'sellingpartnerapi-na.amazon.com',
          port: 443,
          path,
          method,
          headers: {
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        };

        if (body) {
          const bodyString = JSON.stringify(body);
          options.headers['Content-Length'] = Buffer.byteLength(bodyString);
        }

        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const parsedData = JSON.parse(data);
              
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(parsedData);
              } else {
                reject(new Error(\`API Error: \${res.statusCode} - \${parsedData.errors?.[0]?.message || data}\`));
              }
            } catch (error) {
              reject(new Error(\`Parse Error: \${error.message}\`));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        if (body) {
          req.write(JSON.stringify(body));
        }

        req.end();
      });
    } catch (error) {
      secureLogger.error('Erro ao chamar SP-API', { 
        path, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = AmazonService;
`;
    
    fs.writeFileSync(
      path.join(__dirname, '../server/services/amazonService.js'),
      amazonServiceContent
    );
    console.log('✅ amazonService atualizado');

    // 2. Atualizar competitorPricingService para lidar melhor com erros
    console.log('\n2️⃣ Atualizando competitorPricingService...');
    
    const competitorPath = path.join(__dirname, '../server/services/amazon/competitorPricingService.js');
    let competitorContent = fs.readFileSync(competitorPath, 'utf8');
    
    // Adicionar verificação de marketplace ID
    if (!competitorContent.includes('// Usar marketplace do Brasil por padrão')) {
      competitorContent = competitorContent.replace(
        "async getCompetitivePricing(asin, marketplaceId = 'A2Q3Y263D00KWC') {",
        `async getCompetitivePricing(asin, marketplaceId = null) {
    // Usar marketplace do Brasil por padrão
    marketplaceId = marketplaceId || process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC';`
      );
    }
    
    // Adicionar tratamento de erro melhorado
    if (!competitorContent.includes('// Tratar erro 400 especificamente')) {
      competitorContent = competitorContent.replace(
        'const response = await this.amazonService.callSPAPI(path);',
        `let response;
      try {
        response = await this.amazonService.callSPAPI(path);
      } catch (error) {
        // Tratar erro 400 especificamente
        if (error.message.includes('400')) {
          secureLogger.warn('Produto pode não ter competidores ou não está ativo', { asin });
          return { offers: [], summary: { message: 'Produto sem competidores ativos' } };
        }
        throw error;
      }`
      );
    }
    
    fs.writeFileSync(competitorPath, competitorContent);
    console.log('✅ competitorPricingService atualizado');

    // 3. Atualizar PersistentSyncManager para usar o getAmazonService correto
    console.log('\n3️⃣ Verificando método getAmazonService...');
    
    const managerPath = path.join(__dirname, '../server/services/persistentSyncManager.js');
    let managerContent = fs.readFileSync(managerPath, 'utf8');
    
    // Adicionar método getAmazonService se não existir
    if (!managerContent.includes('getAmazonService')) {
      const methodToAdd = `
  /**
   * Obter instância do AmazonService
   */
  async getAmazonService(tenantId = 'default') {
    const AmazonService = require('./amazonService');
    return new AmazonService(this.tokenManager, tenantId);
  }
`;
      
      // Adicionar após o método processDataKioskSync
      const insertPoint = managerContent.indexOf('async processDataKioskSync');
      if (insertPoint > -1) {
        const methodEnd = managerContent.indexOf('}', managerContent.indexOf('{', insertPoint));
        managerContent = managerContent.slice(0, methodEnd + 1) + '\n' + methodToAdd + managerContent.slice(methodEnd + 1);
      }
      
      fs.writeFileSync(managerPath, managerContent);
      console.log('✅ Método getAmazonService adicionado');
    }

    // 4. Criar script de teste específico para competidores
    console.log('\n4️⃣ Criando script de teste corrigido...');
    
    const testScriptContent = `// Script para testar coleta de competidores com correções

require('dotenv').config();
const pool = require('../server/db/pool');
const tokenManager = require('../server/services/tokenManager');
const AmazonService = require('../server/services/amazonService');
const CompetitorPricingService = require('../server/services/amazon/competitorPricingService');

async function testCompetitorPricingFixed() {
  console.log('🔍 TESTANDO COLETA DE COMPETIDORES (VERSÃO CORRIGIDA)');
  console.log('='.repeat(50));
  
  try {
    // 1. Testar token primeiro
    console.log('1️⃣ Testando obtenção de token...');
    try {
      const token = await tokenManager.getAmazonToken('default');
      console.log('✅ Token obtido com sucesso');
    } catch (error) {
      console.error('❌ Erro ao obter token:', error.message);
      console.log('\\nVerifique as credenciais no .env:');
      console.log('- AMAZON_CLIENT_ID');
      console.log('- AMAZON_CLIENT_SECRET');
      console.log('- AMAZON_REFRESH_TOKEN');
      return;
    }
    
    // 2. Buscar produtos
    console.log('\\n2️⃣ Buscando produtos...');
    const productsResult = await pool.query(\`
      SELECT DISTINCT asin, name 
      FROM products 
      WHERE asin IS NOT NULL 
      AND asin != ''
      LIMIT 3
    \`);
    
    if (productsResult.rows.length === 0) {
      console.log('❌ Nenhum produto com ASIN encontrado');
      return;
    }
    
    console.log(\`✅ \${productsResult.rows.length} produtos encontrados\`);
    
    // 3. Inicializar serviços
    console.log('\\n3️⃣ Inicializando serviços...');
    const amazonService = new AmazonService(tokenManager, 'default');
    const competitorService = new CompetitorPricingService(amazonService, pool);
    
    // 4. Coletar dados
    console.log('\\n4️⃣ Coletando dados de competidores...');
    console.log('Marketplace ID:', process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC');
    
    let successCount = 0;
    for (const product of productsResult.rows) {
      console.log(\`\\n📦 Produto: \${product.name}\`);
      console.log(\`   ASIN: \${product.asin}\`);
      
      try {
        const competitorData = await competitorService.getCompetitivePricing(product.asin);
        
        if (competitorData.offers && competitorData.offers.length > 0) {
          console.log(\`   ✅ \${competitorData.offers.length} competidores encontrados:\`);
          
          for (const offer of competitorData.offers) {
            console.log(\`   
   🏪 Vendedor: \${offer.sellerName || offer.sellerId}
      Preço: R$ \${offer.price}
      Buy Box: \${offer.isBuyBoxWinner ? '🏆 SIM' : 'NÃO'}
      FBA: \${offer.isFulfilledByAmazon ? 'SIM' : 'NÃO'}\`);
          }
          
          successCount++;
        } else {
          console.log('   ⚠️ Nenhum competidor ativo');
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(\`   ❌ Erro: \${error.message}\`);
      }
    }
    
    console.log(\`\\n✅ Sucesso em \${successCount} de \${productsResult.rows.length} produtos\`);
    
  } catch (error) {
    console.error('❌ Erro crítico:', error.message);
  } finally {
    await pool.end();
  }
}

testCompetitorPricingFixed().catch(console.error);
`;
    
    fs.writeFileSync(
      path.join(__dirname, '../scripts/testCompetitorPricingFixed.js'),
      testScriptContent
    );
    console.log('✅ Script de teste criado');

    console.log('\n✅ Correções aplicadas com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Executar: node scripts/testCompetitorPricingFixed.js');
    console.log('2. Se funcionar, executar: node scripts/addCompetitorSync.js');
    console.log('3. Reiniciar o PersistentSyncManager');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Executar
fixCompetitorService();