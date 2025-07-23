require('dotenv').config({ path: '.env' });
const pool = require('./server/db/pool');

async function generateDatabaseReport() {
  console.log('🔍 RELATÓRIO DO BANCO DE DADOS - APPPROFT\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Informações gerais do banco
    const dbInfo = await pool.query(`
      SELECT 
        current_database() as database_name,
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        version() as pg_version
    `);
    
    console.log('\n📊 INFORMAÇÕES GERAIS:');
    console.log(`• Banco de dados: ${dbInfo.rows[0].database_name}`);
    console.log(`• Tamanho total: ${dbInfo.rows[0].database_size}`);
    console.log(`• PostgreSQL: ${dbInfo.rows[0].pg_version.split(',')[0]}`);
    
    // 2. Total de tabelas
    const tablesCount = await pool.query(`
      SELECT COUNT(*) as total_tables 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    console.log(`• Total de tabelas: ${tablesCount.rows[0].total_tables}`);
    console.log('\n' + '=' .repeat(60));
    
    // 3. Listar todas as tabelas
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📋 DETALHES POR TABELA:\n');
    
    let totalRecords = 0;
    const tableDetails = [];
    
    // 4. Contar registros e tamanho de cada tabela
    for (const table of tables.rows) {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
      const sizeResult = await pool.query(`
        SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) as size
      `, [table.table_name]);
      
      const count = parseInt(countResult.rows[0].count);
      const size = sizeResult.rows[0].size;
      
      totalRecords += count;
      tableDetails.push({
        name: table.table_name,
        count: count,
        size: size
      });
    }
    
    // Ordenar por quantidade de registros (decrescente)
    tableDetails.sort((a, b) => b.count - a.count);
    
    // Exibir tabela formatada
    console.log('Tabela'.padEnd(30) + 'Registros'.padEnd(15) + 'Tamanho');
    console.log('-'.repeat(55));
    
    for (const table of tableDetails) {
      console.log(
        table.name.padEnd(30) + 
        table.count.toString().padEnd(15) + 
        table.size
      );
    }
    
    console.log('-'.repeat(55));
    console.log('TOTAL'.padEnd(30) + totalRecords.toString().padEnd(15));
    
    // 5. Verificar estrutura da tabela users
    console.log('\n📐 ESTRUTURA DA TABELA USERS:\n');
    
    const userColumns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Coluna'.padEnd(20) + 'Tipo'.padEnd(20) + 'Nullable'.padEnd(10) + 'Default');
    console.log('-'.repeat(60));
    
    for (const col of userColumns.rows) {
      console.log(
        col.column_name.padEnd(20) +
        col.data_type.padEnd(20) +
        col.is_nullable.padEnd(10) +
        (col.column_default || 'NULL')
      );
    }
    
    // 6. Verificar usuários existentes
    console.log('\n👥 USUÁRIOS CADASTRADOS:\n');
    
    const users = await pool.query(`
      SELECT id, email, name, created_at 
      FROM users 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (users.rows.length === 0) {
      console.log('⚠️  Nenhum usuário cadastrado ainda!');
      console.log('\n💡 Para criar um usuário, use:');
      console.log('   - API: POST https://appproft.com/api/auth/register');
      console.log('   - Ou execute: node create-user.js');
    } else {
      console.log('ID'.padEnd(10) + 'Email'.padEnd(30) + 'Nome'.padEnd(20) + 'Criado em');
      console.log('-'.repeat(80));
      
      for (const user of users.rows) {
        console.log(
          user.id.toString().padEnd(10) +
          user.email.padEnd(30) +
          user.name.padEnd(20) +
          new Date(user.created_at).toLocaleDateString('pt-BR')
        );
      }
    }
    
    // 7. Verificar credenciais configuradas
    console.log('\n🔑 CREDENCIAIS CONFIGURADAS:\n');
    
    const credentials = await pool.query(`
      SELECT 
        mc.user_id,
        u.email,
        mc.marketplace,
        CASE WHEN mc.credentials IS NOT NULL THEN 'Sim' ELSE 'Não' END as configurado,
        mc.updated_at
      FROM marketplace_credentials mc
      JOIN users u ON u.id = mc.user_id
      ORDER BY mc.updated_at DESC
    `);
    
    if (credentials.rows.length === 0) {
      console.log('⚠️  Nenhuma credencial configurada ainda!');
    } else {
      console.log('Email'.padEnd(30) + 'Marketplace'.padEnd(20) + 'Configurado'.padEnd(15) + 'Atualizado');
      console.log('-'.repeat(80));
      
      for (const cred of credentials.rows) {
        console.log(
          cred.email.padEnd(30) +
          cred.marketplace.padEnd(20) +
          cred.configurado.padEnd(15) +
          new Date(cred.updated_at).toLocaleDateString('pt-BR')
        );
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ Relatório gerado com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro ao gerar relatório:', error.message);
    
    if (error.message.includes('connect')) {
      console.log('\n💡 Dica: Verifique se:');
      console.log('   1. O arquivo .env existe e contém DATABASE_URL');
      console.log('   2. O túnel SSH está ativo (se aplicável)');
      console.log('   3. O PostgreSQL está rodando');
    }
  } finally {
    // Fechar conexão
    await pool.end();
    process.exit(0);
  }
}

// Executar relatório
generateDatabaseReport();