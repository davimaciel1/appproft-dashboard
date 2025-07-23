const https = require('https');
require('dotenv').config();

console.log('=== VERIFICANDO DEPLOY NO COOLIFY ===\n');

const options = {
  hostname: '49.12.191.119',
  port: 443,
  path: '/api/v1/applications',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.COOLIFY_API_TOKEN}`,
    'Accept': 'application/json'
  },
  rejectUnauthorized: false // Para lidar com certificados auto-assinados
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    
    if (res.statusCode === 200) {
      const apps = JSON.parse(data);
      console.log('\nAplicações encontradas:', apps.length);
      
      // Procurar pela aplicação appproft
      const appProft = apps.find(app => 
        app.name?.includes('appproft') || 
        app.domains?.includes('appproft.com')
      );
      
      if (appProft) {
        console.log('\n✅ Aplicação AppProft encontrada!');
        console.log('- Nome:', appProft.name);
        console.log('- Status:', appProft.status);
        console.log('- Último deploy:', appProft.last_deployment_at);
        console.log('- Domínios:', appProft.domains);
      }
    } else {
      console.log('Resposta:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Erro:', e.message);
  console.log('\nO deploy geralmente acontece automaticamente quando você faz push.');
  console.log('Aguarde alguns minutos e verifique https://appproft.com/dashboard');
});

req.end();

console.log('💡 NOTA: O Coolify geralmente faz deploy automático após o push.');
console.log('Processo típico:');
console.log('1. Push para GitHub ✅ (já feito)');
console.log('2. Coolify detecta mudança via webhook');
console.log('3. Build da imagem Docker (3-5 minutos)');
console.log('4. Deploy da nova versão');
console.log('\nAguarde cerca de 5-10 minutos e acesse https://appproft.com/dashboard');