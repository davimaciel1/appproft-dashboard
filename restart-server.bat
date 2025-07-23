@echo off
echo Reiniciando servidor com modo mock...

echo Parando processos Node...
taskkill /IM node.exe /F 2>nul

echo Aguardando...
timeout /t 2 /nobreak > nul

echo Iniciando servidor com dados mockados...
cd /d "%~dp0"
npm run dev

pause