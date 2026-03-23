'use client';

import { useState, useEffect } from 'react';
import {
  Zap, Plus, Trash2, ChevronDown, ChevronUp, Power, PowerOff,
  Save, AlertCircle, Check, Pencil, Copy, GripVertical
} from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';
import type {
  WorkflowRule, WorkflowAction, WorkflowTriggerType,
  ConditionExpr, FieldUpdateAction, EmailAlertAction, TaskAction
} from '@/lib/schema';

interface WorkflowTriggersProps {
  objectApiName: string;
}

const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  onCreate: 'Only when a record is created',
  onCreateOrEdit: 'Every time a record is created or edited',
  onCreateOrEditToMeetCriteria: 'When created, or edited to subsequently meet criteria',
};

const OP_LABELS: Record<string, string> = {
  '==': 'equals',
  '!=': 'not equal to',
  '>': 'greater than',
  '<': 'less than',
  '>=': 'greater or equal',
  '<=': 'less or equal',
  'CONTAINS': 'contains',
  'STARTS_WITH': 'starts with',
  'IN': 'in',
};

const OPS = Object.keys(OP_LABELS);

// ── Main component ─────────────────────────────────────────────────

export default function WorkflowTriggers({ objectApiName }: WorkflowTriggersProps) {
  const { schema, addWorkflowRule, updateWorkflowRule, deleteWorkflowRule } = useSchemaStore();
  const object = schema?.objects.find(o => o.apiName === objectApiName);

  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  if (!object) return null;

  const rules = object.workflowRules || [];
  const fields = object.fields;

  const toggleExpanded = (id: string) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNew = () => {
    setEditingRule({
      id: '',
      name: '',
      description: '',
      active: true,
      triggerType: 'onCreate',
      conditions: [],
      actions: [],
    });
    setIsNew(true);
  };

  const handleEdit = (rule: WorkflowRule) => {
    setEditingRule({ ...rule, actions: rule.actions.map(a => ({ ...a })), conditions: rule.conditions.map(c => ({ ...c })) });
    setIsNew(false);
  };

  const handleDuplicate = (rule: WorkflowRule) => {
    setEditingRule({
      ...rule,
      id: '',
      name: `${rule.name} (Copy)`,
      actions: rule.actions.map(a => ({ ...a })),
      conditions: rule.conditions.map(c => ({ ...c })),
    });
    setIsNew(true);
  };

  const handleSave = () => {
    if (!editingRule || !editingRule.name.trim()) return;
    if (isNew) {
      addWorkflowRule(objectApiName, editingRule);
    } else {
      updateWorkflowRule(objectApiName, editingRule.id, editingRule);
    }
    setEditingRule(null);
    setIsNew(false);
  };

  const handleDelete = (ruleId: string) => {
    deleteWorkflowRule(objectApiName, ruleId);
  };

  const handleToggleActive = (rule: WorkflowRule) => {
    updateWorkflowRule(objectApiName, rule.id, { active: !rule.active });
  };

  // ── Editing form ────────────────────────────────────────────────

  if (editingRule) {
    return (
      <WorkflowRuleEditor
        rule={editingRule}
        setRule={setEditingRule}
        fields={fields}
        onSave={handleSave}
        onCancel={() => { setEditingRule(null); setIsNew(false); }}
        isNew={isNew}
      />
    );
  }

  // ── Rule list ───────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Workflow Rules</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Automate field updates, email alerts, and task creation when records change.
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">No workflow rules yet</h4>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Create workflow rules to automatically update fields, send emails, or create tasks
            when records are created or modified.
          </p>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={cn(
                'bg-white rounded-xl border transition-colors',
                rule.active ? 'border-gray-200' : 'border-gray-200 opacity-60'
              )}
            >
              {/* Rule header */}
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  onClick={() => toggleExpanded(rule.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {expandedRules.has(rule.id) ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Zap className={cn('w-4 h-4', rule.active ? 'text-amber-500' : 'text-gray-400')} />
                    <span className="text-sm font-semibold text-gray-900 truncate">{rule.name}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      rule.active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    )}>
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {TRIGGER_LABELS[rule.triggerType]} •{' '}
                    {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''} •{' '}
                    {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    title={rule.active ? 'Deactivate' : 'Activate'}
                  >
                    {rule.active ? (
                      <Power className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <PowerOff className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(rule)}
                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expandedRules.has(rule.id) && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                  {rule.description && (
                    <p className="text-sm text-gray-600">{rule.description}</p>
                  )}

                  {/* Conditions */}
                  {rule.conditions.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Conditions (all must be true)
                      </h5>
                      <div className="space-y-1">
                        {rule.conditions.map((c, i) => (
                          <div key={i} className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-1.5">
                            <span className="font-medium">{c.left}</span>{' '}
                            <span className="text-gray-500">{OP_LABELS[c.op] || c.op}</span>{' '}
                            <span className="font-medium">{JSON.stringify(c.right)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div>
                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Actions
                    </h5>
                    <div className="space-y-1">
                      {rule.actions.map((action, i) => (
                        <ActionSummary key={i} action={action} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Action summary badge ───────────────────────────────────────────

function ActionSummary({ action }: { action: WorkflowAction }) {
  switch (action.type) {
    case 'FieldUpdate':
      return (
        <div className="text-sm text-gray-700 bg-blue-50 rounded px-3 py-1.5">
          <span className="font-medium text-blue-700">Field Update:</span>{' '}
          Set <span className="font-mono text-xs">{action.fieldApiName}</span> to{' '}
          <span className="font-medium">{JSON.stringify(action.value)}</span>
        </div>
      );
    case 'EmailAlert':
      return (
        <div className="text-sm text-gray-700 bg-purple-50 rounded px-3 py-1.5">
          <span className="font-medium text-purple-700">Email Alert:</span>{' '}
          Send &quot;{action.subject}&quot; to{' '}
          {action.toField ? <span className="font-mono text-xs">{action.toField}</span> : action.toAddress}
        </div>
      );
    case 'Task':
      return (
        <div className="text-sm text-gray-700 bg-amber-50 rounded px-3 py-1.5">
          <span className="font-medium text-amber-700">Task:</span>{' '}
          Create &quot;{action.subject}&quot;
          {action.dueInDays ? ` (due in ${action.dueInDays} days)` : ''}
        </div>
      );
    default:
      return null;
  }
}

// ── Rule editor ────────────────────────────────────────────────────

interface RuleEditorProps {
  rule: WorkflowRule;
  setRule: (rule: WorkflowRule) => void;
  fields: { apiName: string; label: string; type: string }[];
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
}

function WorkflowRuleEditor({ rule, setRule, fields, onSave, onCancel, isNew }: RuleEditorProps) {
  const update = (patch: Partial<WorkflowRule>) => setRule({ ...rule, ...patch });

  const canSave = rule.name.trim().length > 0 && rule.actions.length > 0;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {isNew ? 'New Workflow Rule' : `Edit: ${rule.name}`}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              canSave ? 'bg-brand-navy hover:bg-brand-navy-dark' : 'bg-gray-300 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {isNew ? 'Create Rule' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Rule Details</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
            <input
              type="text"
              value={rule.name}
              onChange={e => update({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy focus:border-brand-navy"
              placeholder="e.g. Set Status to Active on Create"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <button
              onClick={() => update({ active: !rule.active })}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                rule.active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
              )}
            >
              {rule.active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              {rule.active ? 'Active' : 'Inactive'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={rule.description || ''}
            onChange={e => update({ description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy focus:border-brand-navy resize-none"
            placeholder="Describe what this rule does..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evaluate the rule when</label>
          <select
            value={rule.triggerType}
            onChange={e => update({ triggerType: e.target.value as WorkflowTriggerType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy focus:border-brand-navy"
          >
            {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conditions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Rule Criteria
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">All conditions must be true for the rule to fire</p>
          </div>
          <button
            onClick={() => update({ conditions: [...rule.conditions, { left: fields[0]?.apiName || '', op: '==', right: '' }] })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-navy bg-brand-navy/5 rounded-lg hover:bg-brand-navy/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Condition
          </button>
        </div>

        {rule.conditions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No conditions — rule will fire on every qualifying event.</p>
        ) : (
          <div className="space-y-2">
            {rule.conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-xs font-semibold text-gray-400 w-8 text-center">AND</span>
                )}
                {i === 0 && <span className="w-8" />}

                <select
                  value={cond.left}
                  onChange={e => {
                    const updated = [...rule.conditions];
                    updated[i] = { ...cond, left: e.target.value };
                    update({ conditions: updated });
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select field...</option>
                  {fields.map(f => (
                    <option key={f.apiName} value={f.apiName}>{f.label} ({f.apiName})</option>
                  ))}
                </select>

                <select
                  value={cond.op}
                  onChange={e => {
                    const updated = [...rule.conditions];
                    updated[i] = { ...cond, op: e.target.value as ConditionExpr['op'] };
                    update({ conditions: updated });
                  }}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {OPS.map(op => (
                    <option key={op} value={op}>{OP_LABELS[op]}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={typeof cond.right === 'string' ? cond.right : JSON.stringify(cond.right)}
                  onChange={e => {
                    const updated = [...rule.conditions];
                    updated[i] = { ...cond, right: e.target.value };
                    update({ conditions: updated });
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Value"
                />

                <button
                  onClick={() => update({ conditions: rule.conditions.filter((_, j) => j !== i) })}
                  className="p-1.5 rounded-md hover:bg-red-50 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Workflow Actions *
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">At least one action is required</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => update({
                actions: [...rule.actions, { type: 'FieldUpdate', fieldApiName: fields[0]?.apiName || '', value: '' }]
              })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              <Plus className="w-3.5 h-3.5" />
              Field Update
            </button>
            <button
              onClick={() => update({
                actions: [...rule.actions, { type: 'EmailAlert', subject: '', body: '', toAddress: '' }]
              })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"
            >
              <Plus className="w-3.5 h-3.5" />
              Email Alert
            </button>
            <button
              onClick={() => update({
                actions: [...rule.actions, { type: 'Task', subject: '', priority: 'Normal' }]
              })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100"
            >
              <Plus className="w-3.5 h-3.5" />
              Task
            </button>
          </div>
        </div>

        {rule.actions.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Add at least one action to save this rule.
          </div>
        )}

        <div className="space-y-3">
          {rule.actions.map((action, i) => (
            <ActionEditor
              key={i}
              action={action}
              fields={fields}
              onChange={updated => {
                const actions = [...rule.actions];
                actions[i] = updated;
                update({ actions });
              }}
              onRemove={() => update({ actions: rule.actions.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Action editor ──────────────────────────────────────────────────

interface ActionEditorProps {
  action: WorkflowAction;
  fields: { apiName: string; label: string; type: string }[];
  onChange: (action: WorkflowAction) => void;
  onRemove: () => void;
}

function ActionEditor({ action, fields, onChange, onRemove }: ActionEditorProps) {
  const colorMap = {
    FieldUpdate: { bg: 'bg-blue-50', border: 'border-blue-200', label: 'text-blue-700', title: 'Field Update' },
    EmailAlert: { bg: 'bg-purple-50', border: 'border-purple-200', label: 'text-purple-700', title: 'Email Alert' },
    Task: { bg: 'bg-amber-50', border: 'border-amber-200', label: 'text-amber-700', title: 'Task' },
  };
  const colors = colorMap[action.type] || colorMap.FieldUpdate;

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', colors.bg, colors.border)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-bold uppercase tracking-wider', colors.label)}>
          {colors.title}
        </span>
        <button onClick={onRemove} className="p-1 rounded hover:bg-white/60 text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {action.type === 'FieldUpdate' && (
        <FieldUpdateEditor
          action={action as FieldUpdateAction}
          fields={fields}
          onChange={onChange}
        />
      )}

      {action.type === 'EmailAlert' && (
        <EmailAlertEditor
          action={action as EmailAlertAction}
          fields={fields}
          onChange={onChange}
        />
      )}

      {action.type === 'Task' && (
        <TaskEditor
          action={action as TaskAction}
          fields={fields}
          onChange={onChange}
        />
      )}
    </div>
  );
}

// ── Field Update editor ────────────────────────────────────────────

function FieldUpdateEditor({
  action, fields, onChange
}: { action: FieldUpdateAction; fields: { apiName: string; label: string; type: string }[]; onChange: (a: WorkflowAction) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Field to update</label>
        <select
          value={action.fieldApiName}
          onChange={e => onChange({ ...action, fieldApiName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Select field...</option>
          {fields.map(f => (
            <option key={f.apiName} value={f.apiName}>{f.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">New value</label>
        <input
          type="text"
          value={typeof action.value === 'string' ? action.value : JSON.stringify(action.value ?? '')}
          onChange={e => onChange({ ...action, value: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="Value or {{fieldApiName}}"
        />
      </div>
    </div>
  );
}

// ── Email Alert editor ─────────────────────────────────────────────

function EmailAlertEditor({
  action, fields, onChange
}: { action: EmailAlertAction; fields: { apiName: string; label: string; type: string }[]; onChange: (a: WorkflowAction) => void }) {
  const emailFields = fields.filter(f => f.type === 'Email');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Recipient field</label>
          <select
            value={action.toField || ''}
            onChange={e => onChange({ ...action, toField: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">None (use static address)</option>
            {emailFields.map(f => (
              <option key={f.apiName} value={f.apiName}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Or static address</label>
          <input
            type="email"
            value={action.toAddress || ''}
            onChange={e => onChange({ ...action, toAddress: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="user@example.com"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
        <input
          type="text"
          value={action.subject}
          onChange={e => onChange({ ...action, subject: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder='e.g. New {{status}} record: {{name}}'
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Body (HTML, supports {'{{field}}'} merge tokens)</label>
        <textarea
          value={action.body}
          onChange={e => onChange({ ...action, body: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none font-mono"
          placeholder={'<p>Hello,</p>\n<p>A new record was created: {{name}}</p>'}
        />
      </div>
    </div>
  );
}

// ── Task editor ────────────────────────────────────────────────────

function TaskEditor({
  action, fields, onChange
}: { action: TaskAction; fields: { apiName: string; label: string; type: string }[]; onChange: (a: WorkflowAction) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Task subject</label>
        <input
          type="text"
          value={action.subject}
          onChange={e => onChange({ ...action, subject: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder='e.g. Follow up on {{name}}'
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <select
            value={action.priority || 'Normal'}
            onChange={e => onChange({ ...action, priority: e.target.value as 'High' | 'Normal' | 'Low' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Due in (days)</label>
          <input
            type="number"
            min={0}
            value={action.dueInDays ?? ''}
            onChange={e => onChange({ ...action, dueInDays: e.target.value ? parseInt(e.target.value) : undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="e.g. 3"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Assign to user ID</label>
          <input
            type="text"
            value={action.assignToUserId || ''}
            onChange={e => onChange({ ...action, assignToUserId: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="(current user if blank)"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          value={action.description || ''}
          onChange={e => onChange({ ...action, description: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          placeholder="Optional task description"
        />
      </div>
    </div>
  );
}
