Preciso que você recrie COMPLETAMENTE o dashboard baseado nesta descrição detalhada:

## LAYOUT GERAL

### HEADER DO DASHBOARD
- Fundo: Verde escuro (#16A34A ou similar)
- Altura: ~60px
- Título "Sales" em branco no canto esquerdo
- Botão "Get a discount!" no canto direito com bandeira dos EUA

### BARRA DE FILTROS (abaixo do header verde)
- Fundo: Branco
- Padding: 16px
- 5 elementos em linha:

1. DROPDOWN "Today" (filtro de período)
   - Largura: ~150px
   - Opções (TODAS OBRIGATÓRIAS):
     * Today
     * Yesterday
     * Day Before Yesterday
     * This Week
     * Last Week
     * Last 7 Days
     * Last 14 Days
     * This Month
     * Last Month
     * Month Before Last
     * Last 30 Days
     * Last 3 Months
     * Last 6 Months
     * Last 12 Months
     * Year to Date
     * Last Year
     * All Time
     * Custom

2. DROPDOWN "All Markets"
   - Opções: All Markets, Amazon, Mercado Livre

3. DROPDOWN "All Orders"
   - Opções: All Orders, Pending, Shipped, Delivered, Cancelled

4. DROPDOWN "All Brands & Seller IDs"
   - Listar brands/sellers disponíveis

5. CAMPO DE BUSCA
   - Placeholder: "Enter ASIN, SKU, Order or Keyword"
   - Ícone de lupa à direita
   - Borda cinza clara

### LINHA DE TOTAIS (topo da tabela)
- Fundo: Cinza escuro (#374151)
- Texto: Branco
- Altura: ~50px
- Colunas alinhadas com a tabela principal:
  * "Totals" (esquerda)
  * Units: Número + "+X" em verde pequeno
  * Revenue: Valor em dólar azul
  * Profit: Valor em dólar verde
  * ROI: "0%" com "Margin: XX%" abaixo em cinza
  * ACOS: "0%" com "B/E: XX%" abaixo em cinza

### TABELA DE PRODUTOS

#### ESTRUTURA DAS COLUNAS:
1. **Coluna PRODUTO** (350px largura)
   - Thumbnail 60x60px com bordas arredondadas
   - Logo do marketplace (Amazon/ML) no canto inferior direito do thumbnail (20x20px)
   - Bandeira do país no canto superior esquerdo (16x16px circular)
   - À direita da imagem:
     * Nome do produto (fonte média, cor preta)
     * SKU/ASIN abaixo (fonte pequena, cor cinza)
   - Ícones de ações no final (gráfico, link, configurações)

2. **Coluna UNITS** (120px, centralizada)
   - Número principal grande
   - "+X" em verde pequeno ao lado
   - Ícone de refresh abaixo

3. **Coluna REVENUE** (150px, alinhada à direita)
   - Valor em dólar ($XXX) em azul (#3B82F6)
   - Ícone de coração verde abaixo

4. **Coluna PROFIT** (150px, alinhada à direita)
   - Valor em dólar
   - Verde (#10B981) se positivo com ▲
   - Vermelho (#EF4444) se negativo com ▼
   - Ícone de lixeira abaixo

5. **Coluna ROI** (120px, centralizada)
   - "0%" como texto principal
   - "Margin: XX%" abaixo em cinza pequeno
   - Sem ícones

6. **Coluna ACOS** (120px, centralizada)
   - "0%" como texto principal
   - "B/E: XX%" abaixo em cinza pequeno
   - Ícone de busca no final

#### ESTILO DA TABELA:
- Linhas alternadas: branco e cinza muito claro (#F9FAFB)
- Hover: fundo cinza claro (#F3F4F6)
- Padding vertical: 12px por linha
- Bordas: linha fina cinza clara entre linhas
- Sem bordas verticais

### CORES EXATAS:
- Verde header: #16A34A
- Cinza escuro (totals): #374151
- Azul revenue: #3B82F6
- Verde profit: #10B981
- Vermelho loss: #EF4444
- Cinza texto secundário: #6B7280
- Fundo alternado: #F9FAFB

### COMPORTAMENTOS:
1. Produtos ordenados por TOTAL DE VENDAS (maior primeiro)
2. Filtros atualizam dados em tempo real
3. Hover mostra tooltip com mais informações
4. Clique no produto abre detalhes
5. Paginação no rodapé (20 produtos por página)

### DADOS OBRIGATÓRIOS DE CADA PRODUTO:
- image_url (com fallback para placeholder)
- marketplace_logo 
- country_flag
- product_name
- sku/asin
- units_sold
- units_variation (+X)
- revenue (formatado em dólar)
- profit (formatado em dólar com cor)
- roi_percentage
- profit_margin
- acos
- break_even

IMPORTANTE: 
- NÃO incluir coluna de ranking
- Todos os valores devem vir do PostgreSQL
- Implementar loading skeleton enquanto carrega
- Performance com virtual scrolling para muitos produtos


COMPONENTES A CRIAR/MODIFICAR:

1. Dashboard.jsx - estrutura principal
2. FiltersBar.jsx - barra com todos os dropdowns
3. TotalsRow.jsx - linha de totais no topo
4. ProductsTable.jsx - tabela principal
5. ProductRow.jsx - linha individual de produto
6. TimeFilter.jsx - dropdown com TODAS as opções de tempo

QUERIES SQL NECESSÁRIAS:
- Buscar produtos com todas as métricas agregadas
- Ordenar por total_units_sold DESC
- Incluir JOINs com inventory, orders, advertising_metrics
- Calcular profit margin e break-even

FORMATAÇÕES:
- Moeda: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
- Porcentagem: valor.toFixed(1) + '%'
- Números: valor.toLocaleString()

O resultado DEVE ser visualmente IDÊNTICO ao descrito acima.