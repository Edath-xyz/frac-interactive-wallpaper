param(
  [Parameter(Position=0)][ValidateSet('doctor','build','check','test','serve')][string]$Action='doctor',
  [ValidateSet('wallpaper-engine','lively','both')][string]$HostName='wallpaper-engine'
)
$ErrorActionPreference='Stop'
$previousPurpleHost=$env:PURPLE_HOST
Push-Location -LiteralPath $PSScriptRoot
try {
  if ($Action -eq 'test') { & python -X utf8 -m unittest discover -s tests -p 'test_*.py' }
  elseif ($Action -eq 'serve') {
    if ($HostName -eq 'both') { throw 'serve requires one host: wallpaper-engine or lively' }
    $env:PURPLE_HOST=$HostName; & node tools/serve.cjs
  }
  elseif ($Action -eq 'build') { & python -X utf8 tools/project.py build --host $HostName }
  else { & python -X utf8 tools/project.py $Action }
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $Action" }
} finally { $env:PURPLE_HOST=$previousPurpleHost; Pop-Location }
