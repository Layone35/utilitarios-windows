$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Control Pro 2.0 Web Edition.lnk")
$Shortcut.TargetPath = "d:\MEUS SITES\aplicativos_python_pc\ControlPro.bat"
$Shortcut.WorkingDirectory = "d:\MEUS SITES\aplicativos_python_pc"
$Shortcut.IconLocation = "d:\MEUS SITES\aplicativos_python_pc\ControlPro.ico"
$Shortcut.Save()
