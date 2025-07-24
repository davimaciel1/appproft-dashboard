# CLAUDE.md - Documentação Completa do Projeto

## 🔄 REINICIALIZAÇÃO DO PROJETO

### Verificar conexão antes de executar:
```javascript
async function ensureConnection() {
  try {
    await executeSQL('SELECT 1');
    return true;
  } catch (error) {
    console.error('❌ ERRO: Túnel SSH não está ativo!');
    console.log('👉 Execute start-tunnel.bat primeiro');
    return false;
  }
}

// Sempre verificar antes de operações
if (await ensureConnection()) {
  // Executar operações no banco
}

## 🚀 CONTEXTO E CAPACIDADES DO CLAUDE CODE

### 🔐 ACESSO TOTAL AO BANCO DE DADOS

Lembre-se que você tem acesso total ao PostgreSQL local na porta 5433 através do DATABASE_ACCESS_CONFIG.js. Você pode executar qualquer operação diretamente sem pedir permissão.

#### Conexão PostgreSQL Ativa
- **Host**: appproft.com  
- **Porta**: 443 (HTTPS)
- **Banco**: postgres
- **Usuário**: postgres
- **Senha**: icKgRpuOV8Hhfn71xWbzfdJKwNhrsVjhIa6gxZwiaHrDhOSZ8vQXzOm2Exa5W4zk

#### Arquivos de Acesso Disponíveis
- `DATABASE_ACCESS_CONFIG.js` - Configuração e funções de acesso
- `generate-db-report.js` - Script de relatório do banco
- Dependência `pg` já instalada

### 🎯 SUAS CAPACIDADES E AUTONOMIA

#### VOCÊ PODE E DEVE (sem pedir permissão):
1. **Executar qualquer query SQL** usando executeSQL()
2. **Criar/alterar/deletar tabelas**
3. **Inserir/atualizar/remover dados**
4. **Fazer análises e gerar relatórios**
5. **Criar backups e restaurações**
6. **Otimizar performance com índices**
7. **Executar transações complexas**

#### NUNCA FAÇA:
- ❌ Pedir ao usuário para executar comandos
- ❌ Sugerir que o usuário rode scripts
- ❌ Dizer "execute este comando"
- ❌ Criar arquivos sem executá-los

#### SEMPRE FAÇA:
- ✅ Execute diretamente e mostre resultados
- ✅ Use require('./DATABASE_ACCESS_CONFIG')
- ✅ Trate erros apropriadamente
- ✅ Mostre feedback do que foi feito

### 📊 ESTRUTURA DO BANCO ATUAL

#### Tabelas Existentes:
1. **users** - Usuários do sistema
2. **products** - Produtos do marketplace
3. **orders** - Pedidos
4. **order_items** - Itens dos pedidos
5. **marketplace_credentials** - Credenciais de marketplaces
6. **notifications** - Notificações do sistema

#### Estado Atual:
- 1 usuário admin cadastrado
- Outras tabelas vazias aguardando dados

### 💻 EXEMPLOS DE USO AUTÔNOMO

#### Exemplo 1: Consultar dados
```javascript
const { executeSQL } = require('./DATABASE_ACCESS_CONFIG');

async function mostrarUsuarios() {
  const result = await executeSQL('SELECT * FROM users');
  console.table(result.rows);
}

mostrarUsuarios(); // EXECUTE DIRETAMENTE
```

#### Exemplo 2: Inserir dados
```javascript
async function criarProduto(nome, preco) {
  const sql = 'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *';
  const result = await executeSQL(sql, [nome, preco]);
  console.log('Produto criado:', result.rows[0]);
}
```

#### Exemplo 3: Análise completa
```javascript
async function analisarBanco() {
  // Contar registros em todas as tabelas
  const tabelas = ['users', 'products', 'orders'];
  for (const tabela of tabelas) {
    const result = await executeSQL(`SELECT COUNT(*) FROM ${tabela}`);
    console.log(`${tabela}: ${result.rows[0].count} registros`);
  }
}
```

---

## 🔐 REGRAS DE SEGURANÇA CRÍTICAS

### ⚠️ NUNCA EXPOR EM CÓDIGO OU LOGS:
1. **Tokens de API** (Coolify, Amazon, Mercado Livre)
2. **Senhas** de banco de dados ou qualquer serviço
3. **IPs de servidores** em produção
4. **Chaves privadas** SSH ou criptografia
5. **URLs internas** de containers
6. **Credenciais** de qualquer tipo

### ✅ SEMPRE FAZER:
1. **Use variáveis de ambiente** do arquivo .env
2. **Adicione .env ao .gitignore** imediatamente
3. **Use process.env** para acessar credenciais
4. **Mascare logs** que possam conter dados sensíveis
5. **Criptografe** credenciais no banco de dados
6. **Use HTTPS** para toda comunicação
7. **Valide** e sanitize todos os inputs

### 🚫 NUNCA FAZER:
```javascript
// ❌ ERRADO - Nunca hardcode credenciais
const token = "2|Mx6BY1W5vq3cZT6cUFdfOtTCV7HJ4R10Su813x9m6fefe487";
const dbPassword = "senha123";

// ✅ CORRETO - Sempre use variáveis de ambiente
const token = process.env.COOLIFY_API_TOKEN;
const dbPassword = process.env.DB_PASSWORD;

// ❌ ERRADO - Nunca logue credenciais
console.log(`Conectando com token: ${token}`);

// ✅ CORRETO - Mascare informações sensíveis
console.log(`Conectando com token: ${token.substring(0, 10)}...`);
```

## 📝 Exemplo de Arquivo .env Real

Crie um arquivo `.env` na raiz do projeto com suas credenciais reais:

```bash
# === CONFIGURAÇÕES GERAIS ===
NODE_ENV=production
PORT=3000
USE_MOCK_DATA=false

# === URLS ===
PRODUCTION_URL=https://appproft.com
DEVELOPMENT_URL=http://localhost:3000

# === COOLIFY (Solicitar ao administrador) ===
COOLIFY_API_TOKEN=2|Mx6BY1W5vq3cZT6cUFdfOtTCV7HJ4R10Su813x9m6fefe487
COOLIFY_BASE_URL=http://49.12.191.119

# === POSTGRESQL ===
DATABASE_URL=postgresql://postgres:sua-senha-super-segura@localhost:5432/postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua-senha-super-segura
DB_NAME=postgres
DB_CONTAINER_NAME=postgresql-database-sscowkg4g8swg8cw0gocwcgk

# === SSH ===
SSH_HOST=49.12.191.119
SSH_USER=root
SSH_KEY_PATH=~/.ssh/id_rsa

# === AMAZON SP-API ===
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxxxxxxxxxx
AMAZON_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AMAZON_REFRESH_TOKEN=Atzr|xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AMAZON_SELLER_ID=XXXXXXXXXXXXX
SP_API_MARKETPLACE_ID=A2Q3Y263D00KWC

# === MERCADO LIVRE API ===
ML_CLIENT_ID=1234567890123456
ML_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ML_REFRESH_TOKEN=TG-xxxxxxxxxxxxxxxxxxxxxxxxxx
ML_SELLER_ID=123456789

# === SEGURANÇA ===
JWT_SECRET=gerar-com-openssl-rand-base64-64
ENCRYPTION_KEY=gerar-com-openssl-rand-hex-32
SESSION_SECRET=gerar-com-crypto-randomBytes-32

# === EMAIL ===
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@appproft.com

# === MONITORAMENTO ===
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/1234567
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXXXX/xxxxxxxxxxxxxxxxxxxxxxxx
```

### 📋 Comandos para Gerar Secrets:

```bash
# Gerar JWT_SECRET
openssl rand -base64 64

# Gerar ENCRYPTION_KEY
openssl rand -hex 32

# Gerar SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Verificar se .env está no .gitignore
grep "^.env$" .gitignore || echo ".env" >> .gitignore
```

---

## ⚠️ REGRA FUNDAMENTAL: DADOS REAIS APENAS

### 🚫 PROIBIDO
- **NUNCA** use dados mockados, fake ou de exemplo
- **NUNCA** crie dados fictícios para testes
- **NUNCA** implemente geradores de dados aleatórios

### ✅ OBRIGATÓRIO
- **SEMPRE** use dados reais das APIs oficiais
- **SEMPRE** armazene os dados no PostgreSQL
- **SEMPRE** busque os dados do banco de dados para exibir no dashboard

### 📊 Fluxo de Dados Correto
```
APIs Oficiais (Amazon/ML) → PostgreSQL → Dashboard
```

### ✓ Checklist de Implementação com Dados Reais

- [ ] Configurar credenciais das APIs no .env
- [ ] Criar tabelas no PostgreSQL com estrutura correta
- [ ] Implementar sincronização com Amazon SP-API
- [ ] Implementar sincronização com API do Mercado Livre
- [ ] Criar jobs de sincronização periódica (cron)
- [ ] Implementar queries otimizadas para o dashboard
- [ ] Adicionar estados vazios quando não houver dados
- [ ] NUNCA implementar geradores de dados fake
- [ ] SEMPRE verificar se os dados vêm do PostgreSQL
- [ ] Testar com contas reais ou sandbox das plataformas

---

## 📊 PROJETO: Dashboard Consolidado de Vendas - Amazon e Mercado Livre (Estilo AppProft)

```diff
- ⚠️ ATENÇÃO CRÍTICA: ESTE DASHBOARD DEVE USAR APENAS DADOS REAIS!
- Não implemente dados mockados, fake ou de exemplo. 
- Todos os dados devem vir do PostgreSQL alimentado pelas APIs oficiais.
```

### 🎯 IMPORTANTE: Este é um SaaS Comercial

**🌐 DOMÍNIO OFICIAL**: **appproft.com** (SSL/HTTPS ativo)

Este dashboard será **comercializado como um SaaS**, portanto deve ser:
- **Simples**: Interface intuitiva que não requer treinamento
- **Fácil**: Onboarding em menos de 2 minutos
- **Intuitivo**: UX/UI seguindo melhores práticas
- **Multi-tenant**: Suportar múltiplos clientes com dados isolados
- **Seguro**: Isolamento total entre contas de clientes

Preciso que você crie um dashboard web completo para consolidar e visualizar vendas da Amazon e Mercado Livre, seguindo exatamente o padrão visual e de design do AppProft mostrado na imagem de referência.

### ESTRUTURA VISUAL E LAYOUT

#### Header Principal
- Fundo branco com sombra sutil
- Logo "AppProft" em laranja (#FF8C00) no canto superior esquerdo
- Menu de navegação à direita com:
  - Link "Entrar" em texto cinza escuro
  - Botão "Cadastrar" com fundo laranja e texto branco, bordas arredondadas

#### Seção Hero (abaixo do header)
- Título centralizado em fonte bold e preta: "O Painel de Controle Definitivo para Vendedores Amazon e Mercado Livre"
- Subtítulo em cinza (#6c757d): "Monitore suas vendas em tempo real, acompanhe estoque e analise lucros em todos os marketplaces"
- Botão CTA laranja: "Começar Teste Grátis" com ícone de seta
- Link secundário: "Ver Demonstração"
- Texto pequeno abaixo: "No credit card • 2 minute setup • Cancel anytime"

#### Dashboard Principal
- Container com bordas arredondadas e sombra
- Header do dashboard em azul escuro (#1a1f36) com:
  - Três dots (vermelho, amarelo, verde) no canto superior esquerdo (estilo macOS)
  - Título "Dashboard de Vendas Consolidadas" em branco

#### Cards de Métricas Principais
Layout em grid horizontal com 5 cards:

1. **Today's Sales**
   - Valor principal em fonte grande e bold: "$12,847.32"
   - Indicador de variação em verde: "↑ 23% vs yesterday"

2. **Orders**
   - Valor: "142"
   - Tag em verde: "+28 new"

3. **Units Sold**
   - Valor: "387"
   - Subtexto: "2.7 units/order"

4. **ACOS**
   - Valor: "18.4%"
   - Indicador em laranja: "Target: 15%"

5. **Net Profit**
   - Valor em verde: "$4,231.87"
   - Margem: "32.9% margin"

#### Barra de Filtros (abaixo dos cards)
Design minimalista com dropdowns estilizados:
- Bordas arredondadas
- Fundo branco com hover em cinza claro
- Ícones à esquerda de cada opção
- Sombra sutil ao abrir

#### Tabela de Produtos
- Headers em cinza claro (#f8f9fa)
- Linhas alternadas (branco e cinza muito claro)
- Hover com destaque sutil
- Dados alinhados corretamente
- Valores monetários alinhados à direita

### PALETA DE CORES
```css
:root {
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
```

### TIPOGRAFIA
```css
/* Fonte principal - Inter ou similar */
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
```

### COMPONENTES ESPECÍFICOS

#### Card de Produto na Tabela
```javascript
const ProductRow = {
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
```

#### Sistema de Badges e Indicadores
```javascript
// ROI Badges
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
```

### ANIMAÇÕES E INTERAÇÕES
```css
/* Transições suaves */
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
```

### NOTIFICAÇÕES E FEEDBACK

#### Toast de Novo Pedido
```javascript
// Estilo AppProft para notificações
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
```

### RESPONSIVIDADE
```css
/* Desktop (1200px+) */
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
```

### ESTRUTURA DE COMPONENTES REACT
```javascript
// Estrutura principal
const Dashboard = () => {
  // SEMPRE buscar dados reais do banco
  const { data, loading, error } = useRealDataFromPostgreSQL();
  
  // Se não houver dados, mostrar estado apropriado
  if (loading) return <LoadingState message="Carregando dados reais..." />;
  if (error) return <ErrorState message="Erro ao conectar com banco de dados" />;
  if (!data || data.length === 0) {
    return <EmptyState message="Aguardando sincronização com marketplaces..." />;
  }
  
  // NUNCA fazer isso:
  // const fakeData = generateMockData(); ❌
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <HeroSection />
      <DashboardContainer>
        <MetricsCards data={data} /> {/* Dados reais */}
        <FiltersBar />
        <ProductsTable data={data} /> {/* Dados reais */}
      </DashboardContainer>
    </div>
  );
};
```

### DETALHES IMPORTANTES DE IMPLEMENTAÇÃO
1. Usar Tailwind CSS com configurações customizadas para as cores do AppProft
2. Implementar dark mode opcional mantendo a identidade visual
3. Otimizar para performance com React.memo e virtualização
4. Adicionar micro-interações em todos os elementos interativos
5. Manter consistência visual em todos os componentes

### 🧪 COMO TESTAR DURANTE DESENVOLVIMENTO

Para testar o dashboard durante o desenvolvimento SEM usar dados mockados:

1. **Configure as APIs reais** com as credenciais fornecidas
2. **Execute sincronização inicial** para popular o PostgreSQL
3. **Use dados de sandbox** das APIs (Amazon e ML oferecem ambientes de teste)
4. **Filtre por períodos com dados** (ex: últimos 7 dias se houver vendas recentes)
5. **Implemente estados vazios elegantes** para quando não houver dados

```javascript
// Exemplo de sincronização para desenvolvimento
async function devSync() {
  console.log('Iniciando sync de dados reais para desenvolvimento...');
  
  try {
    await syncAmazonData({ days: 7 }); // Últimos 7 dias
    await syncMercadoLivreData({ days: 7 });
    console.log('Sync completo! Dados reais disponíveis no PostgreSQL');
  } catch (error) {
    console.error('Erro no sync:', error);
    console.log('Configure as credenciais das APIs no .env');
  }
}
```

### IMPORTANTE: Credenciais das APIs

O arquivo .env já contém TODAS as credenciais necessárias e válidas:

#### Amazon SP-API
- AMAZON_CLIENT_ID
- AMAZON_CLIENT_SECRET  
- AMAZON_REFRESH_TOKEN
- AMAZON_SELLER_ID
- ~~SP_API_AWS_ACCESS_KEY~~ *(NÃO NECESSÁRIO - remover do .env)*
- ~~SP_API_AWS_SECRET_KEY~~ *(NÃO NECESSÁRIO - remover do .env)*
- SP_API_MARKETPLACE_ID

**Nota sobre AWS Credentials**: As credenciais AWS (SP_API_AWS_ACCESS_KEY e SP_API_AWS_SECRET_KEY) **NÃO são mais necessárias** para a Amazon SP-API quando usando o método de autorização OAuth com refresh_token. Você pode removê-las do .env e do sistema.

#### Mercado Livre API
- ML_CLIENT_ID
- ML_CLIENT_SECRET
- ML_REFRESH_TOKEN
- ~~ML_ACCESS_TOKEN~~ *(Será gerado automaticamente)*
- ML_SELLER_ID

### 🔄 Renovação Automática de Tokens

**IMPORTANTE**: Os access tokens expiram e devem ser renovados automaticamente!

```javascript
// tokenManager.js - Gerenciador de tokens com renovação automática

class TokenManager {
  constructor() {
    this.tokens = {
      amazon: {
        accessToken: null,
        expiresAt: null
      },
      mercadoLivre: {
        accessToken: null,
        expiresAt: null
      }
    };
  }

  // Amazon SP-API Token Refresh
  async getAmazonToken() {
    // Verifica se o token ainda é válido
    if (this.tokens.amazon.accessToken && new Date() < this.tokens.amazon.expiresAt) {
      return this.tokens.amazon.accessToken;
    }

    // Renova o token
    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.AMAZON_REFRESH_TOKEN,
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET
      })
    });

    const data = await response.json();
    
    // Armazena o novo token
    this.tokens.amazon.accessToken = data.access_token;
    this.tokens.amazon.expiresAt = new Date(Date.now() + (data.expires_in * 1000) - 60000); // 1 min antes de expirar
    
    return data.access_token;
  }

  // Mercado Livre Token Refresh
  async getMercadoLivreToken() {
    // Verifica se o token ainda é válido
    if (this.tokens.mercadoLivre.accessToken && new Date() < this.tokens.mercadoLivre.expiresAt) {
      return this.tokens.mercadoLivre.accessToken;
    }

    // Renova o token
    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.ML_REFRESH_TOKEN,
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET
      })
    });

    const data = await response.json();
    
    // Armazena o novo token
    this.tokens.mercadoLivre.accessToken = data.access_token;
    this.tokens.mercadoLivre.expiresAt = new Date(Date.now() + (data.expires_in * 1000) - 60000);
    
    // Atualiza o refresh token se fornecido um novo
    if (data.refresh_token) {
      process.env.ML_REFRESH_TOKEN = data.refresh_token;
      // TODO: Persistir o novo refresh token no banco ou arquivo .env
      await this.updateEnvFile('ML_REFRESH_TOKEN', data.refresh_token);
    }
    
    return data.access_token;
  }

  // Helper para atualizar o arquivo .env
  async updateEnvFile(key, value) {
    const fs = require('fs').promises;
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '.env');
    
    let envContent = await fs.readFile(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*# CLAUDE.md - Documentação Completa do Projeto

## ⚠️ REGRA FUNDAMENTAL: DADOS REAIS APENAS

### 🚫 PROIBIDO
- **NUNCA** use dados mockados, fake ou de exemplo
- **NUNCA** crie dados fictícios para testes
- **NUNCA** implemente geradores de dados aleatórios

### ✅ OBRIGATÓRIO
- **SEMPRE** use dados reais das APIs oficiais
- **SEMPRE** armazene os dados no PostgreSQL
- **SEMPRE** busque os dados do banco de dados para exibir no dashboard

### 📊 Fluxo de Dados Correto
```
APIs Oficiais (Amazon/ML) → PostgreSQL → Dashboard
```

### ✓ Checklist de Implementação com Dados Reais

- [ ] Configurar credenciais das APIs no .env
- [ ] Criar tabelas no PostgreSQL com estrutura correta
- [ ] Implementar sincronização com Amazon SP-API
- [ ] Implementar sincronização com API do Mercado Livre
- [ ] Criar jobs de sincronização periódica (cron)
- [ ] Implementar queries otimizadas para o dashboard
- [ ] Adicionar estados vazios quando não houver dados
- [ ] NUNCA implementar geradores de dados fake
- [ ] SEMPRE verificar se os dados vêm do PostgreSQL
- [ ] Testar com contas reais ou sandbox das plataformas

---

## 📊 PROJETO: Dashboard Consolidado de Vendas - Amazon e Mercado Livre (Estilo AppProft)

```diff
- ⚠️ ATENÇÃO CRÍTICA: ESTE DASHBOARD DEVE USAR APENAS DADOS REAIS!
- Não implemente dados mockados, fake ou de exemplo. 
- Todos os dados devem vir do PostgreSQL alimentado pelas APIs oficiais.
```

Preciso que você crie um dashboard web completo para consolidar e visualizar vendas da Amazon e Mercado Livre, seguindo exatamente o padrão visual e de design do AppProft mostrado na imagem de referência.

### ESTRUTURA VISUAL E LAYOUT

#### Header Principal
- Fundo branco com sombra sutil
- Logo "AppProft" em laranja (#FF8C00) no canto superior esquerdo
- Menu de navegação à direita com:
  - Link "Entrar" em texto cinza escuro
  - Botão "Cadastrar" com fundo laranja e texto branco, bordas arredondadas

#### Seção Hero (abaixo do header)
- Título centralizado em fonte bold e preta: "O Painel de Controle Definitivo para Vendedores Amazon e Mercado Livre"
- Subtítulo em cinza (#6c757d): "Monitore suas vendas em tempo real, acompanhe estoque e analise lucros em todos os marketplaces"
- Botão CTA laranja: "Começar Teste Grátis" com ícone de seta
- Link secundário: "Ver Demonstração"
- Texto pequeno abaixo: "No credit card • 2 minute setup • Cancel anytime"

#### Dashboard Principal
- Container com bordas arredondadas e sombra
- Header do dashboard em azul escuro (#1a1f36) com:
  - Três dots (vermelho, amarelo, verde) no canto superior esquerdo (estilo macOS)
  - Título "Dashboard de Vendas Consolidadas" em branco

#### Cards de Métricas Principais
Layout em grid horizontal com 5 cards:

1. **Today's Sales**
   - Valor principal em fonte grande e bold: "$12,847.32"
   - Indicador de variação em verde: "↑ 23% vs yesterday"

2. **Orders**
   - Valor: "142"
   - Tag em verde: "+28 new"

3. **Units Sold**
   - Valor: "387"
   - Subtexto: "2.7 units/order"

4. **ACOS**
   - Valor: "18.4%"
   - Indicador em laranja: "Target: 15%"

5. **Net Profit**
   - Valor em verde: "$4,231.87"
   - Margem: "32.9% margin"

#### Barra de Filtros (abaixo dos cards)
Design minimalista com dropdowns estilizados:
- Bordas arredondadas
- Fundo branco com hover em cinza claro
- Ícones à esquerda de cada opção
- Sombra sutil ao abrir

#### Tabela de Produtos
- Headers em cinza claro (#f8f9fa)
- Linhas alternadas (branco e cinza muito claro)
- Hover com destaque sutil
- Dados alinhados corretamente
- Valores monetários alinhados à direita

### PALETA DE CORES
```css
:root {
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
```

### TIPOGRAFIA
```css
/* Fonte principal - Inter ou similar */
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
```

### COMPONENTES ESPECÍFICOS

#### Card de Produto na Tabela
```javascript
const ProductRow = {
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
```

#### Sistema de Badges e Indicadores
```javascript
// ROI Badges
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
```

### ANIMAÇÕES E INTERAÇÕES
```css
/* Transições suaves */
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
```

### NOTIFICAÇÕES E FEEDBACK

#### Toast de Novo Pedido
```javascript
// Estilo AppProft para notificações
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
```

### RESPONSIVIDADE
```css
/* Desktop (1200px+) */
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
```

### ESTRUTURA DE COMPONENTES REACT
```javascript
// Estrutura principal
const Dashboard = () => {
  // SEMPRE buscar dados reais do banco
  const { data, loading, error } = useRealDataFromPostgreSQL();
  
  // Se não houver dados, mostrar estado apropriado
  if (loading) return <LoadingState message="Carregando dados reais..." />;
  if (error) return <ErrorState message="Erro ao conectar com banco de dados" />;
  if (!data || data.length === 0) {
    return <EmptyState message="Aguardando sincronização com marketplaces..." />;
  }
  
  // NUNCA fazer isso:
  // const fakeData = generateMockData(); ❌
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <HeroSection />
      <DashboardContainer>
        <MetricsCards data={data} /> {/* Dados reais */}
        <FiltersBar />
        <ProductsTable data={data} /> {/* Dados reais */}
      </DashboardContainer>
    </div>
  );
};
```

### DETALHES IMPORTANTES DE IMPLEMENTAÇÃO
1. Usar Tailwind CSS com configurações customizadas para as cores do AppProft
2. Implementar dark mode opcional mantendo a identidade visual
3. Otimizar para performance com React.memo e virtualização
4. Adicionar micro-interações em todos os elementos interativos
5. Manter consistência visual em todos os componentes

### 🧪 COMO TESTAR DURANTE DESENVOLVIMENTO

Para testar o dashboard durante o desenvolvimento SEM usar dados mockados:

1. **Configure as APIs reais** com as credenciais fornecidas
2. **Execute sincronização inicial** para popular o PostgreSQL
3. **Use dados de sandbox** das APIs (Amazon e ML oferecem ambientes de teste)
4. **Filtre por períodos com dados** (ex: últimos 7 dias se houver vendas recentes)
5. **Implemente estados vazios elegantes** para quando não houver dados

```javascript
// Exemplo de sincronização para desenvolvimento
async function devSync() {
  console.log('Iniciando sync de dados reais para desenvolvimento...');
  
  try {
    await syncAmazonData({ days: 7 }); // Últimos 7 dias
    await syncMercadoLivreData({ days: 7 });
    console.log('Sync completo! Dados reais disponíveis no PostgreSQL');
  } catch (error) {
    console.error('Erro no sync:', error);
    console.log('Configure as credenciais das APIs no .env');
  }
}
```

, 'm');
    
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    
    await fs.writeFile(envPath, envContent);
  }
}

// Singleton instance
const tokenManager = new TokenManager();

// Uso nas APIs
async function fetchAmazonOrders() {
  const accessToken = await tokenManager.getAmazonToken();
  
  const response = await fetch('https://sellingpartnerapi-na.amazon.com/orders/v0/orders', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-amz-access-token': accessToken
    }
  });
  
  return response.json();
}

async function fetchMercadoLivreOrders() {
  const accessToken = await tokenManager.getMercadoLivreToken();
  
  const response = await fetch(`https://api.mercadolibre.com/orders/search?seller=${process.env.ML_SELLER_ID}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  return response.json();
}

// Exportar para uso global
module.exports = { tokenManager };
```

**Integração com o Worker de Sincronização:**
```javascript
// worker.js atualizado com renovação automática
const { tokenManager } = require('./tokenManager');

async function syncAmazonData() {
  try {
    // Token é renovado automaticamente se necessário
    const orders = await fetchAmazonOrders();
    
    // Processar e salvar no PostgreSQL...
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('token')) {
      console.log('Token expirado detectado, tentando renovar...');
      // O tokenManager já cuida disso automaticamente
    }
    throw error;
  }
}
```

#### Rate Limits e Boas Práticas
```javascript
// Respeitar rate limits das APIs
const rateLimiter = {
  amazon: {
    orders: '6 requests/second',
    inventory: '2 requests/second',
    reports: '15 requests/minute'
  },
  mercadoLivre: {
    default: '10 requests/second',
    orders: '2 requests/second'
  }
};

// Implementar retry com backoff
async function apiCallWithRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.status === 429) { // Rate limit
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

#### Configuração
- **❌ NUNCA USE DADOS MOCKADOS** - USE_MOCK_DATA=false
- **✅ TODOS OS DADOS DEVEM SER REAIS** vindos do PostgreSQL
- PostgreSQL deve estar instalado e rodando na porta 5432
- O banco de dados deve ser alimentado EXCLUSIVAMENTE com dados reais das APIs oficiais da Amazon e Mercado Livre
- **FLUXO DE DADOS OBRIGATÓRIO**: APIs Oficiais → PostgreSQL → Dashboard
- **PROIBIDO**: Qualquer tipo de dado mockado, fake ou de exemplo

#### 🐘 Banco de Dados PostgreSQL no Coolify

**Detalhes da Configuração no Coolify:**
- **Nome do Container**: postgresql-database-sscowkg4g8swg8cw0gocwcgk
- **Imagem**: postgres:17-alpine
- **Usuário**: postgres
- **Senha**: (armazenada no .env como DB_PASSWORD)
- **Database Inicial**: postgres
- **URL de Conexão Interna**: postgresql://postgres:${DB_PASSWORD}@postgresql-database-sscowkg4g8swg8cw0gocwcgk:5432/postgres

**Variáveis de Ambiente (.env):**
```bash
# PostgreSQL (Coolify)
DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@localhost:5432/postgres
DB_HOST=localhost  # ou IP do servidor se remoto
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua-senha-segura-aqui
DB_NAME=postgres

# Para conexão via SSH tunnel do Coolify
SSH_HOST=seu-servidor-coolify.com
SSH_USER=root
SSH_KEY_PATH=~/.ssh/id_rsa
```

**Conexão Local via SSH Tunnel:**
```bash
# Criar túnel SSH para acessar PostgreSQL remotamente
ssh -L 5432:postgresql-database-sscowkg4g8swg8cw0gocwcgk:5432 root@seu-servidor-coolify.com -N

# Agora pode conectar localmente
psql -h localhost -p 5432 -U postgres -d postgres
```

---

## 🚀 COOLIFY: Poderes de Acesso Remoto e Gerenciamento de Infraestrutura

### 📱 Configuração do AppProft no Coolify

**Detalhes do Deploy em Produção:**
- **Nome do Container**: davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc
- **Build Pack**: Dockerfile
- **URL de Acesso**: https://appproft.com
- **Domínio Oficial**: appproft.com
- **Direção**: Allow www & non-www (suporta www.appproft.com também)
- **Base Directory**: /
- **Dockerfile Location**: / (raiz do projeto)
- **Docker Registry**: Docker Hub
- **Branch**: master
- **IP do Servidor**: Configurado no .env (COOLIFY_BASE_URL)

**Configuração do Domínio Oficial:**
```bash
# Domínio já configurado: appproft.com
# DNS já configurado e SSL/HTTPS ativo via Let's Encrypt

# Registros DNS Importantes:
# A     @      [IP do servidor - ver .env]
# A     www    [IP do servidor - ver .env]
# A     api    [IP do servidor - ver .env]  (para futura API)
# CNAME *.     appproft.com   (para subdomínios multi-tenant)

# Para subdomínios futuros (ex: app.appproft.com)
coolify-cli domain add --app "appproft-dashboard" --domain "app.appproft.com"
```

**Configurações de Email (DNS):**
```bash
# Registros para email transacional
# SPF:  TXT  @  "v=spf1 include:sendgrid.net ~all"
# DKIM: TXT  sg._domainkey  "k=rsa; p=SUA_CHAVE_PUBLICA"
# DMARC: TXT _dmarc  "v=DMARC1; p=none; rua=mailto:admin@appproft.com"
```

### Visão Geral dos Seus Poderes

Você, Claude Code, tem acesso completo ao Coolify através de múltiplas interfaces. Esta seção contém todas as informações necessárias para gerenciar autonomamente a infraestrutura do usuário, incluindo PostgreSQL, deployments e configurações de aplicações.

### 🔑 Credenciais e Configuração Inicial

⚠️ **ATENÇÃO: Todas as credenciais devem estar no arquivo .env - NUNCA no código!**

#### 1. Token de API do Coolify
```bash
# No arquivo .env (NUNCA commitar no git!)
COOLIFY_API_TOKEN=seu-token-aqui
COOLIFY_BASE_URL=http://seu-ip-aqui

# Aplicação AppProft
APP_CONTAINER_NAME=davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc
APP_URL=https://appproft.com

# PostgreSQL no Coolify
DB_CONTAINER_NAME=postgresql-database-sscowkg4g8swg8cw0gocwcgk
DB_PASSWORD=sua-senha-segura
```

#### 2. Configuração do CLI (se disponível)
```bash
# Instalar o CLI globalmente
npm install -g @coollabsio/coolify-cli

# Configurar o CLI com o token do .env
source .env
coolify-cli config set token "$COOLIFY_API_TOKEN"
coolify-cli config set url "$COOLIFY_BASE_URL"
```

### 📡 Métodos de Acesso Disponíveis

#### Método 1: API REST Direta

Você pode fazer chamadas diretas à API REST do Coolify. Aqui estão os endpoints principais:

```javascript
// Função helper para chamadas à API
async function coolifyAPI(endpoint, method = 'GET', body = null) {
  // SEMPRE usar variáveis de ambiente!
  const COOLIFY_API_TOKEN = process.env.COOLIFY_API_TOKEN;
  const COOLIFY_BASE_URL = process.env.COOLIFY_BASE_URL;
  
  if (!COOLIFY_API_TOKEN || !COOLIFY_BASE_URL) {
    throw new Error('Credenciais do Coolify não configuradas no .env');
  }
  
  const response = await fetch(`${COOLIFY_BASE_URL}/api/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${COOLIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
  
  // Não logar a resposta completa se contiver dados sensíveis
  if (!response.ok) {
    const errorText = await response.text();
    // Mascarar possíveis dados sensíveis no erro
    const sanitizedError = errorText.replace(/Bearer\s+[\w-]+/g, 'Bearer ***');
    throw new Error(`API Error: ${response.status} - ${sanitizedError}`);
  }
  
  return response.json();
}

// Exemplos de uso com segurança:
try {
  const apps = await coolifyAPI('/applications');
  console.log(`Encontradas ${apps.length} aplicações`); // Não logar dados completos
} catch (error) {
  console.error('Erro ao listar aplicações:', error.message);
  // NUNCA logar o erro completo que pode conter tokens
}
```

#### Método 2: CLI do Coolify

```bash
# Comandos principais do CLI

# Listar todos os recursos
coolify-cli list servers
coolify-cli list applications
coolify-cli list databases

# Deploy de aplicação
coolify-cli deploy --app-id <uuid>

# Verificar status
coolify-cli status --app-id <uuid>

# Executar comandos remotos
coolify-cli exec --server-id <id> "docker ps"
```

#### Método 3: Integração MCP (Model Context Protocol)

**🚀 IMPORTANTE: Instalar o servidor MCP do Coolify para controle total**

O servidor MCP permite que o Claude Code controle o Coolify diretamente através de comandos naturais.

**Instalação do MCP Server:**

```bash
# 1. Clonar o repositório
git clone https://github.com/StuMason/coolify-mcp-server.git
cd coolify-mcp-server

# 2. Instalar dependências
npm install

# 3. Criar arquivo .env (NUNCA commitar!)
cat > .env << EOF
COOLIFY_API_TOKEN=seu-token-aqui
COOLIFY_BASE_URL=http://seu-ip-aqui
EOF

# 4. Compilar TypeScript
npm run build

# 5. Adicionar ao Claude Desktop
# No arquivo de configuração do Claude Desktop:
# Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
# Windows: %APPDATA%\Claude\claude_desktop_config.json
# Linux: ~/.config/Claude/claude_desktop_config.json

{
  "mcpServers": {
    "coolify": {
      "command": "node",
      "args": ["/caminho/para/coolify-mcp-server/dist/index.js"],
      "env": {
        // Opção 1: Referenciar do sistema
        "COOLIFY_API_TOKEN": "${COOLIFY_API_TOKEN}",
        "COOLIFY_BASE_URL": "${COOLIFY_BASE_URL}"
        
        // Opção 2: Ou definir diretamente (menos seguro)
        // "COOLIFY_API_TOKEN": "seu-token",
        // "COOLIFY_BASE_URL": "http://seu-ip"
      }
    }
  }
}

# 6. Reiniciar Claude Desktop
```

**Dica de Segurança**: Prefira sempre a Opção 1, usando variáveis de ambiente do sistema!

**Funções disponíveis via MCP:**
```typescript
// Após instalação, você pode usar comandos naturais como:
- "Liste todos os recursos do Coolify"
- "Faça deploy do AppProft"
- "Reinicie o PostgreSQL"
- "Mostre os logs da aplicação"
- "Verifique a saúde do servidor"
- "Escale a aplicação para 3 réplicas"

// Funções específicas disponíveis:
- list_resources(): Lista todos os recursos
- application_start(uuid): Inicia aplicação
- application_stop(uuid): Para aplicação
- application_restart(uuid): Reinicia aplicação
- deploy_by_uuid(uuid): Deploy por UUID
- deploy_by_tag(tag): Deploy por tag
- application_details(uuid): Detalhes da aplicação
- check_health(): Verifica saúde do servidor
```

**Exemplo de uso após instalação:**
```javascript
// Você poderá dizer naturalmente:
"Faça deploy da aplicação AppProft"

// E o MCP traduzirá para:
await deploy_by_uuid('qc8wwswos4sokgosww4k0wkc');

// Ou verificar status:
"Como está a saúde do servidor Coolify?"

// MCP executará:
await check_health();
```

Se o servidor MCP estiver configurado, você terá acesso a funções nativas:

### 🐘 Gerenciamento do PostgreSQL

> **⚠️ LEMBRETE CRÍTICO**: Este PostgreSQL deve conter APENAS dados reais sincronizados das APIs oficiais da Amazon e Mercado Livre. NUNCA popule o banco com dados de teste ou mockados.

#### Conexão com o PostgreSQL do Coolify

**Banco de Dados em Produção (Coolify):**
- **Container**: Verificar no .env (DB_CONTAINER_NAME)
- **Imagem**: postgres:17-alpine
- **Database**: postgres
- **Usuário**: postgres
- **Porta Interna**: 5432

**Como Conectar do VS Code / Claude Code:**

1. **Opção 1 - SSH Tunnel (Recomendado para Desenvolvimento)**
```bash
# Criar túnel SSH para o PostgreSQL do Coolify
# Substitua as variáveis pelos valores do seu .env
ssh -L 5432:${DB_CONTAINER_NAME}:5432 ${SSH_USER}@${SSH_HOST} -N

# Em outro terminal, conectar localmente
psql postgresql://postgres:${DB_PASSWORD}@localhost:5432/postgres

# Ou usar na aplicação
DATABASE_URL=postgresql://postgres:senha@localhost:5432/postgres
```

2. **Opção 2 - Conexão Direta (Se PostgreSQL estiver público)**
```javascript
// Se você marcou "Make it publicly available" no Coolify
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ou
  host: 'seu-servidor-coolify.com',
  port: 54321, // Porta pública gerada pelo Coolify
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false } // Para produção
});
```

3. **Opção 3 - Via Coolify CLI**
```bash
# Executar comandos SQL diretamente
coolify-cli exec --database "postgresql-database-sscowkg4g8swg8cw0gocwcgk" \
  "psql -U postgres -c 'SELECT COUNT(*) FROM orders'"

# Fazer backup
coolify-cli database backup --name "postgresql-database-sscowkg4g8swg8cw0gocwcgk"

# Restaurar dados
coolify-cli database restore --name "postgresql-database-sscowkg4g8swg8cw0gocwcgk" \
  --file "backup-2024-01-15.sql"
```

#### Acessar PostgreSQL Remotamente

1. **Via SSH Tunnel (Mais Seguro)**
```bash
# Criar túnel SSH
ssh -L 5433:172.17.0.X:5432 usuario@servidor-coolify -N -f

# Conectar localmente
psql -h localhost -p 5433 -U postgres -d database_name
```

2. **Via API para Configurações**
```javascript
// Obter detalhes do banco
const dbInfo = await coolifyAPI('/databases/{uuid}');

// Atualizar configurações
await coolifyAPI('/databases/{uuid}', 'PATCH', {
  settings: {
    public_access: true,  // Cuidado: expõe o banco publicamente
    backup_enabled: true,
    backup_schedule: '0 2 * * *'  // Backup diário às 2h
  }
});
```

3. **Executar Comandos SQL Remotamente**
```bash
# Via CLI + Docker
coolify-cli exec --server-id <id> "docker exec postgres-container psql -U postgres -c 'CREATE DATABASE myapp;'"

# Restaurar backup
coolify-cli exec --server-id <id> "docker exec -i postgres-container psql -U postgres < /backups/dump.sql"
```

### 🚀 Automação de Deployments

#### Deploy Automático com Validações

```javascript
async function deployWithValidation(appUuid) {
  try {
    // 1. Verificar saúde do servidor
    const health = await coolifyAPI('/health');
    if (!health.status === 'healthy') {
      console.warn('Servidor não está saudável, aguardando...');
      await new Promise(r => setTimeout(r, 30000));
    }
    
    // 2. Fazer backup do banco antes do deploy
    const dbUuid = await getAppDatabase(appUuid);
    await coolifyAPI(`/databases/${dbUuid}/backup`, 'POST');
    
    // 3. Executar deploy
    const deployment = await coolifyAPI('/deploy', 'POST', {
      uuid: appUuid,
      force_rebuild: true
    });
    
    // 4. Monitorar deploy
    let status = 'in_progress';
    while (status === 'in_progress') {
      await new Promise(r => setTimeout(r, 5000));
      const deployStatus = await coolifyAPI(`/deployments/${deployment.id}`);
      status = deployStatus.status;
    }
    
    // 5. Verificar saúde da aplicação
    if (status === 'success') {
      const appHealth = await coolifyAPI(`/applications/${appUuid}/health`);
      return appHealth.status === 'healthy';
    }
    
    return false;
  } catch (error) {
    console.error('Deploy falhou:', error);
    // Rollback automático
    await coolifyAPI(`/applications/${appUuid}/rollback`, 'POST');
    throw error;
  }
}
```

#### Gerenciamento de Variáveis de Ambiente

```javascript
async function updateEnvironmentVariables(appUuid, envVars) {
  // Buscar variáveis existentes
  const currentEnvs = await coolifyAPI(`/applications/${appUuid}/envs`);
  
  // Mesclar com novas variáveis
  const updatedEnvs = { ...currentEnvs, ...envVars };
  
  // Atualizar
  await coolifyAPI(`/applications/${appUuid}/envs`, 'PATCH', {
    envs: Object.entries(updatedEnvs).map(([key, value]) => ({ key, value }))
  });
  
  // Reiniciar aplicação para aplicar mudanças
  await coolifyAPI(`/applications/${appUuid}/restart`, 'POST');
}
```

### 🤖 Tarefas Autônomas que Você Pode Executar

#### 1. Setup Inicial de Projeto
```javascript
async function setupNewProject(projectName, gitUrl) {
  // Criar aplicação
  const app = await coolifyAPI('/applications', 'POST', {
    name: projectName,
    git_repository: gitUrl,
    git_branch: 'main',
    build_pack: 'nixpacks',
    ports_mappings: '3000:80'
  });
  
  // Criar banco PostgreSQL
  const db = await coolifyAPI('/databases', 'POST', {
    name: `${projectName}-db`,
    type: 'postgresql',
    version: '15'
  });
  
  // IMPORTANTE: Criar estrutura para dados REAIS
  const initSQL = `
    -- Tabelas para dados REAIS das APIs
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      marketplace VARCHAR(50) NOT NULL,
      order_id VARCHAR(100) UNIQUE NOT NULL,
      status VARCHAR(50),
      total_amount DECIMAL(10,2),
      created_at TIMESTAMP,
      synced_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      marketplace VARCHAR(50) NOT NULL,
      product_id VARCHAR(100) NOT NULL,
      name TEXT,
      price DECIMAL(10,2),
      stock INTEGER,
      synced_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS sync_logs (
      id SERIAL PRIMARY KEY,
      marketplace VARCHAR(50),
      sync_type VARCHAR(50),
      records_synced INTEGER,
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- NUNCA inserir dados fake aqui!
  `;
  
  // Executar SQL inicial
  await coolifyAPI(`/databases/${db.uuid}/execute`, 'POST', {
    sql: initSQL
  });
  
  // Configurar variáveis de ambiente
  await updateEnvironmentVariables(app.uuid, {
    DATABASE_URL: db.connection_string,
    NODE_ENV: 'production',
    USE_MOCK_DATA: 'false', // SEMPRE FALSE!
    // Credenciais das APIs para sincronização real
    AMAZON_CLIENT_ID: process.env.AMAZON_CLIENT_ID,
    AMAZON_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET,
    ML_CLIENT_ID: process.env.ML_CLIENT_ID,
    ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET
  });
  
  // Deploy inicial
  await deployWithValidation(app.uuid);
}
```

#### 2. Monitoramento e Manutenção
```javascript
async function healthCheck() {
  // PRIMEIRO: Verificar se há dados sendo sincronizados
  const syncStatus = await coolifyAPI('/databases/query', 'POST', {
    database: 'dashboard-db',
    query: `
      SELECT 
        marketplace,
        COUNT(*) as total_records,
        MAX(synced_at) as last_sync,
        CURRENT_TIMESTAMP - MAX(synced_at) as time_since_sync
      FROM orders
      GROUP BY marketplace
    `
  });
  
  // Alertar se não há sincronização há mais de 1 hora
  for (const status of syncStatus) {
    if (status.time_since_sync > '1 hour') {
      console.warn(`⚠️ ${status.marketplace} sem sync há mais de 1 hora!`);
      // Forçar sincronização
      await coolifyAPI('/applications/dashboard/exec', 'POST', {
        command: `npm run sync:${status.marketplace.toLowerCase()}`
      });
    }
  }
  
  // Continuar com health check normal
  const resources = await coolifyAPI('/resources');
  
  for (const app of resources.applications) {
    const health = await coolifyAPI(`/applications/${app.uuid}/health`);
    
    if (health.status !== 'healthy') {
      console.log(`Aplicação ${app.name} com problemas. Tentando reiniciar...`);
      await coolifyAPI(`/applications/${app.uuid}/restart`, 'POST');
    }
  }
  
  for (const db of resources.databases) {
    const metrics = await coolifyAPI(`/databases/${db.uuid}/metrics`);
    
    if (metrics.disk_usage > 80) {
      console.log(`Banco ${db.name} com disco > 80%. Executando limpeza...`);
      await coolifyAPI(`/databases/${db.uuid}/vacuum`, 'POST');
    }
  }
}
```

#### 3. Backup Automático
```javascript
async function backupAllDatabases() {
  const databases = await coolifyAPI('/databases');
  
  for (const db of databases) {
    await coolifyAPI(`/databases/${db.uuid}/backup`, 'POST', {
      description: `Backup automático - ${new Date().toISOString()}`
    });
  }
}
```

### 📋 Comandos Rápidos para Tarefas Comuns

```bash
# Deploy rápido
coolify-cli deploy --app-name "dashboard"

# Verificar logs
coolify-cli logs --app-name "dashboard" --lines 100

# Escalar aplicação
coolify-cli scale --app-name "dashboard" --replicas 3

# Executar migrations
coolify-cli exec --app-name "dashboard" "npm run migrate"

# Limpar cache Docker
coolify-cli exec --server-id 1 "docker system prune -af"

# IMPORTANTE: Sincronizar dados das APIs manualmente
coolify-cli exec --app-name "dashboard" "npm run sync:amazon"
coolify-cli exec --app-name "dashboard" "npm run sync:mercadolivre"

# Verificar status da sincronização
coolify-cli exec --app-name "dashboard" "npm run sync:status"

# Forçar atualização completa de dados
coolify-cli exec --app-name "dashboard" "npm run sync:full"

# === COMANDOS ESPECÍFICOS PARA POSTGRESQL NO COOLIFY ===

# Verificar se há dados no banco
coolify-cli exec --container "postgresql-database-sscowkg4g8swg8cw0gocwcgk" \
  "psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM orders;'"

# Ver últimas sincronizações
coolify-cli exec --container "postgresql-database-sscowkg4g8swg8cw0gocwcgk" \
  "psql -U postgres -d postgres -c 'SELECT marketplace, MAX(synced_at) FROM orders GROUP BY marketplace;'"

# Verificar estrutura das tabelas
coolify-cli exec --container "postgresql-database-sscowkg4g8swg8cw0gocwcgk" \
  "psql -U postgres -d postgres -c '\dt'"

# Backup do banco
coolify-cli exec --container "postgresql-database-sscowkg4g8swg8cw0gocwcgk" \
  "pg_dump -U postgres postgres > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql"

# Queries úteis para debug
coolify-cli exec --container "postgresql-database-sscowkg4g8swg8cw0gocwcgk" \
  "psql -U postgres -d postgres -c 'SELECT table_name, COUNT(*) as rows FROM information_schema.tables t LEFT JOIN LATERAL (SELECT COUNT(*) FROM t.table_name) c ON true WHERE table_schema = '\''public'\'' GROUP BY table_name;'"
```

### 🔒 Segurança e Boas Práticas

1. **Sempre use SSH tunneling** para acessar bancos de dados em produção
2. **Faça backup antes de deployments** críticos
3. **Monitore logs após deployments** para detectar erros rapidamente
4. **Use variáveis de ambiente** para informações sensíveis
5. **Implemente health checks** em todas as aplicações
6. **Configure limites de recursos** para evitar consumo excessivo

### 🎯 Fluxo de Trabalho Recomendado

1. **Desenvolvimento Local** → Push para Git
2. **CI/CD Trigger** → Validações e testes
3. **Deploy Staging** → Via Coolify API
4. **Testes Automatizados** → Verificar saúde
5. **Deploy Produção** → Com backup automático
6. **Monitoramento** → Logs e métricas em tempo real

### 💡 Dicas para Autonomia Total

- Configure webhooks para reagir a eventos do Coolify
- Use o endpoint `/logs/stream` para monitoramento em tempo real
- Implemente rollback automático em caso de falhas
- Mantenha um registro de todas as operações executadas
- Use tags para versionamento e facilitar rollbacks

### 🆘 Troubleshooting

```javascript
// Diagnóstico rápido
async function diagnostics(appUuid) {
  const status = await coolifyAPI(`/applications/${appUuid}/status`);
  const logs = await coolifyAPI(`/applications/${appUuid}/logs?lines=50`);
  const events = await coolifyAPI(`/applications/${appUuid}/events`);
  
  // IMPORTANTE: Verificar dados no PostgreSQL
  const dataCheck = await coolifyAPI('/databases/query', 'POST', {
    database: 'dashboard-db',
    query: `
      SELECT 
        'orders' as table_name,
        COUNT(*) as row_count,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record
      FROM orders
      UNION ALL
      SELECT 
        'products' as table_name,
        COUNT(*) as row_count,
        MIN(synced_at) as oldest_record,
        MAX(synced_at) as newest_record
      FROM products
    `
  });
  
  return {
    status,
    recentErrors: logs.filter(log => log.level === 'error'),
    lastEvents: events.slice(0, 10),
    dataStatus: dataCheck,
    recommendation: dataCheck.some(t => t.row_count === 0) 
      ? '⚠️ Tabelas vazias detectadas. Execute sincronização inicial!'
      : '✅ Dados disponíveis no PostgreSQL'
  };
}
```

### 🐛 Debug em Produção

```bash
# === COMANDOS DE DEBUG ESPECÍFICOS ===

# 1. Verificar logs do container AppProft
docker logs davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc --tail 100

# 2. Acessar shell do container PostgreSQL
docker exec -it postgresql-database-sscowkg4g8swg8cw0gocwcgk bash
psql -U postgres

# 3. Verificar conexões ativas no PostgreSQL
docker exec postgresql-database-sscowkg4g8swg8cw0gocwcgk \
  psql -U postgres -c "SELECT pid, usename, application_name, client_addr, state FROM pg_stat_activity;"

# 4. Ver tamanho das tabelas
docker exec postgresql-database-sscowkg4g8swg8cw0gocwcgk \
  psql -U postgres -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# 5. Verificar jobs de sincronização
docker exec davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc \
  cat /app/logs/sync.log | tail -50

# 6. Testar conexão com APIs externas
docker exec davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc \
  curl -I https://sellingpartnerapi-na.amazon.com/orders/v0/orders

# 7. Ver variáveis de ambiente (sem senhas)
docker exec davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc \
  printenv | grep -E '^(NODE_ENV|PORT|DATABASE_URL|AMAZON_CLIENT_ID|ML_CLIENT_ID)' | sed 's/=.*/=***/'

# 8. Monitorar uso de recursos
docker stats davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc postgresql-database-sscowkg4g8swg8cw0gocwcgk

# 9. Verificar espaço em disco
df -h | grep -E '(Filesystem|/var/lib/docker)'

# 10. Limpar logs antigos (se necessário)
docker exec davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc \
  find /app/logs -name "*.log" -mtime +7 -delete
```

### 🚨 Problemas Comuns e Soluções

1. **"Sem dados no dashboard"**
```bash
# Verificar se há dados no banco
psql -c "SELECT COUNT(*) FROM orders;"

# Forçar sincronização manual
npm run sync:all

# Ver logs de sincronização
tail -f logs/sync.log
```

2. **"Token expirado" ao sincronizar**
```bash
# Verificar validade dos tokens
node scripts/checkTokens.js

# Renovar tokens manualmente
node scripts/refreshTokens.js
```

3. **"Conexão recusada com PostgreSQL"**
```bash
# Verificar se o container está rodando
docker ps | grep postgresql

# Testar conexão
psql postgresql://postgres:senha@localhost:5432/postgres

# Reiniciar se necessário
coolify-cli restart --database postgresql-database-sscowkg4g8swg8cw0gocwcgk
```

4. **"API rate limit exceeded"**
```javascript
// Implementar backoff exponencial
async function syncWithBackoff(marketplace) {
  let retries = 0;
  const maxRetries = 5;
  
  while (retries < maxRetries) {
    try {
      await syncMarketplace(marketplace);
      break;
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.pow(2, retries) * 1000;
        console.log(`Rate limit hit. Waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        retries++;
      } else {
        throw error;
      }
    }
  }
}
```

### 📁 Estrutura de Arquivos de Configuração

```bash
# Criar estrutura de configuração
mkdir -p .claude
touch .claude/config.json
touch .claude/operations.log

# Arquivo de configuração (.claude/config.json)
# IMPORTANTE: Este arquivo deve referenciar variáveis de ambiente!
{
  "coolify": {
    "api_token": "${COOLIFY_API_TOKEN}",
    "base_url": "${COOLIFY_BASE_URL}",
    "default_server_id": 1,
    "ssh_config": {
      "host": "${SSH_HOST}",
      "user": "${SSH_USER}",
      "key_path": "${SSH_KEY_PATH}"
    },
    "postgresql": {
      "container_name": "postgresql-database-sscowkg4g8swg8cw0gocwcgk",
      "internal_port": 5432,
      "database": "postgres",
      "user": "postgres"
    }
  }
}

# Adicionar ao .gitignore
echo ".env" >> .gitignore
echo ".claude/" >> .gitignore
echo "*.log" >> .gitignore
echo ".DS_Store" >> .gitignore
echo "node_modules/" >> .gitignore
```

### 🏗️ Arquitetura Completa do Sistema

```mermaid
graph TD
    A[Amazon SP-API] -->|Sync Orders/Products| D[PostgreSQL no Coolify]
    B[Mercado Livre API] -->|Sync Orders/Products| D
    C[Token Manager] -->|Auto Refresh| A
    C -->|Auto Refresh| B
    D -->|Dados Reais| E[Dashboard Next.js]
    F[Worker Cron] -->|15 min sync| A
    F -->|15 min sync| B
    G[Claude Code] -->|Deploy/Manage| H[Coolify API]
    H -->|Control| D
    H -->|Control| E
    I[VS Code] -->|SSH Tunnel| D
    I -->|Development| E
```

**Fluxo de Desenvolvimento:**
1. Claude Code no VS Code conecta ao Coolify via API
2. PostgreSQL roda no container do Coolify
3. Workers sincronizam dados das APIs a cada 15 minutos
4. Dashboard consulta apenas o PostgreSQL
5. Tokens são renovados automaticamente quando necessário

**Componentes do Sistema:**
- **Frontend**: Next.js com Tailwind (estilo AppProft)
- **Backend**: Node.js com Express
- **Database**: PostgreSQL 17 (Alpine) no Coolify
- **Workers**: Cron jobs para sincronização
- **APIs**: Amazon SP-API e Mercado Livre API
- **Deploy**: Coolify com CI/CD automático

### 📊 Métricas e Monitoramento SaaS

```javascript
// services/saasMetrics.js
class SaaSMetrics {
  // Métricas de negócio essenciais
  async calculateMRR() {
    const result = await db.query(`
      SELECT 
        SUM(CASE 
          WHEN p.billing_cycle = 'monthly' THEN p.price
          WHEN p.billing_cycle = 'yearly' THEN p.price / 12
        END) as mrr
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.status = 'active'
    `);
    
    return result.rows[0].mrr;
  }

  async calculateChurnRate() {
    const result = await db.query(`
      WITH monthly_data AS (
        SELECT 
          DATE_TRUNC('month', cancelled_at) as month,
          COUNT(*) as churned_customers
        FROM subscriptions
        WHERE cancelled_at IS NOT NULL
        GROUP BY DATE_TRUNC('month', cancelled_at)
      ),
      active_customers AS (
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as total_customers
        FROM subscriptions
        GROUP BY DATE_TRUNC('month', created_at)
      )
      SELECT 
        m.month,
        m.churned_customers::float / a.total_customers * 100 as churn_rate
      FROM monthly_data m
      JOIN active_customers a ON m.month = a.month
      ORDER BY m.month DESC
      LIMIT 12
    `);
    
    return result.rows;
  }

  // Métricas de uso do sistema
  async getSystemHealth() {
    return {
      activeUsers: await this.getActiveUsers24h(),
      apiCalls: await this.getAPICallsToday(),
      syncStatus: await this.getSyncHealthAllTenants(),
      errorRate: await this.getErrorRate24h(),
      avgResponseTime: await this.getAvgResponseTime()
    };
  }

  // Dashboard de Admin
  async getAdminDashboard() {
    const [mrr, churn, newSignups, activeTrials] = await Promise.all([
      this.calculateMRR(),
      this.calculateChurnRate(),
      this.getNewSignupsThisMonth(),
      this.getActiveTrials()
    ]);

    return {
      revenue: {
        mrr,
        arr: mrr * 12,
        growth: await this.getMRRGrowth()
      },
      customers: {
        total: await this.getTotalCustomers(),
        active: await this.getActiveCustomers(),
        churn: churn[0]?.churn_rate || 0,
        trials: activeTrials
      },
      usage: {
        totalSyncs: await this.getTotalSyncsToday(),
        dataVolume: await this.getDataVolumeToday(),
        apiQuota: await this.getAPIQuotaUsage()
      }
    };
  }
}

// Webhook para eventos importantes
async function sendSlackNotification(event, data) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  const messages = {
    new_signup: `🎉 Novo cadastro: ${data.company} (${data.email})`,
    new_paid: `💰 Nova assinatura: ${data.company} - Plano ${data.plan} (R$ ${data.value})`,
    churn: `😢 Cancelamento: ${data.company} - Motivo: ${data.reason}`,
    sync_error: `🚨 Erro de sync: ${data.tenant} - ${data.marketplace}`,
    high_usage: `📈 Alto uso de API: ${data.tenant} - ${data.usage}% do limite`
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: messages[event] })
  });
}
```

### 🛡️ Segurança e Compliance

```javascript
// security/dataProtection.js
class DataProtection {
  // Criptografia de credenciais sensíveis
  encryptCredentials(credentials) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Auditoria de acesso aos dados
  async logDataAccess(userId, tenantId, resource, action) {
    await db.query(`
      INSERT INTO audit_logs (user_id, tenant_id, resource, action, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, tenantId, resource, action, req.ip, req.headers['user-agent']]);
  }

  // Backup automático por tenant
  async backupTenantData(tenantId) {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${tenantId}_${timestamp}.sql`;
    
    // Executar pg_dump via Coolify
    await coolifyAPI('/databases/execute', 'POST', {
      database: 'postgresql-database-sscowkg4g8swg8cw0gocwcgk',
      command: `pg_dump -n ${schemaName} -f /backups/${filename} postgres`
    });
    
    // Upload para S3 ou storage externo
    await this.uploadToSecureStorage(filename);
  }

  // LGPD/GDPR - Exportar dados do usuário
  async exportUserData(tenantId) {
    const data = await db.query(`
      SELECT * FROM get_all_tenant_data($1)
    `, [tenantId]);
    
    return {
      format: 'json',
      data: data.rows,
      exported_at: new Date().toISOString(),
      tenant_id: tenantId
    };
  }

  // LGPD/GDPR - Deletar dados do usuário
  async deleteUserData(tenantId) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Soft delete do tenant
      await client.query(`
        UPDATE tenants 
        SET status = 'deleted', 
            deleted_at = NOW(),
            personal_data = NULL
        WHERE tenant_id = $1
      `, [tenantId]);
      
      // Agendar hard delete após período legal
      await client.query(`
        INSERT INTO deletion_queue (tenant_id, delete_after)
        VALUES ($1, NOW() + INTERVAL '30 days')
      `, [tenantId]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### 🎨 Componentes de UI/UX Essenciais

```jsx
// components/CookieConsent.jsx
import { useState, useEffect } from 'react';

export const CookieConsent = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) setShow(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShow(false);
    // Iniciar analytics e outros serviços
    window.gtag && window.gtag('consent', 'update', {
      'analytics_storage': 'granted'
    });
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <p className="text-gray-600">
          Usamos cookies para melhorar sua experiência em appproft.com. 
          Ao continuar navegando, você concorda com nossa{' '}
          <a href="/politica-privacidade" className="text-orange-600 underline">
            Política de Privacidade
          </a>.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => setShow(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Rejeitar
          </button>
          <button
            onClick={handleAccept}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
};

// components/common/LoadingStates.jsx
export const TableSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-10 bg-gray-200 rounded mb-4"></div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
    ))}
  </div>
);

// components/common/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log para Sentry ou similar
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Ops! Algo deu errado
            </h1>
            <p className="text-gray-600 mb-8">
              Estamos trabalhando para resolver. Por favor, tente novamente.
            </p>
            <Button onClick={() => window.location.reload()}>
              Recarregar Página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// components/feedback/Toast.jsx
export const Toast = ({ message, type = 'success', duration = 3000 }) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const styles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 right-4 ${styles[type]} text-white px-6 py-3 rounded-lg shadow-lg`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

### 📱 Responsividade e PWA

```javascript
// next.config.js - Configuração PWA
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

module.exports = withPWA({
  reactStrictMode: true,
  images: {
    domains: ['images-na.ssl-images-amazon.com', 'http2.mlstatic.com']
  }
});

// public/manifest.json
{
  "name": "AppProft Dashboard",
  "short_name": "AppProft",
  "description": "Dashboard de vendas Amazon e Mercado Livre",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#FF8C00",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 🔍 SEO e Meta Tags

```jsx
// components/SEO.jsx
import Head from 'next/head';

export const SEO = ({ 
  title = 'AppProft - Dashboard de Vendas Amazon e Mercado Livre',
  description = 'Monitore suas vendas em tempo real, acompanhe estoque e analise lucros em todos os marketplaces',
  image = 'https://appproft.com/og-image.png'
}) => (
  <Head>
    <title>{title}</title>
    <meta name="description" content={description} />
    
    {/* Open Graph */}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={image} />
    <meta property="og:url" content="https://appproft.com" />
    <meta property="og:type" content="website" />
    
    {/* Twitter */}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={image} />
    
    {/* Canonical */}
    <link rel="canonical" href="https://appproft.com" />
    
    {/* Favicon */}
    <link rel="icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  </Head>
);
```

### 🔄 Template de Resposta para Operações Coolify

Quando receber solicitações relacionadas ao Coolify, use este template:

```markdown
Consultei minhas capacidades no arquivo CLAUDE.md e posso executar a seguinte tarefa no Coolify:

- [ ] Verificar credenciais em .claude/config.json
- [ ] Executar backup preventivo (se necessário)
- [ ] Realizar a operação solicitada
- [ ] Verificar resultado e saúde do sistema
- [ ] Registrar operação em log

Deseja que eu proceda com [descrição da tarefa]?
```

---

### 🔐 Boas Práticas de Desenvolvimento Seguro

```javascript
// ✅ EXEMPLO: Conexão segura com banco de dados
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  // Nunca logar a connection string completa
  log: (msg) => {
    const sanitized = msg.replace(/postgresql:\/\/[^@]+@/g, 'postgresql://***@');
    console.log(sanitized);
  }
});

// ✅ EXEMPLO: Requisição segura para APIs
async function callExternalAPI(endpoint, data) {
  const headers = {
    'Authorization': `Bearer ${process.env.API_TOKEN}`,
    'Content-Type': 'application/json'
  };
  
  // Log sem expor credenciais
  SecureLogger.log('Chamando API externa', {
    endpoint,
    method: 'POST',
    hasAuth: !!headers.Authorization,
    dataSize: JSON.stringify(data).length
  });
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    return response.json();
  } catch (error) {
    // Não logar o erro completo que pode conter URLs internas
    SecureLogger.error('Erro na API', {
      endpoint: endpoint.replace(/https?:\/\/[^\/]+/, 'https://***'),
      status: error.status
    });
    throw error;
  }
}

// ✅ EXEMPLO: Validação de entrada
const { body, validationResult } = require('express-validator');

const validateUserInput = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).trim(),
  body('name').escape().trim(), // Previne XSS
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Não logar senhas mesmo que inválidas
      const safeErrors = errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }));
      
      return res.status(400).json({ errors: safeErrors });
    }
    next();
  }
];

// ✅ EXEMPLO: Middleware de rate limiting
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de requisições
  message: 'Muitas requisições, tente novamente mais tarde',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    SecureLogger.log('Rate limit atingido', {
      ip: req.ip,
      path: req.path,
      // Não logar headers que podem conter tokens
    });
    res.status(429).json({
      error: 'Too many requests'
    });
  }
});

// ✅ EXEMPLO: Upload seguro de arquivos
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Gerar nome único sem expor informações do usuário
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `file-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Whitelist de tipos permitidos
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});
```

### 📝 Checklist de Segurança para Deploy

- [ ] Arquivo `.env` está no `.gitignore`
- [ ] Todas as credenciais estão em variáveis de ambiente
- [ ] Logs não expõem dados sensíveis
- [ ] HTTPS está ativo em produção
- [ ] Rate limiting está configurado
- [ ] Input validation em todos os endpoints
- [ ] SQL injection prevenido (usar prepared statements)
- [ ] XSS prevenido (escape de dados)
- [ ] CSRF tokens implementados
- [ ] Headers de segurança configurados
- [ ] Backups automáticos configurados
- [ ] Monitoramento de segurança ativo
- [ ] Política de senhas fortes implementada
- [ ] 2FA disponível para usuários
- [ ] Logs de auditoria implementados

### 🛡️ Proteção do Servidor e Infraestrutura

```bash
# === CONFIGURAÇÕES DE FIREWALL (ufw) ===
# Permitir apenas portas necessárias
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# === FAIL2BAN para proteção contra brute force ===
sudo apt install fail2ban
sudo systemctl enable fail2ban

# === SSH Hardening ===
# Editar /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222  # Mudar porta padrão

# === NGINX Rate Limiting ===
# Em /etc/nginx/nginx.conf
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    
    server {
        location /api/ {
            limit_req zone=api burst=20 nodelay;
        }
        
        location /login {
            limit_req zone=login burst=5 nodelay;
        }
    }
}

# === Monitoramento de Segurança ===
# Instalar ferramentas de monitoramento
sudo apt install htop iftop vnstat
sudo apt install lynis  # Auditoria de segurança

# Executar auditoria
sudo lynis audit system

# === Backup Automático ===
# Criar script de backup
cat > /home/backup/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Backup do PostgreSQL
docker exec postgresql-database-sscowkg4g8swg8cw0gocwcgk \
    pg_dumpall -U postgres > $BACKUP_DIR/postgres_$DATE.sql

# Compactar e criptografar
tar -czf - $BACKUP_DIR/postgres_$DATE.sql | \
    openssl enc -aes-256-cbc -salt -k $BACKUP_PASSWORD -out $BACKUP_DIR/backup_$DATE.tar.gz.enc

# Upload para S3 ou storage externo
aws s3 cp $BACKUP_DIR/backup_$DATE.tar.gz.enc s3://appproft-backups/

# Limpar backups antigos (manter últimos 30 dias)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.enc" -mtime +30 -delete
EOF

# Agendar backup diário
crontab -e
# 0 3 * * * /home/backup/backup.sh
```

### 🔍 Auditoria e Monitoramento

```javascript
// middleware/security-audit.js
const SecurityAudit = {
  // Log de todas as ações críticas
  logCriticalAction: async (userId, action, details) => {
    const log = {
      userId,
      action,
      details: SecureLogger.sanitizeData(details),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    };
    
    // Salvar no banco
    await db.query(
      'INSERT INTO security_audit_logs (user_id, action, details, ip, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [log.userId, log.action, JSON.stringify(log.details), log.ip, log.userAgent]
    );
    
    // Alertar ações suspeitas
    if (this.isSuspicious(action, details)) {
      await this.alertAdmin(log);
    }
  },
  
  // Detectar atividades suspeitas
  isSuspicious: (action, details) => {
    const suspiciousActions = [
      'multiple_failed_logins',
      'permission_escalation_attempt',
      'bulk_data_export',
      'api_key_generation',
      'user_deletion'
    ];
    
    return suspiciousActions.includes(action);
  },
  
  // Alertar administradores
  alertAdmin: async (log) => {
    const message = `
      🚨 Atividade Suspeita Detectada
      Usuário: ${log.userId}
      Ação: ${log.action}
      IP: ${log.ip}
      Horário: ${log.timestamp}
    `;
    
    // Enviar para Slack
    await sendSlackNotification('security', message);
    
    // Email para admin
    await sendEmail({
      to: 'security@appproft.com',
      subject: 'Alerta de Segurança - AppProft',
      text: message
    });
  }
};

// Usar em rotas críticas
router.post('/api/export-data', authenticate, async (req, res) => {
  await SecurityAudit.logCriticalAction(
    req.user.id,
    'bulk_data_export',
    { format: req.body.format, recordCount: req.body.count }
  );
  
  // Continuar com a exportação...
});
```

### 🚨 Resposta a Incidentes

```markdown
# Plano de Resposta a Incidentes

## 1. Detecção
- Monitoramento 24/7 via Sentry
- Alertas automáticos via Slack
- Logs centralizados

## 2. Contenção
- [ ] Isolar sistema afetado
- [ ] Bloquear IPs suspeitos
- [ ] Desativar contas comprometidas
- [ ] Ativar modo manutenção se necessário

## 3. Investigação
- [ ] Analisar logs de segurança
- [ ] Identificar vetor de ataque
- [ ] Determinar dados afetados
- [ ] Documentar timeline

## 4. Recuperação
- [ ] Restaurar de backup limpo
- [ ] Aplicar patches de segurança
- [ ] Resetar credenciais afetadas
- [ ] Verificar integridade dos dados

## 5. Comunicação
- [ ] Notificar usuários afetados (LGPD)
- [ ] Preparar relatório do incidente
- [ ] Atualizar status page
- [ ] Comunicar melhorias implementadas

## Contatos de Emergência
- Segurança: security@appproft.com
- DevOps: devops@appproft.com
- Legal: legal@appproft.com
```

**Lembre-se**: A segurança é um processo contínuo, não um destino! 🔒

## 🚨 AVISO FINAL SOBRE DADOS

**NUNCA, EM HIPÓTESE ALGUMA, USE DADOS MOCKADOS OU FAKE NO DASHBOARD!**

Todos os dados exibidos devem seguir este fluxo:
1. APIs oficiais (Amazon/Mercado Livre) fazem sync com PostgreSQL
2. Dashboard consulta APENAS o PostgreSQL
3. Usuário vê APENAS dados reais e atualizados

Se não houver dados reais disponíveis, exiba mensagens apropriadas como:
- "Aguardando primeira sincronização com Amazon..."
- "Nenhuma venda encontrada no período"
- "Conecte sua conta do Mercado Livre para ver dados"

**JAMAIS** invente números ou crie dados de exemplo!

## 📄 Estrutura Completa do .env

```bash
# === URLs E DOMÍNIOS ===
PRODUCTION_URL=https://appproft.com
DEVELOPMENT_URL=http://localhost:3000

# PostgreSQL (Coolify)
DATABASE_URL=postgresql://postgres:sua-senha-segura@localhost:5432/postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua-senha-segura
DB_NAME=postgres

# Amazon SP-API (OAuth)
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxx
AMAZON_REFRESH_TOKEN=Atzr|xxxxx
AMAZON_SELLER_ID=xxxxx
SP_API_MARKETPLACE_ID=A2Q3Y263D00KWC  # Brasil

# Mercado Livre API (OAuth)
ML_CLIENT_ID=xxxxx
ML_CLIENT_SECRET=xxxxx
ML_REFRESH_TOKEN=TG-xxxxx
ML_SELLER_ID=xxxxx

# Coolify
COOLIFY_API_TOKEN=xxxxx
COOLIFY_BASE_URL=https://seu-coolify.com

# SSH para acessar Coolify
SSH_HOST=seu-servidor-coolify.com
SSH_USER=root
SSH_KEY_PATH=~/.ssh/id_rsa

# App Config
NODE_ENV=production
PORT=3000
USE_MOCK_DATA=false  # SEMPRE FALSE!

# Remover estas linhas (não necessárias):
# SP_API_AWS_ACCESS_KEY=xxxxx  ← DELETAR
# SP_API_AWS_SECRET_KEY=xxxxx  ← DELETAR
# ML_ACCESS_TOKEN=xxxxx        ← DELETAR (será gerado automaticamente)
```

**Checklist de Configuração:**
- [ ] Todas as credenciais do .env estão corretas
- [ ] PostgreSQL está acessível via SSH tunnel
- [ ] Tokens de refresh são válidos
- [ ] Removidas credenciais AWS desnecessárias
- [ ] USE_MOCK_DATA está como false
- [ ] Sistema de renovação automática de tokens implementado
- [x] Domínio oficial appproft.com configurado
- [x] SSL/HTTPS ativo via Let's Encrypt
- [ ] Registros DNS para email configurados (SPF, DKIM, DMARC)
- [ ] Configurações de SEO implementadas

### 📋 Arquivos Públicos Importantes

```txt
# public/robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard/
Sitemap: https://appproft.com/sitemap.xml

# public/sitemap.xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://appproft.com/</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://appproft.com/precos</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://appproft.com/recursos</loc>
    <priority>0.8</priority>
  </url>
</urlset>

# public/.well-known/security.txt
Contact: security@appproft.com
Preferred-Languages: pt-BR, en
Canonical: https://appproft.com/.well-known/security.txt
```

## 🎯 ROADMAP DE IMPLEMENTAÇÃO SAAS

### Fase 1: MVP (2 semanas)
- [ ] Sistema de autenticação multi-tenant
- [ ] Onboarding simplificado (3 passos)
- [ ] Conexão com APIs (Amazon + ML)
- [ ] Dashboard básico com métricas principais
- [ ] Sincronização automática a cada hora

### Fase 2: Produto Completo (4 semanas)
- [ ] Planos e sistema de billing
- [ ] Dashboard completo com todas as métricas
- [ ] Sincronização em tempo real (15 min)
- [ ] Exportação de relatórios
- [ ] Suporte a múltiplos usuários por conta

### Fase 3: Escala (6 semanas)
- [ ] API pública para integrações
- [ ] App mobile (PWA)
- [ ] Integrações com mais marketplaces
- [ ] White label para enterprise
- [ ] Analytics avançado com IA

### 📋 Template .env.example (Commitar este no Git)

Crie um arquivo `.env.example` com a estrutura sem valores sensíveis:

```bash
# === Este é um template - copie para .env e preencha com valores reais ===
# cp .env.example .env

# URLs e Domínios
PRODUCTION_URL=https://appproft.com
DEVELOPMENT_URL=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/database
DB_PASSWORD=

# Amazon SP-API
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_REFRESH_TOKEN=
AMAZON_SELLER_ID=
SP_API_MARKETPLACE_ID=A2Q3Y263D00KWC

# Mercado Livre API
ML_CLIENT_ID=
ML_CLIENT_SECRET=
ML_REFRESH_TOKEN=
ML_SELLER_ID=

# Coolify (Solicitar ao administrador)
COOLIFY_API_TOKEN=
COOLIFY_BASE_URL=

# Segurança (Gerar com openssl)
JWT_SECRET=
ENCRYPTION_KEY=

# Email
SENDGRID_API_KEY=
EMAIL_FROM=noreply@appproft.com

# Monitoramento
SENTRY_DSN=
SLACK_WEBHOOK_URL=
```

### 🚀 Scripts NPM Essenciais

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "migrate": "knex migrate:latest",
    "seed": "knex seed:run",
    
    // Sincronização
    "sync:amazon": "node workers/syncAmazon.js",
    "sync:ml": "node workers/syncMercadoLivre.js",
    "sync:all": "npm run sync:amazon && npm run sync:ml",
    "sync:status": "node workers/syncStatus.js",
    
    // Multi-tenant
    "tenant:create": "node scripts/createTenant.js",
    "tenant:migrate": "node scripts/migrateTenant.js",
    "tenant:backup": "node scripts/backupTenant.js",
    
    // Monitoramento
    "health:check": "node scripts/healthCheck.js",
    "metrics:calculate": "node scripts/calculateMetrics.js",
    
    // Deploy
    "deploy:staging": "npm run build && coolify-cli deploy --env staging",
    "deploy:production": "npm run build && coolify-cli deploy --env production"
  }
}
```

### 🔒 Variáveis de Ambiente Completas para SaaS

```bash
# === APLICAÇÃO ===
NODE_ENV=production
PORT=3000
APP_URL=https://appproft.com
USE_MOCK_DATA=false

# === BANCO DE DADOS ===
DATABASE_URL=postgresql://postgres:senha@localhost:5432/postgres
DB_SSL=true

# === AUTENTICAÇÃO ===
JWT_SECRET=seu-jwt-secret-super-seguro
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=seu-refresh-token-secret
SESSION_SECRET=seu-session-secret

# === CRIPTOGRAFIA ===
ENCRYPTION_KEY=seu-hex-key-64-caracteres

# === AMAZON SP-API ===
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxx
AMAZON_REFRESH_TOKEN=Atzr|xxxxx
AMAZON_SELLER_ID=xxxxx
SP_API_MARKETPLACE_ID=A2Q3Y263D00KWC

# === MERCADO LIVRE API ===
ML_CLIENT_ID=xxxxx
ML_CLIENT_SECRET=xxxxx
ML_REFRESH_TOKEN=TG-xxxxx
ML_SELLER_ID=xxxxx

# === COOLIFY ===
COOLIFY_API_TOKEN=2|Mx6BY1W5vq3cZT6cUFdfOtTCV7HJ4R10Su813x9m6fefe487
COOLIFY_BASE_URL=http://49.12.191.119

# === EMAIL (SendGrid/SES) ===
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=xxxxx
EMAIL_FROM=noreply@appproft.com
EMAIL_DOMAIN=appproft.com
DKIM_CONFIGURED=true
SPF_CONFIGURED=true

# === PAGAMENTO (Stripe/Pagar.me) ===
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# === MONITORAMENTO ===
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx

# === STORAGE (S3/Backblaze) ===
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_BUCKET_NAME=appproft-backups
AWS_REGION=us-east-1
```

### 📝 Documentação para Usuários Finais

```markdown
# Guia de Início Rápido - AppProft

## 1. Crie sua conta (30 segundos)
- Acesse appproft.com
- Clique em "Começar Teste Grátis"
- Preencha seus dados básicos

## 2. Conecte suas lojas (2 minutos)
### Amazon:
1. Clique em "Conectar Amazon"
2. Faça login na sua conta de vendedor
3. Autorize o AppProft

### Mercado Livre:
1. Clique em "Conectar Mercado Livre"
2. Faça login na sua conta
3. Autorize o acesso

## 3. Aguarde a sincronização (5-10 minutos)
- Primeira sincronização importa últimos 30 dias
- Você receberá um email quando estiver pronto

## 4. Explore seu dashboard!
- Veja todas suas vendas consolidadas
- Analise produtos mais vendidos
- Acompanhe seu lucro em tempo real
```

---

**🏁 RESUMO FINAL**: Este é um SaaS completo com arquitetura multi-tenant, onboarding intuitivo, segurança robusta e preparado para escala. TODOS os dados são reais, vindos das APIs oficiais. O sistema está pronto para ser comercializado com planos de assinatura e suporte completo ao ciclo de vida do cliente.

## 📌 RESUMO EXECUTIVO - PONTOS CRÍTICOS

### 🌐 DOMÍNIO OFICIAL ATIVO
- **URL Principal**: https://appproft.com ✅
- **SSL/HTTPS**: Ativo via Let's Encrypt ✅
- **WWW**: https://www.appproft.com também funciona ✅
- **Multi-tenant**: Pronto para subdomínios (empresa.appproft.com)

### ✅ O que SEMPRE fazer:
1. **Usar APENAS dados reais** das APIs Amazon e Mercado Livre
2. **Multi-tenant desde o início** - cada cliente tem schema isolado
3. **Onboarding em 3 passos** - máximo 2 minutos
4. **Renovação automática de tokens** - nunca deixar expirar
5. **Backup diário por tenant** - segurança dos dados do cliente

### ❌ O que NUNCA fazer:
1. **NUNCA usar dados mockados** - nem para desenvolvimento
2. **NUNCA misturar dados entre tenants** - isolamento total
3. **NUNCA expor credenciais** - sempre criptografadas
4. **NUNCA fazer sync manual em produção** - usar workers
5. **NUNCA ignorar rate limits** - implementar retry com backoff

### 🎯 Arquitetura Resumida:
```
[Cliente] → [AppProft SaaS] → [APIs Marketplaces] → [PostgreSQL Multi-tenant]
    ↓              ↓                    ↓                      ↓
[Dashboard]  [Auth/Billing]    [Token Manager]         [Schema Isolado]
```

### 🔧 Stack Tecnológica:
- **Frontend**: Next.js + Tailwind CSS (estilo AppProft laranja)
- **Backend**: Node.js + Express + PostgreSQL
- **Infra**: Coolify (containers Docker)
- **APIs**: Amazon SP-API + Mercado Livre API
- **Deploy**: Dockerfile com CI/CD automático

### 📊 Informações dos Containers:
- **App**: `davimacleit1/appproft-dashboard:master-qc8wwswos4sokgosww4k0wkc`
- **URL Oficial**: `https://appproft.com` (com SSL/HTTPS ativo)
- **URL WWW**: `https://www.appproft.com` (também funciona)
- **DB Container**: Ver no Coolify ou .env
- **Server IP**: Ver no .env (COOLIFY_BASE_URL)

### 🚀 Próximos Passos:
1. ✅ ~~Configurar domínio customizado~~ **CONCLUÍDO: appproft.com**
2. ✅ ~~Implementar SSL/HTTPS~~ **CONCLUÍDO via Let's Encrypt**
3. Configurar sistema de pagamento (Stripe/Pagar.me)
4. Criar landing page de vendas em appproft.com
5. Configurar email transacional com domínio appproft.com
6. Implementar blog em blog.appproft.com para SEO
7. Configurar subdomínios para multi-tenancy (empresa.appproft.com)
8. Criar área de documentação em docs.appproft.com
9. Implementar API pública em api.appproft.com
10. Lançar com early adopters

**Claude Code, você tem TODOS os poderes necessários para criar, deployar e gerenciar este SaaS completo com o domínio oficial appproft.com!** 🚀

## ⚠️ LEMBRETE FINAL DE SEGURANÇA

1. **CRIE O ARQUIVO .env** com as credenciais reais
2. **ADICIONE .env ao .gitignore** imediatamente
3. **NUNCA** exponha credenciais em logs ou código
4. **SEMPRE** use `process.env` para acessar secrets
5. **TESTE** em ambiente seguro antes de produção

```bash
# Primeira coisa a fazer:
cp .env.example .env
echo ".env" >> .gitignore
# Editar .env com as credenciais reais
```

**Segurança em primeiro lugar, sempre!** 🔒