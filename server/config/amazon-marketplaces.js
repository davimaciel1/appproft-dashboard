/**
 * Configuração de Marketplaces da Amazon
 * Dados fixos do sistema - não precisam ser solicitados ao usuário
 */

const AMAZON_MARKETPLACES = {
  // América
  'BR': {
    id: 'A2Q3Y263D00KWC',
    name: 'Brasil',
    endpoint: 'https://sellingpartnerapi-na.amazon.com',
    region: 'na',
    authUrl: 'https://sellercentral.amazon.com.br',
    currency: 'BRL',
    language: 'pt_BR'
  },
  'US': {
    id: 'ATVPDKIKX0DER',
    name: 'Estados Unidos',
    endpoint: 'https://sellingpartnerapi-na.amazon.com',
    region: 'na',
    authUrl: 'https://sellercentral.amazon.com',
    currency: 'USD',
    language: 'en_US'
  },
  'CA': {
    id: 'A2EUQ1WTGCTBG2',
    name: 'Canadá',
    endpoint: 'https://sellingpartnerapi-na.amazon.com',
    region: 'na',
    authUrl: 'https://sellercentral.amazon.ca',
    currency: 'CAD',
    language: 'en_CA'
  },
  'MX': {
    id: 'A1AM78C64UM0Y8',
    name: 'México',
    endpoint: 'https://sellingpartnerapi-na.amazon.com',
    region: 'na',
    authUrl: 'https://sellercentral.amazon.com.mx',
    currency: 'MXN',
    language: 'es_MX'
  },
  
  // Europa
  'UK': {
    id: 'A1F83G8C2ARO7P',
    name: 'Reino Unido',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    region: 'eu',
    authUrl: 'https://sellercentral.amazon.co.uk',
    currency: 'GBP',
    language: 'en_GB'
  },
  'DE': {
    id: 'A1PA6795UKMFR9',
    name: 'Alemanha',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    region: 'eu',
    authUrl: 'https://sellercentral.amazon.de',
    currency: 'EUR',
    language: 'de_DE'
  },
  'FR': {
    id: 'A13V1IB3VIYZZH',
    name: 'França',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    region: 'eu',
    authUrl: 'https://sellercentral.amazon.fr',
    currency: 'EUR',
    language: 'fr_FR'
  },
  'IT': {
    id: 'APJ6JRA9NG5V4',
    name: 'Itália',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    region: 'eu',
    authUrl: 'https://sellercentral.amazon.it',
    currency: 'EUR',
    language: 'it_IT'
  },
  'ES': {
    id: 'A1RKKUPIHCS9HS',
    name: 'Espanha',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    region: 'eu',
    authUrl: 'https://sellercentral.amazon.es',
    currency: 'EUR',
    language: 'es_ES'
  },
  
  // Ásia-Pacífico
  'JP': {
    id: 'A1VC38T7YXB528',
    name: 'Japão',
    endpoint: 'https://sellingpartnerapi-fe.amazon.com',
    region: 'fe',
    authUrl: 'https://sellercentral.amazon.co.jp',
    currency: 'JPY',
    language: 'ja_JP'
  },
  'AU': {
    id: 'A39IBJ37TRP1C6',
    name: 'Austrália',
    endpoint: 'https://sellingpartnerapi-fe.amazon.com',
    region: 'fe',
    authUrl: 'https://sellercentral.amazon.com.au',
    currency: 'AUD',
    language: 'en_AU'
  },
  'SG': {
    id: 'A19VAU5U5O7RUS',
    name: 'Singapura',
    endpoint: 'https://sellingpartnerapi-fe.amazon.com',
    region: 'fe',
    authUrl: 'https://sellercentral.amazon.sg',
    currency: 'SGD',
    language: 'en_SG'
  }
};

// Função helper para obter marketplace por ID
function getMarketplaceById(marketplaceId) {
  return Object.values(AMAZON_MARKETPLACES).find(m => m.id === marketplaceId);
}

// Função helper para obter marketplace por código do país
function getMarketplaceByCountry(countryCode) {
  return AMAZON_MARKETPLACES[countryCode.toUpperCase()];
}

// Função helper para obter lista de países para dropdown
function getCountryList() {
  return Object.entries(AMAZON_MARKETPLACES).map(([code, data]) => ({
    code,
    name: data.name,
    id: data.id
  }));
}

module.exports = {
  AMAZON_MARKETPLACES,
  getMarketplaceById,
  getMarketplaceByCountry,
  getCountryList
};