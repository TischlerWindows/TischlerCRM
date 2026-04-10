/**
 * Workflow Engine
 * Evaluates workflow rules from the OrgSchema on record create/update and
 * executes configured actions (field updates, email alerts, task creation).
 */

import { prisma } from '@crm/db/client';
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id';
import { getAppOnlyToken } from './routes/outlook.js';
import { logAudit, extractIp } from './audit.js';

// ── Types (mirror schema.ts) ──────────────────────────────────────

type WorkflowTriggerType = 'onCreate' | 'onCreateOrEdit' | 'onCreateOrEditToMeetCriteria';

interface ConditionExpr {
  left: string;
  op: string;
  right: any;
}

interface FieldUpdateAction {
  type: 'FieldUpdate';
  fieldApiName: string;
  value: any;
}

interface EmailAlertAction {
  type: 'EmailAlert';
  toField?: string;
  toAddress?: string;
  subject: string;
  body: string;
}

interface TaskAction {
  type: 'Task';
  subject: string;
  priority?: 'High' | 'Normal' | 'Low';
  dueInDays?: number;
  assignToUserId?: string;
  description?: string;
}

type WorkflowAction = FieldUpdateAction | EmailAlertAction | TaskAction;

interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  triggerType: WorkflowTriggerType;
  conditions: ConditionExpr[];
  actions: WorkflowAction[];
}

// ── Condition evaluator ───────────────────────────────────────────

function evaluateCondition(cond: ConditionExpr, data: Record<string, any>): boolean {
  const fieldVal = data[cond.left];
  const target = cond.right;

  switch (cond.op) {
    case '==':  return String(fieldVal ?? '') === String(target ?? '');
    case '!=':  return String(fieldVal ?? '') !== String(target ?? '');
    case '>':   return Number(fieldVal) > Number(target);
    case '<':   return Number(fieldVal) < Number(target);
    case '>=':  return Number(fieldVal) >= Number(target);
    case '<=':  return Number(fieldVal) <= Number(target);
    case 'CONTAINS':
      return typeof fieldVal === 'string' && typeof target === 'string'
        && fieldVal.toLowerCase().includes(target.toLowerCase());
    case 'STARTS_WITH':
      return typeof fieldVal === 'string' && typeof target === 'string'
        && fieldVal.toLowerCase().startsWith(target.toLowerCase());
    case 'IN':
      return Array.isArray(target) && target.includes(fieldVal);
    case 'INCLUDES':
      return Array.isArray(fieldVal) && fieldVal.includes(target);
    default:
      return false;
  }
}

function allConditionsMet(conditions: ConditionExpr[], data: Record<string, any>): boolean {
  if (conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, data));
}

// ── Merge-token replacer ──────────────────────────────────────────

function replaceMergeTokens(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val != null ? String(val) : '';
  });
}

// ── Email sender (reuses MS Graph) ────────────────────────────────

async function sendWorkflowEmail(to: string, subject: string, body: string): Promise<void> {
  const result = await getAppOnlyToken();
  if (!result) {
    console.error('[workflow] Cannot send email — no MS Graph token');
    return;
  }
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(result.senderEmail)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${result.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    }
  );
  if (!res.ok) {
    console.error(`[workflow] Email send failed: ${res.status}`);
  }
}

// ── Action executors ──────────────────────────────────────────────

interface ActionContext {
  objectApi: string;
  recordId: string;
  recordData: Record<string, any>;
  userId: string;
}

async function executeFieldUpdate(
  action: FieldUpdateAction,
  ctx: ActionContext
): Promise<Record<string, any> | null> {
  // Resolve value — supports {{fieldApiName}} merge tokens
  const resolvedValue = typeof action.value === 'string'
    ? replaceMergeTokens(action.value, ctx.recordData)
    : action.value;

  // Return the field update to be applied in batch
  return { [action.fieldApiName]: resolvedValue };
}

async function executeEmailAlert(
  action: EmailAlertAction,
  ctx: ActionContext
): Promise<void> {
  let toAddress = action.toAddress;

  // If toField is set, read the email from the record data
  if (action.toField) {
    const fieldVal = ctx.recordData[action.toField];
    if (typeof fieldVal === 'string' && fieldVal.includes('@')) {
      toAddress = fieldVal;
    }
  }

  if (!toAddress) {
    console.warn(`[workflow] EmailAlert skipped — no recipient`);
    return;
  }

  const subject = replaceMergeTokens(action.subject, ctx.recordData);
  const body = replaceMergeTokens(action.body, ctx.recordData);
  await sendWorkflowEmail(toAddress, subject, body);
}

async function executeTaskAction(
  action: TaskAction,
  ctx: ActionContext
): Promise<void> {
  // Find or verify the "Task" or "Activity" custom object
  const taskObject = await prisma.customObject.findFirst({
    where: {
      apiName: { in: ['Task', 'Activity'], mode: 'insensitive' },
    },
  });

  if (!taskObject) {
    console.warn('[workflow] Task action skipped — no Task/Activity object found');
    return;
  }

  let recordId: string;
  try {
    recordId = generateRecordId(taskObject.apiName);
  } catch {
    registerRecordIdPrefix(taskObject.apiName);
    recordId = generateRecordId(taskObject.apiName);
  }

  const subject = replaceMergeTokens(action.subject, ctx.recordData);
  const description = action.description
    ? replaceMergeTokens(action.description, ctx.recordData)
    : '';

  const dueDate = action.dueInDays
    ? new Date(Date.now() + action.dueInDays * 86400000).toISOString().split('T')[0]
    : undefined;

  const assignee = action.assignToUserId || ctx.userId;

  const taskData: Record<string, any> = {
    subject,
    status: 'Open',
    priority: action.priority || 'Normal',
    relatedObjectApi: ctx.objectApi,
    relatedRecordId: ctx.recordId,
    ...(description && { description }),
    ...(dueDate && { dueDate }),
    assignedToUserId: assignee,
  };

  await prisma.record.create({
    data: {
      id: recordId,
      objectId: taskObject.id,
      data: taskData,
      createdById: ctx.userId,
      modifiedById: ctx.userId,
    },
  });
}

// ── Main entry point ──────────────────────────────────────────────

interface WorkflowInput {
  event: 'create' | 'update';
  objectApi: string;
  recordId: string;
  recordData: Record<string, any>;
  beforeData?: Record<string, any>;
  userId: string;
}

/**
 * Run all active workflow rules for a record event.
 * Returns field updates (if any) that were applied to the record.
 */
export async function runWorkflows(input: WorkflowInput): Promise<Record<string, any> | null> {
  try {
    // Load schema from settings
    const schemaSetting = await prisma.setting.findUnique({
      where: { key: 'tces-object-manager-schema' },
    });
    if (!schemaSetting) return null;

    const orgSchema = schemaSetting.value as any;
    const objectDef = orgSchema?.objects?.find(
      (o: any) => o.apiName.toLowerCase() === input.objectApi.toLowerCase()
    );
    if (!objectDef) return null;

    const rules: WorkflowRule[] = objectDef.workflowRules || [];
    const activeRules = rules.filter(r => r.active);
    if (activeRules.length === 0) return null;

    const ctx: ActionContext = {
      objectApi: input.objectApi,
      recordId: input.recordId,
      recordData: input.recordData,
      userId: input.userId,
    };

    let allFieldUpdates: Record<string, any> = {};

    for (const rule of activeRules) {
      // Check trigger type matches the event
      if (input.event === 'create') {
        // All trigger types fire on create
      } else if (input.event === 'update') {
        if (rule.triggerType === 'onCreate') continue;
        // For 'onCreateOrEditToMeetCriteria', only fire if conditions
        // were NOT met before but ARE met now
        if (rule.triggerType === 'onCreateOrEditToMeetCriteria' && input.beforeData) {
          const metBefore = allConditionsMet(rule.conditions, input.beforeData);
          const metNow = allConditionsMet(rule.conditions, input.recordData);
          if (metBefore || !metNow) continue;
          // Conditions newly met — proceed (skip condition check below)
          await executeRuleActions(rule, ctx, allFieldUpdates);
          continue;
        }
      }

      // Check conditions (AND logic)
      if (!allConditionsMet(rule.conditions, input.recordData)) continue;

      await executeRuleActions(rule, ctx, allFieldUpdates);
    }

    // Apply field updates to the record if any
    if (Object.keys(allFieldUpdates).length > 0) {
      const updatedData = { ...input.recordData, ...allFieldUpdates };
      await prisma.record.update({
        where: { id: input.recordId },
        data: {
          data: updatedData,
          modifiedById: input.userId,
        },
      });
      return allFieldUpdates;
    }

    return null;
  } catch (err) {
    console.error('[workflow] Error executing workflows:', err);
    return null;
  }
}

async function executeRuleActions(
  rule: WorkflowRule,
  ctx: ActionContext,
  allFieldUpdates: Record<string, any>
): Promise<void> {
  for (const action of rule.actions) {
    try {
      switch (action.type) {
        case 'FieldUpdate': {
          const updates = await executeFieldUpdate(action, ctx);
          if (updates) Object.assign(allFieldUpdates, updates);
          break;
        }
        case 'EmailAlert':
          await executeEmailAlert(action, ctx);
          break;
        case 'Task':
          await executeTaskAction(action, ctx);
          break;
      }
    } catch (err) {
      console.error(`[workflow] Action ${action.type} failed for rule "${rule.name}":`, err);
    }
  }
}
