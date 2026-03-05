// Ensure DATABASE_URL is set for prisma generate (it validates env vars but doesn't connect)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://placeholder@localhost/placeholder';
}
const { execSync } = require('child_process');
execSync('npx prisma generate', { stdio: 'inherit', env: process.env, cwd: __dirname });
