$projectRoot = Split-Path -Parent $PSScriptRoot
$parentModules = Join-Path (Split-Path -Parent $projectRoot) 'node_modules'
$vite = Join-Path $parentModules '.bin\vite.cmd'
$electron = Join-Path $parentModules 'electron\dist\electron.exe'

if (!(Test-Path $vite) -or !(Test-Path $electron)) {
  throw 'Ambiente de desenvolvimento incompleto: Vite ou o runtime Electron não foram encontrados.'
}

& $vite build --config vite.main.config.mjs
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível compilar o processo principal.' }
& $vite build --config vite.preload.config.mjs
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível compilar o preload.' }

$env:CONSTRUTEC_DEV_SERVER_URL = 'http://127.0.0.1:5173'
$viteProcess = Start-Process -FilePath $vite -ArgumentList '--host', '127.0.0.1' -WorkingDirectory $projectRoot -PassThru
try {
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    if (Test-NetConnection 127.0.0.1 -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue) { break }
    Start-Sleep -Milliseconds 300
  }
  Start-Process -FilePath $electron -ArgumentList "`"$projectRoot`"" -WorkingDirectory $projectRoot -Wait
} finally {
  if (!$viteProcess.HasExited) { Stop-Process -Id $viteProcess.Id -Force }
}
