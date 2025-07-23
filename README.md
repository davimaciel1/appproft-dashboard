# AppProft - Dashboard Consolidado de Vendas

Dashboard para consolidar e visualizar vendas da Amazon e Mercado Livre em tempo real.

## Instalação

### Pré-requisitos
- Node.js (v14+)
- PostgreSQL
- Credenciais das APIs da Amazon SP-API e Mercado Livre

### Configuração do Banco de Dados
```bash
psql -U postgres < database.sql
```

### Instalação das Dependências
```bash
npm run setup
```

### Configuração do .env
O arquivo .env já está configurado com as credenciais necessárias.

### Executar o Projeto
```bash
npm run dev
```

O servidor estará rodando em http://localhost:3001 e o cliente em http://localhost:3000

## Estrutura do Projeto
```
├── client/              # Aplicação React
│   ├── src/
│   │   ├── components/  # Componentes React
│   │   ├── pages/       # Páginas da aplicação
│   │   └── App.tsx      # Componente principal
├── server/              # API Express
│   ├── routes/          # Rotas da API
│   └── index.js         # Servidor principal
├── .env                 # Variáveis de ambiente
├── database.sql         # Schema do banco de dados
└── package.json         # Dependências do projeto
```

## Funcionalidades
- Dashboard em tempo real com métricas consolidadas
- Integração com Amazon SP-API
- Integração com Mercado Livre API
- Notificações em tempo real via Socket.io
- Autenticação JWT
- Design responsivo estilo AppProft