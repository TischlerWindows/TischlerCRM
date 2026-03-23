/**
 * Server-side workflow engine.
 *
 * Evaluates workflow rules defined in the schema JSON after record
 * create / update and executes matching actions (field updates, email
 * alerts, task creation).
 */

import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { sendWorkflowEmail } from './notifications.js';

// ── Types (mirrors apps/web/lib/schema.ts — keep in sync) ──────────

interface ConditionExpr {
  left: string;
  op: string;
  right: any;
}

type WorkflowTriggerType =
  | 'onCreate'
  | 'onCreateOrEdit'
  | 'onCreateOrEditToMeetCriteria';

interface FieldUpdateAction {
  type: 'FieldUpdate';
  fieldApiName: string;
  value: any;
  useFormula?: boolean;
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
  assignToField?: string;
  assignToUserId?: string;
  dueInDays?: number;
  priority?: 'High' | 'Normal' | 'Low';
  description?: string;
}

type WorkflowAction = FieldUpdateAction | EmailAlertAction | TaskAction;

interface WorkflowRule {
  id: string;
  name: string;
  active: boolean;
  triggerType: WorkflowTriggerType;
  conditions: ConditionExpr[];
  actions: WorkflowAction[];
  order?: number;
}

interface ObjectDef {
  apiName: string;
  workflowRules?: WorkflowRule[];
  fields: { apiName: string; type: string }[];
}

// ── Condition evaluator ────────────────────────────────────────────

function resolveValue(data: Record<string, any>, field: string): any {
  if (field in data) return data[field];
  // Strip "Object__" prefix
  const short = field.replace(/^[^_]+__/, '');
  if (short in data) return data[short];
  return undefined;
}

function evaluateCondition(cond: ConditionExpr, data: Record<string, any>): boolean {
  const left = resolveValue(data, cond.left);
  const right = cond.right;

  switch (cond.op) {
    case '==': return left == right;
    case '!=': return left != right;
    case '>':  return Number(left) > Number(right);
    case '<':  return Number(left) < Number(right);
    case '>=': return Number(left) >= Number(right);
    case '<=': return Number(left) <= Number(right);
    case 'CONTAINS':
      return typeof left === 'string' && typeof right === 'string' && left.includes(right);
    case 'STARTS_WITH':
      return typeof left === 'string' && typeof right === 'string' && left.startsWith(right);
    case 'IN':
      return Array.isArray(right) && right.includes(left);
    case 'INCLUDES':
      return Array.isArray(left) && left.includes(right);
    default:
      return false;
  }
}

function allConditionsMet(conditions: ConditionExpr[], data: Record<string, any>): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, data));
}

// ── Merge-token replacement ────────────────────────────────────────

function replaceMergeTokens(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, field) => {
    const val = resolveValue(data, field);
    return val != null ? String(val) : '';
  });
}

// ── Schema loader ──────────────────────────────────────────────────

async function loadObjectSchema(objectApiName: string): Promise<ObjectDef | null> {
  const setting = await prisma.setting.findUnique({
    where: { key: 'tces-object-manager-schema' },
  });
  if (!setting?.value) return null;

  const schema = typeof setting.value === 'string'
    ? JSON.parse(setting.value)
    : setting.value;

  const objects: ObjectDef[] = schema.objects || [];
  return objects.find(o => o.apiName.toLowerCase() === objectApiName.toLowerCase()) || null;
}

// ── Action executors ───────────────────────────────────────────────

async function executeFieldUpdate(
  action: FieldUpdateAction,
  recordId: string,
  currentData: Record<string, any>,
  logger?: { info: (...a: any[]) => void }
): Promise<Record<string, any> | null> {
  const newVal = action.useFormula ? evaluateSimpleFormula(action.value, currentData) : action.value;
  const updated = { ...currentData, [action.fieldApiName]: newVal };
  await prisma.record.update({
    where: { id: recordId },
    data: { data: updated },
  });
  logger?.info({ recordId, field: action.fieldApiName, value: newVal }, 'Workflow: field updated');
  return updated;
}

/** Minimal formula evaluator for field-update expressions (server side) */
function evaluateSimpleFormula(expr: string, data: Record<string, any>): any {
  // Support basic merge: "{{field}}" → value
  const merged = replaceMergeTokens(expr, data);
  // If the whole expression was a single merge token, return the raw value
  if (/^\{\{\w+\}\}$/.test(expr.trim())) {
    return resolveValue(data, expr.trim().slice(2, -2));
  }
  return merged;
}

async function executeEmailAlert(
  action: EmailAlertAction,
  recordData: Record<string, any>,
  logger?: { info: (...a: any[]) => void }
): Promise<void> {
  const to = action.toField ? resolveValue(recordData, action.toField) : action.toAddress;
  if (!to || typeof to !== 'string') {
    logger?.info({ action }, 'Workflow email: no recipient resolved, skipping');
    return;
  }

  const subject = replaceMergeTokens(action.subject, recordData);
  const body = replaceMergeTokens(action.body, recordData);

  try {
    await sendWorkflowEmail(to, subject, body);
    logger?.info({ to, subject }, 'Workflow: email sent');
  } catch (err) {
    logger?.info({ to, err }, 'Workflow: email send failed');
  }
}

async function executeTask(
  action: TaskAction,
  recordData: Record<string, any>,
  triggeredByUserId: string,
  objectId: string,
  logger?: { info: (...a: any[]) => void }
): Promise<void> {
  const subject = replaceMergeTokens(action.subject, recordData);
  const assignTo = action.assignToField
    ? resolveValue(recordData, action.assignToField)
    : (action.assignToUserId || triggeredByUserId);

  const dueDate = action.dueInDays
    ? new Date(Date.now() + action.dueInDays * 86400000).toISOString()
    : undefined;

  // Store as a record on a "Task" object if it exists, otherwise log
  const taskObject = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Task', mode: 'insensitive' } },
  });

  if (taskObject) {
    const taskId = generateId();
    await prisma.record.create({
      data: {
        id: taskId,
        objectId: taskObject.id,
        data: {
          subject,
          status: 'Not Started',
          priority: action.priority || 'Normal',
          description: action.description ? replaceMergeTokens(action.description, recordData) : '',
          dueDate,
          assignedTo: assignTo,
          _workflowGenerated: true,
        } as any,
        createdById: triggeredByUserId,
        modifiedById: triggeredByUserId,
      },
    });
    logger?.info({ subject, assignTo }, 'Workflow: task created');
  } else {
    logger?.info({ subject, assignTo }, 'Workflow: Task object not found, skipping task creation');
  }
}

// ── Main entry point ───────────────────────────────────────────────

export interface WorkflowContext {
  objectApiName: string;
  recordId: string;
  newData: Record<string, any>;
  oldData?: Record<string, any> | null; // null on create
  userId: string;
  objectId: string;
  isCreate: boolean;
  logger?: { info: (...a: any[]) => void };
}

/**
 * Run all active workflow rules for a record event.
 *
 * Returns the (possibly mutated) record data after field-update actions.
 */
export async function runWorkflows(ctx: WorkflowContext): Promise<Record<string, any>> {
  const { objectApiName, recordId, newData, oldData, userId, objectId, isCreate, logger } = ctx;

  let objectDef: ObjectDef | null;
  try {
    objectDef = await loadObjectSchema(objectApiName);
  } catch (err) {
    logger?.info({ err }, 'Workflow: failed to load schema');
    return newData;
  }

  if (!objectDef?.workflowRules || objectDef.workflowRules.length === 0) {
    return newData;
  }

  // Sort by order (lower first), then by name
  const rules = [...objectDef.workflowRules]
    .filter(r => r.active)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name));

  let currentData = { ...newData };

  for (const rule of rules) {
    // Check trigger type
    if (rule.triggerType === 'onCreate' && !isCreate) continue;

    // For "onCreateOrEditToMeetCriteria", conditions must be newly met
    if (rule.triggerType === 'onCreateOrEditToMeetCriteria' && !isCreate) {
      const metNow = allConditionsMet(rule.conditions, currentData);
      const metBefore = oldData ? allConditionsMet(rule.conditions, oldData) : false;
      if (!metNow || metBefore) continue; // skip if not newly met
    } else {
      // For other types, conditions must be met now
      if (!allConditionsMet(rule.conditions, currentData)) continue;
    }

    logger?.info({ ruleId: rule.id, ruleName: rule.name }, 'Workflow: rule matched');

    // Execute actions
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'FieldUpdate': {
            const updated = await executeFieldUpdate(action, recordId, currentData, logger);
            if (updated) currentData = updated;
            break;
          }
          case 'EmailAlert':
            await executeEmailAlert(action, currentData, logger);
            break;
          case 'Task':
            await executeTask(action, currentData, userId, objectId, logger);
            break;
        }
      } catch (err) {
        logger?.info({ err, ruleId: rule.id, actionType: action.type }, 'Workflow: action failed');
      }
    }
  }

  return currentData;
}
