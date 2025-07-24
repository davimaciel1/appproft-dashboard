# Instruções para Claude Code - Correções do AppProft

## Contexto
O AppProft é um SaaS de dashboard de vendas (Amazon/Mercado Livre) que está com 3 problemas principais:
1. Layout não está full width e está alinhado à esquerda
2. Filtros de período não funcionam (Today, Yesterday, This Month, etc)
3. Headers da tabela estão mostrando números ao invés dos nomes das colunas

## PROBLEMA 1: Layout Full Width

### Arquivos para modificar:
- `client/src/pages/Dashboard.tsx`
- `client/src/components/ProductsTable.tsx`
- `client/src/index.css` ou `client/src/App.css`

### Instruções:
1. No Dashboard.tsx, remover qualquer classe `container` ou `max-w-` que esteja limitando a largura
2. Substituir por `w-full` em todos os elementos principais
3. O header laranja deve ocupar 100% da largura da tela
4. A área de conteúdo deve ter `w-full px-4` para ocupar toda largura com padding lateral
5. Verificar se não há margin ou padding no body/html que esteja criando espaços laterais
6. A tabela de produtos deve usar `w-full` e não ter max-width

## PROBLEMA 2: Filtros de Período Não Funcionam

### Arquivos para modificar:
- `client/src/pages/Dashboard.tsx`
- `client/src/components/FiltersBar.tsx`
- `server/routes/dashboardLocal.js` ou `server/routes/dashboard-fallback.js`

### Instruções Frontend:
1. No Dashboard.tsx, verificar se o estado `filters` está sendo atualizado quando o usuário clica nos filtros
2. Adicionar console.log no handleFiltersChange para debug
3. Garantir que fetchDashboardData está sendo chamado quando filters mudam
4. O filtro de período deve enviar valores como: 'today', 'yesterday', 'this_week', 'this_month', etc
5. Verificar se o FiltersBar está emitindo o evento onFiltersChange corretamente

### Instruções Backend:
1. No arquivo de rotas do dashboard, adicionar processamento dos query parameters
2. Implementar lógica para filtrar por período:
   - 'today': data de hoje
   - 'yesterday': ontem
   - 'this_week': últimos 7 dias
   - 'this_month': mês atual
   - 'last_month': mês anterior
3. Adicionar WHERE clause dinâmica na query SQL baseada no período
4. Garantir que as métricas também sejam filtradas pelo mesmo período

## PROBLEMA 3: Headers da Tabela com Números

### Arquivos para modificar:
- `client/src/components/ProductsTable.tsx`

### Instruções:
1. Localizar onde a tabela está sendo renderizada
2. Os headers devem mostrar:
   - "Tools" (com imagem do produto)
   - "Units" (quantidade vendida)
   - "Revenue" (receita)
   - "Profit" (lucro)
   - "ROI" (retorno sobre investimento)
   - "ACOS" (custo de publicidade)
3. Verificar se está usando um componente de tabela que está sobrescrevendo os headers
4. Se estiver usando map() para gerar headers, verificar o array de origem
5. Headers devem ser strings fixas, não valores calculados

## PROBLEMA ADICIONAL: Rotas API

### Verificar:
1. O Dashboard está chamando `/api/dashboard/` mas deveria chamar `/api/dashboard-local/`
2. Atualizar todas as chamadas de API no Dashboard.tsx
3. Garantir que o backend tem as rotas registradas corretamente em server/index.js

## Testes para Validar as Correções:

1. **Layout**: A página deve ocupar 100% da largura do navegador sem barras de rolagem horizontal
2. **Filtros**: Ao clicar em "Today", deve mostrar apenas vendas de hoje. Verificar no Network tab se o parâmetro está sendo enviado
3. **Headers**: A tabela deve mostrar os nomes das colunas em texto, não números
4. **API**: Verificar no console do navegador se não há erros 404 nas chamadas de API

## Ordem de Implementação Sugerida:
1. Primeiro corrigir as rotas API (mais crítico)
2. Depois corrigir os headers da tabela (visual importante)
3. Em seguida implementar os filtros funcionais
4. Por último ajustar o layout full width

## Comandos Úteis para Debug:
```bash
# No frontend
npm start
# Abrir console do navegador (F12)
# Verificar Network tab para chamadas de API
# Verificar Console para erros

# No backend  
npm run dev
# Adicionar console.log nas rotas para ver os parâmetros recebidos
# Verificar logs do servidor para queries SQL
```