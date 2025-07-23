@echo off
echo Configurando banco de dados PostgreSQL...
echo.

REM Solicitar senha do PostgreSQL
set /p PGPASSWORD=Digite a senha do usuario postgres: 

echo Criando banco de dados...
psql -U postgres -c "CREATE DATABASE amazonsalestracker;"

echo Executando script SQL...
psql -U postgres -d amazonsalestracker < database.sql

echo.
echo Banco de dados configurado com sucesso!
echo.
pause