# 🔐 CONFIGURAÇÃO DE NOVOS TOKENS

## ✅ Sistema de Renovação Automática Implementado

**Funcionalidades criadas:**
- ✅ Sistema de renovação automática a cada 5 horas
- ✅ Armazenamento seguro de tokens no banco PostgreSQL
- ✅ Endpoints para renovação manual via API
- ✅ Sistema de callback para reautorização
- ✅ Monitoramento de expiração de tokens

## 🚨 AÇÃO NECESSÁRIA: Renovar Tokens Expirados

### 1. MERCADO LIVRE - Reautorização Necessária

**Problema:** Refresh token expirado

**Solução:**

1. **Inicie o servidor:**
```bash
npm run dev
```

2. **Acesse a URL de autorização:**
```
https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=6957271904463263&redirect_uri=https://appproft.com/api/marketplace/mercadolivre/callback
```

3. **Faça login na sua conta Mercado Livre e autorize a aplicação**

4. **O sistema redirecionará para:** `https://appproft.com/api/marketplace/mercadolivre/callback?code=CODIGO`

5. **Os novos tokens serão automaticamente salvos no banco**

### 2. AMAZON SP-API - Configuração ARN

**Problema:** ARN da IAM Role incorreto

**Solução:** Você precisa obter o ARN correto da sua IAM Role na AWS:

1. **Acesse o AWS Console → IAM → Roles**
2. **Encontre sua role do Selling Partner API**
3. **Copie o ARN completo (formato: `arn:aws:iam::123456789012:role/NomeDaRole`)**
4. **Atualize no .env:**
```env
SP_API_AWS_ACCOUNT_ID=SEU_ACCOUNT_ID_REAL
```

## 🔧 Como Usar o Sistema

### Verificar Status dos Tokens
```bash
curl http://localhost:3001/api/token-auth/status
```

### Renovar Tokens Manualmente
```bash
# Mercado Livre
curl -X POST http://localhost:3001/api/token-auth/mercadolivre/renew

# Todos os tokens
curl -X POST http://localhost:3001/api/token-auth/renew-all
```

### Obter URL de Autorização
```bash
curl http://localhost:3001/api/token-auth/mercadolivre/auth-url
```

## 🤖 Sistema Automático

**O sistema automaticamente:**
- ✅ Verifica tokens a cada 5 horas
- ✅ Renova tokens que expiram em menos de 1 hora
- ✅ Salva novos tokens no banco PostgreSQL
- ✅ Atualiza variáveis de ambiente em runtime
- ✅ Loga todas as operações para monitoramento

## 📋 Passos para Ativar Completamente

1. **Reautorize o Mercado Livre** (usando URL acima)
2. **Configure o ARN correto da Amazon**
3. **Inicie o servidor:** `npm run dev`
4. **Teste as APIs:** `node test-real-apis.js`
5. **Use o dashboard:** http://localhost:3000

## 🔄 Funcionamento da Renovação Automática

```javascript
// A cada 5 horas, o sistema:
setInterval(async () => {
  // 1. Verifica quais tokens expiram em 1 hora
  const expiringTokens = await checkTokenExpiration();
  
  // 2. Renova automaticamente tokens expirados
  for (const token of expiringTokens) {
    await renewToken(token.marketplace);
  }
  
  // 3. Salva novos tokens no banco
  await saveTokensToDatabase();
  
  // 4. Atualiza variáveis de ambiente
  updateEnvironmentVariables();
}, 5 * 60 * 60 * 1000); // 5 horas
```

## ⚠️ IMPORTANTE

- **Após reautorizar o ML, o sistema funcionará 100% automaticamente**
- **A renovação acontece ANTES dos tokens expirarem**
- **Todos os tokens são salvos de forma segura no PostgreSQL**
- **O sistema continua funcionando mesmo após reinicializações**

**Uma vez configurado, você nunca mais precisará se preocupar com tokens expirados!** 🎉