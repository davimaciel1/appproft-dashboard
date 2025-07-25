// Script para verificar resultado de uma query do Data Kiosk

require('dotenv').config();
const axios = require('axios');

async function checkDataKioskResult(queryId) {
  console.log('🔍 VERIFICANDO RESULTADO DO DATA KIOSK');
  console.log('='.repeat(50));
  console.log(`Query ID: ${queryId}\n`);
  
  try {
    // 1. Obter token
    console.log('1️⃣ Obtendo token...');
    const tokenResponse = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.AMAZON_REFRESH_TOKEN,
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Token obtido');

    // 2. Verificar status da query
    console.log('\n2️⃣ Verificando status da query...');
    
    const statusResponse = await axios.get(
      `https://sellingpartnerapi-na.amazon.com/dataKiosk/2023-11-15/queries/${queryId}`,
      {
        headers: {
          'x-amz-access-token': accessToken,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('📊 Resposta completa:');
    console.log(JSON.stringify(statusResponse.data, null, 2));
    
    // 3. Se houver documentId, buscar o documento
    const documentId = statusResponse.data.documentId || statusResponse.data.dataDocumentId;
    if (documentId) {
      console.log('\n3️⃣ Buscando documento...');
      
      try {
        const documentResponse = await axios.get(
          `https://sellingpartnerapi-na.amazon.com/dataKiosk/2023-11-15/documents/${documentId}`,
          {
            headers: {
              'x-amz-access-token': accessToken,
              'Accept': 'application/json'
            }
          }
        );
        
        console.log('📄 Documento:');
        console.log(JSON.stringify(documentResponse.data, null, 2));
        
        // 4. Se houver URL do documento, baixar
        if (documentResponse.data.documentUrl) {
          console.log('\n4️⃣ Baixando conteúdo...');
          
          const contentResponse = await axios.get(documentResponse.data.documentUrl);
          
          console.log('📦 Conteúdo (primeiros 500 caracteres):');
          const content = typeof contentResponse.data === 'string' 
            ? contentResponse.data 
            : JSON.stringify(contentResponse.data);
          console.log(content.substring(0, 500) + '...');
          
          // Salvar em arquivo para análise
          const fs = require('fs');
          const filename = `dataKiosk_${queryId}_result.json`;
          fs.writeFileSync(filename, JSON.stringify(contentResponse.data, null, 2));
          console.log(`\n💾 Resultado salvo em: ${filename}`);
        }
        
      } catch (error) {
        console.error('❌ Erro ao buscar documento:', error.message);
      }
    } else {
      console.log('\n⚠️ Nenhum documentId encontrado na resposta');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

// Usar o último queryId ou permitir passar como argumento
const queryId = process.argv[2] || '902721020294';
checkDataKioskResult(queryId).catch(console.error);