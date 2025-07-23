const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk',
  database: 'postgres'
});

async function report() {
  await client.connect();
  
  console.log('=== RELATÓRIO DO BANCO DE DADOS ===\n');
  
  // Tamanho
  const size = await client.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
  console.log('Tamanho total:', size.rows[0].size);
  
  // Tabelas e registros
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  console.log('\nTabelas encontradas:', tables.rows.length);
  console.log('\nRegistros por tabela:');
  
  for (const table of tables.rows) {
    const count = await client.query(`SELECT COUNT(*) FROM ${table.table_name}`);
    console.log(`- ${table.table_name}: ${count.rows[0].count} registros`);
  }
  
  // Verificar usuários
  console.log('\n=== USUÁRIOS CADASTRADOS ===');
  const users = await client.query(`SELECT id, email, name FROM users ORDER BY id`);
  
  if (users.rows.length === 0) {
    console.log('Nenhum usuário cadastrado!');
  } else {
    console.log(`Total: ${users.rows.length}`);
    users.rows.forEach(user => {
      console.log(`- [${user.id}] ${user.email} (${user.name})`);
    });
  }
  
  await client.end();
}

report().catch(console.error);