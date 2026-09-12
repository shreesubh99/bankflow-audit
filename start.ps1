Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   BankFlow Audit Intelligence - Startup" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\backend"
Write-Host "Starting FastAPI Backend Server on http://127.0.0.1:8000 ..." -ForegroundColor Yellow
python run_backend.py
