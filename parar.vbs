Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -File " & chr(34) & ScriptDir & "\fechar.ps1" & chr(34), 0
Set WshShell = Nothing
Set fso = Nothing
