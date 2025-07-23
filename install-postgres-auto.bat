@echo off
echo === Instalação Automática do PostgreSQL ===
echo.

REM Verificar se já está instalado
psql --version 2>nul
if %errorlevel% equ 0 (
    echo PostgreSQL já está instalado!
    goto :setup
)

REM Verificar se tem Chocolatey
choco --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando Chocolatey...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))"
)

echo.
echo Instalando PostgreSQL via Chocolatey...
choco install postgresql --params '/Password:postgres' -y

echo.
echo Adicionando PostgreSQL ao PATH...
setx PATH "%PATH%;C:\Program Files\PostgreSQL\16\bin"

:setup
echo.
echo Configurando banco de dados...
timeout /t 3 /nobreak > nul

set PGPASSWORD=postgres
psql -U postgres -c "CREATE DATABASE amazonsalestracker;" 2>nul
psql -U postgres -d amazonsalestracker < database.sql

echo.
echo === Instalação concluída! ===
echo.
echo PostgreSQL instalado com:
echo - Usuário: postgres
echo - Senha: postgres
echo - Banco: amazonsalestracker
echo.
pause