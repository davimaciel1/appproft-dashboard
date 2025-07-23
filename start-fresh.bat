@echo off
echo === INICIANDO SERVIDOR LIMPO ===
echo.
echo 1. Encerrando todos os processos node...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo 2. Limpando cache do node...
if exist node_modules\.cache rd /s /q node_modules\.cache

echo 3. Iniciando servidor...
echo.
npm run server