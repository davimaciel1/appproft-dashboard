# 🚀 COMO INICIAR O PROJETO

## TODA VEZ que abrir o VS Code:

### 1️⃣ PRIMEIRO TERMINAL (Túnel SSH)
- Clique duplo no arquivo `start-tunnel.bat`
- OU no terminal digite: `.\start-tunnel.bat`
- Digite a senha da VPS quando pedir
- DEIXE RODANDO! (vai parecer travado - é normal)

### 2️⃣ SEGUNDO TERMINAL (Seu trabalho)
- Abra um novo terminal (Ctrl+Shift+`)
- Execute: `.\test-connection.bat`
- Se aparecer o relatório do banco = TUDO OK! ✅

## 📝 RESUMO RÁPIDO:
1. start-tunnel.bat (deixar rodando)
2. test-connection.bat (testar se funciona)
3. Pronto para usar!

## 🔧 COMANDO MANUAL (se preferir):
ssh -L 5433:10.0.1.7:5432 root@49.12.191.119 -N