@echo off
echo ========================================
echo   REINICIANDO SERVIDOR APPPROFT
echo ========================================
echo.

echo [1/2] Parando servidor anterior...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/2] Iniciando novo servidor...
echo.
echo ========================================
echo   SERVIDOR REINICIADO
echo ========================================
echo.
echo 🌐 Dashboard: http://localhost:5000
echo 📊 Buy Box Dashboard: http://localhost:5000/buybox
echo 🤖 Sincronizacao automatica: A cada 15 minutos
echo.
echo 🔄 Credenciais AWS atualizadas!
echo.
echo Para parar: Pressione Ctrl+C
echo.

cd server
node index.js