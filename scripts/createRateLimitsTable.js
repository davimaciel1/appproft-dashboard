// Script para criar tabela api_rate_limits

require('dotenv').config();
const { executeSQL } = require('../DATABASE_ACCESS_CONFIG');

async function createRateLimitsTable() {
  console.log('🗄️ Criando tabela api_rate_limits...');
  
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS api_rate_limits (
        id SERIAL PRIMARY KEY,
        api_name VARCHAR(50) NOT NULL,
        endpoint VARCHAR(200) NOT NULL,
        tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
        calls_per_second DECIMAL(10,3) NOT NULL,
        burst_size INTEGER NOT NULL,
        tokens_available DECIMAL(10,3) NOT NULL,
        last_refill_at TIMESTAMP WITH TIME ZONE NOT NULL,
        calls_today INTEGER DEFAULT 0,
        calls_this_hour INTEGER DEFAULT 0,
        last_call_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(api_name, endpoint, tenant_id)
      );
    `);
    
    // Criar índices para performance
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_api_rate_limits_lookup 
      ON api_rate_limits(api_name, endpoint, tenant_id);
    `);
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_api_rate_limits_refill 
      ON api_rate_limits(last_refill_at);
    `);
    
    console.log('✅ Tabela api_rate_limits criada com sucesso');
    
    // Verificar se foi criada corretamente
    const result = await executeSQL(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'api_rate_limits'
    `);
    
    console.log(`📊 Verificação: ${result.rows[0].count} tabela(s) encontrada(s)`);
    
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  createRateLimitsTable();
}

module.exports = createRateLimitsTable;