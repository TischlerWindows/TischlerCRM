/**
 * Trigger Engine
 * Executes code-based triggers on record lifecycle events.
 * Runs alongside the existing workflow engine as a complementary system
 * for complex logic that can't be expressed as simple conditions + actions.
 */

import { prisma } from '@crm/db/client';
import { getActiveTriggers } from './registry-loader.js';
import type { TriggerEvent, TriggerContext } from './types.js';

interface RunTriggersInput {
  event: 'create' | 'update' | 'delete'
  phase: 'before' | 'after'
  objectApi: string
  recordId: string
  recordData: Record<string, any>
  beforeData?: Record<string, any>
  userId: string
  orgId: string
}

/**
 * Executes all active triggers matching the given object and event.
 * Returns merged field updates to apply to the record, or null.
 */
export async function runTriggers(input: RunTriggersInput): Promise<Record<string, any> | null> {
  const { event, phase, objectApi, recordId, recordData, beforeData, userId, orgId } = input;

  // 1. Map phase + event to TriggerEvent
  const triggerEvent = `${phase}${event.charAt(0).toUpperCase()}${event.slice(1)}` as TriggerEvent;

  // 2. Load enabled trigger IDs for this org
  let enabledSettings: Array<{ triggerId: string }>;
  try {
    enabledSettings = await prisma.triggerSetting.findMany({
      where: { orgId, enabled: true },
      select: { triggerId: true },
    });
  } catch {
    // Table may not exist yet during development; fail silently
    return null;
  }

  if (enabledSettings.length === 0) return null;

  const enabledIds = enabledSettings.map(s => s.triggerId);

  // 3. Get active trigger registrations for this object
  const activeRegistrations = getActiveTriggers(objectApi, enabledIds);
  if (activeRegistrations.length === 0) return null;

  // 4. Filter to triggers that listen for this specific event
  const matchingRegistrations = activeRegistrations.filter(
    r => r.manifest.events.includes(triggerEvent)
  );
  if (matchingRegistrations.length === 0) return null;

  // 5. Build context
  const ctx: TriggerContext = {
    event: triggerEvent,
    objectApi,
    recordId,
    recordData,
    beforeData,
    userId,
    orgId,
  };

  // 6. Execute handlers sequentially, merge field updates (last wins)
  let mergedUpdates: Record<string, any> | null = null;

  for (const registration of matchingRegistrations) {
    try {
      const result = await registration.handler(ctx);
      if (result) {
        mergedUpdates = { ...(mergedUpdates ?? {}), ...result };
      }
    } catch (err) {
      // Log and continue — one failing trigger should not block others
      console.error(
        `[trigger-engine] Trigger "${registration.manifest.id}" failed on ${triggerEvent} for ${objectApi}/${recordId}:`,
        err
      );
    }
  }

  return mergedUpdates;
}
