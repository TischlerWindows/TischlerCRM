import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';

const FULL_OBJ_PERMS = { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true };
const STD_OBJ_PERMS = { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false };
const READ_ONLY_OBJ = { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false };
const NO_OBJ_PERMS = { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false };

const CORE_OBJECTS = ['Property', 'Contact', 'Account', 'Product', 'Lead', 'Deal', 'Project', 'Service', 'Quote', 'Installation'];

function buildObjPerms(template: Record<string, boolean>) {
  return Object.fromEntries(CORE_OBJECTS.map(o => [o, { ...template }]));
}

const ALL_APP_PERMS_TRUE: Record<string, boolean> = {
  manageUsers: true, manageRoles: true, manageDepartments: true,
  exportData: true, importData: true, manageReports: true,
  manageDashboards: true, viewSummary: true, viewSetup: true,
  customizeApplication: true, manageSharing: true, viewAllData: true, modifyAllData: true,
};

const SEED_ROLES = [
  {
    name: 'system_administrator',
    label: 'System Administrator',
    description: 'Full access to all features and settings',
    level: 1,
    isSystem: true,
    permissions: {
      objectPermissions: buildObjPerms(FULL_OBJ_PERMS),
      appPermissions: ALL_APP_PERMS_TRUE,
    },
    visibility: {},
  },
  {
    name: 'executive',
    label: 'Executive',
    description: 'Full read access, limited write on all objects',
    level: 2,
    isSystem: false,
    permissions: {
      objectPermissions: Object.fromEntries(CORE_OBJECTS.map(o => [o, { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false }])),
      appPermissions: { ...ALL_APP_PERMS_TRUE, customizeApplication: false, manageSharing: false },
    },
    visibility: {},
  },
  {
    name: 'manager',
    label: 'Manager',
    description: 'Standard access plus delete and viewAll',
    level: 3,
    isSystem: false,
    permissions: {
      objectPermissions: Object.fromEntries(CORE_OBJECTS.map(o => [o, { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false }])),
      appPermissions: {
        manageUsers: false, manageRoles: false, manageDepartments: false,
        exportData: true, importData: true, manageReports: true,
        manageDashboards: true, viewSummary: true, viewSetup: false,
        customizeApplication: false, manageSharing: false, viewAllData: true, modifyAllData: false,
      },
    },
    visibility: {},
  },
  {
    name: 'standard_employee',
    label: 'Standard Employee',
    description: 'Standard access to core CRM features',
    level: 4,
    isSystem: true,
    permissions: {
      objectPermissions: buildObjPerms(STD_OBJ_PERMS),
      appPermissions: {
        manageUsers: false, manageRoles: false, manageDepartments: false,
        exportData: true, importData: false, manageReports: true,
        manageDashboards: true, viewSummary: true, viewSetup: false,
        customizeApplication: false, manageSharing: false, viewAllData: false, modifyAllData: false,
      },
    },
    visibility: {},
  },
  {
    name: 'sales_user',
    label: 'Sales User',
    description: 'Full access to sales objects: Leads, Deals, Contacts, Accounts',
    level: 4,
    isSystem: false,
    permissions: {
      objectPermissions: {
        Property: { ...READ_ONLY_OBJ, viewAll: false },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Product: READ_ONLY_OBJ,
        Lead: { ...FULL_OBJ_PERMS },
        Deal: { ...FULL_OBJ_PERMS },
        Project: { ...READ_ONLY_OBJ, viewAll: false },
        Service: { ...READ_ONLY_OBJ, viewAll: false },
        Quote: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Installation: { ...READ_ONLY_OBJ, viewAll: false },
      },
      appPermissions: {
        manageUsers: false, manageRoles: false, manageDepartments: false,
        exportData: true, importData: false, manageReports: true,
        manageDashboards: true, viewSummary: true, viewSetup: false,
        customizeApplication: false, manageSharing: false, viewAllData: false, modifyAllData: false,
      },
    },
    visibility: {},
  },
  {
    name: 'marketing_user',
    label: 'Marketing User',
    description: 'Full access to Leads and Contacts; read-only Deals',
    level: 4,
    isSystem: false,
    permissions: {
      objectPermissions: {
        Property: { ...READ_ONLY_OBJ, viewAll: false },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Product: READ_ONLY_OBJ,
        Lead: { ...FULL_OBJ_PERMS },
        Deal: { ...READ_ONLY_OBJ, viewAll: false },
        Project: { ...READ_ONLY_OBJ, viewAll: false },
        Service: { ...READ_ONLY_OBJ, viewAll: false },
        Quote: { ...READ_ONLY_OBJ, viewAll: false },
        Installation: { ...READ_ONLY_OBJ, viewAll: false },
      },
      appPermissions: {
        manageUsers: false, manageRoles: false, manageDepartments: false,
        exportData: true, importData: true, manageReports: true,
        manageDashboards: true, viewSummary: true, viewSetup: false,
        customizeApplication: false, manageSharing: false, viewAllData: false, modifyAllData: false,
      },
    },
    visibility: {},
  },
  {
    name: 'read_only',
    label: 'Read Only',
    description: 'Read-only access to all objects',
    level: 5,
    isSystem: true,
    permissions: {
      objectPermissions: buildObjPerms(READ_ONLY_OBJ),
      appPermissions: {
        manageUsers: false, manageRoles: false, manageDepartments: false,
        exportData: true, importData: false, manageReports: false,
        manageDashboards: false, viewSummary: true, viewSetup: false,
        customizeApplication: false, manageSharing: false, viewAllData: true, modifyAllData: false,
      },
    },
    visibility: {},
  },
  {
    name: 'contractor',
    label: 'Contractor',
    description: 'Minimal base access',
    level: 5,
    isSystem: true,
    permissions: {
      objectPermissions: {},
      appPermissions: {
        manageUsers: false, manageRoles: false, manageDepartments: false,
        exportData: false, importData: false, manageReports: false,
        manageDashboards: false, viewSummary: false, viewSetup: false,
        customizeApplication: false, manageSharing: false, viewAllData: false, modifyAllData: false,
      },
    },
    visibility: {},
  },
];

export async function ensureUserManagement() {
  console.log('[UserMgmt] Ensuring roles...');

  for (const roleDef of SEED_ROLES) {
    const existing = await prisma.role.findUnique({ where: { name: roleDef.name } });
    if (!existing) {
      await prisma.role.create({ data: { id: generateId('Role'), ...roleDef } });
      console.log(`[UserMgmt] Created role: ${roleDef.label}`);
    }
  }

  // Assign System Administrator role to admin users without a role
  const adminRole = await prisma.role.findUnique({ where: { name: 'system_administrator' } });
  if (adminRole) {
    const adminsWithoutRole = await prisma.user.findMany({
      where: { role: 'ADMIN', roleId: null },
    });
    for (const admin of adminsWithoutRole) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { roleId: adminRole.id },
      });
      console.log(`[UserMgmt] Assigned System Administrator role to ${admin.email}`);
    }
  }

  // Assign Standard Employee role to non-admin users without a role
  const standardRole = await prisma.role.findUnique({ where: { name: 'standard_employee' } });
  if (standardRole) {
    const usersWithoutRole = await prisma.user.findMany({
      where: { roleId: null, role: { not: 'ADMIN' } },
    });
    for (const user of usersWithoutRole) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId: standardRole.id },
      });
      console.log(`[UserMgmt] Assigned Standard Employee role to ${user.email}`);
    }
  }

  console.log('[UserMgmt] User management setup complete.');
}
