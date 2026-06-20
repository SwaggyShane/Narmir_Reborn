param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

$logDir = Join-Path $RepoRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$outLog = Join-Path $logDir 'post-commit-server.out.log'
$errLog = Join-Path $logDir 'post-commit-server.err.log'

if (Test-Path $outLog) { Remove-Item -LiteralPath $outLog -Force }
if (Test-Path $errLog) { Remove-Item -LiteralPath $errLog -Force }

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

$startArgs = "/c npm.cmd start > `"$outLog`" 2> `"$errLog`""
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList $startArgs -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru
Write-Host "[hook] Restarted dev server (PID $($proc.Id))"
