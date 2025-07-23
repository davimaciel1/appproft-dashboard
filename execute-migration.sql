-- Execute esta migração no PostgreSQL do Coolify
-- Conecte-se ao banco de dados e execute:

-- 1. Verificar estrutura atual
\d api_tokens

-- 2. Executar migração
ALTER TABLE api_tokens 
ADD COLUMN IF NOT EXISTS credentials JSONB;

-- 3. Migrar dados existentes (se houver)
UPDATE api_tokens 
SET credentials = jsonb_build_object(
  'access_token', access_token,
  'refresh_token', refresh_token
)
WHERE credentials IS NULL 
AND (access_token IS NOT NULL OR refresh_token IS NOT NULL);

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_api_tokens_service ON api_tokens(user_id, service);

-- 5. Verificar resultado
SELECT user_id, service, 
       CASE WHEN credentials IS NOT NULL THEN 'Configurado' ELSE 'Não configurado' END as status
FROM api_tokens;

-- IMPORTANTE: Após verificar que a migração funcionou, você pode remover as colunas antigas
-- (executar apenas após confirmar que tudo está funcionando):
-- ALTER TABLE api_tokens DROP COLUMN IF EXISTS access_token;
-- ALTER TABLE api_tokens DROP COLUMN IF EXISTS refresh_token;