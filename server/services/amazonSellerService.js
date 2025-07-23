const https = require('https');
const { getMarketplaceByCountry } = require('../config/amazon-marketplaces');

/**
 * Serviço para obter informações do vendedor automaticamente
 */
class AmazonSellerService {
  
  /**
   * Obtém o Seller ID e outras informações do vendedor
   * @param {string} accessToken - Access token válido
   * @param {string} marketplaceCode - Código do país (BR, US, etc)
   */
  async getSellerInfo(accessToken, marketplaceCode) {
    const marketplace = getMarketplaceByCountry(marketplaceCode);
    
    if (!marketplace) {
      throw new Error(`Marketplace não encontrado: ${marketplaceCode}`);
    }

    return new Promise((resolve, reject) => {
      const endpoint = marketplace.endpoint;
      const url = new URL('/sellers/v1/marketplaceParticipations', endpoint);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode !== 200) {
              reject(new Error(`API Error: ${res.statusCode} - ${data}`));
              return;
            }

            // Extrair informações do vendedor
            const sellerInfo = this.extractSellerInfo(response, marketplace.id);
            resolve(sellerInfo);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Extrai as informações relevantes do vendedor da resposta da API
   */
  extractSellerInfo(response, targetMarketplaceId) {
    // A resposta contém um array de participações em marketplaces
    const participations = response.payload || [];
    
    // Encontrar a participação do marketplace desejado
    const participation = participations.find(p => 
      p.marketplace.id === targetMarketplaceId
    );

    if (!participation) {
      // Se não encontrar o marketplace específico, pegar o primeiro
      const firstParticipation = participations[0];
      if (firstParticipation) {
        return {
          sellerId: firstParticipation.seller.sellerId,
          sellerName: firstParticipation.seller.name,
          marketplaceId: firstParticipation.marketplace.id,
          marketplaceName: firstParticipation.marketplace.name,
          countryCode: firstParticipation.marketplace.countryCode,
          defaultCurrencyCode: firstParticipation.marketplace.defaultCurrencyCode,
          defaultLanguageCode: firstParticipation.marketplace.defaultLanguageCode,
          participationStatus: firstParticipation.participation.isParticipating
        };
      }
    }

    return {
      sellerId: participation.seller.sellerId,
      sellerName: participation.seller.name,
      marketplaceId: participation.marketplace.id,
      marketplaceName: participation.marketplace.name,
      countryCode: participation.marketplace.countryCode,
      defaultCurrencyCode: participation.marketplace.defaultCurrencyCode,
      defaultLanguageCode: participation.marketplace.defaultLanguageCode,
      participationStatus: participation.participation.isParticipating,
      // Listar todos os marketplaces onde o vendedor participa
      allMarketplaces: participations.map(p => ({
        id: p.marketplace.id,
        name: p.marketplace.name,
        countryCode: p.marketplace.countryCode,
        isParticipating: p.participation.isParticipating
      }))
    };
  }

  /**
   * Obtém informações do vendedor para o Mercado Livre
   */
  async getMercadoLivreSellerInfo(accessToken) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.mercadolibre.com',
        path: '/users/me',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode !== 200) {
              reject(new Error(`API Error: ${res.statusCode} - ${data}`));
              return;
            }

            resolve({
              sellerId: response.id,
              nickname: response.nickname,
              email: response.email,
              siteId: response.site_id,
              country: response.country_id,
              registrationDate: response.registration_date,
              reputation: response.seller_reputation,
              status: response.status
            });
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = new AmazonSellerService();