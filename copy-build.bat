@echo off
echo Copiando build do frontend para o servidor...
xcopy /s /e /y /i client\build\* server\public\
echo Build copiado com sucesso!
pause