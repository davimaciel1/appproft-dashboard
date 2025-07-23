# Como Testar o Sistema Localmente

## 1. Com Dados Mockados (Mais Simples)

```bash
# Configurar para dados mockados
usar-dados-mockados.bat

# Iniciar servidor
npm run dev
```

## 2. Acessar o Sistema

1. Abra: http://localhost:3000
2. Faça login com qualquer email/senha (será criado automaticamente)
3. Teste as funcionalidades:
   - Dashboard com métricas
   - Lista de produtos
   - Botão de sincronização

## 3. Verificar no Coolify

O sistema em produção está em:
http://qc8wwswos4sokgosww4k0wkc.49.12.191.119.sslip.io

### Para configurar o banco no Coolify:

1. **No painel Coolify**, encontre o serviço PostgreSQL
2. **Execute o SQL** do arquivo `execute-in-coolify-postgres.sql`
3. **Configure as variáveis de ambiente** no Coolify:
   - `USE_MOCK_DATA=false`
   - Mantenha as credenciais das APIs já configuradas

## 4. APIs Disponíveis

### Autenticação
- POST `/api/auth/login` - Login
- POST `/api/auth/register` - Cadastro

### Dashboard (requer autenticação)
- GET `/api/dashboard/metrics` - Métricas consolidadas
- GET `/api/dashboard/products` - Lista de produtos

### Sincronização (requer autenticação)
- POST `/api/sync/all` - Sincronizar todos os marketplaces
- POST `/api/sync/amazon` - Sincronizar apenas Amazon
- POST `/api/sync/mercadolivre` - Sincronizar apenas Mercado Livre

## Exemplo de Teste com cURL

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# 2. Pegar métricas (use o token retornado)
curl http://localhost:3000/api/dashboard/metrics \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```