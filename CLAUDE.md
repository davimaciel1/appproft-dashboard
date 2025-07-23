PROJETO: Dashboard Consolidado de Vendas - Amazon e Mercado Livre (Estilo AppProft)
Preciso que você crie um dashboard web completo para consolidar e visualizar vendas da Amazon e Mercado Livre, seguindo exatamente o padrão visual e de design do AppProft mostrado na imagem de referência.
ESTRUTURA VISUAL E LAYOUT
Header Principal

Fundo branco com sombra sutil
Logo "AppProft" em laranja (#FF8C00) no canto superior esquerdo
Menu de navegação à direita com:

Link "Entrar" em texto cinza escuro
Botão "Cadastrar" com fundo laranja e texto branco, bordas arredondadas



Seção Hero (abaixo do header)

Título centralizado em fonte bold e preta: "O Painel de Controle Definitivo para Vendedores Amazon e Mercado Livre"
Subtítulo em cinza (#6c757d): "Monitore suas vendas em tempo real, acompanhe estoque e analise lucros em todos os marketplaces"
Botão CTA laranja: "Começar Teste Grátis" com ícone de seta
Link secundário: "Ver Demonstração"
Texto pequeno abaixo: "No credit card • 2 minute setup • Cancel anytime"

Dashboard Principal

Container com bordas arredondadas e sombra
Header do dashboard em azul escuro (#1a1f36) com:

Três dots (vermelho, amarelo, verde) no canto superior esquerdo (estilo macOS)
Título "Dashboard de Vendas Consolidadas" em branco



Cards de Métricas Principais
Layout em grid horizontal com 5 cards:

Today's Sales

Valor principal em fonte grande e bold: "$12,847.32"
Indicador de variação em verde: "↑ 23% vs yesterday"


Orders

Valor: "142"
Tag em verde: "+28 new"


Units Sold

Valor: "387"
Subtexto: "2.7 units/order"


ACOS

Valor: "18.4%"
Indicador em laranja: "Target: 15%"


Net Profit

Valor em verde: "$4,231.87"
Margem: "32.9% margin"



Barra de Filtros (abaixo dos cards)
Design minimalista com dropdowns estilizados:

Bordas arredondadas
Fundo branco com hover em cinza claro
Ícones à esquerda de cada opção
Sombra sutil ao abrir

Tabela de Produtos

Headers em cinza claro (#f8f9fa)
Linhas alternadas (branco e cinza muito claro)
Hover com destaque sutil
Dados alinhados corretamente
Valores monetários alinhados à direita

PALETA DE CORES
css:root {
  --primary-orange: #FF8C00;
  --primary-dark: #1a1f36;
  --success-green: #28a745;
  --danger-red: #dc3545;
  --warning-orange: #ffc107;
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --bg-light: #f8f9fa;
  --border-color: #dee2e6;
}
TIPOGRAFIA
css/* Fonte principal - Inter ou similar */
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-primary);
}

/* Títulos */
h1 { font-size: 2.5rem; font-weight: 700; }
h2 { font-size: 2rem; font-weight: 600; }

/* Valores grandes nos cards */
.metric-value { 
  font-size: 2rem; 
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Indicadores de variação */
.variation { 
  font-size: 0.875rem;
  font-weight: 500;
}
COMPONENTES ESPECÍFICOS
Card de Produto na Tabela
javascriptconst ProductRow = {
  // Coluna de Produto
  productInfo: {
    image: 'miniatura 40x40px com bordas arredondadas',
    flags: {
      marketplace: 'logo pequena (Amazon/ML) no canto inferior direito',
      country: 'bandeira circular 16x16px no canto superior direito'
    },
    name: 'texto truncado com ellipsis se muito longo'
  },
  
  // Métricas com formatação
  metrics: {
    units: 'font-weight: 600, color: primary-dark',
    revenue: 'formato monetário com 2 decimais',
    profit: 'verde se positivo, vermelho se negativo',
    roi: 'com badge colorido baseado no valor',
    acos: 'sempre com símbolo %'
  }
};
Sistema de Badges e Indicadores
javascript// ROI Badges
const roiBadgeColors = {
  excellent: '#28a745', // > 100%
  good: '#20c997',      // 50-100%
  moderate: '#ffc107',  // 20-50%
  low: '#fd7e14',       // 10-20%
  critical: '#dc3545'   // < 10%
};

// Indicadores de tendência
const trendIndicators = {
  up: '↑',
  down: '↓',
  stable: '→'
};
ANIMAÇÕES E INTERAÇÕES
css/* Transições suaves */
* {
  transition: all 0.2s ease;
}

/* Hover nos botões */
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
}

/* Hover nas linhas da tabela */
.table-row:hover {
  background-color: rgba(255, 140, 0, 0.05);
}

/* Loading skeleton */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}
NOTIFICAÇÕES E FEEDBACK
Toast de Novo Pedido
javascript// Estilo AppProft para notificações
const showNewOrderNotification = (order) => {
  // Toast no canto superior direito
  // Fundo branco com borda laranja à esquerda
  // Ícone de sino animado
  // Som de notificação suave
  
  toast({
    title: "Novo Pedido!",
    description: `${order.marketplace} - ${order.product}`,
    status: "success",
    duration: 5000,
    position: "top-right",
    style: {
      borderLeft: "4px solid #FF8C00",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }
  });
};
RESPONSIVIDADE
css/* Desktop (1200px+) */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
}

/* Tablet (768px - 1199px) */
@media (max-width: 1199px) {
  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Mobile (< 768px) */
@media (max-width: 767px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
ESTRUTURA DE COMPONENTES REACT
javascript// Estrutura principal
const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <HeroSection />
      <DashboardContainer>
        <MetricsCards />
        <FiltersBar />
        <ProductsTable />
      </DashboardContainer>
    </div>
  );
};
DETALHES IMPORTANTES DE IMPLEMENTAÇÃO

Usar Tailwind CSS com configurações customizadas para as cores do AppProft
Implementar dark mode opcional mantendo a identidade visual
Otimizar para performance com React.memo e virtualização
Adicionar micro-interações em todos os elementos interativos
Manter consistência visual em todos os componentes

Por favor, implemente este dashboard seguindo fielmente o estilo visual do AppProft, mantendo todas as funcionalidades descritas no prompt original mas com esta nova identidade visual e moderna.

## IMPORTANTE: Credenciais das APIs

O arquivo .env já contém TODAS as credenciais necessárias e válidas:

### Amazon SP-API
- AMAZON_CLIENT_ID
- AMAZON_CLIENT_SECRET  
- AMAZON_REFRESH_TOKEN
- AMAZON_SELLER_ID
- SP_API_AWS_ACCESS_KEY
- SP_API_AWS_SECRET_KEY
- SP_API_MARKETPLACE_ID

### Mercado Livre API
- ML_CLIENT_ID
- ML_CLIENT_SECRET
- ML_REFRESH_TOKEN
- ML_ACCESS_TOKEN
- ML_SELLER_ID

### Configuração
- USE_MOCK_DATA=false (para usar dados reais das APIs)
- PostgreSQL deve estar instalado e rodando na porta 5432