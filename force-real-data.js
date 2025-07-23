require('dotenv').config();

// Forçar USE_MOCK_DATA como false
process.env.USE_MOCK_DATA = 'false';

console.log('=== FORÇANDO USO DE DADOS REAIS ===\n');
console.log('USE_MOCK_DATA:', process.env.USE_MOCK_DATA);

// Iniciar servidor
const { spawn } = require('child_process');

const server = spawn('node', ['server/index.js'], {
  env: { 
    ...process.env, 
    USE_MOCK_DATA: 'false',
    NODE_ENV: 'development'
  },
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('Erro ao iniciar servidor:', err);
});

server.on('close', (code) => {
  console.log(`Servidor encerrado com código ${code}`);
});