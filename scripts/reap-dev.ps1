# reap-dev.ps1 — kill stale Dustfall dev servers + headless browsers left behind by long
# agent sessions. Each procedural-modeler agent + each rig-shot run spawns its own Vite
# server (node) and a headless Chromium; completed agents don't always clean them up, so
# over a multi-hour session dozens accumulate and slow the machine. This reaps them safely.
#
# It NEVER touches the MCP filesystem servers (the app needs those while it's open).
#
# Usage (from the repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/reap-dev.ps1            # kill ALL dev servers + headless browsers
#   powershell -ExecutionPolicy Bypass -File scripts/reap-dev.ps1 -KeepPort 5180   # keep the server you're testing on
param([int]$KeepPort = 0)

$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select-Object ProcessId, @{n='Cmd';e={$_.CommandLine}}
$killed = 0
foreach ($p in $procs) {
  $c = $p.Cmd; if ($null -eq $c) { continue }
  if ($c -match 'server-filesystem') { continue }        # never touch MCP servers
  $isDev = $c -match 'vite|rig-shot|bench-intro|run dev|model-stage'
  $keep  = ($KeepPort -gt 0) -and ($c -match "[:= ]$KeepPort\b")
  if ($isDev -and -not $keep) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $killed++ } catch {}
  }
}
Write-Host "reaped $killed dev-server node processes"

# Headless browsers spawned by the rig (puppeteer/playwright chromium).
$browsers = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match 'headless_shell|chrome_headless' }
$bk = 0; foreach ($b in $browsers) { try { Stop-Process -Id $b.Id -Force -ErrorAction Stop; $bk++ } catch {} }
if ($bk -gt 0) { Write-Host "reaped $bk headless browser processes" }

$remain = @(Get-Process node -ErrorAction SilentlyContinue).Count
Write-Host "node.exe remaining: $remain (a clean idle state is ~4 = the MCP servers)"
