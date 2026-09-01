$root = Split-Path -Parent $PSScriptRoot
try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/ -TimeoutSec 2 | Out-Null; exit 0 } catch {}
Start-Process node -ArgumentList 'web/server.js' -WorkingDirectory $root -WindowStyle Hidden