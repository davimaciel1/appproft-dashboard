const { Pool } = require('pg');
require('dotenv').config();

async function fixCredentialsFormat() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
  
  try {
    console.log('=== CORRIGINDO FORMATO DAS CREDENCIAIS ===\n');
    
    // Buscar credenciais atuais
    const result = await pool.query(`
      SELECT * FROM marketplace_credentials 
      WHERE user_id = 1 AND marketplace = 'amazon'
    `);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('Credenciais encontradas. Verificando formato...');
      
      // Criar objeto de credenciais no formato esperado pelo CredentialsService
      const credentials = {
        clientId: row.client_id,
        clientSecret: row.client_secret,
        refreshToken: row.refresh_token,
        sellerId: row.seller_id,
        marketplaceId: row.marketplace_id || 'ATVPDKIKX0DER'
      };
      
      // Atualizar a coluna credentials com o formato JSON
      await pool.query(`
        UPDATE marketplace_credentials 
        SET credentials = $1
        WHERE user_id = 1 AND marketplace = 'amazon'
      `, [JSON.stringify(credentials)]);
      
      console.log('✅ Formato das credenciais corrigido!');
      console.log('\nCredenciais salvas:');
      console.log('- clientId:', credentials.clientId);
      console.log('- clientSecret:', credentials.clientSecret ? '✅ Configurado' : '❌');
      console.log('- refreshToken:', credentials.refreshToken ? '✅ Configurado' : '❌');
      console.log('- sellerId:', credentials.sellerId);
      console.log('- marketplaceId:', credentials.marketplaceId);
      
      // Testar o CredentialsService
      console.log('\n=== TESTANDO CREDENTIALSSERVICE ===');
      const CredentialsService = require('./server/services/credentialsService');
      const credentialsService = new CredentialsService();
      
      const retrievedCreds = await credentialsService.getCredentials(1, 'amazon');
      if (retrievedCreds) {
        console.log('✅ CredentialsService funcionando!');
        console.log('Credenciais recuperadas com sucesso');
      } else {
        console.log('❌ Erro ao recuperar credenciais');
      }
    }
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

fixCredentialsFormat();