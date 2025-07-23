# Deploy PostgreSQL no Coolify

## Configuração Recomendada

Para o dashboard AppProft, recomendo usar o **PostgreSQL 17 (default)** no Coolify, pois:

1. É suficiente para armazenar dados de vendas da Amazon e Mercado Livre
2. Não precisamos de extensões especiais como PostGIS ou PGVector
3. É mais leve e eficiente que o Supabase PostgreSQL

## Passos para Deploy

### 1. No Coolify, selecione PostgreSQL 17

### 2. Configure as variáveis de ambiente:
```
POSTGRES_DB=appproft
POSTGRES_USER=postgres
POSTGRES_PASSWORD=[gere-uma-senha-segura]
```

### 3. Configure o volume persistente:
```
/var/lib/postgresql/data
```

### 4. Após o deploy, anote a connection string:
```
postgresql://postgres:[sua-senha]@[host-do-coolify]:5432/appproft
```

### 5. Atualize o arquivo .env do seu app com a DATABASE_URL do Coolify

## Estrutura do Banco

O arquivo `database.sql` já contém todas as tabelas necessárias:
- users (autenticação)
- amazon_orders (pedidos Amazon)
- mercadolivre_orders (pedidos ML)
- products (consolidação de produtos)
- notifications (sistema de notificações)

## Próximos Passos

1. Faça deploy do PostgreSQL no Coolify
2. Execute o script `database.sql` para criar as tabelas
3. Configure a DATABASE_URL no seu app
4. Faça deploy da aplicação Node.js/React