@echo off
echo Finalizando processos nas portas 3000 e 3001...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    echo Finalizando processo na porta 3001 - PID: %%a
    taskkill /PID %%a /F 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Finalizando processo na porta 3000 - PID: %%a
    taskkill /PID %%a /F 2>nul
)

echo Portas liberadas!
timeout /t 2 /nobreak > nul