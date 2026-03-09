const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');

async function main() {
  await c.connect();
  
  // Check the password hash for customer user
  const r = await c.query('SELECT email, "passwordHash" FROM "User" WHERE email = $1', ['customer@example.com']);
  console.log('Current hash:', r.rows[0]?.passwordHash?.substring(0, 15) + '...');
  
  // Check what auth method is used
  await c.end();
}

main().catch(console.error);
