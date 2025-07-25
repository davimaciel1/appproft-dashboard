const fs = require('fs');
const path = require('path');

// Lista de arquivos que precisam ter SSL desabilitado
const filesToFix = [
  '../server/db/pool.js',
  '../workers/aiDataCollectionWorker.js',
  '../workers/competitorDataWorker.js',
  '../server/services/dataCollector.js'
];

function fixSSLInFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Arquivo não encontrado: ${filePath}`);
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    // Padrão 1: new Pool({ ... })
    if (content.includes('new Pool({') && !content.includes('ssl: false')) {
      content = content.replace(
        /new Pool\({([^}]+)}\)/g,
        (match, poolConfig) => {
          if (!poolConfig.includes('ssl:')) {
            return `new Pool({${poolConfig},\n  ssl: false\n})`;
          }
          return match;
        }
      );
      modified = true;
    }
    
    // Padrão 2: createPool({ ... })
    if (content.includes('createPool({') && !content.includes('ssl: false')) {
      content = content.replace(
        /createPool\({([^}]+)}\)/g,
        (match, poolConfig) => {
          if (!poolConfig.includes('ssl:')) {
            return `createPool({${poolConfig},\n  ssl: false\n})`;
          }
          return match;
        }
      );
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ SSL desabilitado em: ${filePath}`);
    } else {
      console.log(`✓  ${filePath} já está configurado corretamente`);
    }
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
  }
}

console.log('🔧 Corrigindo configuração SSL do PostgreSQL...\n');

// Corrigir cada arquivo
filesToFix.forEach(fixSSLInFile);

// Verificar se existe um arquivo .env e adicionar variável se necessário
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  if (!envContent.includes('PGSSLMODE')) {
    envContent += '\n# Desabilitar SSL para conexão local\nPGSSLMODE=disable\n';
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Variável PGSSLMODE=disable adicionada ao .env');
  }
}

console.log('\n✅ Configuração SSL corrigida!');
console.log('\n📝 Próximos passos:');
console.log('1. Reinicie os workers se estiverem rodando');
console.log('2. Execute: node workers/aiDataCollectionWorker.js');
console.log('3. Acesse: http://localhost:3000/amazon-data');