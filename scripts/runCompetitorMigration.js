#!/usr/bin/env node

/**
 * Script para executar migração de tracking de competidores
 * Cria tabelas necessárias para análise de Buy Box e competidores
 */

const fs = require('fs').promises;
const path = require('path');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function runMigration() {
  console.log('🚀 Iniciando migração de tracking de competidores...');
  
  try {
    // Ler arquivo de migração
    const migrationPath = path.join(__dirname, '..', 'server', 'db', 'migrations', '004_create_buybox_tables.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('📄 Arquivo de migração carregado');
    
    // Executar migração
    try {
      
      // Dividir SQL em statements individuais, preservando funções
      const statements = [];
      let currentStatement = '';
      let inFunction = false;
      
      const lines = migrationSQL.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Pular comentários
        if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
          continue;
        }
        
        currentStatement += line + '\n';
        
        // Detectar início de função
        if (trimmedLine.includes('$$ LANGUAGE plpgsql') || 
            trimmedLine.includes('AS $$') ||
            trimmedLine.includes('RETURNS')) {
          inFunction = true;
        }
        
        // Detectar fim de statement
        if (trimmedLine.endsWith(';') && !inFunction) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        } else if (inFunction && trimmedLine.endsWith(';') && 
                  (trimmedLine.includes('$$ LANGUAGE plpgsql;') || 
                   trimmedLine.includes('LANGUAGE plpgsql;'))) {
          statements.push(currentStatement.trim());
          currentStatement = '';
          inFunction = false;
        }
      }
      
      // Adicionar último statement se houver
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
      }
      
      // Filtrar statements vazios
      const validStatements = statements.filter(stmt => 
        stmt.length > 0 && !stmt.match(/^[\s\n]*$/)
      );
      
      console.log(`📝 Executando ${validStatements.length} statements...`);
      
      for (let i = 0; i < validStatements.length; i++) {
        const statement = validStatements[i];
        
        try {
          await executeSQL(statement);
          console.log(`✅ Statement ${i + 1}/${validStatements.length} executado com sucesso`);
        } catch (error) {
          // Ignorar erros de "already exists" para tornar migração idempotente
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('relation') && error.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1}/${validStatements.length} já existe, pulando...`);
          } else {
            console.error(`❌ Erro no statement ${i + 1}:`, error.message);
            console.log('Statement:', statement.substring(0, 100) + '...');
            throw error;
          }
        }
      }
      
      // Migration completed
      console.log('✅ Migração concluída com sucesso!');
      
      // Verificar tabelas criadas
      console.log('\n📊 Verificando tabelas criadas:');
      
      const tables = [
        'sellers_cache',
        'competitor_tracking', 
        'buy_box_history',
        'ai_insights'
      ];
      
      for (const table of tables) {
        const result = await executeSQL(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_name = '${table}'
        `);
        
        if (result.rows[0].count > 0) {
          console.log(`✅ ${table} - criada`);
        } else {
          console.log(`❌ ${table} - não encontrada`);
        }
      }
      
      // Verificar views
      console.log('\n👁️  Verificando views:');
      
      const views = ['buy_box_status', 'competitor_summary'];
      
      for (const view of views) {
        const result = await executeSQL(`
          SELECT COUNT(*) as count 
          FROM information_schema.views 
          WHERE table_name = '${view}'
        `);
        
        if (result.rows[0].count > 0) {
          console.log(`✅ ${view} - criada`);
        } else {
          console.log(`❌ ${view} - não encontrada`);
        }
      }
      
      // Verificar funções
      console.log('\n⚙️  Verificando funções:');
      
      const functions = [
        'get_buy_box_changes',
        'calculate_buy_box_percentage',
        'update_price_differences'
      ];
      
      for (const func of functions) {
        const result = await executeSQL(`
          SELECT COUNT(*) as count 
          FROM information_schema.routines 
          WHERE routine_name = '${func}'
        `);
        
        if (result.rows[0].count > 0) {
          console.log(`✅ ${func}() - criada`);
        } else {
          console.log(`❌ ${func}() - não encontrada`);
        }
      }
      
      console.log('\n🎉 Migração de tracking de competidores concluída!');
      console.log('\nPróximos passos:');
      console.log('1. Execute o worker de coleta: npm run collect-competitors');
      console.log('2. Acesse o dashboard de Buy Box em /buy-box-dashboard');
      console.log('3. Configure alertas para mudanças de Buy Box');
      
    } catch (error) {
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;