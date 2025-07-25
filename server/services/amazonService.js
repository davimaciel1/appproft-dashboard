const https = require('https');
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
                reject(new Error(`API Error: ${res.statusCode} - ${parsedData.errors?.[0]?.message || data}`));
              }
            } catch (error) {
              reject(new Error(`Parse Error: ${error.message}`));
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
