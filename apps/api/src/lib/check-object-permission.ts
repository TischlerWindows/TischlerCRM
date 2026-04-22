import { prisma } from '@crm/db/client';

export type ObjectPermissionAction = 'read' | 'create' | 'edit' | 'delete';

export async function checkObjectPermission(
  userId: string,
  userRole: string,
  objectApiName: string,
  action: ObjectPermissionAction
): Promise<boolean> {
  if (userRole === 'ADMIN') return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user) return false;

  // Users without a profile have no object permissions assigned; deny by default.
  // A misconfigured user (no profile + non-ADMIN) must fail closed, not open.
  if (!user.profile) return false;

  const profilePerms = (user.profile?.permissions as any) || {};
  const objPerms = profilePerms?.objects?.[objectApiName];
  if (objPerms?.[action]) return true;

  return false;
}
