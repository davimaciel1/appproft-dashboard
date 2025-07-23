# Instruções para Instalar PostgreSQL

## Método 1: Download Direto (Recomendado)

1. **Baixe o PostgreSQL**:
   - Acesse: https://www.postgresql.org/download/windows/
   - Clique em "Download the installer"
   - Escolha a versão 16 para Windows x86-64

2. **Execute o instalador**:
   - Durante a instalação, defina:
     - Password: **postgres**
     - Port: **5432** (padrão)
   - Marque todos os componentes
   - NÃO é necessário o Stack Builder

3. **Após a instalação**, execute no PowerShell ou CMD:
```cmd
cd C:\Users\davi\YandexDisk\Claude\Projects\ProftNew
setup-real-data.bat
```

## Método 2: Via Linha de Comando

Execute como Administrador no PowerShell:
```powershell
# Instalar via winget
winget install -e --id PostgreSQL.PostgreSQL.16

# Aguarde a instalação interativa
# Defina a senha como: postgres
```

## Verificar Instalação

```cmd
psql --version
```

## Configurar o Banco

Após instalar, execute:
```cmd
set PGPASSWORD=postgres
psql -U postgres -c "CREATE DATABASE amazonsalestracker;"
psql -U postgres -d amazonsalestracker < database.sql
```

## Testar Conexão

```cmd
node server/test-db.js
```

Se tudo estiver OK, você verá:
- ✅ Conexão bem-sucedida!
- Lista de tabelas criadas