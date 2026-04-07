# Build completo: PyInstaller + Frontend + Tauri
$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "============================================================"
Write-Host "  Ferramentas do Layone - Build"
Write-Host "============================================================"
Write-Host ""

# 1. Ativar venv
$venv = "$ROOT\.venv\Scripts\Activate.ps1"
if (Test-Path $venv) { & $venv }

# 2. PyInstaller
Write-Host "[1/4] Empacotando backend com PyInstaller..."
Set-Location "$ROOT\backend"
python -m pip install pyinstaller -q
python -m PyInstaller backend.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) { Write-Error "PyInstaller falhou!"; exit 1 }
Write-Host "      OK: backend.exe gerado"

# 3. Copiar sidecar
Write-Host "[2/4] Copiando sidecar..."
$dest = "$ROOT\src-tauri\binaries"
if (!(Test-Path $dest)) { New-Item -ItemType Directory $dest | Out-Null }
Copy-Item "dist\backend.exe" "$dest\backend-x86_64-pc-windows-msvc.exe" -Force
Write-Host "      OK: sidecar copiado"

# 4. Build frontend
Write-Host "[3/4] Construindo frontend React..."
Set-Location "$ROOT\frontend"
pnpm install
pnpm build
if ($LASTEXITCODE -ne 0) { Write-Error "Build do frontend falhou!"; exit 1 }
Write-Host "      OK: frontend/dist/ gerado"

# 5. Build Tauri
Write-Host "[4/4] Compilando app Tauri (pode demorar ~10min na primeira vez)..."
Set-Location $ROOT
pnpm tauri build
if ($LASTEXITCODE -ne 0) { Write-Error "Tauri build falhou!"; exit 1 }

Write-Host ""
Write-Host "============================================================"
Write-Host "  BUILD CONCLUIDO!"
Write-Host "  Instalador: src-tauri\target\release\bundle\nsis\"
Write-Host "============================================================"
Write-Host ""
