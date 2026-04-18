Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run chr(34) & ScriptDir & "\ControlPro.bat" & Chr(34), 0
Set WshShell = Nothing
Set fso = Nothing
