$ProjectDir = "c:\Users\filip\MEUS SITES\utilitarios-windows"
$WshShell   = New-Object -comObject WScript.Shell

# Resolve a Área de Trabalho independente do idioma/OneDrive
$DesktopPath = $WshShell.SpecialFolders("Desktop")

# 1. Atalho para Iniciar (Silencioso)
$ShortcutStart = $WshShell.CreateShortcut("$DesktopPath\Utilitários Windows.lnk")
$ShortcutStart.TargetPath      = "wscript.exe"
$ShortcutStart.Arguments       = "`"$ProjectDir\iniciar.vbs`""
$ShortcutStart.WorkingDirectory = $ProjectDir
$ShortcutStart.IconLocation    = "$ProjectDir\ControlPro.ico"
$ShortcutStart.WindowStyle     = 7  # Minimizado (mesmo sendo VBS oculto, é boa prática)
$ShortcutStart.Save()

# 2. Atalho para Parar (Silencioso)
$ShortcutStop = $WshShell.CreateShortcut("$DesktopPath\Parar Utilitários.lnk")
$ShortcutStop.TargetPath      = "wscript.exe"
$ShortcutStop.Arguments       = "`"$ProjectDir\parar.vbs`""
$ShortcutStop.WorkingDirectory = $ProjectDir
# Usando um ícone vermelho padrão do Windows (shell32.dll, index 131 costuma ser o 'stop')
$ShortcutStop.IconLocation    = "shell32.dll,131"
$ShortcutStop.WindowStyle     = 7
$ShortcutStop.Save()

Write-Host "Atalhos criados com sucesso na Área de Trabalho!"
Write-Host " - Utilitários Windows (Início Silencioso)"
Write-Host " - Parar Utilitários (Encerramento Silencioso)"
