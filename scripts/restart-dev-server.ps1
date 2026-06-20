param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

$logDir = Join-Path $RepoRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$outLog = Join-Path $logDir 'post-commit-server.out.log'
$errLog = Join-Path $logDir 'post-commit-server.err.log'

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
    Write-Host "[hook] Log file still busy, continuing without clearing: $Path"
    return
  }

  $stream = [System.IO.File]::Open($Path, 'OpenOrCreate', 'ReadWrite', 'None')
  try {
    $stream.SetLength(0)
  } finally {
    $stream.Close()
  }
}

$nodeProcesses = @()
foreach ($port in 3000, 24678) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($conn in $connections) {
    if ($conn.OwningProcess -and -not ($nodeProcesses.ProcessId -contains $conn.OwningProcess)) {
      $nodeProcesses += [pscustomobject]@{
        ProcessId = $conn.OwningProcess
      }
    }
  }
}

foreach ($proc in $nodeProcesses) {
  try {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
  } catch {
    Write-Host "[hook] Failed to stop PID $($proc.ProcessId): $($_.Exception.Message)"
  }
}

Start-Sleep -Milliseconds 500

Clear-FileWhenWritable -Path $outLog
Clear-FileWhenWritable -Path $errLog

$startArgs = "/c npm.cmd start > `"$outLog`" 2> `"$errLog`""
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList $startArgs -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru
Write-Host "[hook] Restarted dev server (PID $($proc.Id))"
