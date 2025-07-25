@echo off
echo ========================================
echo   INICIANDO SERVIDOR APPPROFT
echo   Com sincronizacao automatica Buy Box
echo ========================================
echo.

REM Verificar se o túnel SSH está ativo
echo [1/3] Verificando conexao com banco de dados...
cd /d %~dp0
node -e "require('./DATABASE_ACCESS_CONFIG').executeSQL('SELECT 1').then(() => console.log('✅ Conexao com banco OK')).catch(() => { console.error('❌ ERRO: Tunel SSH nao esta ativo!'); console.log('Execute start-tunnel.bat primeiro'); process.exit(1); })"

if %errorlevel% neq 0 (
    echo.
    echo ❌ Erro: Execute start-tunnel.bat primeiro!
    pause
    exit /b 1
)

echo.
echo [2/3] Verificando dependencias...
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
)

echo.
echo [3/3] Iniciando servidor...
echo.
echo ========================================
echo   SERVIDOR RODANDO
echo ========================================
echo.
echo 🌐 Dashboard: http://localhost:5000
echo 📊 Buy Box Dashboard: http://localhost:5000/buybox
echo 🤖 Sincronizacao automatica: A cada 15 minutos
echo.
echo Para parar: Pressione Ctrl+C
echo.

cd server
node index.js