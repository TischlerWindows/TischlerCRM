# Prints a ready-to-copy DATABASE_URL for local dockerized Postgres
$User = $env:PGUSER
if ([string]::IsNullOrEmpty($User)) { $User = "crm" }
$Pass = $env:PGPASSWORD
if ([string]::IsNullOrEmpty($Pass)) { $Pass = "crm" }
$Host = $env:PGHOST
if ([string]::IsNullOrEmpty($Host)) { $Host = "localhost" }
$Port = $env:PGPORT
if ([string]::IsNullOrEmpty($Port)) { $Port = "5432" }
$Db = $env:PGDATABASE
if ([string]::IsNullOrEmpty($Db)) { $Db = "crm" }

$Conn = "postgresql://$User:$Pass@$Host:$Port/$Db?schema=public"
Write-Output $Conn
