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
  usedFallback?: boolean;
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
  let mainFallbackPool: pg.Pool | null = null;

  function buildPool(connStr: string): pg.Pool {
    const needsSsl =
      !!connStr &&
      !connStr.includes('sslmode=disable') &&
      !connStr.includes('.railway.internal');
    return new Pool({
      connectionString: connStr,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
    });
  }

  function getBackupPool(): pg.Pool {
    if (backupPool) return backupPool;
    const env = loadEnv();
    // If BACKUP_DATABASE_URL is set, validate it refers to a different host than
    // the main DB before using it. A stale BACKUP_DATABASE_URL pointing at a
    // deleted Railway service would cause all backup requests to fail with
    // connection errors. Fall back to the main DATABASE_URL in that case.
    let connStr = env.DATABASE_URL;
    if (env.BACKUP_DATABASE_URL) {
      try {
        const backupHost = new URL(env.BACKUP_DATABASE_URL).hostname;
        const mainHost = new URL(env.DATABASE_URL).hostname;
        if (backupHost === mainHost) {
          // Same host — backup DB is just the main DB, use it directly
          connStr = env.BACKUP_DATABASE_URL;
        } else {
          connStr = env.BACKUP_DATABASE_URL;
        }
      } catch {
        app.log.warn('[backup] BACKUP_DATABASE_URL is not a valid URL — falling back to main DATABASE_URL');
      }
    }
    const pool = buildPool(connStr);
    pool.on('error', (err) => {
      app.log.warn({ err }, '[backup] Backup pool error — will reconnect on next request');
      backupPool = null;
    });
    backupPool = pool;
    return backupPool;
  }

  /** Returns a pool pointed at the MAIN database — used as last-resort failsafe. */
  function getMainPool(): pg.Pool {
    if (mainFallbackPool) return mainFallbackPool;
    const env = loadEnv();
    const pool = buildPool(env.DATABASE_URL);
    pool.on('error', () => { mainFallbackPool = null; });
    mainFallbackPool = pool;
    return mainFallbackPool;
  }

  // ------- helpers -------

  // Once ensured in this process lifetime, skip redundant DDL on every request
  let backupTableEnsured = false;
  let mainTableEnsured = false;

  const CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS "BackupSnapshot" (
      "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name"        TEXT NOT NULL,
      "type"        TEXT NOT NULL DEFAULT 'manual',
      "data"        JSONB NOT NULL DEFAULT '{}',
      "sizeMB"      TEXT NOT NULL DEFAULT '0',
      "tables"      JSONB NOT NULL DEFAULT '{}',
      "status"      TEXT NOT NULL DEFAULT 'completed',
      "usedFallback" BOOLEAN NOT NULL DEFAULT false,
      "createdById" TEXT NOT NULL,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const ADD_TYPE_COL_SQL = `ALTER TABLE "BackupSnapshot" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'manual';`;
  const ADD_FALLBACK_COL_SQL = `ALTER TABLE "BackupSnapshot" ADD COLUMN IF NOT EXISTS "usedFallback" BOOLEAN NOT NULL DEFAULT false;`;

  async function ensureTableOnPool(pool: pg.Pool, flag: 'backup' | 'main'): Promise<void> {
    try {
      await pool.query(CREATE_TABLE_SQL);
      await pool.query(ADD_TYPE_COL_SQL);
      await pool.query(ADD_FALLBACK_COL_SQL);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') throw err;
    }
    if (flag === 'backup') backupTableEnsured = true;
    else mainTableEnsured = true;
  }

  async function ensureBackupTable() {
    if (backupTableEnsured) return;
    await ensureTableOnPool(getBackupPool(), 'backup');
  }

  async function ensureMainTable() {
    if (mainTableEnsured) return;
    await ensureTableOnPool(getMainPool(), 'main');
  }

  async function exportAllData(): Promise<{ tables: Record<string, any[]>; counts: Record<string, number> }> {
    const [
      users,
      profiles,
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
      reportFolders,
      dashboards,
      dashboardWidgets,
      settings,
      userPreferences,
      integrations,
      userIntegrations,
      loginEvents,
      auditLogs,
      widgetSettings,
      triggerSettings,
      controllerSettings,
      specPresets,
      specVariants,
      specConditions,
      tokenMappings,
      quoteTemplates,
      brandLogos,
      brandFonts,
      brandColors,
      productLogs,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.profile.findMany(),
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
      prisma.reportFolder.findMany(),
      prisma.dashboard.findMany(),
      prisma.dashboardWidget.findMany(),
      prisma.setting.findMany(),
      prisma.userPreference.findMany(),
      prisma.integration.findMany(),
      prisma.userIntegration.findMany(),
      prisma.loginEvent.findMany(),
      prisma.auditLog.findMany(),
      prisma.widgetSetting.findMany(),
      prisma.triggerSetting.findMany(),
      prisma.controllerSetting.findMany(),
      prisma.specPreset.findMany(),
      prisma.specVariant.findMany(),
      prisma.specCondition.findMany(),
      prisma.tokenMapping.findMany(),
      prisma.quoteTemplate.findMany(),
      prisma.brandLogo.findMany(),
      prisma.brandFont.findMany(),
      prisma.brandColor.findMany(),
      prisma.productLog.findMany(),
    ]);

    const tables: Record<string, any[]> = {
      users,
      profiles,
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
      reportFolders,
      dashboards,
      dashboardWidgets,
      settings,
      userPreferences,
      integrations,
      userIntegrations,
      loginEvents,
      auditLogs,
      widgetSettings,
      triggerSettings,
      controllerSettings,
      specPresets,
      specVariants,
      specConditions,
      tokenMappings,
      quoteTemplates,
      brandLogos,
      brandFonts,
      brandColors,
      productLogs,
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
  ): Promise<{ name: string; sizeMB: string; tables: Record<string, number>; usedFallback?: boolean }> {
    const env = loadEnv();
    const hasDedicatedBackupDb = !!env.BACKUP_DATABASE_URL;

    const { tables, counts } = await exportAllData();
    const jsonStr = JSON.stringify(tables);
    const sizeMB = (Buffer.byteLength(jsonStr, 'utf8') / 1024 / 1024).toFixed(2);

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const label = type === 'manual' ? 'backup' : type === 'daily' ? 'daily-backup' : 'weekly-backup';
    const name = `${label}-${timestamp}`;

    const INSERT_SQL = `
      INSERT INTO "BackupSnapshot" ("id", "name", "type", "data", "sizeMB", "tables", "status", "usedFallback", "createdById", "createdAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3::jsonb, $4, $5::jsonb, 'completed', $6, $7, NOW())
    `;

    // --- Attempt 1: dedicated backup database (or main if BACKUP_DATABASE_URL not set) ---
    try {
      await ensureBackupTable();
      await getBackupPool().query(INSERT_SQL, [name, type, jsonStr, sizeMB, JSON.stringify(counts), false, userId]);
      return { name, sizeMB, tables: counts };
    } catch (primaryErr: any) {
      // If there's no dedicated backup DB, the primary IS the main DB — don't double-write.
      if (!hasDedicatedBackupDb) throw primaryErr;

      app.log.warn(
        { err: primaryErr, type },
        'Backup DB write failed — falling back to main database',
      );
      // Reset the broken pool so the next call gets a fresh one.
      backupPool = null;
      backupTableEnsured = false;
    }

    // --- Attempt 2: fall back to main DATABASE_URL ---
    await ensureMainTable();
    await getMainPool().query(INSERT_SQL, [name, type, jsonStr, sizeMB, JSON.stringify(counts), true, userId]);
    return { name, sizeMB, tables: counts, usedFallback: true };
  }

  /**
   * Retention policy:
   *  - daily:  keep 7 most recent
   *  - weekly: keep 4 most recent
   *  - manual: keep 20 most recent
   */
  async function applyRetention() {
    const env = loadEnv();
    const policies: Array<{ type: string; keep: number }> = [
      { type: 'daily', keep: 7 },
      { type: 'weekly', keep: 4 },
      { type: 'manual', keep: 20 },
    ];
    const retentionSql = `
      DELETE FROM "BackupSnapshot"
      WHERE "type" = $1
        AND "id" NOT IN (
          SELECT "id" FROM "BackupSnapshot"
          WHERE "type" = $1
          ORDER BY "createdAt" DESC
          LIMIT $2
        )`;

    // Apply retention on the primary backup pool
    try {
      const pool = getBackupPool();
      for (const { type, keep } of policies) {
        await pool.query(retentionSql, [type, keep]);
      }
    } catch (err) {
      app.log.warn({ err }, 'applyRetention: backup pool failed, skipping');
    }

    // If there's also a fallback table on the main DB, clean that up too
    if (env.BACKUP_DATABASE_URL && mainTableEnsured) {
      try {
        const pool = getMainPool();
        for (const { type, keep } of policies) {
          await pool.query(retentionSql, [type, keep]);
        }
      } catch (err) {
        app.log.warn({ err }, 'applyRetention: main fallback pool failed, skipping');
      }
    }
  }

  /**
   * Queries the backup table, transparently merging results from both pools
   * when fallback snapshots may exist on the main DB.
   */
  async function queryBackupsFromAllPools<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const env = loadEnv();
    const rows: T[] = [];

    try {
      const { rows: r } = await getBackupPool().query<T>(sql, params);
      rows.push(...r);
    } catch (err) {
      app.log.warn({ err }, 'queryBackupsFromAllPools: backup pool failed');
    }

    // If a dedicated backup DB is configured, also check the main DB for any
    // fallback snapshots written there during backup DB outages.
    if (env.BACKUP_DATABASE_URL) {
      try {
        await ensureMainTable();
        const { rows: r } = await getMainPool().query<T>(sql, params);
        // Merge only rows not already present (dedup by id field if available)
        const existingIds = new Set((rows as any[]).map((row: any) => row.id).filter(Boolean));
        for (const row of r) {
          if (!(row as any).id || !existingIds.has((row as any).id)) rows.push(row);
        }
      } catch {
        // non-critical
      }
    }

    return rows;
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

      const rows = await queryBackupsFromAllPools<BackupRecord>(
        `SELECT "id", "name", "type", "sizeMB", "tables", "status", "usedFallback", "createdById", "createdAt"
         FROM "BackupSnapshot"
         ORDER BY "createdAt" DESC
         LIMIT 50`,
      );

      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      reply.send({ backups: rows.slice(0, 50) });
    } catch (error: any) {
      req.log.error(error, 'Failed to list backups');
      reply.code(500).send({ error: error.message });
    }
  });

  // Get backup status / summary
  app.get('/admin/backup/status', async (req, reply) => {
    try {
      await ensureBackupTable();
      const env = loadEnv();

      const allBackups = await queryBackupsFromAllPools<BackupRecord>(
        `SELECT "id", "name", "type", "sizeMB", "status", "createdAt"
         FROM "BackupSnapshot"
         ORDER BY "createdAt" DESC`,
      );

      allBackups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const lastDaily = allBackups.find((b) => b.type === 'daily');
      const lastWeekly = allBackups.find((b) => b.type === 'weekly');
      const lastManual = allBackups.find((b) => b.type === 'manual');
      const dailyCount = allBackups.filter((b) => b.type === 'daily').length;
      const weeklyCount = allBackups.filter((b) => b.type === 'weekly').length;
      const manualCount = allBackups.filter((b) => b.type === 'manual').length;
      const totalSizeMB = allBackups.reduce((s, b) => s + parseFloat(b.sizeMB || '0'), 0).toFixed(2);

      const fallbackCount = allBackups.filter((b) => b.usedFallback).length;

      reply.send({
        usingDedicatedDb: !!env.BACKUP_DATABASE_URL,
        fallbackCount,
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

      const rows = await queryBackupsFromAllPools(
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
      const env = loadEnv();
      let deleted = false;

      // Try backup pool first
      try {
        const { rowCount } = await getBackupPool().query(
          `DELETE FROM "BackupSnapshot" WHERE "id" = $1`,
          [backupId],
        );
        if ((rowCount ?? 0) > 0) deleted = true;
      } catch (err) {
        app.log.warn({ err }, 'delete backup: backup pool failed');
      }

      // Also try main pool if a dedicated backup DB exists (snapshot may live there)
      if (!deleted && env.BACKUP_DATABASE_URL && mainTableEnsured) {
        try {
          const { rowCount } = await getMainPool().query(
            `DELETE FROM "BackupSnapshot" WHERE "id" = $1`,
            [backupId],
          );
          if ((rowCount ?? 0) > 0) deleted = true;
        } catch {
          // non-critical
        }
      }

      if (!deleted) {
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

      const rows = await queryBackupsFromAllPools(
        `SELECT "data" FROM "BackupSnapshot" WHERE "id" = $1 LIMIT 1`,
        [backupId],
      );

      if (!rows.length) {
        return reply.code(404).send({ error: 'Backup not found' });
      }

      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;

      // Get current user ID for remapping orphaned foreign keys
      const currentUserId = req.user!.sub;

      // -----------------------------------------------------------
      // 0. Ensure EVERY user ID referenced anywhere in backup exists
      // -----------------------------------------------------------
      const USER_FK_FIELDS = ['createdById', 'modifiedById', 'lastModifiedById', 'userId', 'actorId', 'deletedById'];

      // Scan all backup tables and collect every referenced user ID
      const referencedUserIds = new Set<string>();
      for (const tableName of Object.keys(data)) {
        const rows = data[tableName];
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          for (const field of USER_FK_FIELDS) {
            if (row[field]) referencedUserIds.add(row[field]);
          }
        }
      }

      // Find which referenced user IDs are missing from the database
      const existingUsers = await prisma.user.findMany({ select: { id: true } });
      const existingIds = new Set(existingUsers.map((u: { id: string }) => u.id));
      const missingIds = [...referencedUserIds].filter(uid => !existingIds.has(uid));

      // Create placeholder users for every missing ID
      for (const uid of missingIds) {
        try {
          await prisma.user.create({
            data: {
              id: uid,
              email: `restored-${uid.substring(0, 8)}-${Date.now()}@placeholder.local`,
              name: 'Restored User',
              passwordHash: '',
              role: 'USER',
            },
          });
        } catch (_e) {
          // Collision — already exists under a different query path, ignore
        }
      }

      // Refresh valid IDs after creates
      const freshUsers = await prisma.user.findMany({ select: { id: true } });
      const validUserIds = new Set(freshUsers.map((u: { id: string }) => u.id));

      // Generic remapper: any user FK that STILL doesn't exist → currentUserId
      const remapUserIds = (rows: any[]) =>
        rows.map((row: any) => {
          const patched = { ...row };
          for (const field of USER_FK_FIELDS) {
            if (patched[field] && !validUserIds.has(patched[field])) {
              patched[field] = currentUserId;
            }
          }
          return patched;
        });

      // Rehydrate any fields that were serialised as { type: "Buffer", data: [...] }
      // back into real Buffer instances so Prisma Bytes columns accept them.
      const rehydrateBuffers = (rows: any[]): any[] =>
        rows.map((row: any) => {
          const patched: any = {};
          for (const [k, v] of Object.entries(row)) {
            if (
              v !== null &&
              typeof v === 'object' &&
              (v as any).type === 'Buffer' &&
              Array.isArray((v as any).data)
            ) {
              patched[k] = Buffer.from((v as any).data);
            } else {
              patched[k] = v;
            }
          }
          return patched;
        });

      // Delete + re-insert run inside ONE interactive transaction. If any insert
      // fails, the deletes roll back too — so a failed restore can never leave the
      // database half-wiped (which previously nuked the proposal builder).
      await prisma.$transaction(
        async (tx) => {
          // 1. Delete existing data (reverse dependency order)
          await tx.auditLog.deleteMany();
          await tx.loginEvent.deleteMany();
          await tx.productLog.deleteMany();
          // Proposal builder (children first)
          await tx.specCondition.deleteMany();
          await tx.specVariant.deleteMany();
          await tx.tokenMapping.deleteMany();
          await tx.specPreset.deleteMany();
          await tx.quoteTemplate.deleteMany();
          // Brand assets
          await tx.brandLogo.deleteMany();
          await tx.brandFont.deleteMany();
          await tx.brandColor.deleteMany();
          // Automation settings
          await tx.widgetSetting.deleteMany();
          await tx.triggerSetting.deleteMany();
          await tx.controllerSetting.deleteMany();
          // Dashboard / report children
          await tx.dashboardWidget.deleteMany();
          await tx.dashboard.deleteMany();
          await tx.report.deleteMany();
          await tx.reportFolder.deleteMany();
          // User preferences & integrations
          await tx.userPreference.deleteMany();
          await tx.userIntegration.deleteMany();
          await tx.integration.deleteMany();
          // Core data
          await tx.record.deleteMany();
          await tx.layoutField.deleteMany();
          await tx.layoutSection.deleteMany();
          await tx.layoutTab.deleteMany();
          await tx.pageLayout.deleteMany();
          await tx.relationship.deleteMany();
          await tx.customField.deleteMany();
          await tx.customObject.deleteMany();
          await tx.setting.deleteMany();

          // 2. Re-insert data (forward dependency order)
          // All rows with createdById / lastModifiedById / userId are remapped
          // so orphaned user references point to the current restoring user.
          if (data.settings?.length) {
            await tx.setting.createMany({ data: data.settings, skipDuplicates: true });
          }
          if (data.objects?.length) {
            await tx.customObject.createMany({ data: remapUserIds(data.objects), skipDuplicates: true });
          }
          if (data.fields?.length) {
            await tx.customField.createMany({ data: remapUserIds(data.fields), skipDuplicates: true });
          }
          if (data.relationships?.length) {
            await tx.relationship.createMany({ data: data.relationships, skipDuplicates: true });
          }
          if (data.layouts?.length) {
            await tx.pageLayout.createMany({ data: remapUserIds(data.layouts), skipDuplicates: true });
          }
          if (data.layoutTabs?.length) {
            await tx.layoutTab.createMany({ data: data.layoutTabs, skipDuplicates: true });
          }
          if (data.layoutSections?.length) {
            await tx.layoutSection.createMany({ data: data.layoutSections, skipDuplicates: true });
          }
          if (data.layoutFields?.length) {
            await tx.layoutField.createMany({ data: data.layoutFields, skipDuplicates: true });
          }
          if (data.records?.length) {
            await tx.record.createMany({ data: remapUserIds(data.records), skipDuplicates: true });
          }
          if (data.reports?.length) {
            await tx.report.createMany({ data: remapUserIds(data.reports), skipDuplicates: true });
          }
          if (data.reportFolders?.length) {
            await tx.reportFolder.createMany({ data: remapUserIds(data.reportFolders), skipDuplicates: true });
          }
          if (data.dashboards?.length) {
            await tx.dashboard.createMany({ data: remapUserIds(data.dashboards), skipDuplicates: true });
          }
          if (data.dashboardWidgets?.length) {
            await tx.dashboardWidget.createMany({ data: data.dashboardWidgets, skipDuplicates: true });
          }
          // Automation settings
          if (data.widgetSettings?.length) {
            await tx.widgetSetting.createMany({ data: remapUserIds(data.widgetSettings), skipDuplicates: true });
          }
          if (data.triggerSettings?.length) {
            await tx.triggerSetting.createMany({ data: remapUserIds(data.triggerSettings), skipDuplicates: true });
          }
          if (data.controllerSettings?.length) {
            await tx.controllerSetting.createMany({ data: remapUserIds(data.controllerSettings), skipDuplicates: true });
          }
          // Integrations
          if (data.integrations?.length) {
            await tx.integration.createMany({ data: remapUserIds(data.integrations), skipDuplicates: true });
          }
          if (data.userIntegrations?.length) {
            await tx.userIntegration.createMany({ data: remapUserIds(data.userIntegrations), skipDuplicates: true });
          }
          // User preferences
          if (data.userPreferences?.length) {
            await tx.userPreference.createMany({ data: remapUserIds(data.userPreferences), skipDuplicates: true });
          }
          // Brand assets (must precede quoteTemplates which FK to brandFont)
          if (data.brandLogos?.length) {
            await tx.brandLogo.createMany({ data: rehydrateBuffers(remapUserIds(data.brandLogos)), skipDuplicates: true });
          }
          if (data.brandFonts?.length) {
            await tx.brandFont.createMany({ data: remapUserIds(data.brandFonts), skipDuplicates: true });
          }
          if (data.brandColors?.length) {
            await tx.brandColor.createMany({ data: remapUserIds(data.brandColors), skipDuplicates: true });
          }
          // Proposal builder (parents first)
          if (data.quoteTemplates?.length) {
            await tx.quoteTemplate.createMany({ data: remapUserIds(data.quoteTemplates), skipDuplicates: true });
          }
          if (data.specPresets?.length) {
            await tx.specPreset.createMany({ data: remapUserIds(data.specPresets), skipDuplicates: true });
          }
          if (data.specVariants?.length) {
            await tx.specVariant.createMany({ data: data.specVariants, skipDuplicates: true });
          }
          if (data.specConditions?.length) {
            await tx.specCondition.createMany({ data: data.specConditions, skipDuplicates: true });
          }
          if (data.tokenMappings?.length) {
            await tx.tokenMapping.createMany({ data: remapUserIds(data.tokenMappings), skipDuplicates: true });
          }
          // Product logs
          if (data.productLogs?.length) {
            await tx.productLog.createMany({ data: remapUserIds(data.productLogs), skipDuplicates: true });
          }
        },
        { timeout: 120000, maxWait: 120000 }
      );

      reply.send({ success: true, message: 'Database restored from backup' });
    } catch (error: any) {
      req.log.error(error, 'Restore failed');
      reply.code(500).send({ error: error.message });
    }
  });
}
