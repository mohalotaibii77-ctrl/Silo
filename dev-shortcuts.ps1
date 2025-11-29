# Silo Development Shortcuts
# Run this script: . .\dev-shortcuts.ps1
# Then use: k, bb, s, ss, bs

$SiloRoot = "C:\Users\Mohal\OneDrive\Desktop\Silo\Silo-system"

# k - Kill all common development ports (9000, 3000, 8081, 19000-19006)
function k {
    Write-Host "Killing development ports..." -ForegroundColor Yellow
    $ports = @(9000, 3000, 3002, 8081, 19000, 19001, 19002, 19003, 19004, 19005, 19006)
    
    foreach ($port in $ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $processId = $conn.OwningProcess
                $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
                try {
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    Write-Host "  Killed port $port (PID: $processId, Process: $processName)" -ForegroundColor Green
                } catch {
                    Write-Host "  Could not kill port $port" -ForegroundColor Red
                }
            }
        }
    }
    Write-Host "Done!" -ForegroundColor Cyan
}

# bb - Run Backend
function bb {
    Write-Host "Starting Silo Backend..." -ForegroundColor Cyan
    Set-Location "$SiloRoot\backend"
    npm run dev
}

# s - Run SuperAdmin Frontend (Next.js)
function s {
    Write-Host "Starting SuperAdmin Frontend..." -ForegroundColor Cyan
    Set-Location "$SiloRoot\super-admin"
    npm run dev
}

# ss - Run Store Setup (Next.js)
function ss {
    Write-Host "Starting Store Setup..." -ForegroundColor Cyan
    Set-Location "$SiloRoot\store-setup"
    npm run dev
}

# bs - Run Business Frontend (Expo)
function bs {
    Write-Host "Starting Business App (Expo)..." -ForegroundColor Cyan
    Set-Location "$SiloRoot\business-app"
    npm start
}

Write-Host ""
Write-Host "=== Silo Dev Shortcuts Loaded ===" -ForegroundColor Magenta
Write-Host "  k   - Kill all dev ports (9000, 3000, 3002, 8081, 19000+)" -ForegroundColor White
Write-Host "  bb  - Run Backend" -ForegroundColor White
Write-Host "  s   - Run SuperAdmin Frontend (Next.js)" -ForegroundColor White
Write-Host "  ss  - Run Store Setup (Next.js)" -ForegroundColor White
Write-Host "  bs  - Run Business App (Expo)" -ForegroundColor White
Write-Host ""

