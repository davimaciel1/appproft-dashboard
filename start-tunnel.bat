@echo off
echo ==========================================
echo   INICIANDO TUNEL SSH PARA POSTGRESQL
echo ==========================================
echo.
echo Conectando ao servidor 49.12.191.119...
echo.
echo [IMPORTANTE: Deixe esta janela aberta!]
echo [Pressione Ctrl+C para parar o tunel]
echo.
ssh -L 5433:10.0.1.7:5432 root@49.12.191.119 -N