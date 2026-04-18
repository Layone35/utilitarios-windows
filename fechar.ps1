$pidFile = Join-Path $env:TEMP "control_pro.pids"

if (Test-Path $pidFile) {
    $pids = Get-Content $pidFile | Where-Object { $_ -match '^\d+$' }
    foreach ($p in $pids) {
        Write-Host "Encerrando árvore do processo PID $p ..."
        # /F = força, /T = inclui processos filhos (ffmpeg, node, etc.)
        & taskkill /F /T /PID $p 2>$null
    }
    Remove-Item $pidFile -Force
    Write-Host "Processos encerrados via PID file."
} else {
    Write-Host "Arquivo de PIDs não encontrado. Tentando por nome de processo..."
}

# Garantia extra: matar ffmpeg que ficou órfão, python rodando uvicorn na porta 8010,
# e node/pnpm rodando na porta 5174
$portProcs = @()
try {
    $portProcs += (Get-NetTCPConnection -LocalPort 8010 -ErrorAction SilentlyContinue).OwningProcess
    $portProcs += (Get-NetTCPConnection -LocalPort 5174 -ErrorAction SilentlyContinue).OwningProcess
} catch {}

foreach ($p in ($portProcs | Sort-Object -Unique)) {
    if ($p -gt 0) {
        Write-Host "Encerrando processo na porta (PID $p)..."
        & taskkill /F /T /PID $p 2>$null
    }
}

# Mata ffmpeg órfão restante (seguro: só mata se ainda estiver rodando)
Get-Process -Name "ffmpeg" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Encerrando ffmpeg PID $($_.Id)..."
    & taskkill /F /T /PID $_.Id 2>$null
}

Write-Host "Pronto!"
