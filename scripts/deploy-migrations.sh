#!/bin/bash
# Database Migration Deployment Script
# Usage: ./deploy-migrations.sh <database_url>

if [ -z "$1" ]; then
  echo "Usage: $0 <database_url>"
  echo "Example: $0 'postgresql://user:password@host:5432/crm'"
  exit 1
fi

DATABASE_URL="$1"
export DATABASE_URL

echo "🔄 Checking migration status..."
cd packages/db

# Check status
pnpm prisma migrate status

if [ $? -ne 0 ]; then
  echo "❌ Migration status check failed"
  exit 1
fi

echo ""
echo "📋 Applying pending migrations..."
pnpm prisma migrate deploy

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All migrations applied successfully!"
  echo ""
  echo "📊 Final status:"
  pnpm prisma migrate status
else
  echo "❌ Migration deployment failed"
  exit 1
fi
