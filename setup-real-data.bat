@echo off
echo === Configurando AppProft para Dados Reais ===
echo.

echo 1. Verificando PostgreSQL...
psql -U postgres -c "SELECT version();" 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ❌ PostgreSQL não está instalado ou não está rodando!
    echo.
    echo Por favor:
    echo 1. Baixe em: https://www.postgresql.org/download/windows/
    echo 2. Instale com senha 'postgres' para o usuário postgres
    echo 3. Execute este script novamente
    echo.
    pause
    exit /b 1
)

echo ✅ PostgreSQL detectado!
echo.

echo 2. Criando banco de dados...
psql -U postgres -c "DROP DATABASE IF EXISTS amazonsalestracker;" 2>nul
psql -U postgres -c "CREATE DATABASE amazonsalestracker;"

echo 3. Criando tabelas...
psql -U postgres -d amazonsalestracker < database.sql

echo.
echo 4. Testando conexão...
node server/test-db.js

echo.
echo === Configuração concluída! ===
echo.
echo Agora execute: npm run dev
echo.
pause