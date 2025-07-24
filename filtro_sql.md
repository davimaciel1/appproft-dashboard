# 🔽 Sistema de Filtros Dropdown para Consultas SQL

## 📋 Especificação do Sistema

### Interface do Usuário
- **Dropdown 1**: Período de Tempo
- **Dropdown 2**: Marketplace (Opcional)
- **Dropdown 3**: Ordenação
- **Botão**: "Executar Consulta"
- **Área de Resultado**: Tabela com os dados

### Filtros Disponíveis

#### 🗓️ **Período de Tempo**
- "Todos os períodos" (padrão)
- "Últimos 7 dias"
- "Últimos 30 dias"  
- "Últimos 90 dias"
- "Este mês"
- "Mês passado"
- "Este ano"
- "Ano passado"
- "2024"
- "2023" 
- "Janeiro 2024"
- "Fevereiro 2024"
- ... (todos os meses de 2024)
- "Dezembro 2024"
- "Q1 2024" (Trimestre 1)
- "Q2 2024" (Trimestre 2)
- "Q3 2024" (Trimestre 3)
- "Q4 2024" (Trimestre 4)

#### 🏪 **Marketplace**
- "Todos" (padrão)
- "Amazon"
- "Mercado Livre"

#### 📊 **Ordenação**
- "Mais vendidos" (padrão)
- "Mais pedidos"
- "Maior receita"
- "Alfabética (A-Z)"
- "Alfabética (Z-A)"

### Estrutura de Implementação

```javascript
// Configuração dos filtros
const FILTROS = {
  periodo: {
    'todos': { label: 'Todos os períodos', sql: '' },
    'ultimos_7': { label: 'Últimos 7 dias', sql: "AND o.order_date >= CURRENT_DATE - INTERVAL '7 days'" },
    'ultimos_30': { label: 'Últimos 30 dias', sql: "AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'" },
    'ultimos_90': { label: 'Últimos 90 dias', sql: "AND o.order_date >= CURRENT_DATE - INTERVAL '90 days'" },
    'este_mes': { 
      label: 'Este mês', 
      sql: `AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND EXTRACT(MONTH FROM o.order_date) = EXTRACT(MONTH FROM CURRENT_DATE)` 
    },
    'mes_passado': { 
      label: 'Mês passado', 
      sql: `AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
            AND EXTRACT(MONTH FROM o.order_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')` 
    },
    'este_ano': { 
      label: 'Este ano', 
      sql: "AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE)" 
    },
    'ano_passado': { 
      label: 'Ano passado', 
      sql: "AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1" 
    },
    '2024': { label: '2024', sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024" },
    '2023': { label: '2023', sql: "AND EXTRACT(YEAR FROM o.order_date) = 2023" },
    'jan_2024': { 
      label: 'Janeiro 2024', 
      sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 1" 
    },
    'fev_2024': { 
      label: 'Fevereiro 2024', 
      sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 2" 
    },
    // ... continuar para todos os meses
    'q1_2024': { 
      label: 'Q1 2024', 
      sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 1" 
    },
    'q2_2024': { 
      label: 'Q2 2024', 
      sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 2" 
    },
    'q3_2024': { 
      label: 'Q3 2024', 
      sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 3" 
    },
    'q4_2024': { 
      label: 'Q4 2024', 
      sql: "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 4" 
    }
  },
  
  marketplace: {
    'todos': { label: 'Todos', sql: '' },
    'amazon': { label: 'Amazon', sql: "AND p.marketplace = 'amazon'" },
    'mercadolivre': { label: 'Mercado Livre', sql: "AND p.marketplace = 'mercadolivre'" }
  },
  
  ordenacao: {
    'mais_vendidos': { label: 'Mais vendidos', sql: 'ORDER BY total_vendas DESC' },
    'mais_pedidos': { label: 'Mais pedidos', sql: 'ORDER BY total_pedidos DESC' },
    'maior_receita': { label: 'Maior receita', sql: 'ORDER BY total_revenue DESC' },
    'alfabetica_az': { label: 'Alfabética (A-Z)', sql: 'ORDER BY product_name ASC' },
    'alfabetica_za': { label: 'Alfabética (Z-A)', sql: 'ORDER BY product_name DESC' }
  }
};
```

### Query Base
```sql
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  {FILTRO_PERIODO}
  {FILTRO_MARKETPLACE}
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
{ORDENACAO}
LIMIT 50
```

### Função Geradora de Query
```javascript
function gerarQuery(filtros) {
  const { periodo, marketplace, ordenacao } = filtros;
  
  const baseSql = `
    SELECT 
      p.asin,
      p.image_url,
      p.name AS product_name,
      COALESCE(SUM(oi.quantity), 0) AS total_vendas,
      COUNT(DISTINCT o.id) AS total_pedidos,
      ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
      p.marketplace,
      p.country_code
    FROM products p
    LEFT JOIN order_items oi ON p.id = oi.product_id
    LEFT JOIN orders o ON oi.order_id = o.id
    WHERE p.asin IS NOT NULL 
      AND p.asin != ''
      ${FILTROS.periodo[periodo]?.sql || ''}
      ${FILTROS.marketplace[marketplace]?.sql || ''}
    GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
    ${FILTROS.ordenacao[ordenacao]?.sql || 'ORDER BY total_vendas DESC'}
    LIMIT 50
  `;
  
  return baseSql.trim();
}
```

## 🎨 Interface HTML/CSS

### HTML Structure
```html
<div class="filtros-container">
  <div class="filtros-header">
    <h3>🔍 Filtros de Consulta</h3>
    <p>Selecione os filtros e clique em "Executar" para ver os resultados</p>
  </div>
  
  <div class="filtros-grid">
    <div class="filtro-group">
      <label for="periodo">📅 Período:</label>
      <select id="periodo" class="filtro-select">
        <option value="todos">Todos os períodos</option>
        <option value="ultimos_7">Últimos 7 dias</option>
        <option value="ultimos_30">Últimos 30 dias</option>
        <option value="ultimos_90">Últimos 90 dias</option>
        <option value="este_mes">Este mês</option>
        <option value="mes_passado">Mês passado</option>
        <option value="este_ano">Este ano</option>
        <option value="ano_passado">Ano passado</option>
        <option value="2024">2024</option>
        <option value="2023">2023</option>
        <optgroup label="Meses de 2024">
          <option value="jan_2024">Janeiro 2024</option>
          <option value="fev_2024">Fevereiro 2024</option>
          <option value="mar_2024">Março 2024</option>
          <option value="abr_2024">Abril 2024</option>
          <option value="mai_2024">Maio 2024</option>
          <option value="jun_2024">Junho 2024</option>
          <option value="jul_2024">Julho 2024</option>
          <option value="ago_2024">Agosto 2024</option>
          <option value="set_2024">Setembro 2024</option>
          <option value="out_2024">Outubro 2024</option>
          <option value="nov_2024">Novembro 2024</option>
          <option value="dez_2024">Dezembro 2024</option>
        </optgroup>
        <optgroup label="Trimestres de 2024">
          <option value="q1_2024">Q1 2024 (Jan-Mar)</option>
          <option value="q2_2024">Q2 2024 (Abr-Jun)</option>
          <option value="q3_2024">Q3 2024 (Jul-Set)</option>
          <option value="q4_2024">Q4 2024 (Out-Dez)</option>
        </optgroup>
      </select>
    </div>
    
    <div class="filtro-group">
      <label for="marketplace">🏪 Marketplace:</label>
      <select id="marketplace" class="filtro-select">
        <option value="todos">Todos</option>
        <option value="amazon">Amazon</option>
        <option value="mercadolivre">Mercado Livre</option>
      </select>
    </div>
    
    <div class="filtro-group">
      <label for="ordenacao">📊 Ordenar por:</label>
      <select id="ordenacao" class="filtro-select">
        <option value="mais_vendidos">Mais vendidos</option>
        <option value="mais_pedidos">Mais pedidos</option>
        <option value="maior_receita">Maior receita</option>
        <option value="alfabetica_az">Alfabética (A-Z)</option>
        <option value="alfabetica_za">Alfabética (Z-A)</option>
      </select>
    </div>
    
    <div class="filtro-group">
      <button id="executar-consulta" class="btn-executar">
        🚀 Executar Consulta
      </button>
    </div>
  </div>
  
  <div class="query-preview">
    <label>📝 Query SQL (gerada automaticamente):</label>
    <textarea id="sql-preview" readonly rows="8"></textarea>
    <button id="copiar-sql" class="btn-copiar">📋 Copiar SQL</button>
  </div>
</div>

<div class="resultados-container">
  <div id="loading" class="loading-state" style="display: none;">
    <div class="spinner"></div>
    <p>Executando consulta...</p>
  </div>
  
  <div id="resultados" class="resultados-grid">
    <!-- Resultados aparecem aqui -->
  </div>
</div>
```

### CSS Styling
```css
.filtros-container {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}

.filtros-header {
  text-align: center;
  margin-bottom: 24px;
}

.filtros-header h3 {
  color: #1a1f36;
  margin: 0 0 8px 0;
  font-size: 1.5rem;
}

.filtros-header p {
  color: #6c757d;
  margin: 0;
}

.filtros-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 20px;
  align-items: end;
}

@media (max-width: 768px) {
  .filtros-grid {
    grid-template-columns: 1fr;
  }
}

.filtro-group {
  display: flex;
  flex-direction: column;
}

.filtro-group label {
  font-weight: 600;
  color: #1a1f36;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.filtro-select {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  transition: all 0.2s ease;
  cursor: pointer;
}

.filtro-select:focus {
  outline: none;
  border-color: #FF8C00;
  box-shadow: 0 0 0 3px rgba(255, 140, 0, 0.1);
}

.filtro-select:hover {
  border-color: #cbd5e0;
}

.btn-executar {
  background: linear-gradient(135deg, #FF8C00, #ff7700);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-executar:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
}

.btn-executar:active {
  transform: translateY(0);
}

.query-preview {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}

.query-preview label {
  display: block;
  font-weight: 600;
  color: #1a1f36;
  margin-bottom: 8px;
}

.query-preview textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  background: #f8f9fa;
  resize: vertical;
}

.btn-copiar {
  background: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  margin-top: 8px;
  transition: all 0.2s ease;
}

.btn-copiar:hover {
  background: #5a6268;
}

.loading-state {
  text-align: center;
  padding: 48px;
  color: #6c757d;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #FF8C00;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.resultados-grid {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.resultado-header {
  background: #1a1f36;
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.resultado-stats {
  font-size: 0.9rem;
  opacity: 0.8;
}

.tabela-container {
  max-height: 600px;
  overflow-y: auto;
}

.tabela-resultados {
  width: 100%;
  border-collapse: collapse;
}

.tabela-resultados th,
.tabela-resultados td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.tabela-resultados th {
  background: #f8f9fa;
  font-weight: 600;
  color: #1a1f36;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tabela-resultados tr:hover {
  background: rgba(255, 140, 0, 0.05);
}

.produto-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.produto-image {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}

.produto-name {
  font-weight: 500;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.numero-destaque {
  font-weight: 600;
  color: #1a1f36;
}

.valor-monetario {
  font-weight: 600;
  color: #28a745;
}

.marketplace-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.marketplace-amazon {
  background: #ff9900;
  color: white;
}

.marketplace-mercadolivre {
  background: #fff159;
  color: #333;
}
```

## 🔧 JavaScript Functionality

### Implementação Principal
```javascript
class FiltroSQL {
  constructor() {
    this.init();
  }
  
  init() {
    this.bindEvents();
    this.atualizarPreview();
  }
  
  bindEvents() {
    // Event listeners para os dropdowns
    document.getElementById('periodo').addEventListener('change', () => this.atualizarPreview());
    document.getElementById('marketplace').addEventListener('change', () => this.atualizarPreview());
    document.getElementById('ordenacao').addEventListener('change', () => this.atualizarPreview());
    
    // Botão executar
    document.getElementById('executar-consulta').addEventListener('click', () => this.executarConsulta());
    
    // Botão copiar SQL
    document.getElementById('copiar-sql').addEventListener('click', () => this.copiarSQL());
  }
  
  atualizarPreview() {
    const filtros = this.obterFiltros();
    const sql = this.gerarQuery(filtros);
    document.getElementById('sql-preview').value = sql;
  }
  
  obterFiltros() {
    return {
      periodo: document.getElementById('periodo').value,
      marketplace: document.getElementById('marketplace').value,
      ordenacao: document.getElementById('ordenacao').value
    };
  }
  
  gerarQuery(filtros) {
    const { periodo, marketplace, ordenacao } = filtros;
    
    const baseSql = `SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  ${this.getFiltroSQL(periodo, 'periodo')}
  ${this.getFiltroSQL(marketplace, 'marketplace')}
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
${this.getFiltroSQL(ordenacao, 'ordenacao')}
LIMIT 50`;
    
    return baseSql;
  }
  
  getFiltroSQL(valor, tipo) {
    const filtros = {
      periodo: {
        'todos': '',
        'ultimos_7': "AND o.order_date >= CURRENT_DATE - INTERVAL '7 days'",
        'ultimos_30': "AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'",
        'ultimos_90': "AND o.order_date >= CURRENT_DATE - INTERVAL '90 days'",
        'este_mes': `AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                     AND EXTRACT(MONTH FROM o.order_date) = EXTRACT(MONTH FROM CURRENT_DATE)`,
        'mes_passado': `AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
                        AND EXTRACT(MONTH FROM o.order_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')`,
        'este_ano': "AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE)",
        'ano_passado': "AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1",
        '2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024",
        '2023': "AND EXTRACT(YEAR FROM o.order_date) = 2023",
        'jan_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 1",
        'fev_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 2",
        'mar_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 3",
        'abr_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 4",
        'mai_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 5",
        'jun_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 6",
        'jul_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 7",
        'ago_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 8",
        'set_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 9",
        'out_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 10",
        'nov_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 11",
        'dez_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(MONTH FROM o.order_date) = 12",
        'q1_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 1",
        'q2_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 2",
        'q3_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 3",
        'q4_2024': "AND EXTRACT(YEAR FROM o.order_date) = 2024 AND EXTRACT(QUARTER FROM o.order_date) = 4"
      },
      marketplace: {
        'todos': '',
        'amazon': "AND p.marketplace = 'amazon'",
        'mercadolivre': "AND p.marketplace = 'mercadolivre'"
      },
      ordenacao: {
        'mais_vendidos': 'ORDER BY total_vendas DESC',
        'mais_pedidos': 'ORDER BY total_pedidos DESC',
        'maior_receita': 'ORDER BY total_revenue DESC',
        'alfabetica_az': 'ORDER BY product_name ASC',
        'alfabetica_za': 'ORDER BY product_name DESC'
      }
    };
    
    return filtros[tipo][valor] || '';
  }
  
  async executarConsulta() {
    const loading = document.getElementById('loading');
    const resultados = document.getElementById('resultados');
    
    try {
      loading.style.display = 'block';
      resultados.innerHTML = '';
      
      const sql = document.getElementById('sql-preview').value;
      
      // Fazer requisição para API
      const response = await fetch('/api/execute-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.renderizarResultados(data.results);
      } else {
        this.mostrarErro(data.error);
      }
      
    } catch (error) {
      this.mostrarErro('Erro ao executar consulta: ' + error.message);
    } finally {
      loading.style.display = 'none';
    }
  }
  
  renderizarResultados(dados) {
    const container = document.getElementById('resultados');
    
    if (!dados || dados.length === 0) {
      container.innerHTML = `
        <div class="resultado-vazio">
          <h3>📭 Nenhum resultado encontrado</h3>
          <p>Tente ajustar os filtros para ver mais dados.</p>
        </div>
      `;
      return;
    }
    
    const html = `
      <div class="resultado-header">
        <h3>📊 Resultados da Consulta</h3>
        <div class="resultado-stats">
          ${dados.length} produtos encontrados
        </div>
      </div>
      
      <div class="tabela-container">
        <table class="tabela-resultados">
          <thead>
            <tr>
              <th>Produto</th>
              <th>ASIN</th>
              <th>Vendas</th>
              <th>Pedidos</th>
              <th>Receita</th>
              <th>Marketplace</th>
            </tr>
          </thead>
          <tbody>
            ${dados.map(produto => this.renderizarLinhaProduto(produto)).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = html;
  }
  
  renderizarLinhaProduto(produto) {
    return `
      <tr>
        <td>
          <div class="produto-info">
            <img src="${produto.image_url || '/placeholder-product.png'}" 
                 alt="${produto.product_name}" 
                 class="produto-image"
                 onerror="this.src='/placeholder-product.png'">
            <div class="produto-name" title="${produto.product_name}">
              ${produto.product_name}
            </div>
          </div>
        </td>
        <td><code>${produto.asin}</code></td>
        <td><span class="numero-destaque">${produto.total_vendas}</span></td>
        <td><span class="numero-destaque">${produto.total_pedidos}</span></td>
        <td><span class="valor-monetario">$${produto.total_revenue}</span></td>
        <td>
          <span class="marketplace-badge marketplace-${produto.marketplace}">
            ${produto.marketplace}
          </span>
        </td>
      </tr>
    `;
  }
  
  mostrarErro(mensagem) {
    const container = document.getElementById('resultados');
    container.innerHTML = `
      <div class="resultado-erro">
        <h3>❌ Erro na Consulta</h3>
        <p>${mensagem}</p>
      </div>
    `;
  }
  
  copiarSQL() {
    const textarea = document.getElementById('sql-preview');
    textarea.select();
    document.execCommand('copy');
    
    const botao = document.getElementById('copiar-sql');
    const textoOriginal = botao.textContent;
    botao.textContent = '✅ Copiado!';
    
    setTimeout(() => {
      botao.textContent = textoOriginal;
    }, 2000);
  }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  new FiltroSQL();
});
```

## 🚀 Integração com Backend

### Endpoint da API
```javascript
// No arquivo de rotas (ex: routes/database-query.js)
router.post('/execute-query', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Validar query (apenas SELECTs permitidos)
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      return res.json({
        success: false,
        error: 'Apenas consultas SELECT são permitidas'
      });
    }
    
    // Executar query
    const result = await executeSQL(query);
    
    res.json({
      success: true,
      results: result.rows,
      count: result.rowCount
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});
```

## 📱 Responsividade

O sistema será totalmente responsivo:
- **Desktop**: Layout em grid com 4 colunas
- **Tablet**: Layout em grid com 2 colunas  
- **Mobile**: Layout em coluna única

## ✨ Características Principais

1. **Interface Intuitiva**: Dropdowns claros e organizados
2. **Preview em Tempo Real**: SQL gerado automaticamente
3. **Cópia Fácil**: Botão para copiar SQL
4. **Resultados Visuais**: Tabela estilizada com imagens
5. **Loading States**: Feedback visual durante execução
6. **Error Handling**: Tratamento de erros amigável
7. **Responsivo**: Funciona em todos os dispositivos

Este sistema mantém a flexibilidade do SQL mas oferece uma interface super amigável para usuários não técnicos!