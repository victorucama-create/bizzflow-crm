@echo off
echo 🚀 Iniciando Bizz Flow CRM...
echo ==============================

REM Verificar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado. Instale Node.js v16+
    pause
    exit /b 1
)

REM Verificar versão do Node
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
set NODE_VERSION=%NODE_VERSION:~1%
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set MAJOR_VERSION=%%i

if %MAJOR_VERSION% lss 16 (
    echo ❌ Node.js v16+ necessário. Versão atual: %NODE_VERSION%
    pause
    exit /b 1
)

echo ✅ Node.js %NODE_VERSION% detectado

REM Instalar dependências se necessário
if not exist "node_modules" (
    echo 📦 Instalando dependências...
    call npm install
)

REM Criar diretórios necessários
if not exist "data" mkdir data
if not exist "backups" mkdir backups
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads
if not exist "temp" mkdir temp

REM Verificar banco de dados
if not exist "data\bizzflow.db" (
    echo 🗄️  Banco de dados será criado na primeira execução
)

REM Definir ambiente
if "%NODE_ENV%"=="" (
    set NODE_ENV=development
    echo 🔧 Ambiente: development
) else (
    echo 🔧 Ambiente: %NODE_ENV%
)

REM Iniciar servidor
echo 🌐 Iniciando servidor na porta %PORT%...
echo 👉 Acesse: http://localhost:%PORT%
echo 👉 Health check: http://localhost:%PORT%/health
echo 👉 API Status: http://localhost:%PORT%/status
echo.
echo 📝 Logs disponíveis em:
echo    - Console ^(detalhado^)
echo    - logs\ ^(arquivos^)
echo.
echo 🛑 Pressione Ctrl+C para encerrar
echo.

REM Executar servidor
if "%NODE_ENV%"=="production" (
    npm start
) else (
    npm run dev
)
