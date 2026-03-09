const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');

async function main() {
  await c.connect();
  
  // List all users
  const users = await c.query('SELECT id, email, name, role, "departmentId", "profileId" FROM "User" ORDER BY email');
  console.log('=== USERS ===');
  for (const u of users.rows) {
    console.log(`  ${u.email} | role=${u.role} | dept=${u.departmentId} | profile=${u.profileId}`);
  }

  // For non-admin users, show department permissions
  const nonAdmins = users.rows.filter(u => u.role !== 'ADMIN');
  for (const u of nonAdmins) {
    console.log(`\n=== PERMISSIONS for ${u.email} ===`);
    
    if (u.departmentId) {
      const dept = await c.query('SELECT name, permissions FROM "Department" WHERE id = $1', [u.departmentId]);
      if (dept.rows.length > 0) {
        console.log(`  Department: ${dept.rows[0].name}`);
        console.log(`  Dept perms:`, JSON.stringify(dept.rows[0].permissions, null, 4));
      }
    } else {
      console.log('  No department assigned');
    }
    
    if (u.profileId) {
      const prof = await c.query('SELECT name, permissions FROM "Profile" WHERE id = $1', [u.profileId]);
      if (prof.rows.length > 0) {
        console.log(`  Profile: ${prof.rows[0].name}`);
        console.log(`  Profile perms:`, JSON.stringify(prof.rows[0].permissions, null, 4));
      }
    } else {
      console.log('  No profile assigned');
    }
    
    const ps = await c.query(`
      SELECT ps.name, ps.permissions 
      FROM "PermissionSetAssignment" psa 
      JOIN "PermissionSet" ps ON psa."permissionSetId" = ps.id 
      WHERE psa."userId" = $1
    `, [u.id]);
    if (ps.rows.length > 0) {
      for (const p of ps.rows) {
        console.log(`  PermSet: ${p.name}`);
        console.log(`  PermSet perms:`, JSON.stringify(p.permissions, null, 4));
      }
    } else {
      console.log('  No permission sets');
    }
  }
  
  await c.end();
}

main().catch(console.error);
