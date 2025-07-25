const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Desabilitar SSL para conexões locais através do túnel SSH
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('Erro inesperado no cliente PostgreSQL', err);
  process.exit(-1);
});

module.exports = pool;