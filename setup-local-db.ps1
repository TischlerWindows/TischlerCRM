# PostgreSQL Local Setup Script for Windows
# This script installs PostgreSQL and sets up your CRM database

Write-Host "=== PostgreSQL Local Database Setup ===" -ForegroundColor Green
Write-Host ""

# Check if PostgreSQL is already installed
$pgPath = "C:\Program Files\PostgreSQL\15\bin\psql.exe"
if (Test-Path $pgPath) {
    Write-Host "✅ PostgreSQL found at $pgPath" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL not found. Please install PostgreSQL first:" -ForegroundColor Red
    Write-Host "   1. Download: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "   2. Run installer with these settings:" -ForegroundColor Yellow
    Write-Host "      - Password: crm" -ForegroundColor Yellow
    Write-Host "      - Port: 5432" -ForegroundColor Yellow
    Write-Host "   3. After install, re-run this script" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Setting up CRM database..." -ForegroundColor Cyan

# Create environment file for db package
Write-Host "📝 Creating packages\db\.env..." -ForegroundColor Cyan
@'
DATABASE_URL="postgresql://crm:crm@localhost:5432/crm?schema=public"
'@ | Set-Content -Path "packages\db\.env" -Encoding UTF8

# Create environment file for API
Write-Host "📝 Creating apps\api\.env..." -ForegroundColor Cyan
@'
DATABASE_URL="postgresql://crm:crm@localhost:5432/crm?schema=public"
JWT_SECRET="dev-secret-key-change-in-production"
'@ | Set-Content -Path "apps\api\.env" -Encoding UTF8

Write-Host ""
Write-Host "✅ Environment files created" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Make sure PostgreSQL is running" -ForegroundColor Yellow
Write-Host "2. Run: cd packages\db && pnpm prisma:push" -ForegroundColor Yellow
Write-Host "3. Run: cd apps\api && pnpm run seed" -ForegroundColor Yellow
Write-Host "4. Run: pnpm --filter web dev (in new terminal)" -ForegroundColor Yellow
Write-Host "5. Run: pnpm --filter api dev (in another new terminal)" -ForegroundColor Yellow
Write-Host ""
