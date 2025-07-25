const axios = require('axios');
const tokenManager = require('../tokenManager');

/**
 * Cliente para Amazon Data Kiosk API
 * Gerencia queries GraphQL assíncronas e download de resultados
 */
class DataKioskClient {
  constructor() {
    this.baseUrl = 'https://sellingpartnerapi-na.amazon.com';
    this.apiVersion = '2023-11-15';
    this.requestsPerSecond = 0.5; // Rate limit conservador
    this.lastRequestTime = 0;
  }

  /**
   * Rate limiter simples
   */
  async rateLimitWait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minTimeBetweenRequests = 1000 / this.requestsPerSecond;
    
    if (timeSinceLastRequest < minTimeBetweenRequests) {
      await new Promise(resolve => 
        setTimeout(resolve, minTimeBetweenRequests - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Criar uma nova query no Data Kiosk
   */
  async createQuery(query, tenantId) {
    await this.rateLimitWait();
    
    try {
      // Obter token válido
      const token = await tokenManager.getAmazonToken(tenantId);
      
      console.log('📝 Criando query no Data Kiosk...');
      
      const response = await axios.post(
        `${this.baseUrl}/dataKiosk/${this.apiVersion}/queries`,
        { query },
        {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('✅ Query criada:', response.data.queryId);
      return response.data.queryId;
      
    } catch (error) {
      console.error('❌ Erro ao criar query:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Verificar status de uma query
   */
  async checkQueryStatus(queryId, tenantId) {
    await this.rateLimitWait();
    
    try {
      const token = await tokenManager.getAmazonToken(tenantId);
      
      const response = await axios.get(
        `${this.baseUrl}/dataKiosk/${this.apiVersion}/queries/${queryId}`,
        {
          headers: { 
            'x-amz-access-token': token,
            'Accept': 'application/json'
          }
        }
      );

      const status = response.data;
      // O campo correto é processingStatus, não status
      status.status = status.processingStatus || status.status;
      console.log(`📊 Status da query ${queryId}:`, status.status);
      
      if (status.status === 'FAILED') {
        throw new Error(`Query falhou: ${status.errorMessage || 'Erro desconhecido'}`);
      }
      
      return status;
      
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obter URL do documento com resultados
   */
  async getDocument(documentId, tenantId) {
    await this.rateLimitWait();
    
    try {
      const token = await tokenManager.getAmazonToken(tenantId);
      
      const response = await axios.get(
        `${this.baseUrl}/dataKiosk/${this.apiVersion}/documents/${documentId}`,
        {
          headers: { 
            'x-amz-access-token': token,
            'Accept': 'application/json'
          }
        }
      );

      console.log('📄 URL do documento obtida');
      return response.data.documentUrl;
      
    } catch (error) {
      console.error('❌ Erro ao obter documento:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Baixar resultados do documento
   */
  async downloadResults(documentUrl) {
    try {
      console.log('⬇️ Baixando resultados...');
      
      const response = await axios.get(documentUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Os resultados vêm em formato NDJSON (newline delimited JSON)
      const ndjsonData = response.data;
      
      // Se for string, processar como NDJSON
      if (typeof ndjsonData === 'string') {
        const lines = ndjsonData.trim().split('\n');
        const results = [];
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              results.push(JSON.parse(line));
            } catch (e) {
              console.warn('⚠️ Linha inválida ignorada:', line);
            }
          }
        }
        
        console.log(`✅ ${results.length} registros processados`);
        
        // Retornar no formato esperado pelo processador
        return {
          data: {
            analytics_salesAndTraffic_2023_11_15: {
              salesAndTrafficByDate: results
            }
          }
        };
      }
      
      // Se já for objeto, retornar como está
      console.log('✅ Resultados baixados com sucesso');
      return response.data;
      
    } catch (error) {
      console.error('❌ Erro ao baixar resultados:', error.message);
      throw error;
    }
  }

  /**
   * Executar query completa (criar, aguardar, baixar)
   */
  async executeQuery(query, tenantId, maxWaitTime = 600000) { // 10 minutos max
    try {
      // 1. Criar query
      const queryId = await this.createQuery(query, tenantId);
      
      // 2. Aguardar processamento
      const startTime = Date.now();
      let status;
      
      do {
        // Aguardar antes de verificar (começa com 10s, aumenta até 30s)
        const waitTime = Math.min(10000 + (Date.now() - startTime) / 10, 30000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        status = await this.checkQueryStatus(queryId, tenantId);
        
        if (Date.now() - startTime > maxWaitTime) {
          throw new Error('Timeout aguardando processamento da query');
        }
        
      } while (status.status === 'IN_PROGRESS' || status.status === 'QUEUED' || status.status === 'IN_QUEUE');
      
      // 3. Baixar resultados se completo
      const documentId = status.documentId || status.dataDocumentId;
      if ((status.status === 'COMPLETED' || status.status === 'DONE') && documentId) {
        const documentUrl = await this.getDocument(documentId, tenantId);
        const results = await this.downloadResults(documentUrl);
        
        return {
          queryId,
          status: 'SUCCESS',
          data: results
        };
      }
      
      throw new Error(`Query terminou com status: ${status.status}`);
      
    } catch (error) {
      console.error('❌ Erro na execução da query:', error.message);
      throw error;
    }
  }
}

module.exports = new DataKioskClient();