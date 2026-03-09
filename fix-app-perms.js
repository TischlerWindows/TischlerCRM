const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');

async function main() {
  await c.connect();

  // Update Customer Support dept: deny manageReports, manageDashboards, viewSummary
  const dept = await c.query(`SELECT id, permissions FROM "Department" WHERE name='Customer Support'`);
  const d = dept.rows[0];
  const perms = d.permissions;
  perms.appPermissions.manageReports = false;
  perms.appPermissions.manageDashboards = false;
  perms.appPermissions.viewSummary = false;
  await c.query(`UPDATE "Department" SET permissions=$1 WHERE id=$2`, [JSON.stringify(perms), d.id]);
  console.log('Updated Customer Support dept');

  // Also update Standard User profile
  const prof = await c.query(`SELECT id, permissions FROM "Profile" WHERE name='Standard User'`);
  const p = prof.rows[0];
  const profPerms = p.permissions;
  profPerms.appPermissions.manageReports = false;
  profPerms.appPermissions.manageDashboards = false;
  profPerms.appPermissions.viewSummary = false;
  await c.query(`UPDATE "Profile" SET permissions=$1 WHERE id=$2`, [JSON.stringify(profPerms), p.id]);
  console.log('Updated Standard User profile');

  // Verify
  const check1 = await c.query(`SELECT permissions FROM "Department" WHERE id=$1`, [d.id]);
  console.log('Dept appPermissions:', JSON.stringify(check1.rows[0].permissions.appPermissions));
  const check2 = await c.query(`SELECT permissions FROM "Profile" WHERE id=$1`, [p.id]);
  console.log('Profile appPermissions:', JSON.stringify(check2.rows[0].permissions.appPermissions));

  await c.end();
}
main().catch(console.error);
