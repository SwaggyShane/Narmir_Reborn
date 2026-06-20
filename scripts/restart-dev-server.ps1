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

$repoRootRegex = [regex]::Escape((Resolve-Path $RepoRoot).Path)
$nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine -match $repoRootRegex -and $_.CommandLine -match 'index\.js'
}

foreach ($proc in $nodeProcesses) {
  try {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
  } catch {
    Write-Host "[hook] Failed to stop PID $($proc.ProcessId): $($_.Exception.Message)"
  }
}

Start-Sleep -Milliseconds 500

$startInfo = @{
  FilePath = 'npm.cmd'
  ArgumentList = @('start')
  WorkingDirectory = $RepoRoot
  WindowStyle = 'Hidden'
  RedirectStandardOutput = $outLog
  RedirectStandardError = $errLog
  PassThru = $true
}

$proc = Start-Process @startInfo
Write-Host "[hook] Restarted dev server (PID $($proc.Id))"
