#!/bin/bash

# Script de Migração do Banco de Dados PostgreSQL no Coolify
# Domínio: appproft.com

set -e  # Parar em caso de erro

echo "==================================="
echo "MIGRAÇÃO POSTGRESQL - COOLIFY"
echo "Domínio: appproft.com"
echo "==================================="
echo ""

# Função para perguntar confirmação
confirm() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operação cancelada."
        exit 1
    fi
}

# Passo 1: Encontrar container PostgreSQL
echo "Passo 1: Procurando container PostgreSQL..."
POSTGRES_CONTAINER=$(docker ps --format "table {{.Names}}" | grep -i postgres | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "ERRO: Container PostgreSQL não encontrado!"
    echo "Containers disponíveis:"
    docker ps --format "table {{.Names}}\t{{.Image}}"
    exit 1
fi

echo "Container PostgreSQL encontrado: $POSTGRES_CONTAINER"
echo ""

# Passo 2: Obter informações do banco
echo "Passo 2: Obtendo informações do banco de dados..."
echo "Bancos de dados disponíveis:"
docker exec "$POSTGRES_CONTAINER" psql -U postgres -c "\l" 2>/dev/null || {
    echo "ERRO: Não foi possível conectar ao PostgreSQL"
    echo "Tentando com diferentes usuários..."
    docker exec "$POSTGRES_CONTAINER" psql -U coolify -c "\l" 2>/dev/null || {
        echo "ERRO: Não foi possível conectar ao banco"
        exit 1
    }
}

echo ""
read -p "Digite o nome do banco de dados: " DB_NAME
read -p "Digite o usuário do banco (padrão: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

# Passo 3: Criar backup
echo ""
echo "Passo 3: Criando backup do banco..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null || {
    echo "AVISO: Não foi possível criar backup completo"
    confirm "Deseja continuar sem backup?"
}

if [ -f "$BACKUP_FILE" ]; then
    echo "Backup criado: $BACKUP_FILE"
fi

# Passo 4: Verificar estrutura atual
echo ""
echo "Passo 4: Verificando estrutura atual da tabela api_tokens..."
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "\d api_tokens" 2>/dev/null || {
    echo "AVISO: Tabela api_tokens não encontrada ou erro ao acessar"
    confirm "Deseja continuar?"
}

# Passo 5: Executar migração
echo ""
echo "Passo 5: Executando migração..."
confirm "Deseja executar a migração agora?"

# Criar arquivo temporário com comandos SQL
cat > /tmp/migration.sql << 'EOF'
-- Adicionar nova coluna credentials
ALTER TABLE api_tokens 
ADD COLUMN IF NOT EXISTS credentials JSONB;

-- Migrar dados existentes
UPDATE api_tokens 
SET credentials = jsonb_build_object(
  'access_token', access_token,
  'refresh_token', refresh_token
)
WHERE credentials IS NULL 
AND (access_token IS NOT NULL OR refresh_token IS NOT NULL);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_api_tokens_service ON api_tokens(user_id, service);

-- Verificar resultado
SELECT user_id, service, 
       CASE WHEN credentials IS NOT NULL THEN 'Configurado' ELSE 'Não configurado' END as status
FROM api_tokens;
EOF

# Copiar arquivo para container e executar
docker cp /tmp/migration.sql "$POSTGRES_CONTAINER":/tmp/migration.sql
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/migration.sql || {
    echo "ERRO: Falha ao executar migração"
    echo "Verifique os logs acima para mais detalhes"
    exit 1
}

# Limpar arquivo temporário
rm -f /tmp/migration.sql
docker exec "$POSTGRES_CONTAINER" rm -f /tmp/migration.sql

echo ""
echo "✓ Migração executada com sucesso!"

# Passo 6: Verificar aplicação
echo ""
echo "Passo 6: Verificando status da aplicação..."
echo ""

# Tentar encontrar container da aplicação
APP_CONTAINER=$(docker ps --format "table {{.Names}}" | grep -v postgres | grep -E "(app|proft|node)" | head -1)

if [ -n "$APP_CONTAINER" ]; then
    echo "Container da aplicação: $APP_CONTAINER"
    echo "Últimas 20 linhas dos logs:"
    docker logs "$APP_CONTAINER" --tail 20
fi

# Verificar se o site está acessível
echo ""
echo "Verificando acesso ao site..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://appproft.com 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "✓ Site acessível (HTTP $HTTP_STATUS)"
else
    echo "⚠ Site pode estar inacessível (HTTP $HTTP_STATUS)"
fi

# Passo 7: Limpeza opcional
echo ""
echo "==================================="
echo "MIGRAÇÃO CONCLUÍDA!"
echo "==================================="
echo ""
echo "Próximos passos recomendados:"
echo "1. Acesse https://appproft.com e teste o login"
echo "2. Verifique se as APIs estão funcionando corretamente"
echo "3. Monitore os logs por algumas horas"
echo ""
echo "Após confirmar que tudo está funcionando, você pode:"
echo "- Remover as colunas antigas (access_token, refresh_token)"
echo "- Deletar o backup se não for mais necessário"
echo ""
echo "Backup salvo em: $BACKUP_FILE"

# Perguntar se deseja remover colunas antigas
echo ""
confirm "Deseja remover as colunas antigas agora? (recomendado apenas após testes completos)"

if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
    ALTER TABLE api_tokens DROP COLUMN IF EXISTS access_token;
    ALTER TABLE api_tokens DROP COLUMN IF EXISTS refresh_token;
    " && echo "✓ Colunas antigas removidas"
fi

echo ""
echo "Script finalizado!"