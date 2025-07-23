-- Migration: Atualizar tabela api_tokens para suportar credenciais JSON

-- Adicionar coluna credentials se não existir
ALTER TABLE api_tokens 
ADD COLUMN IF NOT EXISTS credentials JSONB;

-- Migrar dados existentes (se houver)
UPDATE api_tokens 
SET credentials = jsonb_build_object(
  'access_token', access_token,
  'refresh_token', refresh_token
)
WHERE credentials IS NULL 
AND (access_token IS NOT NULL OR refresh_token IS NOT NULL);

-- Remover colunas antigas (comentado para segurança - executar manualmente após verificar)
-- ALTER TABLE api_tokens DROP COLUMN IF EXISTS access_token;
-- ALTER TABLE api_tokens DROP COLUMN IF EXISTS refresh_token;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_api_tokens_service ON api_tokens(user_id, service);