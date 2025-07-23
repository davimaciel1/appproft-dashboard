@echo off
echo Iniciando projeto sem PostgreSQL...
echo.
echo AVISO: O projeto rodara com dados mockados.
echo Para dados reais, instale o PostgreSQL e configure o banco.
echo.

set USE_MOCK_DATA=true
npm run dev

pause