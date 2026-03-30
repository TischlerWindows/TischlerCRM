import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';
import crypto from 'crypto';
import { hashPassword, signJwt } from '../auth.js';
import { loadEnv } from '../config.js';
import { logAudit, extractIp } from '../audit.js';
import * as notifications from '../notifications.js';

const createUserSchema = z.object({
  name:         z.string().min(1).max(200).trim(),
  email:        z.string().email().max(255).toLowerCase(),
  title:        z.string().max(200).trim().optional().nullable(),
  phone:        z.string().max(50).trim().optional().nullable(),
  mobilePhone:  z.string().max(50).trim().optional().nullable(),
  nickname:     z.string().max(100).trim().optional().nullable(),
  alias:        z.string().max(50).trim().optional().nullable(),
  departmentId: z.string().min(1).optional().nullable(),
  profileId:    z.string().min(1).optional().nullable(),
  managerId:    z.string().min(1).optional().nullable(),
  timezone:     z.string().max(100).optional().nullable(),
  locale:       z.string().max(20).optional().nullable(),
  password:     z.string().min(8).max(128).optional(),
}).strict();

const updateUserSchema = z.object({
  name:         z.string().min(1).max(200).trim().optional(),
  title:        z.string().max(200).trim().optional().nullable(),
  phone:        z.string().max(50).trim().optional().nullable(),
  mobilePhone:  z.string().max(50).trim().optional().nullable(),
  nickname:     z.string().max(100).trim().optional().nullable(),
  alias:        z.string().max(50).trim().optional().nullable(),
  departmentId: z.string().min(1).optional().nullable(),
  profileId:    z.string().min(1).optional().nullable(),
  managerId:    z.string().min(1).optional().nullable(),
  timezone:     z.string().max(100).optional().nullable(),
  locale:       z.string().max(20).optional().nullable(),
  isActive:     z.boolean().optional(),
}).strict();

const idParam = z.object({ id: z.string().min(1) });
const listQuerySchema = z.object({ includeDeleted: z.enum(['true', 'false']).optional() });

const profileSelect = { select: { id: true, name: true, label: true } } as const;

async function resolveSystemRole(profileId: string | null | undefined): Promise<'ADMIN' | 'USER'> {
  if (!profileId) return 'USER';
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { grantsAdminAccess: true },
  });
  return profile?.grantsAdminAccess ? 'ADMIN' : 'USER';
}

function computeInviteStatus(user: {
  inviteToken: string | null;
  inviteTokenExpiry: Date | null;
  inviteAcceptedAt: Date | null;
  passwordHash: string | null;
}): 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'LEGACY' | 'NOT_SENT' {
  const now = new Date();
  if (user.inviteToken && user.inviteTokenExpiry && user.inviteTokenExpiry > now) return 'PENDING';
  if (user.inviteToken && user.inviteTokenExpiry && user.inviteTokenExpiry <= now) return 'EXPIRED';
  if (user.inviteAcceptedAt) return 'ACCEPTED';
  if (user.passwordHash) return 'LEGACY';
  return 'NOT_SENT';
}

function buildInviteUrl(inviteToken: string): string {
  // M-4: use FRONTEND_URL; fall back to stripping /api from NEXT_PUBLIC_API_URL
  const frontendUrl =
    process.env.FRONTEND_URL ??
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/api\/?$/, '');
  return `${frontendUrl}/auth/accept-invite?token=${inviteToken}`;
}

export async function usersAdminRoutes(app: FastifyInstance) {
  // ── List users ──────────────────────────────────────────────────────────
  app.get('/admin/users', async (req, reply) => {
    const qParsed = listQuerySchema.safeParse(req.query);
    const includeDeleted = qParsed.success && qParsed.data.includeDeleted === 'true';
    const where = includeDeleted ? {} : { deletedAt: null };

    const users = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        title: true, phone: true, lastLoginAt: true, createdAt: true, deletedAt: true,
        inviteToken: true, inviteTokenExpiry: true, inviteAcceptedAt: true, passwordHash: true,
        profile: profileSelect,
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    return reply.send(users.map(u => ({
      ...u,
      passwordHash: undefined,
      inviteStatus: computeInviteStatus(u),
      inviteToken: undefined,
      inviteTokenExpiry: undefined,
    })));
  });

  // ── Get single user ─────────────────────────────────────────────────────
  app.get('/admin/users/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;

    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        title: true, phone: true, mobilePhone: true, nickname: true, alias: true,
        timezone: true, locale: true, lastLoginAt: true, createdAt: true, updatedAt: true,
        inviteToken: true, inviteTokenExpiry: true, inviteSentAt: true, inviteAcceptedAt: true,
        passwordHash: true,
        profile:    { select: { id: true, name: true, label: true, isSystem: true, grantsAdminAccess: true } },
        department: { select: { id: true, name: true } },
        manager:    { select: { id: true, name: true, email: true } },
        createdBy:  { select: { id: true, name: true } },
      },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    // Fetch last modification from audit log
    const lastAudit = await prisma.auditLog.findFirst({
      where: { objectType: 'User', objectId: id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true } } },
    });

    return reply.send({
      ...user,
      passwordHash: undefined,
      inviteStatus: computeInviteStatus(user),
      inviteToken: undefined,
      inviteTokenExpiry: undefined,
      lastModifiedBy: lastAudit?.actor ?? null,
      lastModifiedAt: lastAudit?.createdAt ?? null,
    });
  });

  // ── Create user (invite flow or manual password) ─────────────────────────
  app.post('/admin/users', async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msgs = Object.entries(flat.fieldErrors).map(([f, m]) => `${f}: ${(m as string[]).join(', ')}`);
      return reply.code(400).send({ error: msgs.join('; ') || 'Validation error', details: flat });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.code(409).send({ error: 'Email already registered' });

    const systemRole = await resolveSystemRole(parsed.data.profileId);
    const actorId = (req as any).user.sub;
    const isManualPassword = !!parsed.data.password;

    const commonData = {
      id: generateId('User'),
      email: parsed.data.email,
      name: parsed.data.name,
      role: systemRole,
      title: parsed.data.title ?? null,
      phone: parsed.data.phone ?? null,
      mobilePhone: parsed.data.mobilePhone ?? null,
      nickname: parsed.data.nickname ?? null,
      alias: parsed.data.alias ?? null,
      profileId: parsed.data.profileId ?? null,
      departmentId: parsed.data.departmentId ?? null,
      managerId: parsed.data.managerId ?? null,
      timezone: parsed.data.timezone ?? 'America/New_York',
      locale: parsed.data.locale ?? 'en_US',
      isActive: true,
      createdById: actorId,
    };

    const userSelect = {
      id: true, email: true, name: true, role: true, isActive: true,
      title: true, phone: true, createdAt: true,
      profile: profileSelect,
      department: { select: { id: true, name: true } },
    } as const;

    if (isManualPassword) {
      const user = await prisma.user.create({
        data: {
          ...commonData,
          passwordHash: hashPassword(parsed.data.password!),
          mustChangePassword: true,
        },
        select: userSelect,
      });

      await logAudit({
        actorId,
        action: 'CREATE',
        objectType: 'User',
        objectId: user.id,
        objectName: user.name ?? user.email,
        after: { email: parsed.data.email, name: parsed.data.name, profileId: parsed.data.profileId, manualPassword: true },
        ipAddress: extractIp(req),
      });

      return reply.code(201).send({ user, inviteSent: false });
    }

    // Invite flow (existing behavior)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        ...commonData,
        inviteToken,
        inviteTokenExpiry,
        inviteSentAt: new Date(),
      },
      select: userSelect,
    });

    const inviteUrl = buildInviteUrl(inviteToken);
    const { sent } = await notifications.sendInviteEmail(user, inviteUrl);

    await logAudit({
      actorId,
      action: 'CREATE',
      objectType: 'User',
      objectId: user.id,
      objectName: user.name ?? user.email,
      after: { email: parsed.data.email, name: parsed.data.name, profileId: parsed.data.profileId },
      ipAddress: extractIp(req),
    });

    return reply.code(201).send({ user, inviteUrl: sent ? undefined : inviteUrl, inviteSent: sent });
  });

  // ── Update user ──────────────────────────────────────────────────────────
  app.put('/admin/users/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msgs = Object.entries(flat.fieldErrors).map(([f, m]) => `${f}: ${(m as string[]).join(', ')}`);
      return reply.code(400).send({ error: msgs.join('; ') || 'Validation error', details: flat });
    }

    const existing = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        before[key] = (existing as any)[key];
        after[key] = value;
      }
    }

    // Keep system role in sync with profile assignment
    const roleUpdate: { role?: 'ADMIN' | 'USER' } = {};
    if (parsed.data.profileId !== undefined) {
      roleUpdate.role = await resolveSystemRole(parsed.data.profileId);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { ...parsed.data, ...roleUpdate },
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        title: true, phone: true, mobilePhone: true, nickname: true, alias: true,
        timezone: true, locale: true, lastLoginAt: true, createdAt: true, updatedAt: true,
        inviteToken: true, inviteTokenExpiry: true, inviteSentAt: true, inviteAcceptedAt: true,
        passwordHash: true,
        profile:    { select: { id: true, name: true, label: true, isSystem: true, grantsAdminAccess: true } },
        department: { select: { id: true, name: true } },
        manager:    { select: { id: true, name: true, email: true } },
        createdBy:  { select: { id: true, name: true } },
      },
    });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: 'UPDATE',
      objectType: 'User',
      objectId: user.id,
      objectName: user.name ?? user.email,
      before,
      after,
      ipAddress: extractIp(req),
    });

    // Fetch last modification from audit log
    const lastAudit = await prisma.auditLog.findFirst({
      where: { objectType: 'User', objectId: id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true } } },
    });

    return reply.send({
      ...user,
      passwordHash: undefined,
      inviteStatus: computeInviteStatus(user),
      inviteToken: undefined,
      inviteTokenExpiry: undefined,
      lastModifiedBy: lastAudit?.actor ?? null,
      lastModifiedAt: lastAudit?.createdAt ?? null,
    });
  });

  // ── Admin reset password ─────────────────────────────────────────────────
  app.post('/admin/users/:id/reset-password', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;

    const bodySchema = z.object({ password: z.string().min(8).max(128) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Password must be at least 8 characters' });

    const existing = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashPassword(parsed.data.password),
        mustChangePassword: true,
        inviteToken: null,
        inviteTokenExpiry: null,
        inviteAcceptedAt: existing.inviteAcceptedAt ?? new Date(),
      },
    });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: 'RESET_PASSWORD',
      objectType: 'User',
      objectId: id,
      objectName: existing.name ?? existing.email,
      ipAddress: extractIp(req),
    });

    return reply.send({ success: true });
  });

  // ── Resend invite ────────────────────────────────────────────────────────
  app.post('/admin/users/:id/resend-invite', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;

    const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id },
      data: { inviteToken, inviteTokenExpiry, inviteSentAt: new Date() },
    });

    const inviteUrl = buildInviteUrl(inviteToken);
    const { sent } = await notifications.sendInviteEmail({ id: user.id, name: user.name, email: user.email }, inviteUrl);
    return reply.send({ inviteUrl: sent ? undefined : inviteUrl, inviteSent: sent });
  });

  // ── Freeze / Unfreeze ────────────────────────────────────────────────────
  app.post('/admin/users/:id/freeze', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;

    const existing = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });

    const newActive = !existing.isActive;
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: newActive },
      select: { id: true, isActive: true, name: true, email: true, role: true },
    });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: newActive ? 'UNFREEZE' : 'FREEZE',
      objectType: 'User',
      objectId: id,
      objectName: existing.name ?? existing.email,
      before: { isActive: existing.isActive },
      after: { isActive: newActive },
      ipAddress: extractIp(req),
    });

    return reply.send(user);
  });

  // ── Delete (soft) ─────────────────────────────────────────────────────────
  app.delete('/admin/users/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'User not found' });
    if (existing.deletedAt) return reply.code(204).send();

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
      objectName: existing.name ?? existing.email,
      before: { email: existing.email, name: existing.name, isActive: existing.isActive },
      ipAddress: extractIp(req),
    });

    return reply.code(204).send();
  });

  // ── User permissions (returns profile.permissions directly) ──────────────
  app.get('/admin/users/:id/permissions', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;

    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: { profile: true },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send(user.profile?.permissions ?? {});
  });

  // ── Impersonate user (admin-only) ───────────────────────────────────────
  app.post('/admin/users/:id/impersonate', async (req, reply) => {
    const actor = (req as any).user;
    if (!actor || actor.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only admins can impersonate users' });
    }

    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid user ID' });
    const { id } = pp.data;

    if (id === actor.sub) {
      return reply.code(400).send({ error: 'Cannot impersonate yourself' });
    }

    const target = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: { profile: true },
    });
    if (!target) return reply.code(404).send({ error: 'User not found' });

    const env = loadEnv();
    const role = await resolveSystemRole(target.profileId);
    const token = signJwt({ sub: target.id, role }, env.JWT_SECRET, 60 * 60 * 4); // 4-hour TTL

    await logAudit({
      actorId: actor.sub,
      action: 'UPDATE',
      objectType: 'User',
      objectId: target.id,
      objectName: target.name ?? target.email,
      after: { event: 'admin_impersonate' },
      ipAddress: extractIp(req),
    });

    return reply.send({
      token,
      user: {
        id: target.id,
        email: target.email,
        name: target.name,
        role,
      },
    });
  });
}
