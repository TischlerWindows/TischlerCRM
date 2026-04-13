import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { logAudit, extractIp } from '../audit';

const idParam = z.object({ id: z.string().min(1) });

export async function recycleBinRoutes(app: FastifyInstance) {
  app.get('/admin/recycle-bin', async (req, reply) => {
    const [deletedUsers, deletedDepartments, deletedRecords] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          deletedAt: true,
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.department.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          deletedAt: true,
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.record.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        take: 500,
        include: {
          object: { select: { id: true, apiName: true, label: true } },
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    // Derive a display name from each deleted record's JSON data
    const records = deletedRecords.map((r) => {
      const d = r.data as Record<string, any> | null;
      const objectApi = r.object.apiName;
      const name = d?.name || d?.[`${objectApi}__name`]
        || d?.accountName || d?.[`${objectApi}__accountName`]
        || d?.contactName || d?.[`${objectApi}__contactName`]
        || d?.opportunityName || d?.[`${objectApi}__opportunityName`]
        || d?.leadName || d?.[`${objectApi}__leadName`]
        || d?.projectName || d?.[`${objectApi}__projectName`]
        || d?.productName || d?.[`${objectApi}__productName`]
        || d?.propertyNumber || d?.[`${objectApi}__propertyNumber`]
        || d?.teamMemberNumber || d?.[`${objectApi}__teamMemberNumber`]
        || r.id;
      return {
        id: r.id,
        name: typeof name === 'string' ? name : String(name),
        objectApiName: objectApi,
        objectLabel: r.object.label,
        deletedAt: r.deletedAt,
        deletedBy: r.deletedBy,
      };
    });

    reply.send({ users: deletedUsers, departments: deletedDepartments, records });
  });

  app.post('/admin/recycle-bin/users/:id/restore', async (req, reply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid user ID' });

    const user = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (!user.deletedAt) return reply.code(400).send({ error: 'User is not deleted' });

    const restored = await prisma.user.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null, deletedById: null, isActive: true },
      select: { id: true, name: true, email: true, isActive: true },
    });

    const actorId = req.user!.sub;
    await logAudit({
      actorId,
      action: 'RESTORE',
      objectType: 'User',
      objectId: restored.id,
      objectName: restored.name || restored.email,
      ipAddress: extractIp(req),
    });

    reply.send(restored);
  });

  app.post('/admin/recycle-bin/departments/:id/restore', async (req, reply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid department ID' });

    const dept = await prisma.department.findUnique({ where: { id: parsed.data.id } });
    if (!dept) return reply.code(404).send({ error: 'Department not found' });
    if (!dept.deletedAt) return reply.code(400).send({ error: 'Department is not deleted' });

    const restored = await prisma.department.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null, deletedById: null, isActive: true },
      select: { id: true, name: true },
    });

    const actorId = req.user!.sub;
    await logAudit({
      actorId,
      action: 'RESTORE',
      objectType: 'Department',
      objectId: restored.id,
      objectName: restored.name,
      ipAddress: extractIp(req),
    });

    reply.send(restored);
  });

  // ── Record restore ──
  app.post('/admin/recycle-bin/records/:id/restore', async (req, reply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid record ID' });

    const record = await prisma.record.findUnique({
      where: { id: parsed.data.id },
      include: { object: { select: { apiName: true } } },
    });
    if (!record) return reply.code(404).send({ error: 'Record not found' });
    if (!record.deletedAt) return reply.code(400).send({ error: 'Record is not deleted' });

    await prisma.record.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null, deletedById: null },
    });

    const d = record.data as Record<string, any> | null;
    const objectApi = record.object.apiName;
    const recName = d?.name || d?.[`${objectApi}__name`]
      || d?.accountName || d?.contactName || d?.opportunityName
      || d?.leadName || d?.projectName || d?.productName
      || d?.propertyNumber || d?.teamMemberNumber || record.id;

    const actorId = req.user!.sub;
    await logAudit({
      actorId,
      action: 'RESTORE',
      objectType: objectApi,
      objectId: record.id,
      objectName: typeof recName === 'string' ? recName : String(recName),
      ipAddress: extractIp(req),
    });

    reply.send({ id: record.id, restored: true });
  });

  // ── Permanently delete a record ──
  app.delete('/admin/recycle-bin/records/:id', async (req, reply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid record ID' });

    const record = await prisma.record.findUnique({
      where: { id: parsed.data.id },
      include: { object: { select: { apiName: true } } },
    });
    if (!record) return reply.code(404).send({ error: 'Record not found' });
    if (!record.deletedAt) return reply.code(400).send({ error: 'Record is not in the recycle bin' });

    await prisma.record.delete({ where: { id: parsed.data.id } });

    const d = record.data as Record<string, any> | null;
    const objectApi = record.object.apiName;
    const recName = d?.name || d?.[`${objectApi}__name`]
      || d?.accountName || d?.contactName || d?.opportunityName
      || d?.leadName || d?.projectName || d?.productName
      || d?.propertyNumber || d?.teamMemberNumber || record.id;

    const actorId = req.user!.sub;
    await logAudit({
      actorId,
      action: 'PERMANENT_DELETE',
      objectType: objectApi,
      objectId: record.id,
      objectName: typeof recName === 'string' ? recName : String(recName),
      ipAddress: extractIp(req),
    });

    reply.code(204).send();
  });
}
