# Opções de Banco de Dados na Nuvem (Gratuito)

## 1. Supabase (Recomendado)
- PostgreSQL completo
- 500 MB grátis
- Interface web
- URL: https://supabase.com

## 2. Neon
- PostgreSQL serverless
- 3 GB grátis
- URL: https://neon.tech

## 3. Aiven
- PostgreSQL gerenciado
- 1 mês grátis
- URL: https://aiven.io

## 4. ElephantSQL
- PostgreSQL como serviço
- 20 MB grátis (bom para testes)
- URL: https://www.elephantsql.com

## Como configurar:

1. Crie uma conta em um dos serviços
2. Crie um novo banco de dados
3. Copie a connection string
4. Atualize o .env:
```
DATABASE_URL=postgresql://user:password@host:port/database
```

## Exemplo com Supabase:
```
DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```