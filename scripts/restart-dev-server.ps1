param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Continue'

$logDir = Join-Path $RepoRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$outLog = Join-Path $logDir 'post-commit-server.out.log'
$errLog = Join-Path $logDir 'post-commit-server.err.log'
$devPorts = @(3000, 24678, 5173)

function Wait-ForWritableFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [int]$TimeoutSeconds = 15
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $stream = [System.IO.File]::Open($Path, 'OpenOrCreate', 'ReadWrite', 'None')
      $stream.Close()
      return $true
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  return $false
}

function Clear-FileWhenWritable {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  if (-not (Wait-ForWritableFile -Path $Path)) {
    Write-Host ('[hook] Log file still busy, continuing without clearing: {0}' -f $Path)
    return
  }

  $stream = [System.IO.File]::Open($Path, 'OpenOrCreate', 'ReadWrite', 'None')
  try {
    $stream.SetLength(0)
  } finally {
    $stream.Close()
  }
}

function Stop-RepoDevServers {
  param([string]$Root)

  $escapedRoot = [regex]::Escape($Root)

  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = $_.CommandLine
    if ($cmd -and ($cmd -match 'index\.js') -and ($cmd -match $escapedRoot)) {
      Write-Host ('[hook] Stopping node PID {0}' -f $_.ProcessId)
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }

  Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = $_.CommandLine
    if ($cmd -and ($cmd -match 'npm\.cmd start') -and ($cmd -match $escapedRoot)) {
      Write-Host ('[hook] Stopping npm shell PID {0}' -f $_.ProcessId)
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }

  foreach ($port in $devPorts) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
      Where-Object { $_.OwningProcess -gt 0 } |
      ForEach-Object { $_.OwningProcess } |
      Sort-Object -Unique |
      ForEach-Object {
        Write-Host ('[hook] Stopping port {0} holder PID {1}' -f $port, $_)
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      }
  }
}

function Wait-ForListenPortsFree {
  param(
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $busy = $false
    foreach ($port in $devPorts) {
      if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        $busy = $true
        break
      }
    }
    if (-not $busy) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Import-DotEnv {
  param([string]$Root)

  $envFile = Join-Path $Root '.env'
  if (-not (Test-Path $envFile)) { return }

  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }

    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "Env:$name" -Value $value
  }
}

Stop-RepoDevServers -Root $RepoRoot

if (-not (Wait-ForListenPortsFree)) {
  Write-Host '[hook] WARNING: dev ports still in use; retrying stop'
  Stop-RepoDevServers -Root $RepoRoot
  if (-not (Wait-ForListenPortsFree)) {
    Write-Host ('[hook] ERROR: could not free ports {0} - aborting restart' -f ($devPorts -join ', '))
    exit 1
  }
}

Clear-FileWhenWritable -Path $outLog
Clear-FileWhenWritable -Path $errLog

Import-DotEnv -Root $RepoRoot
if (-not $env:NODE_ENV) {
  $env:NODE_ENV = 'development'
}

$proc = Start-Process `
  -FilePath 'node' `
  -ArgumentList 'index.js' `
  -WorkingDirectory $RepoRoot `
  -WindowStyle Hidden `
  -PassThru `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

function Test-ServerReady {
  param([int]$TimeoutSeconds = 60)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $status = (& curl.exe -s -o NUL -w '%{http_code}' 'http://127.0.0.1:3000/api/auth/me' 2>$null).ToString().Trim()
    # /api/auth/me returns 401 with "Not authenticated" when the server is up but logged out.
    if ($status -in @('200', '401')) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

$ready = Test-ServerReady

if ($ready) {
  Write-Host ('[hook] Dev server ready (node PID {0})' -f $proc.Id)
} else {
  Write-Host ('[hook] Dev server started (node PID {0}) but health check timed out - see {1} and {2}' -f $proc.Id, $outLog, $errLog)
  exit 1
}