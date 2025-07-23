# Guia para Criar Usuário no AppProft

## Opção 1: Via SQL no PostgreSQL

### Passo 1: Verificar estrutura da tabela
```bash
docker exec sscowkg4g8swg8cw0gocwcgk psql -U postgres -d postgres -c "\d users"
```

### Passo 2: Criar o usuário
```bash
docker exec -i sscowkg4g8swg8cw0gocwcgk psql -U postgres -d postgres << 'EOF'
-- Deletar usuário anterior se existir
DELETE FROM users WHERE email = 'admin@appproft.com';

-- Criar usuário novo
INSERT INTO users (email, password, name) 
VALUES (
  'admin@appproft.com',
  '$2a$10$.4tB.XuQWIpeUHVdBKV1Ouhd0ZJYjdflfTI8Ae5SRGSQwUv/mKIHy',
  'Admin'
);

-- Verificar se foi criado
SELECT id, email, name, created_at FROM users WHERE email = 'admin@appproft.com';
EOF
```

### Credenciais:
- **Email**: admin@appproft.com
- **Senha**: admin123

## Opção 2: Via API de Registro

### Usando curl:
```bash
curl -X POST https://appproft.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@appproft.com",
    "password": "admin123",
    "name": "Admin"
  }'
```

### Usando a página de registro:
1. Acesse: https://appproft.com/login
2. Procure por um link "Cadastrar" ou "Registrar"
3. Preencha o formulário com:
   - Email: admin@appproft.com
   - Senha: admin123
   - Nome: Admin

## Troubleshooting

### Se der erro "Credenciais inválidas":

1. **Verificar se o usuário existe**:
```bash
docker exec sscowkg4g8swg8cw0gocwcgk psql -U postgres -d postgres -c "SELECT * FROM users;"
```

2. **Verificar logs da aplicação**:
```bash
docker logs $(docker ps --format "{{.Names}}" | grep qc8wwswos4sokgosww4k0wkc) --tail 50
```

3. **Testar a conexão com o banco**:
```bash
docker exec sscowkg4g8swg8cw0gocwcgk psql -U postgres -d postgres -c "SELECT NOW();"
```

## Hash de Senhas Alternativas

Se quiser usar uma senha diferente:

- **Senha**: 123456
  - **Hash**: `$2a$10$xGqXbtTVQhLmgocNksVTheT5vEUe5qfD38N3Tw5gOEzNvxtNH.uWC`

- **Senha**: appproft
  - **Hash**: `$2a$10$KDQs.qXuYJAWKG7L8Zr2U.OfkxGR7kO3Rm0X0O8.R8YcXPNkQQ3Oi`

Exemplo:
```sql
INSERT INTO users (email, password, name) 
VALUES ('admin@appproft.com', '$2a$10$xGqXbtTVQhLmgocNksVTheT5vEUe5qfD38N3Tw5gOEzNvxtNH.uWC', 'Admin');
-- Senha: 123456
```