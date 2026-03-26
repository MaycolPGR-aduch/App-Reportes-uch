Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = Join-Path $backendDir "venv\Scripts\python.exe"
$stateDir = Join-Path $backendDir ".run"
$stateFile = Join-Path $stateDir "dev-processes.json"

if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "No se encontró el intérprete de Python en: $pythonExe"
}

if (-not (Test-Path -LiteralPath $stateDir)) {
  New-Item -ItemType Directory -Path $stateDir | Out-Null
}

if (Test-Path -LiteralPath $stateFile) {
  Write-Host "Existe un estado previo en $stateFile. Si ya no está activo, usa stop-all.ps1 y vuelve a iniciar." -ForegroundColor Yellow
}

function Start-DevWindow {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Command,
    [string]$StartupMessage = ""
  )

  $wrapped = @"
`$Host.UI.RawUI.WindowTitle = 'Campus - $Name'
Set-Location '$backendDir'
if ('$StartupMessage' -ne '') {
  Write-Host '$StartupMessage' -ForegroundColor Green
}
$Command
"@

  $proc = Start-Process -FilePath "pwsh" -ArgumentList "-NoExit", "-Command", $wrapped -PassThru
  return $proc
}

$apiProcess = Start-DevWindow `
  -Name "API" `
  -Command "& '$pythonExe' -m uvicorn app.main:app --reload --port 8000" `
  -StartupMessage "Servicio API iniciado correctamente."

$notificationProcess = Start-DevWindow `
  -Name "Notification Worker" `
  -Command "& '$pythonExe' -m app.workers.notification_worker" `
  -StartupMessage "Servicio Notification Worker iniciado correctamente."

$aiProcess = Start-DevWindow `
  -Name "AI Worker" `
  -Command "& '$pythonExe' -m app.workers.ai_worker" `
  -StartupMessage "Servicio AI Worker iniciado correctamente."

$state = @{
  started_at = (Get-Date).ToString("o")
  backend_dir = $backendDir
  processes  = @(
    @{ name = "api"; pid = $apiProcess.Id },
    @{ name = "notification_worker"; pid = $notificationProcess.Id },
    @{ name = "ai_worker"; pid = $aiProcess.Id }
  )
}

$state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateFile -Encoding UTF8

Write-Host ""
Write-Host "Procesos iniciados:" -ForegroundColor Green
Write-Host "  API:                 PID $($apiProcess.Id)"
Write-Host "  Notification Worker: PID $($notificationProcess.Id)"
Write-Host "  AI Worker:           PID $($aiProcess.Id)"
Write-Host ""
Write-Host "Para detenerlos:  .\stop-all.ps1" -ForegroundColor Cyan
