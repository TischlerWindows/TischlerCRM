/**
 * Trigger Engine
 * Executes code-based triggers on record lifecycle events.
 * Runs alongside the existing workflow engine as a complementary system
 * for complex logic that can't be expressed as simple conditions + actions.
 *
 * Opt-OUT model: all registered triggers fire by default. They only stop
 * firing if an admin explicitly disables them in Settings > Automations.
 */

import { prisma } from '@crm/db/client';
import { triggerRegistrations } from '../../triggers/registry.js';
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

  // 2. Load explicitly disabled trigger IDs for this org
  //    Opt-OUT model: triggers fire by default unless disabled
  const disabledIds = new Set<string>();
  try {
    const disabledSettings = await prisma.triggerSetting.findMany({
      where: { orgId, enabled: false },
      select: { triggerId: true },
    });
    for (const s of disabledSettings) disabledIds.add(s.triggerId);
  } catch {
    // Table may not exist yet — treat all triggers as enabled
  }

  // 3. Get all trigger registrations for this object, excluding disabled ones
  const activeRegistrations = triggerRegistrations.filter(
    r => r.manifest.objectApiName === objectApi && !disabledIds.has(r.manifest.id)
  );
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
