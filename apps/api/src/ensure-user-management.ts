import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';

// ── Permission building blocks ─────────────────────────────────────────────
const FULL  = { create:true,  read:true, edit:true,  delete:true,  viewAll:true,  modifyAll:true  };
const STD   = { create:true,  read:true, edit:true,  delete:false, viewAll:false, modifyAll:false };
const READ  = { create:false, read:true, edit:false, delete:false, viewAll:true,  modifyAll:false };
const NONE  = { create:false, read:false,edit:false, delete:false, viewAll:false, modifyAll:false };

const OBJECTS = ['leads','opportunities','projects','service','quotes','installations','properties','contacts','companies'] as const;
const APP_KEYS = ['viewReports','exportData','manageUsers','manageProfiles','viewAuditLog','manageIntegrations','manageDepartments','manageCompanySettings','manageSupportTickets'] as const;

function makePerms(
  obj: Record<string, typeof FULL>,
  app: Record<string, boolean>
) {
  return { objects: obj, app };
}

function allObj(template: typeof FULL) {
  return Object.fromEntries(OBJECTS.map(o => [o, { ...template }]));
}

function allApp(value: boolean) {
  return Object.fromEntries(APP_KEYS.map(k => [k, value]));
}

// ── Seed profile definitions ───────────────────────────────────────────────
const SEED_PROFILES = [
  {
    name: 'system_administrator',
    label: 'System Administrator',
    description: 'Full access to all system features and records.',
    isSystem: true,
    grantsAdminAccess: true,
    permissions: makePerms(allObj(FULL), allApp(true)),
  },
  {
    name: 'executive',
    label: 'Executive',
    description: 'Full read access across all objects with broad write access.',
    isSystem: false,
    grantsAdminAccess: false,
    permissions: makePerms(
      Object.fromEntries(OBJECTS.map(o => [o, { read:true, create:true, edit:true, delete:true, viewAll:true, modifyAll:false }])),
      { viewReports:true, exportData:true, manageUsers:false, manageProfiles:false, viewAuditLog:true, manageIntegrations:false, manageDepartments:false, manageCompanySettings:false }
    ),
  },
  {
    name: 'manager',
    label: 'Manager',
    description: 'Standard access plus delete and viewAll on all objects.',
    isSystem: false,
    grantsAdminAccess: false,
    permissions: makePerms(
      Object.fromEntries(OBJECTS.map(o => [o, { read:true, create:true, edit:true, delete:true, viewAll:true, modifyAll:false }])),
      { viewReports:true, exportData:true, manageUsers:false, manageProfiles:false, viewAuditLog:false, manageIntegrations:false, manageDepartments:false, manageCompanySettings:false }
    ),
  },
  {
    name: 'standard_employee',
    label: 'Standard Employee',
    description: 'Standard access for general staff.',
    isSystem: false,
    grantsAdminAccess: false,
    permissions: makePerms(
      { leads:STD, opportunities:STD, projects:{...READ,viewAll:false}, service:{...READ,viewAll:false}, quotes:STD, installations:NONE, properties:{...READ,viewAll:false}, contacts:STD, companies:STD },
      allApp(false)
    ),
  },
  {
    name: 'sales_user',
    label: 'Sales User',
    description: 'Full access to sales objects: Leads, Opportunities, Contacts, Companies.',
    isSystem: false,
    grantsAdminAccess: false,
    permissions: makePerms(
      { leads:FULL, opportunities:FULL, projects:{...READ,viewAll:false}, service:{...READ,viewAll:false}, quotes:{...STD,delete:true,viewAll:true}, installations:NONE, properties:{...READ,viewAll:false}, contacts:{...STD,delete:true,viewAll:true}, companies:{...STD,delete:true,viewAll:true} },
      { viewReports:true, exportData:true, manageUsers:false, manageProfiles:false, viewAuditLog:false, manageIntegrations:false, manageDepartments:false, manageCompanySettings:false }
    ),
  },
  {
    name: 'marketing_user',
    label: 'Marketing User',
    description: 'Full access to Leads and Contacts; read-only Opportunities.',
    isSystem: false,
    grantsAdminAccess: false,
    permissions: makePerms(
      { leads:FULL, opportunities:{...READ,viewAll:false}, projects:{...READ,viewAll:false}, service:{...READ,viewAll:false}, quotes:{...READ,viewAll:false}, installations:NONE, properties:{...READ,viewAll:false}, contacts:{...STD,delete:true,viewAll:true}, companies:{...STD,viewAll:true} },
      { viewReports:true, exportData:true, manageUsers:false, manageProfiles:false, viewAuditLog:false, manageIntegrations:false, manageDepartments:false, manageCompanySettings:false }
    ),
  },
  {
    name: 'read_only',
    label: 'Read Only',
    description: 'Read-only access to all objects.',
    isSystem: true,
    grantsAdminAccess: false,
    permissions: makePerms(allObj(READ), { viewReports:true, exportData:true, manageUsers:false, manageProfiles:false, viewAuditLog:false, manageIntegrations:false, manageDepartments:false, manageCompanySettings:false }),
  },
  {
    name: 'contractor',
    label: 'Contractor',
    description: 'Minimal base access.',
    isSystem: true,
    grantsAdminAccess: false,
    permissions: makePerms(allObj(NONE), allApp(false)),
  },
];

export async function ensureUserManagement() {
  console.log('[UserMgmt] Ensuring profiles...');

  for (const profileDef of SEED_PROFILES) {
    const existing = await prisma.profile.findUnique({ where: { name: profileDef.name } });
    if (!existing) {
      await prisma.profile.create({
        data: {
          id: generateId('Profile'),
          name: profileDef.name,
          label: profileDef.label,
          description: profileDef.description,
          isSystem: profileDef.isSystem,
          grantsAdminAccess: profileDef.grantsAdminAccess,
          permissions: profileDef.permissions,
        },
      });
      console.log(`[UserMgmt] Created profile: ${profileDef.label}`);
    } else if (profileDef.grantsAdminAccess && !existing.grantsAdminAccess) {
      // Ensure grantsAdminAccess is set correctly even if profile already existed
      await prisma.profile.update({ where: { name: profileDef.name }, data: { grantsAdminAccess: true } });
      console.log(`[UserMgmt] Updated grantsAdminAccess for: ${profileDef.label}`);
    }
  }

  // Assign System Administrator profile to admin users without a profile
  const adminProfile = await prisma.profile.findUnique({ where: { name: 'system_administrator' } });
  if (adminProfile) {
    const adminsWithoutProfile = await prisma.user.findMany({
      where: { role: 'ADMIN', profileId: null },
    });
    for (const admin of adminsWithoutProfile) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { profileId: adminProfile.id },
      });
      console.log(`[UserMgmt] Assigned System Administrator profile to ${admin.email}`);
    }
  }

  // Assign Standard Employee profile to non-admin users without a profile
  const standardProfile = await prisma.profile.findUnique({ where: { name: 'standard_employee' } });
  if (standardProfile) {
    const usersWithoutProfile = await prisma.user.findMany({
      where: { profileId: null, role: { not: 'ADMIN' } },
    });
    for (const user of usersWithoutProfile) {
      await prisma.user.update({
        where: { id: user.id },
        data: { profileId: standardProfile.id },
      });
      console.log(`[UserMgmt] Assigned Standard Employee profile to ${user.email}`);
    }
  }

  console.log('[UserMgmt] User management setup complete.');
}
