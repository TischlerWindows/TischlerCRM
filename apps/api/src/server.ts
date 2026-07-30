// API server entrypoint — build 2026-06-23b
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env FIRST before any other imports
// Load from the api app directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { buildApp } from './app';
import { ensureCoreObjects } from './ensure-core-objects';
import { ensureUserManagement } from './ensure-user-management';
import { runPendingMigrations } from './run-migrations';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';

const port = Number(process.env.PORT || 4000);
const app = buildApp();

// Last-resort net for errors outside any request (startup, timers, etc.) —
// logs to the same ErrorLog table as route errors and the client reporter,
// then exits so Railway restarts the process with a clean state.
async function logFatal(source: string, err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  app.log.error(error);
  try {
    await prisma.errorLog.create({
      data: {
        id: generateId('ErrorLog'),
        message: error.message.slice(0, 2000),
        stack: error.stack?.slice(0, 8000),
        source: 'server',
        metadata: { origin: source },
      },
    });
  } catch {
    // Never let error-logging itself block shutdown
  }
  process.exit(1);
}
process.on('uncaughtException', (err) => { void logFatal('uncaughtException', err); });
process.on('unhandledRejection', (err) => { void logFatal('unhandledRejection', err); });

// Run raw SQL migrations first, then seed data, then start listening
runPendingMigrations()
  .then(() => ensureCoreObjects())
  .then(() => ensureUserManagement())
  .then(() => {
    return app.listen({ port, host: '0.0.0.0' });
  })
  .then(() => {
    app.log.info(`API listening on ${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
