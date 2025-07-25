#!/usr/bin/env python3
"""
Script de setup para o ambiente Python de IA
Instala dependências e verifica configuração
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Executa um comando e mostra o resultado"""
    print(f"\n{'='*60}")
    print(f"🔧 {description}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Sucesso!")
            if result.stdout:
                print(result.stdout)
        else:
            print(f"❌ Erro!")
            if result.stderr:
                print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Erro ao executar comando: {e}")
        return False
    
    return True

def main():
    print("""
    🤖 AppProft AI Setup
    ====================
    
    Este script irá:
    1. Criar ambiente virtual Python
    2. Instalar todas as dependências de ML/AI
    3. Verificar conexão com PostgreSQL
    4. Testar scripts Python
    """)
    
    # Verificar Python
    python_version = sys.version_info
    print(f"\n📌 Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print("❌ Python 3.8+ é necessário!")
        sys.exit(1)
    
    # Criar venv se não existir
    venv_path = os.path.join(os.path.dirname(__file__), 'venv')
    if not os.path.exists(venv_path):
        if not run_command(f"{sys.executable} -m venv venv", "Criando ambiente virtual"):
            sys.exit(1)
    
    # Detectar comando de ativação baseado no OS
    if sys.platform == "win32":
        activate_cmd = "venv\\Scripts\\activate.bat &&"
        pip_cmd = "venv\\Scripts\\pip"
        python_cmd = "venv\\Scripts\\python"
    else:
        activate_cmd = "source venv/bin/activate &&"
        pip_cmd = "venv/bin/pip"
        python_cmd = "venv/bin/python"
    
    # Atualizar pip
    run_command(f"{pip_cmd} install --upgrade pip", "Atualizando pip")
    
    # Instalar requirements
    requirements_path = os.path.join(os.path.dirname(__file__), 'requirements.txt')
    if os.path.exists(requirements_path):
        if not run_command(f"{pip_cmd} install -r requirements.txt", "Instalando dependências"):
            print("\n⚠️  Algumas dependências falharam, mas continuando...")
    
    # Verificar instalação
    print("\n📦 Verificando pacotes instalados:")
    run_command(f"{pip_cmd} list | grep -E '(prophet|scikit-learn|pandas|psycopg2)'", "Pacotes principais")
    
    # Testar conexão com banco
    print("\n🔍 Testando conexão com PostgreSQL...")
    test_script = """
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

try:
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'postgres'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD')
    )
    print("✅ Conexão com PostgreSQL OK!")
    
    # Verificar tabelas
    cur = conn.cursor()
    cur.execute('''
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('products_ml', 'ai_insights_advanced', 'demand_forecasts')
    ''')
    tables = cur.fetchall()
    print(f"📊 Tabelas AI encontradas: {len(tables)}")
    for table in tables:
        print(f"   - {table[0]}")
    
    conn.close()
except Exception as e:
    print(f"❌ Erro ao conectar: {e}")
"""
    
    with open('test_connection.py', 'w') as f:
        f.write(test_script)
    
    run_command(f"{python_cmd} test_connection.py", "Teste de conexão")
    os.remove('test_connection.py')
    
    # Instruções finais
    print(f"""
    
    ✨ Setup concluído!
    ==================
    
    Para usar os scripts de IA:
    
    1. Ativar ambiente virtual:
       {activate_cmd.strip(' &&')}
    
    2. Executar worker principal:
       node workers/aiDataCollectionWorker.js
    
    3. Ou executar scripts individualmente:
       {python_cmd} scripts/analyze_all.py
       {python_cmd} scripts/demand_forecast.py
       {python_cmd} scripts/price_optimization.py
       {python_cmd} scripts/campaign_analysis.py
    
    4. Verificar logs:
       tail -f ../logs/ai-worker.log
    
    📌 Lembre-se de configurar as variáveis de ambiente no arquivo .env!
    """)

if __name__ == '__main__':
    main()