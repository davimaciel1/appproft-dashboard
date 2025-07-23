const { Pool } = require('pg');
require('dotenv').config();

async function checkCredentialsStatus() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('=== STATUS DAS CREDENCIAIS NO SISTEMA ===\n');
    
    // 1. Verificar .env
    console.log('📁 CREDENCIAIS NO .ENV:');
    console.log('LWA_CLIENT_ID:', process.env.LWA_CLIENT_ID ? '✅ Configurado' : '❌ Não configurado');
    console.log('LWA_CLIENT_SECRET:', process.env.LWA_CLIENT_SECRET ? '✅ Configurado' : '❌ Não configurado');
    console.log('AMAZON_CLIENT_ID:', process.env.AMAZON_CLIENT_ID ? '✅ Configurado' : '❌ Não configurado');
    console.log('AMAZON_CLIENT_SECRET:', process.env.AMAZON_CLIENT_SECRET ? '✅ Configurado' : '❌ Não configurado');
    
    // 2. Verificar banco de dados
    console.log('\n💾 CREDENCIAIS NO BANCO DE DADOS:');
    const result = await pool.query(`
      SELECT 
        user_id,
        marketplace,
        client_id,
        client_secret,
        refresh_token,
        access_token,
        seller_id,
        marketplace_id,
        created_at,
        updated_at
      FROM marketplace_credentials
      WHERE marketplace = 'amazon'
      ORDER BY user_id
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nenhuma credencial Amazon encontrada no banco!');
    } else {
      result.rows.forEach(row => {
        console.log(`\nUsuário ID ${row.user_id}:`);
        console.log('  Client ID:', row.client_id || '❌ Não configurado');
        console.log('  Client Secret:', row.client_secret ? '✅ Configurado' : '❌ Não configurado');
        console.log('  Refresh Token:', row.refresh_token ? '✅ Configurado' : '❌ Não configurado');
        console.log('  Access Token:', row.access_token ? '✅ Configurado' : '❌ Não configurado');
        console.log('  Seller ID:', row.seller_id || '❌ Não configurado');
        console.log('  Marketplace ID:', row.marketplace_id || '❌ Não configurado');
        console.log('  Criado em:', row.created_at);
        console.log('  Atualizado em:', row.updated_at);
      });
    }
    
    // 3. Explicar o fluxo atual
    console.log('\n🔄 FLUXO ATUAL DO SISTEMA:');
    console.log('1. Usuário fornece Client ID e Client Secret na interface');
    console.log('2. Sistema salva no banco de dados (NÃO usa mais .env)');
    console.log('3. Usuário clica "Gerar Refresh Token"');
    console.log('4. Sistema usa credenciais DO BANCO para OAuth');
    console.log('5. Refresh token é salvo no banco para o usuário');
    
    console.log('\n⚠️  IMPORTANTE:');
    console.log('O sistema agora é MULTI-TENANT - cada usuário tem suas próprias credenciais!');
    console.log('As credenciais do .env NÃO são mais usadas diretamente.');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

checkCredentialsStatus();