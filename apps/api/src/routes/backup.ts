import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import pg from 'pg';
import { loadEnv } from '../config';

const { Pool } = pg;

interface BackupRecord {
  id: string;
  name: string;
  type: 'manual' | 'daily' | 'weekly';
  sizeMB: string;
  tables: Record<string, number>;
  createdAt: string;
  createdById: string;
  status: 'completed' | 'failed';
}

/**
 * Database backup routes.
 *
 * Backups are stored in a SEPARATE PostgreSQL database (BACKUP_DATABASE_URL)
 * to isolate backup storage from the production database.
 * Falls back to the main DATABASE_URL if BACKUP_DATABASE_URL is not set.
 *
 * Retention policy:
 *  - Daily backups: keep the most recent 7
 *  - Weekly backups: keep the most recent 4
 *  - Manual backups: keep the most recent 20
 */
export async function backupRoutes(app: FastifyInstance) {
  // ------- Backup DB connection -------
  let backupPool: pg.Pool | null = null;

  function getBackupPool(): pg.Pool {
    if (backupPool) return backupPool;
    const env = loadEnv();
    const connStr = env.BACKUP_DATABASE_URL || env.DATABASE_URL;
    backupPool = new Pool({
      connectionString: connStr,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    return backupPool;
  }

  // ------- helpers -------

  async function ensureBackupTable() {
    const pool = getBackupPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "BackupSnapshot" (
        "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "name"        TEXT NOT NULL,
        "type"        TEXT NOT NULL DEFAULT 'manual',
        "data"        JSONB NOT NULL DEFAULT '{}',
        "sizeMB"      TEXT NOT NULL DEFAULT '0',
        "tables"      JSONB NOT NULL DEFAULT '{}',
        "status"      TEXT NOT NULL DEFAULT 'completed',
        "createdById" TEXT NOT NULL,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Add type column if missing (migrate existing backups)
    await pool.query(`
      ALTER TABLE "BackupSnapshot" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'manual';
    `);
  }

  async function exportAllData(): Promise<{ tables: Record<string, any[]>; counts: Record<string, number> }> {
    const [
      users,
      roles,
      departments,
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
      settings,
      loginEvents,
      auditLogs,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.role.findMany(),
      prisma.department.findMany(),
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
      prisma.setting.findMany(),
      prisma.loginEvent.findMany(),
      prisma.auditLog.findMany(),
    ]);

    const tables: Record<string, any[]> = {
      users,
      roles,
      departments,
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
      settings,
      loginEvents,
      auditLogs,
    };

    const counts: Record<string, number> = {};
    for (const [key, arr] of Object.entries(tables)) {
      counts[key] = arr.length;
    }

    return { tables, counts };
  }

  async function createBackupSnapshot(
    type: 'manual' | 'daily' | 'weekly',
    userId: string,
  ): Promise<{ name: string; sizeMB: string; tables: Record<string, number> }> {
    await ensureBackupTable();
    const pool = getBackupPool();

    const { tables, counts } = await exportAllData();
    const jsonStr = JSON.stringify(tables);
    const sizeMB = (Buffer.byteLength(jsonStr, 'utf8') / 1024 / 1024).toFixed(2);

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const label = type === 'manual' ? 'backup' : type === 'daily' ? 'daily-backup' : 'weekly-backup';
    const name = `${label}-${timestamp}`;

    await pool.query(
      `INSERT INTO "BackupSnapshot" ("id", "name", "type", "data", "sizeMB", "tables", "status", "createdById", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3::jsonb, $4, $5::jsonb, 'completed', $6, NOW())`,
      [name, type, jsonStr, sizeMB, JSON.stringify(counts), userId],
    );

    return { name, sizeMB, tables: counts };
  }

  /**
   * Retention policy:
   *  - daily:  keep 7 most recent
   *  - weekly: keep 4 most recent
   *  - manual: keep 20 most recent
   */
  async function applyRetention() {
    const pool = getBackupPool();
    const policies: Array<{ type: string; keep: number }> = [
      { type: 'daily', keep: 7 },
      { type: 'weekly', keep: 4 },
      { type: 'manual', keep: 20 },
    ];
    for (const { type, keep } of policies) {
      await pool.query(
        `DELETE FROM "BackupSnapshot"
         WHERE "type" = $1
           AND "id" NOT IN (
             SELECT "id" FROM "BackupSnapshot"
             WHERE "type" = $1
             ORDER BY "createdAt" DESC
             LIMIT $2
           )`,
        [type, keep],
      );
    }
  }

  // ------- Routes -------

  // Create a manual backup
  app.post('/admin/backup', async (req, reply) => {
    const userId = req.user!.sub;
    try {
      const result = await createBackupSnapshot('manual', userId);
      await applyRetention();
      reply.send({ success: true, ...result });
    } catch (error: any) {
      req.log.error(error, 'Backup failed');
      reply.code(500).send({ error: error.message });
    }
  });

  // Scheduled backup endpoint (called by cron)
  // Auth: either admin bearer token OR cron secret header
  app.post('/admin/backup/scheduled', async (req, reply) => {
    const env = loadEnv();

    // Allow cron secret auth as alternative to bearer token
    const cronSecret = (req.headers['x-cron-secret'] || '') as string;
    const isAuthedViaCron = env.BACKUP_CRON_SECRET && cronSecret === env.BACKUP_CRON_SECRET;

    if (!isAuthedViaCron && (!req.user || req.user.role !== 'ADMIN')) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const now = new Date();
      const dayOfWeek = now.getUTCDay(); // 0=Sunday

      // Always create a daily backup
      const userId = req.user?.sub || 'system-cron';
      const daily = await createBackupSnapshot('daily', userId);

      let weekly: { name: string; sizeMB: string; tables: Record<string, number> } | null = null;
      // Create a weekly backup on Sundays
      if (dayOfWeek === 0) {
        weekly = await createBackupSnapshot('weekly', userId);
      }

      await applyRetention();

      reply.send({
        success: true,
        daily,
        weekly: weekly || 'skipped (not Sunday)',
        nextWeekly: dayOfWeek === 0 ? 'just created' : `in ${7 - dayOfWeek} day(s)`,
      });
    } catch (error: any) {
      req.log.error(error, 'Scheduled backup failed');
      reply.code(500).send({ error: error.message });
    }
  });

  // List all backups (metadata only, no data payload)
  app.get('/admin/backups', async (req, reply) => {
    try {
      await ensureBackupTable();
      const pool = getBackupPool();

      const { rows } = await pool.query<BackupRecord>(
        `SELECT "id", "name", "type", "sizeMB", "tables", "status", "createdById", "createdAt"
         FROM "BackupSnapshot"
         ORDER BY "createdAt" DESC
         LIMIT 50`
      );

      reply.send({ backups: rows });
    } catch (error: any) {
      req.log.error(error, 'Failed to list backups');
      reply.code(500).send({ error: error.message });
    }
  });

  // Get backup status / summary
  app.get('/admin/backup/status', async (req, reply) => {
    try {
      await ensureBackupTable();
      const pool = getBackupPool();
      const env = loadEnv();

      const { rows: allBackups } = await pool.query<BackupRecord>(
        `SELECT "id", "name", "type", "sizeMB", "status", "createdAt"
         FROM "BackupSnapshot"
         ORDER BY "createdAt" DESC`
      );

      const lastDaily = allBackups.find((b) => b.type === 'daily');
      const lastWeekly = allBackups.find((b) => b.type === 'weekly');
      const lastManual = allBackups.find((b) => b.type === 'manual');
      const dailyCount = allBackups.filter((b) => b.type === 'daily').length;
      const weeklyCount = allBackups.filter((b) => b.type === 'weekly').length;
      const manualCount = allBackups.filter((b) => b.type === 'manual').length;
      const totalSizeMB = allBackups.reduce((s, b) => s + parseFloat(b.sizeMB || '0'), 0).toFixed(2);

      reply.send({
        usingDedicatedDb: !!env.BACKUP_DATABASE_URL,
        totalBackups: allBackups.length,
        totalSizeMB,
        daily: { count: dailyCount, maxRetained: 7, lastBackup: lastDaily?.createdAt || null },
        weekly: { count: weeklyCount, maxRetained: 4, lastBackup: lastWeekly?.createdAt || null },
        manual: { count: manualCount, maxRetained: 20, lastBackup: lastManual?.createdAt || null },
      });
    } catch (error: any) {
      req.log.error(error, 'Failed to get backup status');
      reply.code(500).send({ error: error.message });
    }
  });

  // Download a specific backup (full JSON data)
  app.get('/admin/backups/:backupId', async (req, reply) => {
    const { backupId } = req.params as { backupId: string };

    try {
      await ensureBackupTable();
      const pool = getBackupPool();

      const { rows } = await pool.query(
        `SELECT "id", "name", "data", "sizeMB", "tables", "status", "createdAt"
         FROM "BackupSnapshot" WHERE "id" = $1 LIMIT 1`,
        [backupId],
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
      const pool = getBackupPool();

      const { rowCount } = await pool.query(
        `DELETE FROM "BackupSnapshot" WHERE "id" = $1`,
        [backupId],
      );

      if (rowCount === 0) {
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
      const pool = getBackupPool();

      const { rows } = await pool.query(
        `SELECT "data" FROM "BackupSnapshot" WHERE "id" = $1 LIMIT 1`,
        [backupId],
      );

      if (!rows.length) {
        return reply.code(404).send({ error: 'Backup not found' });
      }

      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;

      // Get current user ID for remapping orphaned foreign keys
      const currentUserId = req.user!.sub;

      // Collect all existing user IDs so we can remap createdById / lastModifiedById
      // that reference users no longer in the database
      const existingUsers = await prisma.user.findMany({ select: { id: true } });
      const validUserIds = new Set(existingUsers.map((u: { id: string }) => u.id));

      const remapUserIds = (rows: any[]) =>
        rows.map((row: any) => {
          const patched = { ...row };
          if (patched.createdById && !validUserIds.has(patched.createdById)) {
            patched.createdById = currentUserId;
          }
          if (patched.lastModifiedById && !validUserIds.has(patched.lastModifiedById)) {
            patched.lastModifiedById = currentUserId;
          }
          if (patched.userId && !validUserIds.has(patched.userId)) {
            patched.userId = currentUserId;
          }
          return patched;
        });

      // Restore in correct order (respects foreign key constraints)
      // 1. Delete existing data (reverse dependency order)
      await prisma.$transaction([
        prisma.auditLog.deleteMany(),
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
        prisma.setting.deleteMany(),
        // Note: Users, Roles, Departments are NOT deleted — we keep current user management intact
      ]);

      // 2. Re-insert data (forward dependency order)
      // All rows with createdById / lastModifiedById / userId are remapped
      // so orphaned user references point to the current restoring user.
      if (data.settings?.length) {
        await prisma.setting.createMany({ data: data.settings, skipDuplicates: true });
      }
      if (data.objects?.length) {
        await prisma.customObject.createMany({ data: remapUserIds(data.objects), skipDuplicates: true });
      }
      if (data.fields?.length) {
        await prisma.customField.createMany({ data: remapUserIds(data.fields), skipDuplicates: true });
      }
      if (data.relationships?.length) {
        await prisma.relationship.createMany({ data: data.relationships, skipDuplicates: true });
      }
      if (data.layouts?.length) {
        await prisma.pageLayout.createMany({ data: remapUserIds(data.layouts), skipDuplicates: true });
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
        await prisma.record.createMany({ data: remapUserIds(data.records), skipDuplicates: true });
      }
      if (data.reports?.length) {
        await prisma.report.createMany({ data: remapUserIds(data.reports), skipDuplicates: true });
      }
      if (data.dashboards?.length) {
        await prisma.dashboard.createMany({ data: remapUserIds(data.dashboards), skipDuplicates: true });
      }

      reply.send({ success: true, message: 'Database restored from backup' });
    } catch (error: any) {
      req.log.error(error, 'Restore failed');
      reply.code(500).send({ error: error.message });
    }
  });
}
