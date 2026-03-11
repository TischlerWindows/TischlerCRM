import { prisma } from '@crm/db/client';

const SEED_PROFILES = [
  {
    name: 'System Administrator',
    description: 'Full access to all features and settings',
    isSystemProfile: true,
    permissions: {
      objectPermissions: {
        Property: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Account: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Product: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Lead: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Deal: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Project: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Service: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Quote: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Installation: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
      },
      appPermissions: {
        manageUsers: true,
        manageProfiles: true,
        manageRoles: true,
        exportData: true,
        importData: true,
        manageReports: true,
        manageDashboards: true,
        viewSetup: true,
        customizeApplication: true,
        manageSharing: true,
        viewAllData: true,
        modifyAllData: true,
      },
      tabVisibility: {},
    },
  },
  {
    name: 'Standard User',
    description: 'Standard access to core CRM features',
    isSystemProfile: true,
    permissions: {
      objectPermissions: {
        Property: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Contact: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Product: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Lead: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Deal: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Project: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Service: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Quote: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Installation: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
      },
      appPermissions: {
        manageUsers: false,
        manageProfiles: false,
        manageRoles: false,
        exportData: true,
        importData: false,
        manageReports: true,
        manageDashboards: true,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: false,
        modifyAllData: false,
      },
      tabVisibility: {},
    },
  },
  {
    name: 'Sales User',
    description: 'Full access to sales objects: Leads, Deals, Contacts, Accounts',
    isSystemProfile: false,
    permissions: {
      objectPermissions: {
        Property: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Product: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Lead: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Deal: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Project: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Service: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Quote: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Installation: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
      },
      appPermissions: {
        manageUsers: false,
        manageProfiles: false,
        manageRoles: false,
        exportData: true,
        importData: false,
        manageReports: true,
        manageDashboards: true,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: false,
        modifyAllData: false,
      },
      tabVisibility: {},
    },
  },
  {
    name: 'Marketing User',
    description: 'Full access to Leads and Contacts; read-only Deals',
    isSystemProfile: false,
    permissions: {
      objectPermissions: {
        Property: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Product: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Lead: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Deal: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Project: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Service: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Quote: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Installation: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
      },
      appPermissions: {
        manageUsers: false,
        manageProfiles: false,
        manageRoles: false,
        exportData: true,
        importData: true,
        manageReports: true,
        manageDashboards: true,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: false,
        modifyAllData: false,
      },
      tabVisibility: {},
    },
  },
  {
    name: 'Read Only',
    description: 'Read-only access to all objects',
    isSystemProfile: true,
    permissions: {
      objectPermissions: {
        Property: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Contact: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Account: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Product: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Lead: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Deal: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Project: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Service: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Quote: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Installation: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
      },
      appPermissions: {
        manageUsers: false,
        manageProfiles: false,
        manageRoles: false,
        exportData: true,
        importData: false,
        manageReports: false,
        manageDashboards: false,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: true,
        modifyAllData: false,
      },
      tabVisibility: {},
    },
  },
  {
    name: 'Minimum Access',
    description: 'No object access — minimal base profile',
    isSystemProfile: true,
    permissions: {
      objectPermissions: {},
      appPermissions: {
        manageUsers: false,
        manageProfiles: false,
        manageRoles: false,
        exportData: false,
        importData: false,
        manageReports: false,
        manageDashboards: false,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: false,
        modifyAllData: false,
      },
      tabVisibility: {},
    },
  },
];

const SEED_DEPARTMENTS = [
  {
    name: 'Executive',
    description: 'Executive leadership team',
    permissions: {
      objectPermissions: {
        Property: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Account: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Product: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Lead: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Deal: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Project: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Service: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Quote: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Installation: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
      },
      appPermissions: {
        manageUsers: true, manageProfiles: true, manageDepartments: true,
        exportData: true, importData: true, manageReports: true, manageDashboards: true,
        viewSetup: true, customizeApplication: true, manageSharing: true,
        viewAllData: true, modifyAllData: true,
      },
    },
  },
  {
    name: 'Sales',
    description: 'Sales and business development',
    permissions: {
      objectPermissions: {
        Property: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Product: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Lead: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Deal: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Project: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Service: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Quote: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Installation: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
      },
      appPermissions: {
        manageUsers: false, manageProfiles: false, manageDepartments: false,
        exportData: true, importData: false, manageReports: true, manageDashboards: true,
        viewSetup: false, customizeApplication: false, manageSharing: false,
        viewAllData: false, modifyAllData: false,
      },
    },
  },
  {
    name: 'Marketing',
    description: 'Marketing and communications',
    permissions: {
      objectPermissions: {
        Property: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Product: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Lead: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Deal: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Project: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Service: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Quote: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Installation: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
      },
      appPermissions: {
        manageUsers: false, manageProfiles: false, manageDepartments: false,
        exportData: true, importData: true, manageReports: true, manageDashboards: true,
        viewSetup: false, customizeApplication: false, manageSharing: false,
        viewAllData: false, modifyAllData: false,
      },
    },
  },
  {
    name: 'Operations',
    description: 'Operations and logistics',
    permissions: {
      objectPermissions: {
        Property: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Contact: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false },
        Product: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Lead: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Deal: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Project: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Service: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Quote: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Installation: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
      },
      appPermissions: {
        manageUsers: false, manageProfiles: false, manageDepartments: false,
        exportData: true, importData: false, manageReports: true, manageDashboards: true,
        viewSetup: false, customizeApplication: false, manageSharing: false,
        viewAllData: false, modifyAllData: false,
      },
    },
  },
  {
    name: 'Finance',
    description: 'Finance and accounting',
    permissions: {
      objectPermissions: {
        Property: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Contact: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Account: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Product: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Lead: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Deal: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Project: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Service: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Quote: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Installation: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
      },
      appPermissions: {
        manageUsers: false, manageProfiles: false, manageDepartments: false,
        exportData: true, importData: false, manageReports: true, manageDashboards: true,
        viewSetup: false, customizeApplication: false, manageSharing: false,
        viewAllData: true, modifyAllData: false,
      },
    },
  },
  {
    name: 'Engineering',
    description: 'Engineering and product development',
    permissions: {
      objectPermissions: {
        Property: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Contact: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Account: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Product: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Lead: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Deal: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Project: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Service: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Quote: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Installation: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
      },
      appPermissions: {
        manageUsers: false, manageProfiles: false, manageDepartments: false,
        exportData: true, importData: false, manageReports: true, manageDashboards: true,
        viewSetup: true, customizeApplication: true, manageSharing: false,
        viewAllData: false, modifyAllData: false,
      },
    },
  },
  {
    name: 'Customer Support',
    description: 'Customer support and success',
    permissions: {
      objectPermissions: {
        Property: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Contact: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Product: { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false },
        Lead: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Deal: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Project: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Service: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true },
        Quote: { read: true, create: false, edit: false, delete: false, viewAll: false, modifyAll: false },
        Installation: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
      },
      appPermissions: {
        manageUsers: false, manageProfiles: false, manageDepartments: false,
        exportData: true, importData: false, manageReports: true, manageDashboards: true,
        viewSetup: false, customizeApplication: false, manageSharing: false,
        viewAllData: false, modifyAllData: false,
      },
    },
  },
];

export async function ensureUserManagement() {
  console.log('[UserMgmt] Ensuring profiles and departments...');

  // Seed Profiles
  for (const profile of SEED_PROFILES) {
    const existing = await prisma.profile.findUnique({ where: { name: profile.name } });
    if (!existing) {
      await prisma.profile.create({ data: profile });
      console.log(`[UserMgmt] Created profile: ${profile.name}`);
    }
  }

  // Seed Departments (with permissions)
  for (const dept of SEED_DEPARTMENTS) {
    const existing = await prisma.department.findUnique({ where: { name: dept.name } });
    if (!existing) {
      await prisma.department.create({ data: dept });
      console.log(`[UserMgmt] Created department: ${dept.name}`);
    } else {
      // Update permissions if they were empty
      const existingPerms = existing.permissions as any;
      if (!existingPerms || Object.keys(existingPerms).length === 0) {
        await prisma.department.update({ where: { id: existing.id }, data: { permissions: dept.permissions } });
        console.log(`[UserMgmt] Updated permissions for department: ${dept.name}`);
      }
    }
  }

  // Assign System Administrator profile to any admin users that don't have a profile
  const adminProfile = await prisma.profile.findUnique({ where: { name: 'System Administrator' } });
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

  // Assign Standard User profile to any regular users that don't have a profile
  const standardProfile = await prisma.profile.findUnique({ where: { name: 'Standard User' } });
  if (standardProfile) {
    const usersWithoutProfile = await prisma.user.findMany({
      where: { profileId: null },
    });
    for (const user of usersWithoutProfile) {
      await prisma.user.update({
        where: { id: user.id },
        data: { profileId: standardProfile.id },
      });
      console.log(`[UserMgmt] Assigned Standard User profile to ${user.email}`);
    }
  }

  console.log('[UserMgmt] User management setup complete.');
}
