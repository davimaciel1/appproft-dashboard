# 🌐 Links dos Dashboards - AppProft

## 🚀 URLs de Produção (appproft.com)

### 📊 Dashboard Principal
- **URL**: https://appproft.com/dashboard
- **Descrição**: Dashboard geral com métricas consolidadas

### 🛍️ Amazon Data Viewer
- **URL**: https://appproft.com/amazon-data
- **Descrição**: Visualização completa dos dados da Amazon
- **Funcionalidades**:
  - Visão geral com métricas
  - Lista de produtos com estoque
  - Análise de competidores e Buy Box
  - Insights gerados pela IA
  - Previsões de demanda
  - Otimização de preços
  - Status do estoque

### 🧠 Central de Insights com IA
- **URL**: https://appproft.com/insights
- **Descrição**: Gerenciamento de insights e recomendações
- **Funcionalidades**:
  - Filtros por tipo e prioridade
  - Sistema de aprovação/rejeição
  - Estatísticas de aplicação
  - Impacto financeiro estimado

### 🗄️ Database Viewer (SQL)
- **URL**: https://appproft.com/database
- **Descrição**: Interface SQL avançada
- **Funcionalidades**:
  - Filtros SQL inteligentes
  - Criação de views customizadas
  - Exploração de tabelas
  - Execução de queries personalizadas

### 🏆 Buy Box Dashboard
- **URL**: https://appproft.com/buy-box-dashboard
- **Descrição**: Monitoramento de Buy Box em tempo real

### 📈 Métricas Agregadas
- **URL**: https://appproft.com/aggregated-metrics
- **Descrição**: Métricas consolidadas sem autenticação

### 🔐 Configuração de Credenciais
- **URL**: https://appproft.com/credentials
- **Descrição**: Gerenciamento de credenciais dos marketplaces

## 🔧 URLs de Desenvolvimento (localhost)

Para desenvolvimento local, substitua `https://appproft.com` por `http://localhost:3000`:

- http://localhost:3000/dashboard
- http://localhost:3000/amazon-data
- http://localhost:3000/insights
- http://localhost:3000/database
- http://localhost:3000/buy-box-dashboard
- http://localhost:3000/aggregated-metrics
- http://localhost:3000/credentials

## 📱 Configuração no Nginx (Produção)

```nginx
server {
    listen 443 ssl http2;
    server_name appproft.com www.appproft.com;
    
    ssl_certificate /etc/letsencrypt/live/appproft.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/appproft.com/privkey.pem;
    
    # React App (Client)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name appproft.com www.appproft.com;
    return 301 https://$server_name$request_uri;
}
```

## 🎯 Estrutura de Rotas no React

```javascript
// App.tsx
<Routes>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/amazon-data" element={<AmazonDataViewer />} />
  <Route path="/insights" element={<InsightsDashboard />} />
  <Route path="/database" element={<DatabaseViewer />} />
  <Route path="/buy-box-dashboard" element={<BuyBoxDashboard />} />
  <Route path="/aggregated-metrics" element={<AggregatedMetrics />} />
  <Route path="/credentials" element={<CredentialsConfig />} />
  <Route path="/login" element={<Login />} />
  <Route path="/" element={<Navigate to="/dashboard" />} />
</Routes>
```

## 🔒 Segurança

Todas as rotas (exceto `/login` e `/aggregated-metrics`) requerem autenticação. O sistema verifica o token JWT antes de permitir acesso.

## 📝 Notas Importantes

1. **SSL/HTTPS**: Já configurado via Let's Encrypt no Coolify
2. **Multi-tenant**: Pronto para subdomínios (empresa.appproft.com)
3. **API**: Todas as chamadas para `/api/*` são redirecionadas para o backend
4. **WebSocket**: Suporte configurado para notificações em tempo real