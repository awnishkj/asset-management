# Start SSH tunnels for AssetTrack (works from any network)

Write-Host "Starting public tunnels..." -ForegroundColor Cyan

# Kill old SSH tunnels
Get-Process | Where-Object { $_.Name -like "ssh*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start backend tunnel (port 5000)
Write-Host "`nStarting backend tunnel..." -ForegroundColor Yellow
$backendLog = "$PSScriptRoot\backend-tunnel.log"
$backend = Start-Process -FilePath "ssh" `
    -ArgumentList "-o StrictHostKeyChecking=no -R 80:localhost:5000 nokey@localhost.run" `
    -RedirectStandardOutput $backendLog `
    -RedirectStandardError $backendLog `
    -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 8

# Start frontend tunnel (port 3000)
Write-Host "Starting frontend tunnel..." -ForegroundColor Yellow
$frontendLog = "$PSScriptRoot\frontend-tunnel.log"
$frontend = Start-Process -FilePath "ssh" `
    -ArgumentList "-o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run" `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError $frontendLog `
    -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 8

# Extract URLs
$backendUrl = (Get-Content $backendLog -Raw) -match 'https://[a-z0-9]+\.lhr\.life' | Out-Null
$backendUrl = [regex]::Match((Get-Content $backendLog -Raw), 'https://[a-z0-9]+\.lhr\.life').Value

$frontendUrl = [regex]::Match((Get-Content $frontendLog -Raw), 'https://[a-z0-9]+\.lhr\.life').Value

if (-not $backendUrl -or -not $frontendUrl) {
    Write-Host "`nERROR: Could not get tunnel URLs. Check your internet connection." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "Public Tunnels Active!" -ForegroundColor Green
Write-Host "  Backend:  $backendUrl" -ForegroundColor White
Write-Host "  Frontend: $frontendUrl" -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan

# Update frontend .env with tunnel URLs
Write-Host "`nUpdating .env..." -ForegroundColor Yellow
$envPath = "$PSScriptRoot\frontend\.env"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace 'REACT_APP_API_URL=.*', "REACT_APP_API_URL=$backendUrl/api"
$envContent = $envContent -replace 'REACT_APP_FRONTEND_URL=.*', "REACT_APP_FRONTEND_URL=$frontendUrl"
if ($envContent -notmatch 'REACT_APP_FRONTEND_URL') {
    $envContent += "`nREACT_APP_FRONTEND_URL=$frontendUrl"
}
Set-Content $envPath $envContent -NoNewline

Write-Host "`n** IMPORTANT: Restart your frontend server (npm start) for changes to take effect **`n" -ForegroundColor Yellow

Write-Host "Tunnels will stay active until you close this window." -ForegroundColor Cyan
Read-Host "Press Enter to stop tunnels"

Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
Write-Host "Tunnels stopped." -ForegroundColor Green
