# Instalação do PostgreSQL no Windows

## 1. Download
Baixe o PostgreSQL em: https://www.postgresql.org/download/windows/

## 2. Instalação
1. Execute o instalador
2. Durante a instalação:
   - Defina a senha do usuário 'postgres' como: **postgres**
   - Porta padrão: 5432
   - Marque a opção "Stack Builder" (opcional)

## 3. Verificar se está rodando
```cmd
psql -U postgres -c "SELECT version();"
```

## 4. Criar o banco de dados
Execute no PowerShell ou CMD:
```cmd
psql -U postgres -c "CREATE DATABASE amazonsalestracker;"
psql -U postgres -d amazonsalestracker < database.sql
```

## 5. Testar conexão
```cmd
node server/test-db.js
```

Se tudo estiver correto, você verá:
- ✅ Conexão bem-sucedida!
- Lista de tabelas criadas