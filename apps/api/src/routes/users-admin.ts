import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { hashPassword } from '../auth';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  profileId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobilePhone: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  locale: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateUserSchema = createUserSchema.omit({ password: true, email: true }).partial();

export async function usersAdminRoutes(app: FastifyInstance) {
  // List all users with profile, department, role
  app.get('/admin/users', async (req, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        title: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        profile: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
    reply.send(users);
  });

  // Get single user detail
  app.get('/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        title: true,
        phone: true,
        mobilePhone: true,
        timezone: true,
        locale: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        profileId: true,
        departmentId: true,
        managerId: true,
        profile: { select: { id: true, name: true, permissions: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    reply.send(user);
  });

  // Create new user
  app.post('/admin/users', async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.code(409).send({ error: 'Email already registered' });
    const passwordHash = hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: 'USER',
        profileId: parsed.data.profileId,
        departmentId: parsed.data.departmentId,
        managerId: parsed.data.managerId,
        title: parsed.data.title,
        phone: parsed.data.phone,
        mobilePhone: parsed.data.mobilePhone,
        timezone: parsed.data.timezone || 'America/New_York',
        locale: parsed.data.locale || 'en_US',
        isActive: parsed.data.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        profile: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    reply.code(201).send(user);
  });

  // Update user
  app.put('/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        title: true,
        profile: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    reply.send(user);
  });

  // Reset password
  app.post('/admin/users/:id/reset-password', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { password } = req.body as { password?: string };
    if (!password || password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters' });
    }
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });
    const passwordHash = hashPassword(password);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    reply.send({ success: true });
  });

  // Delete user
  app.delete('/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });
    await prisma.user.delete({ where: { id } });
    reply.code(204).send();
  });

  // Freeze / unfreeze user
  app.post('/admin/users/:id/freeze', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: { id: true, isActive: true },
    });
    reply.send(user);
  });

  // Get effective permissions (profile + department merged)
  app.get('/admin/users/:id/permissions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        department: true,
      },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    // Start from profile permissions
    const profilePerms = (user.profile?.permissions as any) || {};
    const objectPerms: Record<string, Record<string, boolean>> = { ...(profilePerms.objectPermissions || {}) };
    const appPerms: Record<string, boolean> = { ...(profilePerms.appPermissions || {}) };
    const fieldPerms: Record<string, Record<string, boolean>> = { ...(profilePerms.fieldPermissions || {}) };

    // Admin department — grant full access to all objects
    const deptPerms = (user.department?.permissions as any) || {};
    if (deptPerms.isAdmin) {
      const allActions = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'];
      const customObjects = await prisma.customObject.findMany({ select: { apiName: true } });
      for (const obj of customObjects) {
        objectPerms[obj.apiName] = Object.fromEntries(allActions.map(a => [a, true]));
      }
      const allAppPermKeys = ['manageUsers', 'manageProfiles', 'manageDepartments', 'exportData', 'importData', 'manageReports', 'manageDashboards', 'viewSummary', 'viewSetup', 'customizeApplication', 'manageSharing', 'viewAllData', 'modifyAllData'];
      for (const p of allAppPermKeys) {
        appPerms[p] = true;
      }
    } else {
      // Apply department ceiling
      if (deptPerms.objectPermissions) {
        for (const [obj, perms] of Object.entries(deptPerms.objectPermissions as Record<string, Record<string, boolean>>)) {
          if (!objectPerms[obj]) objectPerms[obj] = {};
          for (const [action, granted] of Object.entries(perms)) {
            if (!granted) {
              objectPerms[obj][action] = false;
            } else if (!(obj in objectPerms) || !(action in objectPerms[obj])) {
              objectPerms[obj][action] = true;
            }
          }
        }
      }
      if (deptPerms.appPermissions) {
        for (const [perm, granted] of Object.entries(deptPerms.appPermissions as Record<string, boolean>)) {
          if (!granted) {
            appPerms[perm] = false;
          } else if (!(perm in appPerms)) {
            appPerms[perm] = true;
          }
        }
      }
    }

    reply.send({
      userId: id,
      profileName: user.profile?.name || 'No Profile',
      departmentName: user.department?.name || 'No Department',
      effectivePermissions: {
        objectPermissions: objectPerms,
        appPermissions: appPerms,
        fieldPermissions: fieldPerms,
      },
    });
  });
}
