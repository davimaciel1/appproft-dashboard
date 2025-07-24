const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function checkTokens() {
  console.log('=== VERIFICANDO TOKENS NO BANCO ===\n');
  
  try {
    const result = await executeSQL(`
      SELECT 
        id,
        user_id,
        marketplace,
        refresh_token,
        access_token,
        created_at,
        updated_at
      FROM marketplace_credentials
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nenhuma credencial encontrada no banco!');
      return;
    }
    
    result.rows.forEach(row => {
      console.log(`📋 Credencial ID: ${row.id}`);
      console.log(`   Marketplace: ${row.marketplace}`);
      console.log(`   User ID: ${row.user_id}`);
      console.log(`   Refresh Token: ${row.refresh_token ? '✅ Configurado (' + row.refresh_token.substring(0, 20) + '...)' : '❌ NÃO CONFIGURADO'}`);
      console.log(`   Access Token: ${row.access_token ? '✅ Presente' : '❌ Ausente'}`);
      console.log(`   Criado em: ${new Date(row.created_at).toLocaleString('pt-BR')}`);
      console.log(`   Atualizado em: ${row.updated_at ? new Date(row.updated_at).toLocaleString('pt-BR') : 'Nunca'}`);
      console.log('');
    });
    
    // Verificar se precisa configurar tokens
    const needsSetup = result.rows.some(r => !r.refresh_token);
    
    if (needsSetup) {
      console.log('⚠️  AÇÃO NECESSÁRIA:');
      console.log('1. Você precisa obter o refresh_token da Amazon através do fluxo OAuth');
      console.log('2. Acesse: http://localhost:3000/api/amazon/auth');
      console.log('3. Faça login com sua conta de vendedor Amazon');
      console.log('4. O sistema salvará automaticamente o refresh_token');
      console.log('\nOu configure manualmente no .env:');
      console.log('AMAZON_REFRESH_TOKEN=seu_refresh_token_aqui');
    } else {
      console.log('✅ Tokens configurados! Pronto para sincronização.');
      
      // Verificar .env também
      console.log('\n📄 Verificando .env:');
      console.log(`AMAZON_REFRESH_TOKEN: ${process.env.AMAZON_REFRESH_TOKEN ? '✅ Configurado' : '❌ Não configurado'}`);
      console.log(`LWA_CLIENT_ID: ${process.env.LWA_CLIENT_ID ? '✅ Configurado' : '❌ Não configurado'}`);
      console.log(`LWA_CLIENT_SECRET: ${process.env.LWA_CLIENT_SECRET ? '✅ Configurado' : '❌ Não configurado'}`);
      
      if (!process.env.AMAZON_REFRESH_TOKEN && row.refresh_token) {
        console.log('\n💡 DICA: O refresh_token está no banco mas não no .env');
        console.log('Adicione ao .env para facilitar:');
        console.log(`AMAZON_REFRESH_TOKEN=${row.refresh_token}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkTokens();