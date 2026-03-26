Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateFile = Join-Path $backendDir ".run\dev-processes.json"

if (-not (Test-Path -LiteralPath $stateFile)) {
  Write-Host "No existe estado de procesos en $stateFile. Nada que detener." -ForegroundColor Yellow
  exit 0
}

$raw = Get-Content -LiteralPath $stateFile -Raw
$state = $raw | ConvertFrom-Json

foreach ($procInfo in $state.processes) {
  $pidValue = [int]$procInfo.pid
  $nameValue = [string]$procInfo.name

  try {
    $proc = Get-Process -Id $pidValue -ErrorAction Stop
    Stop-Process -Id $pidValue -Force
    Write-Host "Detenido $nameValue (PID $pidValue)." -ForegroundColor Green
  } catch {
    Write-Host "PID $pidValue ($nameValue) ya no estaba activo." -ForegroundColor DarkYellow
  }
}

Remove-Item -LiteralPath $stateFile -Force
Write-Host "Estado limpiado: $stateFile" -ForegroundColor Cyan
