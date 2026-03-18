import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type OldPermLevel = 'full' | 'read' | 'none';
const OBJECTS = ['leads','deals','projects','service','quotes','installations','properties','contacts','companies'] as const;
const APP_KEYS = ['viewReports','exportData','manageUsers','manageProfiles','viewAuditLog','manageIntegrations','manageDepartments','manageCompanySettings'] as const;

function convertObjectPerm(level: OldPermLevel) {
  if (level === 'full') return { create: true,  read: true, edit: true,  delete: false, viewAll: true,  modifyAll: false };
  if (level === 'read') return { create: false, read: true, edit: false, delete: false, viewAll: true,  modifyAll: false };
  return                       { create: false, read: false, edit: false, delete: false, viewAll: false, modifyAll: false };
}

async function main() {
  const profiles = await prisma.profile.findMany();
  console.log(`Found ${profiles.length} profiles to migrate`);

  for (const profile of profiles) {
    const old = profile.permissions as any;

    // If it already has the new shape, skip
    if (old && typeof old === 'object' && old.objects && old.app) {
      console.log(`Profile ${profile.name}: already in new format, skipping`);
      continue;
    }

    const oldObj: Record<string, OldPermLevel> = old?.objectPermissions ?? {};
    const oldApp: Record<string, boolean> = old?.appPermissions ?? {};

    const newPerms = {
      objects: Object.fromEntries(
        OBJECTS.map(obj => [obj, convertObjectPerm(oldObj[obj] ?? 'none')])
      ),
      app: Object.fromEntries(
        APP_KEYS.map(key => [key, oldApp[key] ?? false])
      ),
    };

    await prisma.profile.update({
      where: { id: profile.id },
      data: { permissions: newPerms },
    });
    console.log(`Updated profile: ${profile.name}`);
  }

  // Ensure system_administrator has grantsAdminAccess
  const result = await prisma.profile.updateMany({
    where: { name: 'system_administrator' },
    data: { grantsAdminAccess: true },
  });
  console.log(`Set grantsAdminAccess on system_administrator (${result.count} rows updated)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
