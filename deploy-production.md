# Deploy Seguro para appproft.com

## Configurações de Segurança no Coolify

### 1. Variáveis de Ambiente OBRIGATÓRIAS

```env
# Ambiente
NODE_ENV=production
PORT=3000

# Segurança (GERAR VALORES ÚNICOS!)
JWT_SECRET=[gerar-string-aleatoria-64-chars]
ENCRYPTION_KEY=[gerar-string-aleatoria-64-chars]

# Database (fornecido pelo Coolify)
DATABASE_URL=[será preenchido automaticamente]

# Domínio
FRONTEND_URL=https://appproft.com

# APIs (adicionar quando usuário configurar)
# As credenciais são por usuário, não globais
```

### 2. Configuração de Domínio

1. No Coolify, configurar domínio: `appproft.com`
2. Habilitar HTTPS automático (Let's Encrypt)
3. Configurar redirects:
   - www.appproft.com → appproft.com
   - http → https

### 3. Configurações de Build

```dockerfile
# Já configurado no Dockerfile existente
```

### 4. Health Check

Configurar no Coolify:
- Path: `/api/health`
- Interval: 30s
- Timeout: 10s
- Retries: 3

### 5. Recursos Recomendados

- CPU: 2 cores mínimo
- RAM: 4GB mínimo
- Storage: 20GB SSD

### 6. Backup

Configurar backup automático do PostgreSQL:
- Frequência: Diário
- Retenção: 30 dias
- Armazenamento: S3 ou similar

## Checklist de Segurança

- [ ] JWT_SECRET gerado com 64+ caracteres aleatórios
- [ ] ENCRYPTION_KEY gerado com 64+ caracteres aleatórios
- [ ] HTTPS habilitado
- [ ] Rate limiting configurado
- [ ] CORS limitado a appproft.com
- [ ] Logs sem informações sensíveis
- [ ] Backup automático configurado
- [ ] Monitoramento ativo

## Gerar Strings Seguras

```bash
# Linux/Mac
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Monitoramento

Implementar monitoramento com:
- Uptime monitoring
- Error tracking (Sentry)
- Performance monitoring
- Security alerts