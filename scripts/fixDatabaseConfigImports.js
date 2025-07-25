const fs = require('fs');
const path = require('path');

// Lista de arquivos que precisam ser atualizados
const filesToUpdate = [
  'server/services/advertisingTokenManager.js',
  'server/services/dataCollector.js',
  'server/services/notificationSystem.js',
  'server/services/optimizedDataCollector.js',
  'server/services/persistentSyncManager.js',
  'server/services/rateLimiter.js'
];

// Função para atualizar o arquivo
function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Substituir o import
    const oldImport = `const { executeSQL } = require('../../DATABASE_ACCESS_CONFIG');`;
    const newImport = `const { executeSQL } = require('../utils/executeSQL');`;
    
    if (content.includes(oldImport)) {
      content = content.replace(oldImport, newImport);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Atualizado: ${filePath}`);
    } else {
      console.log(`⏭️  Não encontrado em: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
  }
}

// Atualizar todos os arquivos
console.log('Atualizando imports do DATABASE_ACCESS_CONFIG...\n');

filesToUpdate.forEach(file => {
  updateFile(file);
});

console.log('\n✨ Concluído!');