# Database Setup Checker
# Run this script to check if PostgreSQL is ready

Write-Host "=== CRM Database Setup Checker ===" -ForegroundColor Cyan
Write-Host ""

# Check 1: .env file
Write-Host "[1/5] Checking .env configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "DATABASE_URL=(.+)") {
        $dbUrl = $matches[1].Trim()
        Write-Host "  ✓ DATABASE_URL found: $dbUrl" -ForegroundColor Green
    } else {
        Write-Host "  ✗ DATABASE_URL not found in .env" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ .env file not found" -ForegroundColor Red
}
Write-Host ""

# Check 2: PostgreSQL port
Write-Host "[2/5] Checking PostgreSQL connectivity..." -ForegroundColor Yellow
$pgTest = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
if ($pgTest.TcpTestSucceeded) {
    Write-Host "  ✓ PostgreSQL is accessible on port 5432" -ForegroundColor Green
} else {
    Write-Host "  ✗ PostgreSQL is not accessible on port 5432" -ForegroundColor Red
    Write-Host "    Please start PostgreSQL or install it" -ForegroundColor Yellow
}
Write-Host ""

# Check 3: Docker
Write-Host "[3/5] Checking Docker availability..." -ForegroundColor Yellow
$dockerInstalled = $false
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $dockerInstalled = $true
        Write-Host "  ✓ Docker is installed: $dockerVersion" -ForegroundColor Green
    }
} catch {
    $dockerInstalled = $false
}

if (-not $dockerInstalled) {
    Write-Host "  ! Docker is not installed" -ForegroundColor Yellow
    Write-Host "    See POSTGRESQL_SETUP.md for alternatives" -ForegroundColor Cyan
}
Write-Host ""

# Check 4: Prisma Client
Write-Host "[4/5] Checking Prisma Client..." -ForegroundColor Yellow
if (Test-Path "node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client") {
    Write-Host "  ✓ Prisma Client is installed" -ForegroundColor Green
} else {
    Write-Host "  ! Prisma Client needs to be generated" -ForegroundColor Yellow
    Write-Host "    Run: cd packages/db; pnpm exec prisma generate" -ForegroundColor Cyan
}
Write-Host ""

# Check 5: Migration status
Write-Host "[5/5] Checking migration readiness..." -ForegroundColor Yellow
if (Test-Path "packages/db/prisma/migrations/add_reports/migration.sql") {
    Write-Host "  ✓ Reports migration file is ready" -ForegroundColor Green
} else {
    Write-Host "  ✗ Reports migration file not found" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
if ($pgTest.TcpTestSucceeded) {
    Write-Host "✓ Database is ready! Run these commands to activate:" -ForegroundColor Green
    Write-Host ""
    Write-Host "  cd packages\db" -ForegroundColor White
    Write-Host "  pnpm exec prisma generate" -ForegroundColor White
    Write-Host "  pnpm exec prisma migrate dev --name add_reports" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "⚠ Database is NOT ready" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Install PostgreSQL (see POSTGRESQL_SETUP.md)" -ForegroundColor White
    Write-Host "2. Or install Docker Desktop and run: docker compose up -d" -ForegroundColor White
    Write-Host "3. Then run this script again" -ForegroundColor White
    Write-Host ""
}
