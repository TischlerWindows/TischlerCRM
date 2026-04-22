import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';
import { logAudit, extractIp } from '../audit.js';

const OBJECTS = ['leads','opportunities','projects','service','quotes','installations','properties','contacts','companies','products'] as const;
const APP_KEYS = [
  'manageUsers','manageProfiles','manageDepartments','manageIntegrations','manageCompanySettings',
  'exportData','importData',
  'viewReports','manageReports','manageDashboards',
  'viewSummary','viewSetup','viewAuditLog',
  'customizeApplication','viewAllData','modifyAllData',
] as const;

const objectPermSchema = z.object({
  create:    z.boolean(),
  read:      z.boolean(),
  edit:      z.boolean(),
  delete:    z.boolean(),
  viewAll:   z.boolean(),
  modifyAll: z.boolean(),
});

const permissionsSchema = z.object({
  objects: z.record(z.enum(OBJECTS), objectPermSchema),
  app:     z.record(z.enum(APP_KEYS), z.boolean()),
});

function applyImplications(perms: z.infer<typeof permissionsSchema>): z.infer<typeof permissionsSchema> {
  for (const obj of Object.values(perms.objects)) {
    if (obj.modifyAll) { obj.viewAll = true; obj.edit = true; obj.read = true; }
    if (obj.viewAll)   { obj.read = true; }
    if (obj.create)    { obj.read = true; }
  }
  return perms;
}

const createProfileSchema = z.object({
  name:        z.string().min(1).max(100).trim(),
  label:       z.string().min(1).max(200).trim(),
  description: z.string().max(1000).optional().nullable(),
  permissions: permissionsSchema.optional(),
}).strict();

const updateProfileSchema = z.object({
  label:             z.string().min(1).max(200).trim().optional(),
  description:       z.string().max(1000).optional().nullable(),
  grantsAdminAccess: z.boolean().optional(),
}).strict();

const idParam = z.object({ id: z.string().min(1) });

const defaultPerms = () => ({
  objects: Object.fromEntries(OBJECTS.map(o => [o, { create:false, read:false, edit:false, delete:false, viewAll:false, modifyAll:false }])),
  app: Object.fromEntries(APP_KEYS.map(k => [k, false])),
});

export async function profilesRoutes(app: FastifyInstance) {
  app.get('/admin/profiles', async (_req, reply) => {
    const profiles = await prisma.profile.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    return reply.send(profiles);
  });

  app.get('/admin/profiles/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid profile ID' });
    const { id } = pp.data;
    const profile = await prisma.profile.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!profile) return reply.code(404).send({ error: 'Profile not found' });
    return reply.send(profile);
  });

  app.get('/admin/profiles/:id/members', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid profile ID' });
    const { id } = pp.data;
    const querySchema = z.object({ includeInactive: z.enum(['true', 'false']).optional() });
    const qp = querySchema.safeParse(req.query);
    const includeInactive = qp.success && qp.data.includeInactive === 'true';
    const whereActive = includeInactive ? {} : { isActive: true };
    const members = await prisma.user.findMany({
      where: { profileId: id, deletedAt: null, ...whereActive },
      select: {
        id: true, name: true, email: true, title: true, isActive: true,
        department: { select: { id: true, name: true } },
        // inviteToken intentionally omitted: it is a bearer credential that would
        // let any authenticated caller hijack pending invitations. Expiry is kept
        // so the admin UI can still render "expires in N days" badges.
        inviteAcceptedAt: true, inviteTokenExpiry: true,
      },
      orderBy: { name: 'asc' },
    });
    return reply.send(members);
  });

  app.post('/admin/profiles', async (req, reply) => {
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid profile data', details: parsed.error.flatten() });
    const data = parsed.data;
    const existing = await prisma.profile.findUnique({ where: { name: data.name } });
    if (existing) return reply.code(409).send({ error: 'A profile with that name already exists' });

    const permissions = data.permissions ? applyImplications(data.permissions) : defaultPerms();
    const profile = await prisma.profile.create({
      data: {
        id: generateId('Profile'),
        name: data.name,
        label: data.label,
        description: data.description ?? null,
        permissions,
        isSystem: false,
        grantsAdminAccess: false,
      },
    });
    await logAudit({
      actorId: (req as any).user.sub,
      action: 'CREATE',
      objectType: 'Profile',
      objectId: profile.id,
      objectName: profile.label,
      after: profile as any,
      ipAddress: extractIp(req),
    });
    return reply.code(201).send(profile);
  });

  app.put('/admin/profiles/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid profile ID' });
    const { id } = pp.data;
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid profile data', details: parsed.error.flatten() });
    const data = parsed.data;
    const existing = await prisma.profile.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Profile not found' });
    if (existing.isSystem) {
      if (data.label !== undefined || data.description !== undefined) {
        return reply.code(403).send({ error: 'System profile name and description cannot be modified' });
      }
      if (data.grantsAdminAccess !== undefined) {
        return reply.code(403).send({ error: 'System profile admin access cannot be modified' });
      }
    }
    const updated = await prisma.profile.update({ where: { id }, data });
    await logAudit({
      actorId: (req as any).user.sub,
      action: 'UPDATE',
      objectType: 'Profile',
      objectId: id,
      objectName: updated.label,
      before: existing as any,
      after: updated as any,
      ipAddress: extractIp(req),
    });
    return reply.send(updated);
  });

  app.put('/admin/profiles/:id/permissions', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid profile ID' });
    const { id } = pp.data;
    const existing = await prisma.profile.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Profile not found' });
    const parsed = permissionsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid permissions data', details: parsed.error.flatten() });
    const permissions = applyImplications(parsed.data);
    const updated = await prisma.profile.update({ where: { id }, data: { permissions } });
    await logAudit({
      actorId: (req as any).user.sub,
      action: 'UPDATE',
      objectType: 'Profile',
      objectId: id,
      objectName: existing.label,
      before: { permissions: existing.permissions } as any,
      after: { permissions } as any,
      ipAddress: extractIp(req),
    });
    return reply.send(updated);
  });

  app.post('/admin/profiles/:id/clone', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid profile ID' });
    const { id } = pp.data;
    const source = await prisma.profile.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ error: 'Profile not found' });
    const clone = await prisma.profile.create({
      data: {
        id: generateId('Profile'),
        name: `${source.name}_copy_${Date.now()}`,
        label: `${source.label} (Copy)`,
        description: source.description,
        permissions: source.permissions ?? defaultPerms(),
        isSystem: false,
        grantsAdminAccess: false,
      },
    });
    await logAudit({
      actorId: (req as any).user.sub,
      action: 'CREATE',
      objectType: 'Profile',
      objectId: clone.id,
      objectName: clone.label,
      after: clone as any,
      ipAddress: extractIp(req),
    });
    return reply.code(201).send(clone);
  });

  app.delete('/admin/profiles/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid profile ID' });
    const { id } = pp.data;
    const existing = await prisma.profile.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) return reply.code(404).send({ error: 'Profile not found' });
    if (existing.isSystem) return reply.code(403).send({ error: 'System profiles cannot be deleted' });
    if (existing._count.users > 0) {
      return reply.code(409).send({ error: `Cannot delete profile with ${existing._count.users} assigned user(s). Reassign them first.` });
    }
    await prisma.profile.delete({ where: { id } });
    await logAudit({
      actorId: (req as any).user.sub,
      action: 'DELETE',
      objectType: 'Profile',
      objectId: id,
      objectName: existing.label,
      before: existing as any,
      ipAddress: extractIp(req),
    });
    return reply.code(204).send();
  });
}
