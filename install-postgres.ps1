# PostgreSQL Download & Install Helper
# Run this in PowerShell as Administrator

Write-Host "=== PostgreSQL Installation Helper ===" -ForegroundColor Green
Write-Host ""
Write-Host "PostgreSQL is not installed. You need to install it manually." -ForegroundColor Yellow
Write-Host ""
Write-Host "Download PostgreSQL 15 (Windows):" -ForegroundColor Cyan
Write-Host "👉 https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Installation settings (IMPORTANT):" -ForegroundColor Yellow
Write-Host "  • Superuser password: crm" -ForegroundColor White
Write-Host "  • Port: 5432" -ForegroundColor White
Write-Host "  • Locale: Default" -ForegroundColor White
Write-Host "  • All other: Accept defaults" -ForegroundColor White
Write-Host ""
Write-Host "After installation:" -ForegroundColor Green
Write-Host "  1. PostgreSQL will start automatically" -ForegroundColor White
Write-Host "  2. Come back and run setup-db.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Need help? Open PowerShell as Admin and run:" -ForegroundColor Cyan
Write-Host "  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor White
Write-Host ""
