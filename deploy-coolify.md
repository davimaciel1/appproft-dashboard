# Deploy no Coolify com PostgreSQL

## Opção 1: PostgreSQL como Serviço no Coolify

1. **No painel do Coolify:**
   - New Resource > Database > PostgreSQL
   - Nome: `appproft-db`
   - Version: 16
   - Password: (gerar uma senha forte)

2. **Anotar as credenciais:**
   ```
   Host: appproft-db
   Port: 5432
   Database: postgres
   Username: postgres
   Password: [senha-gerada]
   ```

3. **Connection string interna:**
   ```
   DATABASE_URL=postgresql://postgres:[senha]@appproft-db:5432/postgres
   ```

## Opção 2: PostgreSQL Direto na VPS

1. **Conectar na VPS via SSH:**
   ```bash
   ssh user@seu-servidor.com
   ```

2. **Instalar PostgreSQL:**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib

   # Configurar senha
   sudo -u postgres psql
   ALTER USER postgres PASSWORD 'sua-senha-forte';
   \q
   ```

3. **Criar banco de dados:**
   ```bash
   sudo -u postgres createdb amazonsalestracker
   ```

4. **Permitir conexões locais:**
   ```bash
   # Editar postgresql.conf
   sudo nano /etc/postgresql/*/main/postgresql.conf
   # Adicionar: listen_addresses = 'localhost'

   # Reiniciar
   sudo systemctl restart postgresql
   ```

## Deploy da Aplicação no Coolify

1. **Criar novo projeto no Coolify:**
   - New Project > "AppProft Dashboard"
   - Source: GitHub/GitLab
   - Branch: main

2. **Configurar variáveis de ambiente:**
   ```env
   DATABASE_URL=postgresql://postgres:senha@appproft-db:5432/amazonsalestracker
   USE_MOCK_DATA=false
   JWT_SECRET=gerar-senha-segura-aqui
   PORT=3000
   NODE_ENV=production
   
   # APIs
   AMAZON_CLIENT_ID=...
   AMAZON_CLIENT_SECRET=...
   ML_CLIENT_ID=...
   ML_CLIENT_SECRET=...
   # etc...
   ```

3. **Build configuration:**
   ```yaml
   Build Command: npm run build
   Start Command: npm start
   Port: 3001
   ```

4. **Configurar domínio:**
   - Domain: dashboard.appproft.com
   - SSL: Let's Encrypt (automático)

## Docker Compose (Alternativa)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:senha@db:5432/amazonsalestracker
      - NODE_ENV=production
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=senha-forte
      - POSTGRES_DB=amazonsalestracker
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Backup Automático

```bash
# Criar script de backup
cat > /home/user/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U postgres amazonsalestracker > /backups/backup_$DATE.sql
# Manter apenas últimos 7 dias
find /backups -name "backup_*.sql" -mtime +7 -delete
EOF

# Agendar backup diário
crontab -e
# Adicionar: 0 2 * * * /home/user/backup-db.sh
```