Get-Process | Where-Object { $_.Name -match "Ferramentas|backend|layone" } | ForEach-Object {
    Write-Host "Fechando: $($_.Name)"
    $_ | Stop-Process -Force
}
Write-Host "Pronto!"
