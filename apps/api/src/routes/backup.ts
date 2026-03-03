import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';

interface BackupRecord {
  id: string;
  name: string;
  sizeMB: string;
  tables: Record<string, number>;
  createdAt: string;
  createdById: string;
  status: 'completed' | 'failed';
}

/**
 * Database backup routes.
 *
 * Backups are stored as JSON snapshots in a dedicated BackupSnapshot table.
 * Each snapshot contains a full export of all application data (objects, fields,
 * layouts, records, users, accounts, reports, dashboards).
 *
 * This avoids needing filesystem access or pg_dump, which aren't available in
 * Railway's containerised environment.
 */
export async function backupRoutes(app: FastifyInstance) {
  // ------- helpers -------

  async function exportAllData(): Promise<{ tables: Record<string, any[]>; counts: Record<string, number> }> {
    const [
      users,
      objects,
      fields,
      relationships,
      layouts,
      layoutTabs,
      layoutSections,
      layoutFields,
      records,
      reports,
      dashboards,
      loginEvents,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.customObject.findMany(),
      prisma.customField.findMany(),
      prisma.relationship.findMany(),
      prisma.pageLayout.findMany(),
      prisma.layoutTab.findMany(),
      prisma.layoutSection.findMany(),
      prisma.layoutField.findMany(),
      prisma.record.findMany(),
      prisma.report.findMany(),
      prisma.dashboard.findMany(),
      prisma.loginEvent.findMany(),
    ]);

    const tables: Record<string, any[]> = {
      users,
      objects,
      fields,
      relationships,
      layouts,
      layoutTabs,
      layoutSections,
      layoutFields,
      records,
      reports,
      dashboards,
      loginEvents,
    };

    const counts: Record<string, number> = {};
    for (const [key, arr] of Object.entries(tables)) {
      counts[key] = arr.length;
    }

    return { tables, counts };
  }

  // ------- Ensure BackupSnapshot table exists (uses raw SQL) -------
  async function ensureBackupTable() {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BackupSnapshot" (
        "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "name"        TEXT NOT NULL,
        "data"        JSONB NOT NULL DEFAULT '{}',
        "sizeMB"      TEXT NOT NULL DEFAULT '0',
        "tables"      JSONB NOT NULL DEFAULT '{}',
        "status"      TEXT NOT NULL DEFAULT 'completed',
        "createdById" TEXT NOT NULL,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // ------- Routes -------

  // Create a new backup
  app.post('/admin/backup', async (req, reply) => {
    const userId = (req as any).user.sub;

    try {
      await ensureBackupTable();

      const { tables, counts } = await exportAllData();
      const jsonStr = JSON.stringify(tables);
      const sizeMB = (Buffer.byteLength(jsonStr, 'utf8') / 1024 / 1024).toFixed(2);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = `backup-${timestamp}`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO "BackupSnapshot" ("id", "name", "data", "sizeMB", "tables", "status", "createdById", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2::jsonb, $3, $4::jsonb, 'completed', $5, NOW())`,
        name,
        jsonStr,
        sizeMB,
        JSON.stringify(counts),
        userId,
      );

      // Rotate: keep only last 30 snapshots
      await prisma.$executeRawUnsafe(`
        DELETE FROM "BackupSnapshot"
        WHERE "id" NOT IN (
          SELECT "id" FROM "BackupSnapshot"
          ORDER BY "createdAt" DESC
          LIMIT 30
        )
      `);

      reply.send({
        success: true,
        name,
        sizeMB,
        tables: counts,
      });
    } catch (error: any) {
      req.log.error(error, 'Backup failed');
      reply.code(500).send({ error: error.message });
    }
  });

  // List all backups (metadata only, no data payload)
  app.get('/admin/backups', async (req, reply) => {
    try {
      await ensureBackupTable();

      const backups = await prisma.$queryRawUnsafe<BackupRecord[]>(`
        SELECT "id", "name", "sizeMB", "tables", "status", "createdById", "createdAt"
        FROM "BackupSnapshot"
        ORDER BY "createdAt" DESC
        LIMIT 50
      `);

      reply.send({ backups });
    } catch (error: any) {
      req.log.error(error, 'Failed to list backups');
      reply.code(500).send({ error: error.message });
    }
  });

  // Download a specific backup (full JSON data)
  app.get('/admin/backups/:backupId', async (req, reply) => {
    const { backupId } = req.params as { backupId: string };

    try {
      await ensureBackupTable();

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "name", "data", "sizeMB", "tables", "status", "createdAt"
         FROM "BackupSnapshot" WHERE "id" = $1 LIMIT 1`,
        backupId,
      );

      if (!rows.length) {
        return reply.code(404).send({ error: 'Backup not found' });
      }

      const backup = rows[0];
      reply
        .header('Content-Type', 'application/json')
        .header('Content-Disposition', `attachment; filename="${backup.name}.json"`)
        .send(backup.data);
    } catch (error: any) {
      req.log.error(error, 'Failed to download backup');
      reply.code(500).send({ error: error.message });
    }
  });

  // Delete a backup
  app.delete('/admin/backups/:backupId', async (req, reply) => {
    const { backupId } = req.params as { backupId: string };

    try {
      await ensureBackupTable();

      const result = await prisma.$executeRawUnsafe(
        `DELETE FROM "BackupSnapshot" WHERE "id" = $1`,
        backupId,
      );

      if (result === 0) {
        return reply.code(404).send({ error: 'Backup not found' });
      }

      reply.send({ success: true });
    } catch (error: any) {
      req.log.error(error, 'Failed to delete backup');
      reply.code(500).send({ error: error.message });
    }
  });

  // Restore from a backup
  app.post('/admin/backups/:backupId/restore', async (req, reply) => {
    const { backupId } = req.params as { backupId: string };

    try {
      await ensureBackupTable();

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "data" FROM "BackupSnapshot" WHERE "id" = $1 LIMIT 1`,
        backupId,
      );

      if (!rows.length) {
        return reply.code(404).send({ error: 'Backup not found' });
      }

      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;

      // Restore in correct order (respects foreign key constraints)
      // 1. Delete existing data (reverse dependency order)
      await prisma.$transaction([
        prisma.loginEvent.deleteMany(),
        prisma.record.deleteMany(),
        prisma.layoutField.deleteMany(),
        prisma.layoutSection.deleteMany(),
        prisma.layoutTab.deleteMany(),
        prisma.pageLayout.deleteMany(),
        prisma.relationship.deleteMany(),
        prisma.customField.deleteMany(),
        prisma.customObject.deleteMany(),
        prisma.dashboard.deleteMany(),
        prisma.report.deleteMany(),
        // Note: Users are NOT deleted — we keep current users intact
      ]);

      // 2. Re-insert data (forward dependency order)
      if (data.objects?.length) {
        await prisma.customObject.createMany({ data: data.objects, skipDuplicates: true });
      }
      if (data.fields?.length) {
        await prisma.customField.createMany({ data: data.fields, skipDuplicates: true });
      }
      if (data.relationships?.length) {
        await prisma.relationship.createMany({ data: data.relationships, skipDuplicates: true });
      }
      if (data.layouts?.length) {
        await prisma.pageLayout.createMany({ data: data.layouts, skipDuplicates: true });
      }
      if (data.layoutTabs?.length) {
        await prisma.layoutTab.createMany({ data: data.layoutTabs, skipDuplicates: true });
      }
      if (data.layoutSections?.length) {
        await prisma.layoutSection.createMany({ data: data.layoutSections, skipDuplicates: true });
      }
      if (data.layoutFields?.length) {
        await prisma.layoutField.createMany({ data: data.layoutFields, skipDuplicates: true });
      }
      if (data.records?.length) {
        await prisma.record.createMany({ data: data.records, skipDuplicates: true });
      }
      if (data.reports?.length) {
        await prisma.report.createMany({ data: data.reports, skipDuplicates: true });
      }
      if (data.dashboards?.length) {
        await prisma.dashboard.createMany({ data: data.dashboards, skipDuplicates: true });
      }

      reply.send({ success: true, message: `Database restored from backup` });
    } catch (error: any) {
      req.log.error(error, 'Restore failed');
      reply.code(500).send({ error: error.message });
    }
  });
}
