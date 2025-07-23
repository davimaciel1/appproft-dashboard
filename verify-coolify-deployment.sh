#!/bin/bash

# Script de Verificação do Deployment no Coolify
# Domínio: appproft.com

echo "===================================="
echo "VERIFICAÇÃO DE DEPLOYMENT - COOLIFY"
echo "Domínio: appproft.com"
echo "===================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# 1. Verificar containers rodando
echo "1. Verificando containers Docker..."
echo "-----------------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(postgres|app|proft|node)"
echo ""

# 2. Verificar conectividade do site
echo "2. Verificando conectividade..."
echo "-------------------------------"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://appproft.com 2>/dev/null || echo "000")
check_status $([[ "$HTTP_STATUS" =~ ^(200|301|302)$ ]] && echo 0 || echo 1) "Site principal (HTTP $HTTP_STATUS)"

# Verificar endpoints da API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://appproft.com/api/health 2>/dev/null || echo "000")
check_status $([[ "$API_STATUS" =~ ^(200|404)$ ]] && echo 0 || echo 1) "API endpoint (HTTP $API_STATUS)"

echo ""

# 3. Verificar SSL
echo "3. Verificando certificado SSL..."
echo "---------------------------------"
SSL_INFO=$(echo | openssl s_client -servername appproft.com -connect appproft.com:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
if [ -n "$SSL_INFO" ]; then
    echo -e "${GREEN}✓${NC} SSL configurado corretamente"
    echo "$SSL_INFO"
else
    echo -e "${RED}✗${NC} Problema com certificado SSL"
fi
echo ""

# 4. Verificar banco de dados
echo "4. Verificando banco de dados..."
echo "--------------------------------"
POSTGRES_CONTAINER=$(docker ps --format "{{.Names}}" | grep -i postgres | head -1)

if [ -n "$POSTGRES_CONTAINER" ]; then
    echo "Container PostgreSQL: $POSTGRES_CONTAINER"
    
    # Tentar verificar a tabela api_tokens
    read -p "Digite o nome do banco de dados (Enter para pular): " DB_NAME
    if [ -n "$DB_NAME" ]; then
        echo "Verificando estrutura da tabela api_tokens..."
        docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -c "
        SELECT 
            column_name, 
            data_type, 
            is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'api_tokens' 
        ORDER BY ordinal_position;
        " 2>/dev/null || echo "Não foi possível verificar a tabela"
    fi
else
    echo -e "${RED}✗${NC} Container PostgreSQL não encontrado"
fi
echo ""

# 5. Verificar logs recentes
echo "5. Logs recentes da aplicação..."
echo "--------------------------------"
APP_CONTAINER=$(docker ps --format "{{.Names}}" | grep -v postgres | grep -E "(app|proft|node)" | head -1)

if [ -n "$APP_CONTAINER" ]; then
    echo "Container: $APP_CONTAINER"
    echo "Últimas 10 linhas de log:"
    docker logs "$APP_CONTAINER" --tail 10 2>&1
else
    echo -e "${YELLOW}⚠${NC} Container da aplicação não identificado automaticamente"
    echo "Containers disponíveis:"
    docker ps --format "table {{.Names}}" | grep -v NAME
fi
echo ""

# 6. Verificar variáveis de ambiente
echo "6. Verificando variáveis de ambiente..."
echo "---------------------------------------"
if [ -n "$APP_CONTAINER" ]; then
    ENV_COUNT=$(docker exec "$APP_CONTAINER" printenv | grep -E "(DB_|API_|NODE_ENV)" | wc -l)
    echo "Variáveis de ambiente relacionadas: $ENV_COUNT"
    
    # Verificar NODE_ENV
    NODE_ENV=$(docker exec "$APP_CONTAINER" printenv NODE_ENV 2>/dev/null || echo "não definido")
    echo "NODE_ENV: $NODE_ENV"
fi
echo ""

# 7. Teste de funcionalidades
echo "7. Testes de funcionalidade..."
echo "------------------------------"
echo "Por favor, teste manualmente:"
echo "- [ ] Acesse https://appproft.com"
echo "- [ ] Faça login com credenciais de teste"
echo "- [ ] Verifique se o dashboard carrega"
echo "- [ ] Teste conexão com Amazon API"
echo "- [ ] Teste conexão com Mercado Livre API"
echo "- [ ] Verifique se os dados são salvos corretamente"
echo ""

# Resumo
echo "===================================="
echo "RESUMO DA VERIFICAÇÃO"
echo "===================================="
echo ""
echo "Site: https://appproft.com"
echo "Status HTTP: $HTTP_STATUS"
echo "PostgreSQL: $([ -n "$POSTGRES_CONTAINER" ] && echo "Rodando" || echo "Não encontrado")"
echo "Aplicação: $([ -n "$APP_CONTAINER" ] && echo "Rodando" || echo "Não identificada")"
echo ""
echo "Para mais detalhes, execute:"
echo "- docker ps                    # Ver todos containers"
echo "- docker logs [container]      # Ver logs específicos"
echo "- curl -v https://appproft.com # Testar conectividade"
echo ""