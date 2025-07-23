@echo off
echo === Instalando PostgreSQL ===
echo.

REM Tentar com winget primeiro
winget --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Instalando PostgreSQL via winget...
    winget install -e --id PostgreSQL.PostgreSQL -h --accept-source-agreements --accept-package-agreements
    goto :configure
)

REM Se winget não estiver disponível
echo.
echo Por favor, instale o PostgreSQL manualmente:
echo.
echo 1. Acesse: https://www.postgresql.org/download/windows/
echo 2. Baixe o instalador "Windows x86-64"
echo 3. Durante a instalação:
echo    - Defina a senha como: postgres
echo    - Porta: 5432 (padrão)
echo.
start https://www.postgresql.org/download/windows/
pause
exit /b

:configure
echo.
echo Aguardando instalação concluir...
timeout /t 10 /nobreak

echo.
echo Configurando banco de dados...
set PGPASSWORD=postgres

REM Testar conexão
psql -U postgres -c "SELECT version();" 2>nul
if %errorlevel% neq 0 (
    echo.
    echo PostgreSQL ainda não está pronto. 
    echo Execute este script novamente após a instalação.
    pause
    exit /b
)

echo.
echo Criando banco de dados...
psql -U postgres -c "CREATE DATABASE amazonsalestracker;" 2>nul

echo Executando script SQL...
psql -U postgres -d amazonsalestracker < database.sql

echo.
echo === Instalação concluída! ===
echo.
echo Teste a conexão:
node server/test-db.js

pause