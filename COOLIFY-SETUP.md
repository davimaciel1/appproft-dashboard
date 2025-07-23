# Deploy AppProft Dashboard no Coolify

## 🚀 Configuração do Deploy

### 1. Criar Novo Projeto no Coolify

1. Acesse seu Coolify: http://49.12.191.119/
2. Clique em "New Project" 
3. Nome: `appproft-dashboard`
4. Descrição: `Dashboard consolidado de vendas Amazon e Mercado Livre`

### 2. Configurar Repositório

**Tipo**: Git Repository
**URL**: `https://github.com/davimaciel1/appproft-dashboard`
**Branch**: `master`
**Build Pack**: `dockerfile`

### 3. Configurações de Build

**Dockerfile**: `Dockerfile` (já configurado)
**Port**: `3000`
**Health Check**: `/api/auth/health`

### 4. Variáveis de Ambiente

Configure essas variáveis no Coolify:

```bash
# Database (PostgreSQL já existente no Coolify)
DATABASE_URL=postgres://postgres:icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk@sscowkg4g8swg8cw0gocwcgk:5432/postgres

# App Configuration
PORT=3000
NODE_ENV=production
USE_MOCK_DATA=false

# JWT Secret (gere uma chave segura)
JWT_SECRET=[GERAR_CHAVE_SEGURA_AQUI]

# Amazon SP-API
AMAZON_CLIENT_ID=[SEU_AMAZON_CLIENT_ID]
AMAZON_CLIENT_SECRET=[SEU_AMAZON_CLIENT_SECRET]
AMAZON_REFRESH_TOKEN=[SEU_AMAZON_REFRESH_TOKEN]
AMAZON_SELLER_ID=[SEU_AMAZON_SELLER_ID]
AMAZON_SP_API_CLIENT_ID=[SEU_AMAZON_SP_API_CLIENT_ID]
AMAZON_SP_API_CLIENT_SECRET=[SEU_AMAZON_SP_API_CLIENT_SECRET]
SP_API_AWS_ACCESS_KEY=[SEU_AWS_ACCESS_KEY]
SP_API_AWS_SECRET_KEY=[SEU_AWS_SECRET_KEY]
SP_API_MARKETPLACE_ID=[SEU_MARKETPLACE_ID]

# Mercado Livre
ML_CLIENT_ID=[SEU_ML_CLIENT_ID]
ML_CLIENT_SECRET=[SEU_ML_CLIENT_SECRET]
ML_REFRESH_TOKEN=[SEU_ML_REFRESH_TOKEN]
ML_ACCESS_TOKEN=[SEU_ML_ACCESS_TOKEN]
ML_SELLER_ID=[SEU_ML_SELLER_ID]
```

### 5. Configurar Domínio

1. No Coolify, vá para "Domains"
2. Adicione seu domínio customizado ou use o gerado
3. Configure SSL/HTTPS automaticamente

### 6. Deploy

1. Clique em "Deploy"
2. Aguarde o build e deploy
3. Acesse a aplicação no domínio configurado

## ✅ Verificação Pós-Deploy

1. **Health Check**: `https://seu-dominio.com/api/auth/health`
2. **Login**: `https://seu-dominio.com/`
   - Email: `admin@appproft.com`
   - Senha: `123456`
3. **Dashboard**: Verificar se métricas e produtos carregam
4. **APIs**: Testar sincronização Amazon e ML

## 🛠️ Troubleshooting

- **Logs**: Verificar no Coolify > Logs
- **Database**: Conexão já testada e funcionando
- **APIs**: Credenciais devem estar corretas nas env vars
- **CORS**: Configurado automaticamente para domínio de produção

## 📱 Acesso

Após deploy, a aplicação estará disponível em:
- Dashboard: `https://seu-dominio.com`
- API: `https://seu-dominio.com/api`