const { Pool } = require('pg');
require('dotenv').config();

async function verifyDashboardData() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== VERIFICANDO DADOS DO DASHBOARD ===\n');
    
    // 1. Verificar credenciais do usuário admin
    const credsResult = await pool.query(`
      SELECT * FROM marketplace_credentials 
      WHERE user_id = 1 AND marketplace = 'amazon'
    `);
    
    if (credsResult.rows.length > 0) {
      const creds = credsResult.rows[0];
      console.log('✅ Credenciais encontradas para usuário admin');
      console.log('Client ID:', creds.client_id || 'NÃO CONFIGURADO');
      console.log('Client Secret:', creds.client_secret ? '✅ Configurado' : '❌ NÃO CONFIGURADO');
      console.log('Refresh Token:', creds.refresh_token ? '✅ Configurado' : '❌ NÃO CONFIGURADO');
      console.log('Seller ID:', creds.seller_id || 'NÃO CONFIGURADO');
      console.log('Marketplace ID:', creds.marketplace_id || 'NÃO CONFIGURADO');
      
      // Se tem credenciais na nova estrutura, vamos convertê-las
      if (creds.credentials) {
        console.log('\n⚠️ Credenciais estão no formato JSON antigo. Migrando...');
        
        try {
          const credentialsData = JSON.parse(creds.credentials);
          
          // Migrar para colunas separadas
          await pool.query(`
            UPDATE marketplace_credentials 
            SET 
              client_id = $1,
              client_secret = $2,
              refresh_token = $3,
              seller_id = $4,
              marketplace_id = $5
            WHERE user_id = $6 AND marketplace = 'amazon'
          `, [
            credentialsData.clientId || credentialsData.client_id,
            credentialsData.clientSecret || credentialsData.client_secret,
            credentialsData.refreshToken || credentialsData.refresh_token,
            credentialsData.sellerId || credentialsData.seller_id,
            credentialsData.marketplaceId || credentialsData.marketplace_id || 'ATVPDKIKX0DER',
            1
          ]);
          
          console.log('✅ Credenciais migradas com sucesso!');
        } catch (e) {
          console.error('Erro ao migrar:', e.message);
        }
      }
    } else {
      console.log('❌ Nenhuma credencial Amazon encontrada para o usuário admin');
      console.log('\nVamos criar credenciais usando dados do .env...');
      
      if (process.env.AMAZON_CLIENT_ID && process.env.AMAZON_REFRESH_TOKEN) {
        await pool.query(`
          INSERT INTO marketplace_credentials 
            (user_id, marketplace, client_id, client_secret, refresh_token, seller_id, marketplace_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          1, 
          'amazon',
          process.env.AMAZON_CLIENT_ID,
          process.env.AMAZON_CLIENT_SECRET,
          process.env.AMAZON_REFRESH_TOKEN,
          process.env.AMAZON_SELLER_ID,
          'ATVPDKIKX0DER'
        ]);
        
        console.log('✅ Credenciais criadas com sucesso!');
      }
    }
    
    // 2. Testar chamada ao dashboard
    console.log('\n=== TESTANDO SERVIÇOS ===\n');
    
    const AmazonService = require('./server/services/amazonService');
    const CredentialsService = require('./server/services/credentialsService');
    
    const credentialsService = new CredentialsService();
    const amazonCreds = await credentialsService.getCredentials(1, 'amazon');
    
    if (amazonCreds) {
      console.log('Credenciais recuperadas do CredentialsService:');
      console.log('- clientId:', amazonCreds.clientId || amazonCreds.client_id || 'NÃO ENCONTRADO');
      console.log('- refreshToken:', amazonCreds.refreshToken || amazonCreds.refresh_token ? '✅' : '❌');
      
      // Ajustar formato das credenciais
      const formattedCreds = {
        clientId: amazonCreds.clientId || amazonCreds.client_id,
        clientSecret: amazonCreds.clientSecret || amazonCreds.client_secret,
        refreshToken: amazonCreds.refreshToken || amazonCreds.refresh_token,
        sellerId: amazonCreds.sellerId || amazonCreds.seller_id,
        marketplaceId: amazonCreds.marketplaceId || amazonCreds.marketplace_id || 'ATVPDKIKX0DER'
      };
      
      console.log('\nTestando conexão com Amazon SP-API...');
      const amazonService = new AmazonService(formattedCreds);
      const testResult = await amazonService.testConnection();
      
      if (testResult.success) {
        console.log('✅ Conexão com Amazon SP-API funcionando!');
        console.log('Marketplaces ativos:', testResult.marketplaces);
      } else {
        console.log('❌ Erro na conexão:', testResult.error);
      }
    }
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

verifyDashboardData();