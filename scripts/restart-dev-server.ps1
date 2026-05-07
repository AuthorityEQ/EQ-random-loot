[CmdletBinding()]
param(
  [int]$Port = 3000,
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repoPattern = [regex]::Escape($repoRoot)

function Write-Step($Message) {
  Write-Host "[dev] $Message"
}

function Get-ProcessCommandLine([int]$ProcessId) {
  try {
    return (Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId").CommandLine
  } catch {
    return ""
  }
}

function Stop-DevProcess([int]$ProcessId, [string]$Reason) {
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $process) {
    return
  }

  Write-Step "Stopping PID $ProcessId ($($process.ProcessName)): $Reason"
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

Set-Location $repoRoot

$devProcesses = Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine -match $repoPattern -and
    ($_.CommandLine -match "next\\dist\\bin\\next|next dev|npm-cli\.js.+run dev|npm\.cmd.+run dev")
  }

foreach ($process in $devProcesses) {
  Stop-DevProcess -ProcessId $process.ProcessId -Reason "existing dev server for this repo"
}

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $commandLine = Get-ProcessCommandLine -ProcessId $listener.OwningProcess
  if ($commandLine -match "next|node_modules\\next") {
    Stop-DevProcess -ProcessId $listener.OwningProcess -Reason "Next.js listener on port $Port"
  } else {
    $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    throw "Port $Port is already used by PID $($listener.OwningProcess) ($($owner.ProcessName)). Stop it manually or choose a different port."
  }
}

$lockPath = Join-Path $repoRoot ".next\dev\lock"
if (Test-Path $lockPath) {
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
$npm = if ($npmCommand) { $npmCommand.Source } else { $null }
if (-not $npm) {
  $npm = "C:\Program Files\nodejs\npm.cmd"
}

if ($Foreground) {
  Write-Step "Starting foreground dev server at http://127.0.0.1:$Port/"
  & $npm run dev
  exit $LASTEXITCODE
}

$logDir = Join-Path $repoRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdoutLog = Join-Path $logDir "next-dev-stdout.log"
$stderrLog = Join-Path $logDir "next-dev-stderr.log"

Write-Step "Starting background dev server at http://127.0.0.1:$Port/"
$serverProcess = Start-Process `
  -FilePath $npm `
  -ArgumentList "run", "dev" `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -PassThru

$deadline = (Get-Date).AddSeconds(45)
$ready = $false
do {
  Start-Sleep -Seconds 1
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $ready = $true
      break
    }
  } catch {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
      $ready = $true
      break
    }
  }
} while ((Get-Date) -lt $deadline)

if (-not $ready) {
  Write-Warning "Dev server did not become ready on port $Port."
  if (Test-Path $stdoutLog) {
    Write-Host "--- stdout ---"
    Get-Content $stdoutLog -Tail 80
  }
  if (Test-Path $stderrLog) {
    Write-Host "--- stderr ---"
    Get-Content $stderrLog -Tail 80
  }
  exit 1
}

Write-Step "Ready: http://127.0.0.1:$Port/ (launcher PID $($serverProcess.Id))"
