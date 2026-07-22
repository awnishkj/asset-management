# ============================================================
#  AssetTrack - One-Click Startup Script
#  Starts MongoDB, Backend, Tunnels, Frontend
#  Auto-updates .env files with live tunnel URLs
# ============================================================

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = "$ROOT\backend"
$FRONTEND = "$ROOT\frontend"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   ASSETTRACK - Starting All Services   " -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ── 1. Start MongoDB ──────────────────────────────────────
Write-Host "[1/5] Starting MongoDB..." -ForegroundColor Yellow
Start-Process "mongod" -ArgumentList '--dbpath "C:\data\MongoDB\data\db"' -WindowStyle Minimized
Start-Sleep -Seconds 3
Write-Host "      MongoDB started" -ForegroundColor Green

# ── 2. Start Backend ──────────────────────────────────────
Write-Host "[2/5] Starting Backend (port 5000)..." -ForegroundColor Yellow
$backendProc = Start-Process "cmd" -ArgumentList "/c cd /d `"$BACKEND`" && npm run dev" -WindowStyle Minimized -PassThru
Start-Sleep -Seconds 4
Write-Host "      Backend started (PID $($backendProc.Id))" -ForegroundColor Green

# ── 3. Start Tunnels ─────────────────────────────────────
Write-Host "[3/5] Starting Cloudflare Tunnels..." -ForegroundColor Yellow

$beTunnelLog = "$ROOT\be-tunnel-live.log"
$feTunnelLog = "$ROOT\fe-tunnel-live.log"

# Clear old logs
"" | Set-Content $beTunnelLog
"" | Set-Content $feTunnelLog

$beTunnel = Start-Process "$ROOT\cloudflared.exe" `
    -ArgumentList "tunnel --url http://localhost:5000" `
    -RedirectStandardError $beTunnelLog `
    -WindowStyle Hidden -PassThru

$feTunnel = Start-Process "$ROOT\cloudflared.exe" `
    -ArgumentList "tunnel --url http://localhost:3000" `
    -RedirectStandardError $feTunnelLog `
    -WindowStyle Hidden -PassThru

Write-Host "      Waiting for tunnel URLs (up to 30s)..." -ForegroundColor Gray

# Poll logs until both URLs appear
$beUrl = $null
$feUrl = $null
$timeout = 30
$elapsed = 0

while ((-not $beUrl -or -not $feUrl) -and $elapsed -lt $timeout) {
    Start-Sleep -Seconds 2
    $elapsed += 2

    if (-not $beUrl) {
        $beLine = Select-String -Path $beTunnelLog -Pattern "trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($beLine) {
            $beUrl = ($beLine.Line -replace '.*\|\s+(\bhttps://[^\s|]+trycloudflare\.com\b).*', '$1').Trim()
            if ($beUrl -notmatch '^https://') { $beUrl = $null }
        }
    }

    if (-not $feUrl) {
        $feLine = Select-String -Path $feTunnelLog -Pattern "trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($feLine) {
            $feUrl = ($feLine.Line -replace '.*\|\s+(\bhttps://[^\s|]+trycloudflare\.com\b).*', '$1').Trim()
            if ($feUrl -notmatch '^https://') { $feUrl = $null }
        }
    }

    Write-Host "      [$elapsed s] BE: $(if($beUrl){$beUrl}else{'waiting...'})  FE: $(if($feUrl){$feUrl}else{'waiting...'})" -ForegroundColor Gray
}

if (-not $beUrl -or -not $feUrl) {
    Write-Host "`n[ERROR] Could not get tunnel URLs. Check cloudflared output." -ForegroundColor Red
    exit 1
}

Write-Host "`n      BE Tunnel: $beUrl" -ForegroundColor Green
Write-Host "      FE Tunnel: $feUrl" -ForegroundColor Green

# ── 4. Update .env files ──────────────────────────────────
Write-Host "`n[4/5] Updating .env files..." -ForegroundColor Yellow

# Update frontend/.env
$frontendEnv = @"
REACT_APP_API_URL=$beUrl/api
REACT_APP_PC_IP=localhost
REACT_APP_FRONTEND_URL=$feUrl
DANGEROUSLY_DISABLE_HOST_CHECK=true
WDS_SOCKET_HOST=localhost
WDS_SOCKET_PORT=3000
HOST=0.0.0.0
"@
$frontendEnv | Set-Content "$FRONTEND\.env" -Encoding UTF8
Write-Host "      frontend/.env updated" -ForegroundColor Green

# Update backend/.env - only update FRONTEND_URL line, keep everything else
$backendEnvPath = "$BACKEND\.env"
$backendEnvContent = Get-Content $backendEnvPath -Raw

# Replace or add FRONTEND_URL
if ($backendEnvContent -match 'FRONTEND_URL=') {
    $backendEnvContent = $backendEnvContent -replace 'FRONTEND_URL=.*', "FRONTEND_URL=$feUrl"
} else {
    $backendEnvContent = $backendEnvContent.TrimEnd() + "`nFRONTEND_URL=$feUrl`n"
}
$backendEnvContent | Set-Content $backendEnvPath -Encoding UTF8 -NoNewline
Write-Host "      backend/.env updated (FRONTEND_URL=$feUrl)" -ForegroundColor Green

# Restart backend to pick up new FRONTEND_URL
Write-Host "      Restarting backend to load new FRONTEND_URL..." -ForegroundColor Gray
Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-Process "cmd" -ArgumentList "/c cd /d `"$BACKEND`" && npm run dev" -WindowStyle Minimized
Start-Sleep -Seconds 3
Write-Host "      Backend restarted" -ForegroundColor Green

# ── 5. Start Frontend ─────────────────────────────────────
Write-Host "[5/5] Starting Frontend (port 3000)..." -ForegroundColor Yellow
Start-Process "cmd" -ArgumentList "/c cd /d `"$FRONTEND`" && npm start" -WindowStyle Minimized
Write-Host "      Frontend compiling (~30-60s)..." -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   ALL SERVICES STARTED SUCCESSFULLY    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Desktop (local):   http://localhost:3000" -ForegroundColor White
Write-Host "  Frontend (public): $feUrl" -ForegroundColor Green
Write-Host "  Backend  (public): $beUrl" -ForegroundColor Green
Write-Host ""
Write-Host "  QR codes will encode:" -ForegroundColor White
Write-Host "  $beUrl/asset/<ID>" -ForegroundColor Yellow
Write-Host "  -> redirects to -> $feUrl/asset/<ID>" -ForegroundColor Yellow
Write-Host ""
Write-Host "  IMPORTANT: Regenerate QR codes after each restart" -ForegroundColor Magenta
Write-Host "             (tunnel URLs change per session)" -ForegroundColor Magenta
Write-Host ""
