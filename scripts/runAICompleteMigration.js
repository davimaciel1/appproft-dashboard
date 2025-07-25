#!/usr/bin/env node

/**
 * Script para executar migração completa da estrutura de IA
 * Cria todas as tabelas necessárias para o sistema de inteligência competitiva
 */

const fs = require('fs').promises;
const path = require('path');
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function runMigration() {
  console.log('🤖 Iniciando migração da estrutura completa de IA...');
  console.log('📊 Este processo criará tabelas para:');
  console.log('   - Machine Learning e análise preditiva');
  console.log('   - Tracking avançado de competidores');
  console.log('   - Métricas de advertising e otimização');
  console.log('   - Sistema de insights com IA\n');
  
  try {
    // Ler arquivo de migração
    const migrationPath = path.join(__dirname, '..', 'server', 'db', 'migrations', '005_create_ai_complete_structure.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('📄 Arquivo de migração carregado');
    
    // Executar migração
    try {
      // Dividir SQL em statements individuais
      const statements = [];
      let currentStatement = '';
      let inFunction = false;
      let inDollarQuote = false;
      
      const lines = migrationSQL.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Pular comentários de linha única
        if (trimmedLine.startsWith('--') && !inFunction && !inDollarQuote) {
          continue;
        }
        
        // Detectar início/fim de dollar quotes
        if (line.includes('$$')) {
          inDollarQuote = !inDollarQuote;
        }
        
        // Detectar início de função
        if ((trimmedLine.includes('AS $$') || 
             trimmedLine.includes('RETURNS')) && !inFunction) {
          inFunction = true;
        }
        
        currentStatement += line + '\n';
        
        // Detectar fim de statement
        if (!inFunction && !inDollarQuote && trimmedLine.endsWith(';')) {
          const cleanStatement = currentStatement.trim();
          if (cleanStatement && !cleanStatement.match(/^[\s\n]*$/)) {
            statements.push(cleanStatement);
          }
          currentStatement = '';
        } else if (inFunction && trimmedLine.endsWith('plpgsql;')) {
          statements.push(currentStatement.trim());
          currentStatement = '';
          inFunction = false;
        }
      }
      
      // Adicionar último statement se houver
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
      }
      
      console.log(`📝 Executando ${statements.length} statements...`);
      
      let successCount = 0;
      let skipCount = 0;
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        // Pular comentários sobre extensões
        if (statement.includes('CREATE EXTENSION')) {
          console.log(`⚠️  Statement ${i + 1}: Extensão deve ser criada manualmente (requer superuser)`);
          skipCount++;
          continue;
        }
        
        try {
          await executeSQL(statement);
          successCount++;
          
          // Log de progresso para statements importantes
          if (statement.includes('CREATE TABLE')) {
            const tableName = statement.match(/CREATE TABLE[^(]+\(([^)]+)\)/)?.[1] || 'tabela';
            console.log(`✅ Tabela criada: ${tableName}`);
          } else if (statement.includes('CREATE INDEX')) {
            console.log(`✅ Índice criado`);
          } else if (statement.includes('CREATE VIEW')) {
            const viewName = statement.match(/CREATE[^V]*VIEW\s+(\S+)/)?.[1] || 'view';
            console.log(`✅ View criada: ${viewName}`);
          } else if (statement.includes('CREATE FUNCTION')) {
            const funcName = statement.match(/CREATE[^F]*FUNCTION\s+(\S+)/)?.[1] || 'função';
            console.log(`✅ Função criada: ${funcName}`);
          }
          
        } catch (error) {
          // Ignorar erros de "already exists"
          if (error.message.includes('already exists') || 
              error.message.includes('já existe')) {
            console.log(`⚠️  Statement ${i + 1}: Objeto já existe, pulando...`);
            skipCount++;
          } else {
            console.error(`❌ Erro no statement ${i + 1}:`, error.message);
            console.log('Statement:', statement.substring(0, 100) + '...');
            throw error;
          }
        }
      }
      
      console.log(`\n✅ Migração concluída!`);
      console.log(`   - ${successCount} statements executados com sucesso`);
      console.log(`   - ${skipCount} statements pulados (já existentes ou extensões)`);
      
      // Verificar tabelas criadas
      console.log('\n📊 Verificando estrutura criada:');
      
      const tables = [
        'products_ml',
        'sales_metrics',
        'inventory_snapshots',
        'competitor_tracking_advanced',
        'campaign_metrics',
        'keywords_performance',
        'search_terms',
        'ai_insights_advanced',
        'demand_forecasts',
        'price_optimization',
        'sync_jobs',
        'api_rate_limits'
      ];
      
      let tableCount = 0;
      for (const table of tables) {
        const result = await executeSQL(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_name = '${table}'
        `);
        
        if (result.rows[0].count > 0) {
          console.log(`  ✅ ${table}`);
          tableCount++;
        } else {
          console.log(`  ❌ ${table} - não encontrada`);
        }
      }
      
      // Verificar views
      console.log('\n👁️  Verificando views:');
      
      const views = ['product_analysis', 'priority_alerts'];
      
      for (const view of views) {
        const result = await executeSQL(`
          SELECT COUNT(*) as count 
          FROM information_schema.views 
          WHERE table_name = '${view}'
        `);
        
        if (result.rows[0].count > 0) {
          console.log(`  ✅ ${view}`);
        } else {
          console.log(`  ❌ ${view} - não encontrada`);
        }
      }
      
      // Verificar funções
      console.log('\n⚙️  Verificando funções:');
      
      const functions = [
        'calculate_sales_velocity',
        'suggest_reorder_point',
        'update_updated_at_column'
      ];
      
      for (const func of functions) {
        const result = await executeSQL(`
          SELECT COUNT(*) as count 
          FROM information_schema.routines 
          WHERE routine_name = '${func}'
        `);
        
        if (result.rows[0].count > 0) {
          console.log(`  ✅ ${func}()`);
        } else {
          console.log(`  ❌ ${func}() - não encontrada`);
        }
      }
      
      console.log('\n🎉 Sistema de IA configurado com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('1. Instalar extensões PostgreSQL (requer superuser):');
      console.log('   - CREATE EXTENSION IF NOT EXISTS timescaledb;');
      console.log('   - CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('   - CREATE EXTENSION IF NOT EXISTS pg_cron;');
      console.log('2. Configurar Python com bibliotecas de ML:');
      console.log('   - pip install pandas prophet scikit-learn');
      console.log('3. Implementar serviços de coleta de dados');
      console.log('4. Configurar workers de análise com IA');
      console.log('\n💡 Dica: Execute "node scripts/testAIStructure.js" para testar');
      
    } catch (error) {
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

// Função auxiliar para verificar extensões
async function checkExtensions() {
  console.log('\n🔍 Verificando extensões necessárias:');
  
  const extensions = [
    { name: 'timescaledb', description: 'Time-series data' },
    { name: 'vector', description: 'ML embeddings' },
    { name: 'pg_cron', description: 'Scheduled jobs' }
  ];
  
  for (const ext of extensions) {
    try {
      const result = await executeSQL(`
        SELECT COUNT(*) as count 
        FROM pg_extension 
        WHERE extname = '${ext.name}'
      `);
      
      if (result.rows[0].count > 0) {
        console.log(`  ✅ ${ext.name} - instalada`);
      } else {
        console.log(`  ⚠️  ${ext.name} - não instalada (${ext.description})`);
      }
    } catch (error) {
      console.log(`  ❌ Erro ao verificar ${ext.name}`);
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runMigration()
    .then(() => checkExtensions())
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = runMigration;