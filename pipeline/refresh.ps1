# 'Continue', ne 'Stop': native stderr (npr. claude progress) pod 2>&1 sicer
# prekine skripto v Windows PowerShell 5.1. Varnost je v try/catch + preverbah spodaj.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "refresh-$stamp.log"
function Log($m){ ("[{0}] {1}" -f (Get-Date -Format HH:mm:ss), $m) | Tee-Object -FilePath $log -Append }

$claude = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $claude) { $claude = Join-Path $env:USERPROFILE '.local\bin\claude.exe' }
if (-not (Test-Path $claude)) { Log 'claude.exe ni najden'; exit 1 }

$bak = Join-Path $PSScriptRoot ".bak-$stamp"
New-Item -ItemType Directory -Force -Path $bak | Out-Null
foreach ($f in 'data\clean\events.json','data\scored\events.json','out\digest.md','out\events.ics') {
  if (Test-Path $f) { Copy-Item $f (Join-Path $bak ($f -replace '[\\/]','_')) -Force }
}

$prompt = Get-Content -Raw (Join-Path $PSScriptRoot 'radar-auto.md')
$start  = Get-Date
Log 'claude -p radar-auto ...'
try {
  & $claude -p $prompt --permission-mode bypassPermissions 2>&1 | Tee-Object -FilePath $log -Append
  $claudeExit = $LASTEXITCODE
} catch {
  $claudeExit = 1
  Log ("claude EXC: " + $_.Exception.Message)
}
Log "claude exit=$claudeExit"

$ok = $true
try {
  $ev = Get-Content -Raw 'data\scored\events.json' | ConvertFrom-Json
  if ($ev.Count -lt 1) { throw '0 dogodkov' }
  foreach ($f in 'out\digest.md','out\events.ics') {
    if (-not (Test-Path $f) -or (Get-Item $f).LastWriteTime -lt $start) { throw "$f ni osvezen" }
  }
  Log "OK: $($ev.Count) dogodkov"
} catch { $ok = $false; Log "VERIFIKACIJA: $($_.Exception.Message)" }

if (-not $ok) {
  Log 'ROLLBACK'
  Get-ChildItem $bak -File | ForEach-Object { Copy-Item $_.FullName (Join-Path $root ($_.Name -replace '_','\')) -Force }
  exit 1
}
& (Join-Path $PSScriptRoot 'start-viewer.ps1')

# --- objava javne strani (docs/ -> GitHub Pages) ---
node pipeline/build-site.js 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $root '.git'))) {
  git add -A 2>&1 | Tee-Object -FilePath $log -Append
  git commit -m ("refresh {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm')) 2>&1 | Tee-Object -FilePath $log -Append
  git push 2>&1 | Tee-Object -FilePath $log -Append
  Log "git push exit=$LASTEXITCODE"
} else {
  Log "build-site/git preskocen (exit=$LASTEXITCODE ali ni .git)"
}

Get-ChildItem $logDir -Filter 'refresh-*.log' | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem $PSScriptRoot -Directory -Filter '.bak-*' | Sort-Object Name -Descending | Select-Object -Skip 5 | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Log 'koncano OK'