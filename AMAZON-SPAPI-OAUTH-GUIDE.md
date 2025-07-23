# 📚 Guia Completo: Amazon SP-API com OAuth

## 🔑 Dados Necessários (Apenas estes!)

1. **Client ID** - Identificador da aplicação
2. **Client Secret** - Segredo da aplicação
3. **Refresh Token** - Token permanente (obtido via autorização)
4. **Endpoint Regional** - URL da API por região

### 🌎 Endpoints por Região:
- **América do Norte**: `https://sellingpartnerapi-na.amazon.com`
- **Europa**: `https://sellingpartnerapi-eu.amazon.com`
- **Extremo Oriente**: `https://sellingpartnerapi-fe.amazon.com`

## 🔄 Fluxo de Autenticação

### 1️⃣ Obtenção do Refresh Token (Uma única vez)

1. **Vendedor autoriza no Seller Central**
   - URL: `https://sellercentral.amazon.com.br/apps/authorize/consent`
   - Parâmetros: `?application_id={CLIENT_ID}&state={STATE}&version=beta`

2. **Receber código de autorização**
   - Amazon redireciona com: `?spapi_oauth_code={CODE}`
   - ⚠️ Código expira em 5 minutos!

3. **Trocar código por Refresh Token**
   ```http
   POST https://api.amazon.com/auth/o2/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code={AUTHORIZATION_CODE}
   &client_id={CLIENT_ID}
   &client_secret={CLIENT_SECRET}
   ```

   **Resposta:**
   ```json
   {
     "access_token": "Atza|...",
     "refresh_token": "Atzr|...",  // GUARDAR ESTE!
     "token_type": "bearer",
     "expires_in": 3600
   }
   ```

### 2️⃣ Uso Diário (Renovação de Access Token)

Access Token expira em **1 hora**. Renove usando o Refresh Token:

```http
POST https://api.amazon.com/auth/o2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
```

**Resposta:**
```json
{
  "access_token": "Atza|...",  // Novo token válido por 1 hora
  "token_type": "bearer",
  "expires_in": 3600
}
```

### 3️⃣ Fazer Chamadas à SP-API

```http
GET https://sellingpartnerapi-na.amazon.com/orders/v0/orders
Authorization: Bearer {ACCESS_TOKEN}
x-amz-access-token: {ACCESS_TOKEN}
```

## ⚠️ Informações Importantes

### ✅ Refresh Token
- **NÃO expira** (válido indefinidamente)
- **NÃO pode ser recuperado** se perdido
- Só é invalidado se:
  - Vendedor revogar autorização
  - Aplicação for deletada
  - Mudanças nas políticas Amazon

### ❌ Não é mais necessário:
- AWS Access Key
- AWS Secret Key
- IAM Role
- AssumeRole
- Configurações AWS

## 🔐 Boas Práticas de Segurança

1. **Armazene com criptografia**
   - Use AES-256 ou superior
   - Nunca em texto plano

2. **Renovação automática**
   - Renove access token ANTES de expirar
   - Implemente retry com backoff

3. **Monitoramento**
   - Log de todas as renovações
   - Alertas se falhar

4. **Backup do Refresh Token**
   - Múltiplas cópias seguras
   - Plano de recuperação

## 💻 Implementação no Sistema

No nosso sistema, isso já está implementado:

1. **Interface Visual** em `/credentials`
   - Botão "Gerar Refresh Token" automático
   - Processo guiado passo a passo

2. **Renovação Automática**
   - Verifica a cada hora
   - Renova se expira em < 1 hora
   - Zero manutenção

3. **Armazenamento Seguro**
   - Criptografia AES-256-GCM
   - Isolamento por tenant
   - Backup automático

## 📊 Exemplo de Uso Completo

```javascript
// 1. Obter Access Token
const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.AMAZON_REFRESH_TOKEN,
    client_id: process.env.AMAZON_CLIENT_ID,
    client_secret: process.env.AMAZON_CLIENT_SECRET
  })
});

const { access_token } = await tokenResponse.json();

// 2. Fazer chamada à SP-API
const ordersResponse = await fetch('https://sellingpartnerapi-na.amazon.com/orders/v0/orders', {
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'x-amz-access-token': access_token
  }
});

const orders = await ordersResponse.json();
```

## 🎯 Resumo

O novo fluxo OAuth da Amazon SP-API é **muito mais simples**:
- Sem configuração AWS
- Apenas 3 credenciais necessárias
- Refresh Token permanente
- Renovação simples do Access Token

Tudo já está implementado e funcionando no sistema! 🚀