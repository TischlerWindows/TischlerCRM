# Database Migration Deployment Script (PowerShell)
# Usage: .\deploy-migrations.ps1 -DatabaseUrl "postgresql://user:password@host:5432/crm"

param(
    [Parameter(Mandatory=$true)]
    [string]$DatabaseUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$WorkingDirectory = (Get-Location)
)

$env:DATABASE_URL = $DatabaseUrl

Write-Host "🔄 Checking migration status..." -ForegroundColor Cyan

Push-Location "packages/db"

# Check status
Write-Host "Running: pnpm prisma migrate status" -ForegroundColor Gray
pnpm prisma migrate status

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration status check failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ""
Write-Host "📋 Applying pending migrations..." -ForegroundColor Cyan
pnpm prisma migrate deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ All migrations applied successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Final status:" -ForegroundColor Cyan
    pnpm prisma migrate status
    Pop-Location
    exit 0
} else {
    Write-Host "❌ Migration deployment failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
