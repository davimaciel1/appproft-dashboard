# Guia de Instalação - AppProft Dashboard

## Pré-requisitos

1. **Node.js** (v14 ou superior)
   - Download: https://nodejs.org/

2. **PostgreSQL** (v12 ou superior)
   - Download: https://www.postgresql.org/download/
   - Durante a instalação, anote a senha do usuário 'postgres'

## Passo a Passo

### 1. Instalar PostgreSQL

1. Baixe e instale o PostgreSQL
2. Durante a instalação, defina uma senha para o usuário 'postgres'
3. Certifique-se de que o PostgreSQL está rodando como serviço

### 2. Configurar o Banco de Dados

#### Opção A - Usando o script automatizado (Windows):
```cmd
setup-database.bat
```

#### Opção B - Manualmente:
```bash
# Criar o banco de dados
psql -U postgres -c "CREATE DATABASE amazonsalestracker;"

# Executar o script SQL
psql -U postgres -d amazonsalestracker < database.sql
```

### 3. Configurar Variáveis de Ambiente

1. Edite o arquivo `.env` com suas credenciais:
```env
# Atualize com seu usuário e senha do PostgreSQL
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/amazonsalestracker
```

### 4. Instalar Dependências

```bash
# Instalar todas as dependências (servidor e cliente)
npm run setup
```

### 5. Executar o Projeto

```bash
# Rodar servidor e cliente simultaneamente
npm run dev
```

O servidor estará disponível em: http://localhost:3001
O cliente estará disponível em: http://localhost:3000

## Solução de Problemas

### PostgreSQL não está rodando
- Windows: Abra "Serviços" e inicie o serviço "postgresql-x64-[versão]"
- Verifique se a porta 5432 está disponível

### Erro de conexão com banco
- Verifique se o PostgreSQL está rodando
- Confirme usuário e senha no arquivo .env
- Teste a conexão: `node server/test-db.js`

### Porta já em uso
- Mude a porta no .env: `PORT=3002`
- Ou encerre o processo usando a porta