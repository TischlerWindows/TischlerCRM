'use client';

import { useState } from 'react';
import {
  Plus, Trash2, ChevronRight, ChevronDown, GripVertical,
  Save, Pencil, Copy, MoreVertical, GitBranch,
} from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';
import type { PathDef, PathStage, PathTransitionField } from '@/lib/schema';

interface PathsProps {
  objectApiName: string;
}

const CATEGORY_LABELS: Record<PathStage['category'], string> = {
  active: 'Active',
  'closed-won': 'Closed Won',
  'closed-lost': 'Closed Lost',
};

const CATEGORY_COLORS: Record<PathStage['category'], string> = {
  active: 'bg-blue-100 text-blue-700',
  'closed-won': 'bg-green-100 text-green-700',
  'closed-lost': 'bg-red-100 text-red-700',
};

const STAGE_PREVIEW_COLORS: Record<PathStage['category'], string> = {
  active: 'bg-blue-300 text-blue-900',
  'closed-won': 'bg-green-300 text-green-900',
  'closed-lost': 'bg-red-300 text-red-900',
};

function generateStageId(): string {
  return Math.random().toString(36).substr(2, 9);
}

const TM_FLAG_OPTIONS: Array<{ value: 'primaryContact' | 'contractHolder' | 'quoteRecipient'; label: string }> = [
  { value: 'primaryContact', label: 'Primary Contact' },
  { value: 'contractHolder', label: 'Contract Holder' },
  { value: 'quoteRecipient', label: 'Quote Recipient' },
];

function tmTransitionKey(tf: PathTransitionField): string {
  if (tf.kind === 'teamMemberFlag') return `__tm:flag:${tf.flag ?? ''}`;
  if (tf.kind === 'teamMemberRole') return `__tm:role:${tf.role ?? ''}`;
  return '';
}

function tmTransitionLabel(tf: PathTransitionField): string {
  if (tf.kind === 'teamMemberFlag') {
    const opt = TM_FLAG_OPTIONS.find(o => o.value === tf.flag);
    return opt?.label ?? 'Team Member';
  }
  if (tf.kind === 'teamMemberRole' && tf.role) return tf.role;
  return 'Team Member';
}

export default function Paths({ objectApiName }: PathsProps) {
  const { schema, addPath, updatePath, deletePath } = useSchemaStore();
  const object = schema?.objects.find(o => o.apiName === objectApiName);

  const [editingPath, setEditingPath] = useState<PathDef | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  if (!object) return null;

  const paths = object.paths || [];

  function handleNew() {
    const newPath: PathDef = {
      id: '',
      name: '',
      description: '',
      active: true,
      trackingFieldApiName: '',
      stages: [
        { id: generateStageId(), name: '', order: 0, category: 'active' },
      ],
      createdAt: '',
      updatedAt: '',
    };
    setEditingPath(newPath);
    setIsNew(true);
  }

  function handleEdit(path: PathDef) {
    setEditingPath({ ...path, stages: path.stages.map(s => ({ ...s })) });
    setIsNew(false);
  }

  function handleDuplicate(path: PathDef) {
    const duplicated: PathDef = {
      ...path,
      id: '',
      name: `${path.name} (Copy)`,
      trackingFieldApiName: '',
      stages: path.stages.map(s => ({ ...s, id: generateStageId() })),
      createdAt: '',
      updatedAt: '',
    };
    setEditingPath(duplicated);
    setIsNew(true);
    setMenuOpenId(null);
  }

  function handleDelete(pathId: string) {
    if (!confirm('Are you sure you want to delete this path?')) return;
    deletePath(objectApiName, pathId);
    setMenuOpenId(null);
  }

  function handleSave() {
    if (!editingPath || !editingPath.name.trim()) return;

    const sortedStages = editingPath.stages
      .map((s, i) => ({ ...s, order: i }));

    if (isNew) {
      addPath(objectApiName, {
        name: editingPath.name.trim(),
        description: editingPath.description,
        active: editingPath.active,
        stages: sortedStages,
      });
    } else {
      updatePath(objectApiName, editingPath.id, {
        name: editingPath.name.trim(),
        description: editingPath.description,
        active: editingPath.active,
        stages: sortedStages,
      });
    }
    setEditingPath(null);
    setIsNew(false);
  }

  function handleCancel() {
    setEditingPath(null);
    setIsNew(false);
  }

  if (editingPath) {
    return (
      <PathEditor
        path={editingPath}
        onChange={setEditingPath}
        onSave={handleSave}
        onCancel={handleCancel}
        isNew={isNew}
        objectFields={object.fields}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Paths</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Define visual stage progressions for {object.label} records
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Path
        </button>
      </div>

      {paths.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">No paths configured yet</p>
          <button
            onClick={handleNew}
            className="text-sm font-medium text-brand-navy hover:underline"
          >
            Create your first path
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {paths.map(path => (
            <div
              key={path.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    path.active ? 'bg-green-500' : 'bg-gray-400'
                  )}
                />
                <div>
                  <div className="font-medium text-sm text-gray-900">{path.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {path.stages.length} stage{path.stages.length !== 1 ? 's' : ''} · {path.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex gap-0.5">
                  {[...path.stages]
                    .sort((a, b) => a.order - b.order)
                    .map((stage, i) => (
                      <div
                        key={stage.id}
                        className={cn(
                          'text-[9px] px-2 py-0.5 font-medium',
                          path.active
                            ? STAGE_PREVIEW_COLORS[stage.category]
                            : 'bg-gray-200 text-gray-500',
                          i === 0 && 'rounded-l',
                          i === path.stages.length - 1 && 'rounded-r',
                        )}
                      >
                        {stage.name}
                      </div>
                    ))}
                </div>

                <button
                  onClick={() => handleEdit(path)}
                  className="text-xs text-gray-500 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50"
                >
                  Edit
                </button>

                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === path.id ? null : path.id)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpenId === path.id && (
                    <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={() => handleDuplicate(path)}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(path.id)}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PathEditorProps {
  path: PathDef;
  onChange: (path: PathDef) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
  objectFields: Array<{ apiName: string; label: string; type: string }>;
}

function PathEditor({ path, onChange, onSave, onCancel, isNew, objectFields }: PathEditorProps) {
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const [transitionFieldSearch, setTransitionFieldSearch] = useState('');
  const [tmAdderStageId, setTmAdderStageId] = useState<string | null>(null);
  const tmRoleSchema = useSchemaStore(s =>
    s.schema?.objects.find(o => o.apiName === 'TeamMember')?.fields.find(f => f.apiName === 'role')
  );
  const tmRoleValues: string[] = tmRoleSchema?.picklistValues && tmRoleSchema.picklistValues.length > 0
    ? tmRoleSchema.picklistValues
    : ['Homeowner', 'General Contractor', 'Subcontractor', 'Architect / Designer', 'Property Manager', 'Sales Rep', 'Installer', 'Inspector', 'Engineer', 'Other'];

  function updateStage(stageId: string, updates: Partial<PathStage>) {
    onChange({
      ...path,
      stages: path.stages.map(s => (s.id === stageId ? { ...s, ...updates } : s)),
    });
  }

  function addStage() {
    const newStage: PathStage = {
      id: generateStageId(),
      name: '',
      order: path.stages.length,
      category: 'active',
    };
    onChange({ ...path, stages: [...path.stages, newStage] });
    setExpandedStageId(newStage.id);
  }

  function removeStage(stageId: string) {
    onChange({
      ...path,
      stages: path.stages.filter(s => s.id !== stageId),
    });
    if (expandedStageId === stageId) setExpandedStageId(null);
  }

  function moveStage(stageId: string, direction: 'up' | 'down') {
    const sorted = [...path.stages].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === stageId);
    if (direction === 'up' && idx > 0) {
      [sorted[idx], sorted[idx - 1]] = [sorted[idx - 1], sorted[idx]];
    } else if (direction === 'down' && idx < sorted.length - 1) {
      [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
    }
    onChange({
      ...path,
      stages: sorted.map((s, i) => ({ ...s, order: i })),
    });
  }

  function toggleKeyField(stageId: string, fieldApi: string) {
    const stage = path.stages.find(s => s.id === stageId);
    if (!stage) return;
    const current = stage.keyFields || [];
    const updated = current.includes(fieldApi)
      ? current.filter(f => f !== fieldApi)
      : [...current, fieldApi];
    updateStage(stageId, { keyFields: updated });
  }

  function toggleTransitionField(stageId: string, fieldApi: string) {
    const stage = path.stages.find(s => s.id === stageId);
    if (!stage) return;
    const current = stage.transitionFields || [];
    const exists = current.find(f => f.fieldApiName === fieldApi);
    const updated = exists
      ? current.filter(f => f.fieldApiName !== fieldApi)
      : [...current, { fieldApiName: fieldApi, required: true }];
    updateStage(stageId, { transitionFields: updated });
  }

  function toggleTransitionRequired(stageId: string, fieldApi: string) {
    const stage = path.stages.find(s => s.id === stageId);
    if (!stage) return;
    const updated = (stage.transitionFields || []).map(f =>
      f.fieldApiName === fieldApi ? { ...f, required: !f.required } : f
    );
    updateStage(stageId, { transitionFields: updated });
  }

  function toggleTmTransitionRequired(stageId: string, key: string) {
    const stage = path.stages.find(s => s.id === stageId);
    if (!stage) return;
    const updated = (stage.transitionFields || []).map(f =>
      tmTransitionKey(f) === key ? { ...f, required: !f.required } : f
    );
    updateStage(stageId, { transitionFields: updated });
  }

  function removeTmTransition(stageId: string, key: string) {
    const stage = path.stages.find(s => s.id === stageId);
    if (!stage) return;
    const updated = (stage.transitionFields || []).filter(f => tmTransitionKey(f) !== key);
    updateStage(stageId, { transitionFields: updated });
  }

  function addTmFlagTransition(stageId: string, flag: 'primaryContact' | 'contractHolder' | 'quoteRecipient') {
    const stage = path.stages.find(s => s.id === stageId);
    if (!stage) return;
    const current = stage.transitionFields || [];
    const key = `__tm:flag:${flag}`;
    if (current.some(f => tmTransitionKey(f) === key)) return;
    const next: PathTransitionField = {
      kind: 'teamMemberFlag',
      flag,
      tmMode: 'paired',
      tmCardinality: 'single',
      required: true,
    };
    updateStage(stageId, { transitionFields: [...current, next] });
  }

  function addTmRoleTransition(stageId: string, role: string) {
    const stage = path.stages.find(s => s.id === stageId);
    if (!stage) return;
    const current = stage.transitionFields || [];
    const key = `__tm:role:${role}`;
    if (current.some(f => tmTransitionKey(f) === key)) return;
    const next: PathTransitionField = {
      kind: 'teamMemberRole',
      role,
      tmMode: 'paired',
      tmCardinality: 'single',
      required: true,
    };
    updateStage(stageId, { transitionFields: [...current, next] });
  }

  const sortedStages = [...path.stages].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {isNew ? 'New Path' : `Edit: ${path.name}`}
        </h2>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Path Name</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
              value={path.name}
              onChange={e => onChange({ ...path, name: e.target.value })}
              placeholder="e.g., Sales Process"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
              value={path.description || ''}
              onChange={e => onChange({ ...path, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => onChange({ ...path, active: !path.active })}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              path.active ? 'bg-green-500' : 'bg-gray-300'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
                path.active ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </button>
          <span className="text-sm text-gray-700">{path.active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Stages</h3>
          <button
            onClick={addStage}
            className="text-xs text-gray-500 border border-dashed border-gray-400 rounded-md px-3 py-1.5 hover:bg-gray-50"
          >
            + Add Stage
          </button>
        </div>

        <div className="space-y-2">
          {sortedStages.map((stage, idx) => {
            const isExpanded = expandedStageId === stage.id;
            return (
              <div
                key={stage.id}
                className={cn(
                  'bg-white border rounded-lg overflow-hidden',
                  isExpanded ? 'border-blue-500 border-2' : 'border-gray-200'
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 cursor-pointer',
                    isExpanded && 'bg-blue-50/50'
                  )}
                  onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                >
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                  <div
                    className={cn(
                      'text-[10px] font-bold text-white rounded px-1.5 py-0.5 min-w-[20px] text-center',
                      stage.category === 'active' && 'bg-blue-500',
                      stage.category === 'closed-won' && 'bg-green-500',
                      stage.category === 'closed-lost' && 'bg-red-500',
                    )}
                  >
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-900">
                    {stage.name || <span className="text-gray-400 italic">Unnamed stage</span>}
                  </span>
                  <span className={cn('text-[10px] rounded-full px-2 py-0.5', CATEGORY_COLORS[stage.category])}>
                    {CATEGORY_LABELS[stage.category]}
                  </span>
                  <div className="flex items-center gap-1">
                    {idx > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); moveStage(stage.id, 'up'); }}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                        title="Move up"
                      >
                        ▲
                      </button>
                    )}
                    {idx < sortedStages.length - 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); moveStage(stage.id, 'down'); }}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                        title="Move down"
                      >
                        ▼
                      </button>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-blue-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {isExpanded && (
                  <div className="px-4 py-4 border-t border-gray-200 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Stage Name</label>
                        <input
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
                          value={stage.name}
                          onChange={e => updateStage(stage.id, { name: e.target.value })}
                          placeholder="e.g., Prospecting"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category</label>
                        <div className="flex gap-1">
                          {(['active', 'closed-won', 'closed-lost'] as const).map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => updateStage(stage.id, { category: cat })}
                              className={cn(
                                'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                                stage.category === cat
                                  ? cat === 'active' ? 'bg-blue-500 text-white' : cat === 'closed-won' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                              )}
                            >
                              {CATEGORY_LABELS[cat]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Key Fields</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(stage.keyFields || []).map(fieldApi => {
                          const field = objectFields.find(f => f.apiName === fieldApi);
                          return (
                            <span
                              key={fieldApi}
                              className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-md px-2.5 py-1 text-xs text-gray-800"
                            >
                              {field?.label || fieldApi}
                              <button
                                onClick={() => toggleKeyField(stage.id, fieldApi)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <div className="relative">
                        <input
                          className="w-full rounded-md border border-dashed border-gray-400 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
                          value={fieldSearch}
                          onChange={e => setFieldSearch(e.target.value)}
                          placeholder="+ Search fields to add..."
                        />
                        {fieldSearch && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {objectFields
                              .filter(f =>
                                !f.apiName.startsWith('__') &&
                                !(stage.keyFields || []).includes(f.apiName) &&
                                (f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
                                 f.apiName.toLowerCase().includes(fieldSearch.toLowerCase()))
                              )
                              .slice(0, 10)
                              .map(f => (
                                <button
                                  key={f.apiName}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                                  onClick={() => {
                                    toggleKeyField(stage.id, f.apiName);
                                    setFieldSearch('');
                                  }}
                                >
                                  {f.label} <span className="text-gray-400">({f.apiName})</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Guidance for Success</label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
                        value={stage.guidance || ''}
                        onChange={e => updateStage(stage.id, { guidance: e.target.value })}
                        placeholder="Tips and guidance for completing this stage..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        Transition Fields
                        <span className="font-normal normal-case text-gray-400 ml-1">
                          — shown in a popup when entering this stage
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(stage.transitionFields || [])
                          // TM-criterion transitions get their own chip rendering in Chunk 7.
                          .filter((tf): tf is PathTransitionField & { fieldApiName: string } =>
                            (!tf.kind || tf.kind === 'field') && typeof tf.fieldApiName === 'string'
                          )
                          .map(tf => {
                            const field = objectFields.find(f => f.apiName === tf.fieldApiName);
                            return (
                              <span
                                key={tf.fieldApiName}
                                className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 text-xs text-amber-800"
                              >
                                {field?.label || tf.fieldApiName}
                                <button
                                  onClick={() => toggleTransitionRequired(stage.id, tf.fieldApiName)}
                                  className={cn(
                                    'text-[10px] font-bold rounded px-1',
                                    tf.required
                                      ? 'text-red-600 bg-red-50'
                                      : 'text-gray-400 bg-gray-100'
                                  )}
                                  title={tf.required ? 'Required — click to make optional' : 'Optional — click to make required'}
                                >
                                  {tf.required ? 'REQ' : 'OPT'}
                                </button>
                                <button
                                  onClick={() => toggleTransitionField(stage.id, tf.fieldApiName)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                      </div>
                      <div className="relative">
                        <input
                          className="w-full rounded-md border border-dashed border-gray-400 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
                          value={transitionFieldSearch}
                          onChange={e => setTransitionFieldSearch(e.target.value)}
                          placeholder="+ Search fields to add as transition fields..."
                        />
                        {transitionFieldSearch && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {objectFields
                              .filter(f =>
                                !f.apiName.startsWith('__') &&
                                !(stage.transitionFields || []).some(tf => tf.fieldApiName === f.apiName) &&
                                (f.label.toLowerCase().includes(transitionFieldSearch.toLowerCase()) ||
                                 f.apiName.toLowerCase().includes(transitionFieldSearch.toLowerCase()))
                              )
                              .slice(0, 10)
                              .map(f => (
                                <button
                                  key={f.apiName}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                                  onClick={() => {
                                    toggleTransitionField(stage.id, f.apiName);
                                    setTransitionFieldSearch('');
                                  }}
                                >
                                  {f.label} <span className="text-gray-400">({f.apiName})</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Team-member criterion chips + adder */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(stage.transitionFields || [])
                          .filter(tf => tf.kind === 'teamMemberFlag' || tf.kind === 'teamMemberRole')
                          .map(tf => {
                            const key = tmTransitionKey(tf);
                            return (
                              <span
                                key={key}
                                className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-md px-2.5 py-1 text-xs text-purple-800"
                              >
                                <span className="text-[10px] font-bold text-purple-500 uppercase mr-0.5">
                                  {tf.kind === 'teamMemberFlag' ? 'Flag' : 'Role'}
                                </span>
                                {tmTransitionLabel(tf)}
                                <button
                                  onClick={() => toggleTmTransitionRequired(stage.id, key)}
                                  className={cn(
                                    'text-[10px] font-bold rounded px-1',
                                    tf.required
                                      ? 'text-red-600 bg-red-50'
                                      : 'text-gray-400 bg-gray-100'
                                  )}
                                  title={tf.required ? 'Required — click to make optional' : 'Optional — click to make required'}
                                >
                                  {tf.required ? 'REQ' : 'OPT'}
                                </button>
                                <button
                                  onClick={() => removeTmTransition(stage.id, key)}
                                  className="text-purple-400 hover:text-purple-700"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                      </div>
                      {tmAdderStageId === stage.id ? (
                        <div className="mt-2 rounded-md border border-dashed border-purple-300 bg-purple-50/30 p-2 space-y-2">
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Team Member Flags</p>
                            <div className="flex flex-wrap gap-1">
                              {TM_FLAG_OPTIONS
                                .filter(o => !(stage.transitionFields || []).some(tf => tf.kind === 'teamMemberFlag' && tf.flag === o.value))
                                .map(o => (
                                  <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => addTmFlagTransition(stage.id, o.value)}
                                    className="px-2 py-1 text-[11px] rounded border border-purple-200 bg-white text-purple-700 hover:bg-purple-100"
                                  >
                                    + {o.label}
                                  </button>
                                ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Team Member Roles</p>
                            <div className="flex flex-wrap gap-1">
                              {tmRoleValues
                                .filter(r => !(stage.transitionFields || []).some(tf => tf.kind === 'teamMemberRole' && tf.role === r))
                                .map(r => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => addTmRoleTransition(stage.id, r)}
                                    className="px-2 py-1 text-[11px] rounded border border-purple-200 bg-white text-purple-700 hover:bg-purple-100"
                                  >
                                    + {r}
                                  </button>
                                ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTmAdderStageId(null)}
                            className="text-[11px] text-gray-500 hover:text-gray-700"
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setTmAdderStageId(stage.id)}
                          className="mt-2 text-[11px] text-purple-600 hover:text-purple-800 underline"
                        >
                          + Add team-member criterion (flag or role)
                        </button>
                      )}
                    </div>

                    {path.stages.length > 1 && (
                      <button
                        onClick={() => removeStage(stage.id)}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove stage
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!path.name.trim() || path.stages.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-navy rounded-lg hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Save Path
        </button>
      </div>
    </div>
  );
}
