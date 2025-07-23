@echo off
echo === AppProft Dashboard - Modo Desenvolvimento ===
echo.

echo Verificando portas...
netstat -ano | findstr :3001 >nul 2>&1
if %errorlevel% equ 0 (
    echo Porta 3001 em uso. Tente executar kill-ports.bat primeiro.
    pause
    exit /b 1
)

echo Iniciando servidor e cliente...
echo.
echo Servidor: http://localhost:3001
echo Cliente: http://localhost:3000
echo.
echo USE_MOCK_DATA está ativado - Login com qualquer email/senha
echo.

npm run dev

pause