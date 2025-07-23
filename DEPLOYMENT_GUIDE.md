# 🚀 Guia de Deploy - Dashboard AppProft v2.0

## 📋 Resumo das Mudanças Implementadas

### 1. **Banco de Dados** ✅
- Criado schema completo com tabelas: `products`, `orders`, `order_items`, `inventory`, `sync_logs`
- Implementada **materialized view** `product_sales_summary` para ranking de produtos
- Adicionados índices para performance
- Sistema multi-tenant com isolamento por `tenant_id`

### 2. **Sincronização com Rate Limiting** ✅
- Implementado `SyncService` com controle de rate limit:
  - Amazon: 6 req/s (orders), 2 req/s (inventory/catalog)
  - Mercado Livre: 10 req/s
- Sincronização incremental a cada minuto
- Sincronização completa a cada 15 minutos
- Atualização de imagens a cada hora

### 3. **Worker em Tempo Real** ✅
- Criado `realtimeSyncWorker` com cron jobs
- WebSocket para notificações em tempo real
- Refresh automático da materialized view a cada 5 minutos

### 4. **API de Produtos Rankeados** ✅
- Endpoint `/api/dashboard/products` atualizado para usar ranking por vendas
- Suporte completo a filtros (marketplace, período, país)
- Dados agregados com vendas totais e vendas do dia

### 5. **Interface Atualizada** ✅
- **ProductsTable**: Nova tabela com ranking, badges coloridos, indicadores de estoque
- **RealtimeOrdersSidebar**: Sidebar com pedidos em tempo real
- **Notificações sonoras**: Implementadas com Web Audio API
- Layout responsivo com grid 3:1 (tabela:sidebar)

## 🔧 Passos para Deploy

### 1. Executar Migração do Banco
```bash
# SSH no servidor
ssh root@49.12.191.119

# Entrar no container do app
docker exec -it davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc bash

# Executar migração
npm run migrate
```

### 2. Criar Placeholder para Imagens
```bash
# Executar localmente
node create-placeholder.js

# Isso criará client/public/placeholder.svg
```

### 3. Build e Deploy
```bash
# Build do frontend
npm run build

# Commit e push
git add .
git commit -m "feat: implementar dashboard v2.0 com produtos rankeados e real-time

- Adicionar ranking de produtos por vendas
- Implementar sincronização com rate limiting
- Criar sidebar de pedidos em tempo real
- Adicionar notificações sonoras
- Atualizar interface seguindo especificações DASHBOARD.md

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin master
```

### 4. Verificar Deploy no Coolify
```bash
# Verificar status do deploy
node check-coolify-deploy.js

# Aguardar 5-10 minutos para build e deploy
```

### 5. Testar Sincronização
```bash
# No servidor, executar teste de sync
docker exec davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc npm run sync:test
```

## ✅ Checklist Pós-Deploy

- [ ] Acessar https://appproft.com/dashboard
- [ ] Verificar se produtos estão ordenados por vendas
- [ ] Testar filtros (marketplace, período, país)
- [ ] Verificar sidebar de pedidos em tempo real
- [ ] Confirmar notificações sonoras funcionando
- [ ] Verificar se imagens carregam com fallback
- [ ] Testar responsividade em mobile

## 🔍 Monitoramento

### Logs do Worker
```bash
docker exec davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc tail -f logs/sync.log
```

### Verificar Dados no PostgreSQL
```bash
# Conectar ao PostgreSQL
docker exec -it postgresql-database-sscowkg4g8swg8cw0gocwcgk psql -U postgres

# Queries úteis
SELECT COUNT(*) FROM products WHERE tenant_id = 1;
SELECT COUNT(*) FROM orders WHERE tenant_id = 1;
SELECT * FROM product_sales_summary WHERE tenant_id = 1 ORDER BY total_units_sold DESC LIMIT 10;
```

### WebSocket Events
```javascript
// No console do navegador
const socket = io();
socket.on('new-order', (order) => console.log('Novo pedido:', order));
```

## 🚨 Troubleshooting

### Se não houver dados no dashboard:
1. Verificar credenciais no banco: `SELECT * FROM marketplace_credentials;`
2. Executar sincronização manual: `npm run sync:test`
3. Verificar logs de erro: `SELECT * FROM sync_logs WHERE status = 'error';`

### Se imagens não carregarem:
1. Verificar se placeholder.svg existe em public/
2. Executar sync de imagens: `UPDATE products SET image_url = NULL WHERE image_url = '';`
3. Worker atualizará automaticamente

### Se filtros não funcionarem:
1. Limpar cache do navegador
2. Verificar console por erros de JavaScript
3. Confirmar que materialized view está atualizada

## 📊 Resultado Esperado

Após o deploy, o dashboard deve exibir:
- ✅ Produtos ordenados por vendas (mais vendidos primeiro)
- ✅ Ranking visual com badges (#1, #2, #3...)
- ✅ Vendas totais e vendas do dia para cada produto
- ✅ Indicadores de estoque com cores (crítico/aviso/bom)
- ✅ Sidebar com pedidos em tempo real
- ✅ Notificações sonoras para novos pedidos
- ✅ Filtros funcionais atualizando dados
- ✅ Sem dados mockados - tudo vindo do PostgreSQL

## 🎉 Conclusão

O dashboard AppProft v2.0 está pronto para produção com:
- Ranking de produtos por vendas
- Atualização em tempo real
- Rate limiting respeitado
- Interface profissional e responsiva
- Dados 100% reais das APIs

**Tempo estimado de deploy: 10-15 minutos**