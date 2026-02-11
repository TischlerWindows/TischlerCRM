# PostgreSQL Database Setup Script
# Run this AFTER PostgreSQL is installed and running
# You may need to run PowerShell as Administrator

param(
    [string]$PgUser = "postgres",
    [string]$PgPassword = "crm",
    [string]$DbUser = "crm",
    [string]$DbPassword = "crm",
    [string]$DbName = "crm"
)

Write-Host "=== CRM Database Setup ===" -ForegroundColor Green
Write-Host ""

# Try to find PostgreSQL
$pgBinPaths = @(
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\14\bin",
    "C:\Program Files (x86)\PostgreSQL\15\bin",
    "C:\Program Files (x86)\PostgreSQL\14\bin"
)

$pgBin = $null
foreach ($path in $pgBinPaths) {
    if (Test-Path "$path\psql.exe") {
        $pgBin = $path
        Write-Host "✅ Found PostgreSQL at: $path" -ForegroundColor Green
        break
    }
}

if (-not $pgBin) {
    Write-Host "❌ PostgreSQL not found in standard locations" -ForegroundColor Red
    Write-Host "Please install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

# Create SQL script file
$sqlScript = @"
-- Create CRM database user if it doesn't exist
DO \`$do\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DbUser') THEN
        CREATE USER $DbUser WITH PASSWORD '$DbPassword';
    END IF;
END
\`$do\$;

-- Create database if it doesn't exist
DO \`$do\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DbName') THEN
        CREATE DATABASE $DbName OWNER $DbUser;
    END IF;
END
\`$do\$;

-- Grant privileges
ALTER ROLE $DbUser WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;
"@

$sqlFile = "setup-db.sql"
Set-Content -Path $sqlFile -Value $sqlScript -Encoding UTF8

Write-Host "📝 Running database setup..." -ForegroundColor Cyan
Write-Host ""

# Execute SQL script
try {
    $env:PGPASSWORD = $PgPassword
    & "$pgBin\psql.exe" -U $PgUser -d postgres -f $sqlFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Database setup completed!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Database setup finished with warnings (this might be OK)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error running setup: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  1. cd packages\db" -ForegroundColor White
Write-Host "  2. pnpm prisma:push" -ForegroundColor White
Write-Host "  3. cd ..\..\apps\api" -ForegroundColor White
Write-Host "  4. pnpm run seed" -ForegroundColor White
Write-Host ""
