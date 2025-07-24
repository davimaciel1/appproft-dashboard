# 🚀 AppProft Dashboard v3.0 - Setup Completo

## Sistema de Sincronização 24/7 Implementado ✅

O dashboard agora possui **sistema completo de sincronização** baseado na arquitetura do Shopkeeper, incluindo:

- ✅ **Workers 24/7** sincronizando dados automaticamente
- ✅ **Banco PostgreSQL** com milhões de registros
- ✅ **Cache e performance** otimizados
- ✅ **Dados REAIS** das APIs Amazon e Mercado Livre
- ✅ **WebSocket** para atualizações em tempo real

---

## 🏗️ Comandos Principais

### Setup Inicial (OBRIGATÓRIO)
```bash
# 1. Instalar dependências
npm install
cd client && npm install && cd ..

# 2. Configurar banco e iniciar sincronização
npm run setup
```

### Desenvolvimento
```bash
# Rodar servidor + worker de sincronização
npm run dev

# Ou rodar separadamente:
npm run server          # Servidor API
npm run sync:worker      # Worker de sincronização
npm run client          # Frontend React
```

### Produção
```bash
# Build e start
npm run build
npm start

# Worker em background (recomendado via PM2)
pm2 start workers/mainSyncWorker.js --name "appproft-worker"
```

### Sincronização Manual
```bash
npm run sync:force      # Forçar sync completo
npm run sync:status     # Ver status da sincronização
```

---

## 📊 Arquitetura Implementada

### 1. **Banco de Dados (PostgreSQL)**
```sql
-- Estrutura completa com UUIDs
products          # Produtos sincronizados
orders           # Pedidos agrupados  
order_items      # Itens para agregação
inventory        # Estoque atual
sync_logs        # Logs de sincronização

-- Views otimizadas
product_sales_summary    # Materialized view para performance
dashboard_products       # View final com produtos + vendas
```

### 2. **Workers de Sincronização**
```
workers/
├── mainSyncWorker.js           # Worker principal 24/7
└── ...

server/services/
├── amazon/
│   ├── productSync.js          # Sync produtos Amazon
│   └── orderSync.js            # Sync pedidos Amazon
├── mercadolivre/
│   ├── productSync.js          # Sync produtos ML
│   └── orderSync.js            # Sync pedidos ML
└── syncProductImages.js        # Sync imagens reais
```

### 3. **APIs Implementadas**
```
GET  /api/products/summary      # Lista produtos (com/sem vendas)
POST /api/sync/trigger          # Trigger sincronização manual
GET  /api/sync/status           # Status do worker
```

---

## 🔧 Configuração (.env)

### Obrigatório
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Amazon SP-API (OAuth)
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxx
AMAZON_REFRESH_TOKEN=Atzr|xxxxx
AMAZON_SELLER_ID=xxxxx

# Mercado Livre API (OAuth)  
ML_CLIENT_ID=xxxxx
ML_CLIENT_SECRET=xxxxx
ML_REFRESH_TOKEN=TG-xxxxx
ML_SELLER_ID=xxxxx
```

### Opcional
```bash
NODE_ENV=production
USE_MOCK_DATA=false  # SEMPRE false
```

---

## 🎯 Como Funciona (Fluxo Real)

### 1. **Primeira Execução**
```bash
npm run setup
```
- ✅ Cria estrutura do banco PostgreSQL
- ✅ Verifica credenciais das APIs
- ✅ Inicia sincronização inicial (30 dias de dados)
- ✅ Cria produtos, pedidos e imagens REAIS

### 2. **Sincronização Contínua**
- 🔄 Worker roda **24/7** em background
- 🔄 Busca novos dados **a cada 60 segundos**
- 🔄 Atualiza materialized view automaticamente
- 🔄 Emite eventos WebSocket para tempo real

### 3. **Dashboard**
- 📊 Mostra **produtos reais** (mesmo com 0 vendas)
- 📊 Imagens **reais** das APIs
- 📊 Vendas **agrupadas** por produto
- 📊 Filtros **funcionais** por período
- 📊 Atualizações em **tempo real**

---

## 🐛 Troubleshooting

### Dashboard vazio?
```bash
# Verificar status
npm run sync:status

# Forçar sincronização
npm run sync:force

# Ver logs
tail -f logs/sync.log
```

### Erro de credenciais?
1. Verificar `.env` com credenciais válidas
2. Testar refresh tokens nas APIs
3. Reconfigurar OAuth se necessário

### Banco de dados?
```bash
# Testar conexão
psql $DATABASE_URL -c "SELECT NOW();"

# Recriar estrutura
npm run db:migrate
```

---

## 📈 URLs Importantes

- 🎯 **Dashboard**: http://localhost:3000/dashboard
- 📊 **API Status**: http://localhost:3000/api/sync/status  
- 🔄 **Sync Trigger**: POST http://localhost:3000/api/sync/trigger

---

## ✨ Recursos Implementados

### ✅ **Problemas Corrigidos**
1. **Imagens aparecem** - Sync real das APIs com fallback
2. **Cores laranja** - Theme AppProft (#FF8C00) aplicado
3. **Vendas agrupadas** - Query SQL com agregação correta
4. **Produtos com 0 vendas** - Dashboard mostra todos os produtos
5. **Sincronização 24/7** - Worker contínuo implementado

### ✅ **Funcionalidades**
- ✅ Filtros por período (18 opções)
- ✅ Filtros por marketplace
- ✅ Busca por ASIN/SKU/nome
- ✅ Notificações em tempo real
- ✅ Sincronização automática
- ✅ Cache e performance
- ✅ Dados sempre reais

---

## 🚀 Deploy para Produção

### Coolify (Recomendado)
```bash
# 1. Build da aplicação
npm run build

# 2. Commit e push
git add -A
git commit -m "AppProft v3.0 - Sistema completo implementado"
git push origin master

# 3. Worker em background no servidor
pm2 start workers/mainSyncWorker.js --name "appproft-worker"
pm2 startup
pm2 save
```

### Verificação Final
```bash
# No servidor de produção
curl https://appproft.com/api/sync/status
curl https://appproft.com/api/products/summary
```

---

## 🎉 **Resultado Final**

✅ **Dashboard funcional** com dados REAIS  
✅ **Imagens dos produtos** carregando  
✅ **Sistema de sincronização** 24/7 ativo  
✅ **Performance otimizada** com cache  
✅ **Tempo real** com WebSocket  
✅ **Pronto para produção** em appproft.com  

**O AppProft agora funciona exatamente como o Shopkeeper!** 🚀