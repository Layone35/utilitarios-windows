@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   Control Pro — Build Script (Tauri + PyInstaller) 
echo ============================================================
echo.

REM ── Pré-requisitos: Rust, Node.js, Python com venv ──────────────

REM 1. Copiar ícone para src-tauri/icons/
echo [1/5] Copiando icone...
if not exist "src-tauri\icons" mkdir "src-tauri\icons"
if exist "ControlPro.ico" (
    copy /Y "ControlPro.ico" "src-tauri\icons\icon.ico" > nul
    echo       OK: ControlPro.ico copiado
) else (
    echo       AVISO: ControlPro.ico nao encontrado. Coloque um .ico em src-tauri\icons\icon.ico manualmente.
)

REM 2. Criar pasta de binaries para o sidecar
if not exist "src-tauri\binaries" mkdir "src-tauri\binaries"

REM 3. Empacotar backend com PyInstaller
echo.
echo [2/5] Empacotando backend FastAPI com PyInstaller...
cd backend

REM Ativa o venv do projeto se existir, senão usa Python do sistema
if exist "..\.venv\Scripts\activate.bat" (
    echo       Usando venv do projeto...
    call "..\.venv\Scripts\activate.bat"
) else (
    echo       Usando Python do sistema...
)

REM Instala PyInstaller
python -m pip install pyinstaller --quiet
if errorlevel 1 (
    echo ERRO: Falha ao instalar PyInstaller!
    pause
    exit /b 1
)

python -m PyInstaller backend.spec --clean --noconfirm
if errorlevel 1 (
    echo ERRO: PyInstaller falhou!
    pause
    exit /b 1
)
echo       OK: backend.exe gerado em backend\dist\

REM 4. Copiar sidecar para src-tauri/binaries/ com o nome correto (target triple Windows x64)
echo.
echo [3/5] Copiando sidecar para src-tauri/binaries/...
set TRIPLE=x86_64-pc-windows-msvc
copy /Y "dist\backend.exe" "..\src-tauri\binaries\backend-%TRIPLE%.exe" > nul
if errorlevel 1 (
    echo ERRO: Falha ao copiar backend.exe!
    pause
    exit /b 1
)
echo       OK: backend-%TRIPLE%.exe copiado

cd ..

REM 4. Build do frontend React
echo.
echo [4/6] Construindo frontend React...
cd frontend
pnpm install
if errorlevel 1 (
    echo ERRO: pnpm install do frontend falhou!
    pause
    exit /b 1
)
pnpm build
if errorlevel 1 (
    echo ERRO: build do frontend falhou!
    pause
    exit /b 1
)
echo       OK: frontend/dist/ gerado
cd ..

REM 5. Instalar dependencias Tauri
echo.
echo [5/6] Instalando dependencias Tauri (@tauri-apps/cli)...
pnpm install
if errorlevel 1 (
    echo ERRO: pnpm install raiz falhou!
    pause
    exit /b 1
)

REM 6. Compilar com Tauri
echo.
echo [6/6] Compilando app Tauri (aguarde, demora ~10min na primeira vez)...
pnpm run build
if errorlevel 1 (
    echo ERRO: tauri build falhou!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   BUILD CONCLUIDO!
echo   Instalador: src-tauri\target\release\bundle\nsis\
echo   Executavel: src-tauri\target\release\bundle\nsis\Control Pro_2.0.0_x64-setup.exe
echo ============================================================
echo.
pause
