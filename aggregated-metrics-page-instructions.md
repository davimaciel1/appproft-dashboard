# Instruções para Claude Code - Criar Página de Métricas Agregadas

## Contexto
A API `/api/dashboard/aggregated-metrics` está retornando dados JSON corretos, mas está sendo exibido como JSON bruto no navegador. Precisamos criar uma página React que consuma essa API e exiba os dados em uma tabela formatada e bonita.

## Objetivo
Criar uma nova página/rota no React que:
1. Busque dados da API de métricas agregadas
2. Exiba em uma tabela profissional e bonita
3. Permita filtros e ordenação
4. Mostre totais e estatísticas

## TAREFA 1: Criar Nova Página React

### Arquivo a criar:
`client/src/pages/AggregatedMetrics.tsx`

### Funcionalidades da página:
1. **Header** similar ao Dashboard (laranja com logo AppProft)
2. **Filtros** no topo:
   - Seletor de período (date pickers para startDate e endDate)
   - Seletor de marketplace (Amazon/Mercado Livre)
   - Seletor de nível ASIN (PARENT/CHILD)
   - Botão "Aplicar Filtros"
3. **Tabela** com as seguintes colunas:
   - Imagem do produto (usar URL padrão se não tiver)
   - Nome do Produto
   - SKU
   - ASIN
   - Unidades Vendidas
   - Receita (R$)
   - Visualizações
   - Sessões
   - Taxa de Conversão (%)
4. **Rodapé da tabela** com totais:
   - Total de unidades vendidas
   - Receita total
   - Média de conversão

### Estrutura de componentes:
```
AggregatedMetrics.tsx
├── Header (reutilizar do Dashboard)
├── FiltersSection
│   ├── DateRangePicker
│   ├── MarketplaceSelect
│   └── AsinLevelSelect
├── MetricsTable
│   ├── TableHeader
│   ├── TableBody
│   └── TableFooter
└── LoadingSpinner
```

## TAREFA 2: Adicionar Rota no React Router

### Arquivo a modificar:
`client/src/App.tsx` ou onde estão as rotas

### Instruções:
1. Importar o novo componente AggregatedMetrics
2. Adicionar rota: `/aggregated-metrics`
3. Adicionar item no menu de navegação (se houver)

## TAREFA 3: Implementar a Tabela

### Especificações da tabela:
1. **Estilo**: Usar classes Tailwind similares ao Dashboard
2. **Cores**: 
   - Header da tabela: fundo cinza escuro (#4a5568)
   - Linhas alternadas: branco e cinza claro (#f7fafc)
   - Hover nas linhas: cinza médio (#e2e8f0)
3. **Formatação de valores**:
   - Receita: R$ X.XXX,XX (formato brasileiro)
   - Unidades: Número inteiro com separador de milhares
   - Percentual: XX.X%
4. **Ordenação**: Clicar no header deve ordenar por aquela coluna
5. **Responsividade**: Scroll horizontal em telas pequenas

### Exemplo de estrutura da tabela:
```html
<table class="w-full">
  <thead class="bg-gray-700 text-white">
    <tr>
      <th>Produto</th>
      <th>SKU</th>
      <th>ASIN</th>
      <th>Unidades</th>
      <th>Receita</th>
      <th>Views</th>
      <th>Sessões</th>
      <th>Conversão</th>
    </tr>
  </thead>
  <tbody>
    <!-- linhas aqui -->
  </tbody>
  <tfoot class="bg-gray-100 font-bold">
    <tr>
      <td colspan="3">Totais</td>
      <td>1.637</td>
      <td>R$ 34.036,73</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
    </tr>
  </tfoot>
</table>
```

## TAREFA 4: Implementar Chamada à API

### Função para buscar dados:
```typescript
const fetchAggregatedMetrics = async (filters) => {
  const params = new URLSearchParams({
    aggregationType: 'byAsin',
    marketplace: filters.marketplace,
    asinLevel: filters.asinLevel,
    startDate: filters.startDate,
    endDate: filters.endDate
  });
  
  const response = await api.get(`/api/dashboard/aggregated-metrics?${params}`);
  return response.data;
};
```

### Tratamento de dados:
1. Extrair o array de `data` do objeto retornado
2. Calcular totais para o rodapé
3. Formatar valores monetários e percentuais
4. Ordenar por receita (maior primeiro)

## TAREFA 5: Adicionar Funcionalidades Extras

### Exportação:
1. Botão "Exportar CSV" no topo da página
2. Gerar CSV com todos os dados da tabela
3. Nome do arquivo: `metricas-agregadas-${startDate}-${endDate}.csv`

### Busca:
1. Campo de busca para filtrar produtos na tabela
2. Buscar por nome do produto, SKU ou ASIN

### Paginação (se mais de 50 produtos):
1. Mostrar 50 produtos por página
2. Navegação no rodapé da tabela

## TAREFA 6: Melhorias Visuais

### Cards de resumo no topo:
Antes da tabela, mostrar 4 cards com:
1. **Receita Total**: R$ XX.XXX,XX
2. **Unidades Vendidas**: X.XXX
3. **Produtos Ativos**: XX
4. **Ticket Médio**: R$ XXX,XX

### Gráfico de barras (opcional):
- Top 10 produtos por receita
- Usar biblioteca recharts (já disponível no projeto)

## Exemplo de Layout Completo:

```
┌─────────────────────────────────────────┐
│         AppProft (header laranja)       │
├─────────────────────────────────────────┤
│  Filtros: [Data] [Marketplace] [ASIN]   │
├─────────────────────────────────────────┤
│  Cards: Receita | Unidades | Produtos   │
├─────────────────────────────────────────┤
│  [Buscar...] [Exportar CSV]             │
├─────────────────────────────────────────┤
│  Tabela de Produtos                     │
│  ┌─────┬─────┬─────┬─────┬─────┐      │
│  │Prod │SKU  │ASIN │Units│Rev  │      │
│  ├─────┼─────┼─────┼─────┼─────┤      │
│  │ ... │ ... │ ... │ ... │ ... │      │
│  └─────┴─────┴─────┴─────┴─────┘      │
├─────────────────────────────────────────┤
│  Paginação: < 1 2 3 ... >              │
└─────────────────────────────────────────┘
```

## Validações Importantes:
1. Mostrar loading enquanto busca dados
2. Mostrar mensagem se não houver dados
3. Tratar erros de API com toast de erro
4. Validar datas (endDate não pode ser antes de startDate)
5. Salvar filtros no localStorage para persistir entre sessões

## Código de Referência:
Usar o Dashboard.tsx e ProductsTable.tsx como referência para:
- Estrutura de componentes
- Estilo e classes Tailwind
- Padrões de chamada de API
- Tratamento de erros