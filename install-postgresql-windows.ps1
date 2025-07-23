# Script PowerShell para instalar PostgreSQL no Windows
Write-Host "=== Instalando PostgreSQL ===" -ForegroundColor Green

# Verificar se já está instalado
$pgInstalled = Get-Command psql -ErrorAction SilentlyContinue
if ($pgInstalled) {
    Write-Host "PostgreSQL já está instalado!" -ForegroundColor Yellow
    psql --version
    exit 0
}

# Baixar PostgreSQL installer
Write-Host "Baixando PostgreSQL 16..." -ForegroundColor Cyan
$installerUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.1-1-windows-x64.exe"
$installerPath = "$env:TEMP\postgresql-installer.exe"

try {
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "Download concluído!" -ForegroundColor Green
} catch {
    Write-Host "Erro ao baixar PostgreSQL. Tentando método alternativo..." -ForegroundColor Red
    
    # Tentar com chocolatey se disponível
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host "Instalando via Chocolatey..." -ForegroundColor Cyan
        choco install postgresql16 --params '/Password:postgres' -y
        exit 0
    } else {
        Write-Host "Por favor, baixe manualmente em: https://www.postgresql.org/download/windows/" -ForegroundColor Red
        exit 1
    }
}

# Instalar PostgreSQL silenciosamente
Write-Host "Instalando PostgreSQL (isso pode levar alguns minutos)..." -ForegroundColor Cyan
$installArgs = @(
    "--mode", "unattended",
    "--unattendedmodeui", "minimal",
    "--superpassword", "postgres",
    "--serverport", "5432",
    "--enable-components", "server,commandlinetools"
)

Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait

# Adicionar ao PATH
$pgPath = "C:\Program Files\PostgreSQL\16\bin"
if (Test-Path $pgPath) {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
    if ($currentPath -notlike "*$pgPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$pgPath", [EnvironmentVariableTarget]::User)
        $env:Path += ";$pgPath"
    }
}

Write-Host "PostgreSQL instalado com sucesso!" -ForegroundColor Green
Write-Host "Usuário: postgres" -ForegroundColor Yellow
Write-Host "Senha: postgres" -ForegroundColor Yellow