const { Pool } = require('pg');
require('dotenv').config();

async function fixCredentialsFinal() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
  
  try {
    console.log('=== SOLUÇÃO FINAL PARA CREDENCIAIS ===\n');
    
    // 1. Limpar tabela marketplace_credentials antiga
    console.log('1. Limpando dados antigos...');
    await pool.query('DELETE FROM marketplace_credentials WHERE user_id = 1');
    
    // 2. Inserir credenciais diretamente
    console.log('2. Inserindo credenciais Amazon...');
    
    // Criar objeto credentials como JSON
    const credentials = {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      marketplaceId: 'ATVPDKIKX0DER'
    };
    
    await pool.query(`
      INSERT INTO marketplace_credentials 
        (user_id, marketplace, credentials, client_id, client_secret, refresh_token, seller_id, marketplace_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      1, 
      'amazon',
      JSON.stringify(credentials),
      credentials.clientId,
      credentials.clientSecret,
      credentials.refreshToken,
      credentials.sellerId,
      credentials.marketplaceId
    ]);
    
    console.log('✅ Credenciais inseridas!');
    
    // 3. Verificar
    const result = await pool.query(
      'SELECT * FROM marketplace_credentials WHERE user_id = 1 AND marketplace = $1',
      ['amazon']
    );
    
    if (result.rows.length > 0) {
      console.log('\n✅ CREDENCIAIS VERIFICADAS NO BANCO:');
      const row = result.rows[0];
      console.log('- client_id:', row.client_id);
      console.log('- client_secret:', row.client_secret ? '✅ Presente' : '❌');
      console.log('- refresh_token:', row.refresh_token ? '✅ Presente' : '❌');
      console.log('- seller_id:', row.seller_id);
      console.log('- marketplace_id:', row.marketplace_id);
    }
    
    console.log('\n🎉 SUCESSO! Agora o dashboard deve funcionar!');
    console.log('\n📱 PRÓXIMOS PASSOS:');
    console.log('1. O servidor já está rodando');
    console.log('2. Acesse: http://localhost:3000');
    console.log('3. Faça login: admin@appproft.com / admin123');
    console.log('4. O dashboard mostrará seus dados reais da Amazon!');
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

fixCredentialsFinal();