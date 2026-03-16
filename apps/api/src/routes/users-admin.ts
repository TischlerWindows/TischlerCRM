import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { hashPassword } from '../auth';
import { logAudit, extractIp } from '../audit';

const createUserSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(6).max(128),
  roleId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  mobilePhone: z.string().max(50).optional().nullable(),
  timezone: z.string().max(100).optional().nullable(),
  locale: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  roleId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  mobilePhone: z.string().max(50).optional().nullable(),
  timezone: z.string().max(100).optional().nullable(),
  locale: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

const uuidParam = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({ includeDeleted: z.enum(['true', 'false']).optional() });

const roleSelect = { select: { id: true, name: true, label: true } };

async function resolveSystemRole(roleId: string | null | undefined): Promise<'ADMIN' | 'USER'> {
  if (!roleId) return 'USER';
  const orgRole = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
  return orgRole?.name === 'system_administrator' ? 'ADMIN' : 'USER';
}

export async function usersAdminRoutes(app: FastifyInstance) {
  app.get('/admin/users', async (req, reply) => {
    const qParsed = listQuerySchema.safeParse(req.query);
    const includeDeleted = qParsed.success && qParsed.data.includeDeleted === 'true';
    const where = includeDeleted ? {} : { deletedAt: null };

    const users = await prisma.user.findMany({
      where,
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
        deletedAt: true,
        orgRole: roleSelect,
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
    reply.send(users);
  });

  app.get('/admin/users/:id', async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;
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
        roleId: true,
        departmentId: true,
        managerId: true,
        deletedAt: true,
        orgRole: { select: { id: true, name: true, label: true, permissions: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    reply.send(user);
  });

  app.post('/admin/users', async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.code(409).send({ error: 'Email already registered' });
    const passwordHash = hashPassword(parsed.data.password);
    const systemRole = await resolveSystemRole(parsed.data.roleId);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: systemRole,
        roleId: parsed.data.roleId,
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
        orgRole: roleSelect,
        department: { select: { id: true, name: true } },
      },
    });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: 'CREATE',
      objectType: 'User',
      objectId: user.id,
      objectName: user.name || user.email,
      after: { email: parsed.data.email, name: parsed.data.name, roleId: parsed.data.roleId, departmentId: parsed.data.departmentId },
      ipAddress: extractIp(req),
    });

    reply.code(201).send(user);
  });

  app.put('/admin/users/:id', async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        before[key] = (existing as any)[key];
        after[key] = value;
      }
    }

    // Keep system role in sync with org role assignment
    const roleUpdate: { role?: 'ADMIN' | 'USER' } = {};
    if (parsed.data.roleId !== undefined) {
      roleUpdate.role = await resolveSystemRole(parsed.data.roleId);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { ...parsed.data, ...roleUpdate },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        title: true,
        orgRole: roleSelect,
        department: { select: { id: true, name: true } },
      },
    });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: 'UPDATE',
      objectType: 'User',
      objectId: user.id,
      objectName: user.name || user.email,
      before,
      after,
      ipAddress: extractIp(req),
    });

    reply.send(user);
  });

  app.post('/admin/users/:id/reset-password', async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;
    const bodySchema = z.object({ password: z.string().min(6).max(128) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Password must be at least 6 characters' });

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });
    const passwordHash = hashPassword(parsed.data.password);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: 'RESET_PASSWORD',
      objectType: 'User',
      objectId: id,
      objectName: existing.name || existing.email,
      ipAddress: extractIp(req),
    });

    reply.send({ success: true });
  });

  app.delete('/admin/users/:id', async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });
    if (existing.deletedAt) return reply.code(400).send({ error: 'User is already deleted' });

    const actorId = (req as any).user.sub;
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actorId, isActive: false },
    });

    await logAudit({
      actorId,
      action: 'DELETE',
      objectType: 'User',
      objectId: id,
      objectName: existing.name || existing.email,
      before: { email: existing.email, name: existing.name, isActive: existing.isActive },
      ipAddress: extractIp(req),
    });

    reply.code(204).send();
  });

  app.post('/admin/users/:id/freeze', async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });

    const newActive = !existing.isActive;
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: newActive },
      select: { id: true, isActive: true },
    });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: newActive ? 'UNFREEZE' : 'FREEZE',
      objectType: 'User',
      objectId: id,
      objectName: existing.name || existing.email,
      before: { isActive: existing.isActive },
      after: { isActive: newActive },
      ipAddress: extractIp(req),
    });

    reply.send(user);
  });

  app.get('/admin/users/:id/permissions', async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        orgRole: true,
        department: true,
      },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const rolePerms = (user.orgRole?.permissions as any) || {};
    const objectPerms: Record<string, Record<string, boolean>> = { ...(rolePerms.objectPermissions || {}) };
    const appPerms: Record<string, boolean> = { ...(rolePerms.appPermissions || {}) };

    const deptPerms = (user.department?.permissions as any) || {};
    if (deptPerms.isAdmin) {
      const allActions = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'];
      const customObjects = await prisma.customObject.findMany({ select: { apiName: true } });
      for (const obj of customObjects) {
        objectPerms[obj.apiName] = Object.fromEntries(allActions.map(a => [a, true]));
      }
      const allAppPermKeys = ['manageUsers', 'manageRoles', 'manageDepartments', 'exportData', 'importData', 'manageReports', 'manageDashboards', 'viewSummary', 'viewSetup', 'customizeApplication', 'manageSharing', 'viewAllData', 'modifyAllData'];
      for (const p of allAppPermKeys) {
        appPerms[p] = true;
      }
    } else {
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
      roleName: user.orgRole?.label || 'No Role',
      departmentName: user.department?.name || 'No Department',
      effectivePermissions: {
        objectPermissions: objectPerms,
        appPermissions: appPerms,
      },
    });
  });
}
