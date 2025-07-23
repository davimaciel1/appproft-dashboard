const axios = require('axios');

async function checkSystemStatus() {
  console.log('🚀 VERIFICANDO STATUS DO SISTEMA\n');
  
  const services = {
    backend: { url: 'http://localhost:3002', status: '❌', details: '' },
    frontend: { url: 'http://localhost:3003', status: '❌', details: '' },
    amazon: { status: '❌', details: '' },
    mercadolivre: { status: '❌', details: '' }
  };

  // Verificar Backend
  try {
    console.log('1️⃣ Verificando Backend (Node.js)...');
    const backendResponse = await axios.get('http://localhost:3002', { timeout: 5000 });
    services.backend.status = '✅';
    services.backend.details = 'Servidor Node.js rodando';
    console.log('✅ Backend: OK');
  } catch (error) {
    services.backend.details = error.code || error.message;
    console.log('❌ Backend: Não acessível');
  }

  // Verificar Frontend
  try {
    console.log('2️⃣ Verificando Frontend (React)...');
    const frontendResponse = await axios.get('http://localhost:3003', { timeout: 5000 });
    services.frontend.status = '✅';
    services.frontend.details = 'React app rodando';
    console.log('✅ Frontend: OK');
  } catch (error) {
    services.frontend.details = error.code || error.message;
    console.log('❌ Frontend: Não acessível');
  }

  // Verificar APIs (se backend estiver funcionando)
  if (services.backend.status === '✅') {
    try {
      console.log('3️⃣ Verificando Amazon API...');
      const amazonResponse = await axios.get('http://localhost:3002/api/amazon/metrics', { 
        timeout: 10000,
        headers: { 'Authorization': 'Bearer test-token' } 
      });
      services.amazon.status = '✅';
      services.amazon.details = 'API respondendo';
      console.log('✅ Amazon API: OK');
    } catch (error) {
      services.amazon.details = error.response?.status || error.code || error.message;
      console.log('⚠️  Amazon API: ', error.response?.status || error.message);
    }

    try {
      console.log('4️⃣ Verificando Mercado Livre API...');
      const mlResponse = await axios.get('http://localhost:3002/api/mercadolivre/orders', { 
        timeout: 10000,
        headers: { 'Authorization': 'Bearer test-token' } 
      });
      services.mercadolivre.status = '✅';
      services.mercadolivre.details = 'API respondendo';
      console.log('✅ Mercado Livre API: OK');
    } catch (error) {
      services.mercadolivre.details = error.response?.status || error.code || error.message;
      console.log('⚠️  Mercado Livre API: ', error.response?.status || error.message);
    }
  }

  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('📊 STATUS FINAL DO SISTEMA');
  console.log('='.repeat(60));
  
  console.log(`🖥️  Backend (Node.js):     ${services.backend.status} - ${services.backend.details}`);
  console.log(`🌐 Frontend (React):     ${services.frontend.status} - ${services.frontend.details}`);
  console.log(`🟠 Amazon API:           ${services.amazon.status} - ${services.amazon.details}`);
  console.log(`🔵 Mercado Livre API:    ${services.mercadolivre.status} - ${services.mercadolivre.details}`);

  const allWorking = Object.values(services).every(service => service.status === '✅');
  const partialWorking = Object.values(services).some(service => service.status === '✅');

  console.log('\n🎯 RESULTADO:');
  if (allWorking) {
    console.log('🎉 SISTEMA 100% FUNCIONAL!');
    console.log('✅ Todos os serviços estão rodando');
    console.log('🔗 Acesse: http://localhost:3003');
  } else if (partialWorking) {
    console.log('⚡ SISTEMA PARCIALMENTE FUNCIONAL');
    console.log('💡 Alguns serviços estão rodando');
    if (services.frontend.status === '✅') {
      console.log('🔗 Acesse: http://localhost:3003');
    }
  } else {
    console.log('❌ SISTEMA COM PROBLEMAS');
    console.log('🔧 Verifique se os serviços foram iniciados corretamente');
  }

  console.log('\n📝 COMANDOS PARA INICIAR:');
  console.log('Backend:  cd server && PORT=3002 node index.js');
  console.log('Frontend: cd client && PORT=3003 npm start');
  
  return services;
}

checkSystemStatus().catch(console.error);