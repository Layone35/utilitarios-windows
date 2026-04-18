$pidFile  = Join-Path $env:TEMP "control_pro.pids"
$baseDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$python   = Join-Path $baseDir "backend\.venv\Scripts\python.exe"

# ── 1. Matar o processo atual do backend (porta 8010) ────────────
Write-Host "Encerrando backend na porta 8010..."
$portProcs = @()
try {
    $portProcs = (Get-NetTCPConnection -LocalPort 8010 -ErrorAction SilentlyContinue).OwningProcess
} catch {}

foreach ($p in ($portProcs | Sort-Object -Unique)) {
    if ($p -gt 0) {
        & taskkill /F /T /PID $p 2>$null
        Write-Host "  PID $p encerrado."
    }
}

# Matar ffmpeg órfão que possa ter ficado do backend
Get-Process -Name "ffmpeg" -ErrorAction SilentlyContinue | ForEach-Object {
    & taskkill /F /T /PID $_.Id 2>$null
}

Start-Sleep -Milliseconds 800

# ── 2. Reiniciar o backend ────────────────────────────────────────
Write-Host "Iniciando backend..."
$backendDir = Join-Path $baseDir "backend"

$proc = Start-Process -FilePath $python `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010" `
    -WorkingDirectory $backendDir `
    -WindowStyle Hidden `
    -PassThru

# ── 3. Atualizar arquivo de PIDs (preservando PID do processo pai) ─
if (Test-Path $pidFile) {
    $existingPids = Get-Content $pidFile | Where-Object { $_ -match '^\d+$' }
    # Remove o PID antigo do backend (porta 8010 já foi morto) e adiciona o novo
    $newPids = ($existingPids | Where-Object { $_ -ne "" }) + $proc.Id
    $newPids | Set-Content $pidFile
} else {
    $proc.Id | Set-Content $pidFile
}

Write-Host "Backend reiniciado (PID $($proc.Id)). Aguarde alguns segundos para ficar disponível."
