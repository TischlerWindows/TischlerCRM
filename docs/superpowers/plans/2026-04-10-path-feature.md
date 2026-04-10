# Path Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Salesforce Path-like feature with settings UI for defining stage progressions and a dynamic widget for visualizing/advancing a record's current stage.

**Architecture:** Path definitions are stored on `ObjectDef` in the existing OrgSchema (same pattern as `workflowRules`). Each path auto-creates a hidden tracking field (`__path_{id}_stage`) on the object. A new internal widget renders the chevron bar and handles stage transitions via the records API.

**Tech Stack:** Next.js 14 (App Router), React 18, Zustand, Tailwind CSS, TypeScript, Lucide icons, dnd-kit

**Spec:** `docs/superpowers/specs/2026-04-10-path-feature-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/app/object-manager/[objectApi]/paths.tsx` | Path list view + path editor (settings UI) |
| `apps/web/widgets/internal/path/widget.config.ts` | Widget manifest for the Path widget |
| `apps/web/widgets/internal/path/index.tsx` | Path widget component (chevron bar + popover + stage transitions) |
| `apps/web/widgets/internal/path/ConfigPanel.tsx` | Page builder config panel (path selector + display toggles) |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/lib/schema.ts` | Add `PathDef`, `PathStage`, `PathConfig` types; extend `ObjectDef`; extend `WidgetType` and `WidgetConfig` |
| `apps/web/lib/schema-store.ts` | Add `addPath`, `updatePath`, `deletePath` store actions |
| `apps/web/widgets/internal/registry.ts` | Register Path widget |
| `apps/web/app/object-manager/[objectApi]/page.tsx` | Add "Paths" sidebar section + render `<Paths />` component |
| `apps/web/app/object-manager/[objectApi]/page-editor/dnd/drag-parser.ts` | Add `'Path'` to `WIDGET_TYPES` |
| `apps/web/app/object-manager/[objectApi]/page-editor/canvas-widget.tsx` | Add Path icon, label, summary |
| `apps/web/app/object-manager/[objectApi]/page-editor/properties/widget-config-panel.tsx` | Add Path config panel rendering |
| `apps/web/components/layout-widgets-inline.tsx` | Add Path label in `getWidgetLabel` |

---

## Task 1: Add Path Types to Schema

**Files:**
- Modify: `apps/web/lib/schema.ts`

- [ ] **Step 1: Add PathStage and PathDef interfaces**

Open `apps/web/lib/schema.ts`. Add the following interfaces directly above the `ObjectDef` interface (before line 537):

```typescript
// ── Path definitions ────────────────────────────────────────────────────────

export interface PathStage {
  id: string;
  name: string;
  order: number;
  category: 'active' | 'closed-won' | 'closed-lost';
  guidance?: string;
  keyFields?: string[];
}

export interface PathDef {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  trackingFieldApiName: string;
  stages: PathStage[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Extend ObjectDef with paths**

In the `ObjectDef` interface (line 537), add `paths` after `workflowRules` (line 547):

```typescript
  workflowRules?: WorkflowRule[];
  paths?: PathDef[];
```

- [ ] **Step 3: Add 'Path' to WidgetType**

On line 222, extend the `WidgetType` union:

```typescript
export type WidgetType = 'RelatedList' | 'CustomComponent' | 'ActivityFeed' | 'FileFolder' | 'Spacer' | 'HeaderHighlights' | 'ExternalWidget' | 'TeamMembersRollup' | 'TeamMemberAssociations' | 'Path';
```

- [ ] **Step 4: Add PathConfig interface**

Add this after `TeamMemberAssociationsConfig` (after line 325):

```typescript
export interface PathConfig {
  type: 'Path';
  pathId: string;
  showLabel: boolean;
  showGuidance: boolean;
  showKeyFields: boolean;
  compact: boolean;
}
```

- [ ] **Step 5: Add PathConfig to WidgetConfig union**

On line 327, add `PathConfig` to the union:

```typescript
export type WidgetConfig =
  | RelatedListConfig
  | CustomComponentConfig
  | ActivityFeedConfig
  | FileFolderConfig
  | SpacerConfig
  | HeaderHighlightsConfig
  | ExternalWidgetLayoutConfig
  | TeamMembersRollupConfig
  | TeamMemberAssociationsConfig
  | PathConfig;
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors related to Path types. Some pre-existing errors may appear — ignore those.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/schema.ts
git commit -m "feat(path): add PathDef, PathStage, PathConfig types to schema"
```

---

## Task 2: Add Path CRUD to Schema Store

**Files:**
- Modify: `apps/web/lib/schema-store.ts`

- [ ] **Step 1: Add PathDef to imports**

On line 3, add `PathDef` to the import:

```typescript
import { OrgSchema, ObjectDef, FieldDef, ValidationRule, WorkflowRule, RecordType, PageLayout, FlowDefinition, CustomLayoutTemplate, PathDef } from './schema';
```

- [ ] **Step 2: Add path operations to SchemaStore interface**

Add these after the workflow rule operations block (after line 72):

```typescript
  // Path operations
  addPath: (objectApi: string, path: Omit<PathDef, 'id' | 'createdAt' | 'updatedAt' | 'trackingFieldApiName'>) => string;
  updatePath: (objectApi: string, pathId: string, updates: Partial<PathDef>) => void;
  deletePath: (objectApi: string, pathId: string) => void;
```

- [ ] **Step 3: Implement addPath**

Add the implementation inside the store's `create` call, after the `deleteWorkflowRule` implementation (after line 983). Follow the exact same pattern as `addWorkflowRule`:

```typescript
      // Add path
      addPath: (objectApi, pathData) => {
        const { schema } = get();
        if (!schema) return '';

        const pathId = generateId();
        const trackingFieldApiName = `__path_${pathId}_stage`;
        const now = new Date().toISOString();
        const newPath: PathDef = {
          ...pathData,
          id: pathId,
          trackingFieldApiName,
          createdAt: now,
          updatedAt: now,
        };

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi
            ? {
                ...obj,
                paths: [...(obj.paths || []), newPath],
                updatedAt: now,
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: now,
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);

        return pathId;
      },
```

- [ ] **Step 4: Implement updatePath**

```typescript
      // Update path
      updatePath: (objectApi, pathId, updates) => {
        const { schema } = get();
        if (!schema) return;

        const now = new Date().toISOString();
        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi
            ? {
                ...obj,
                paths: (obj.paths || []).map(p =>
                  p.id === pathId ? { ...p, ...updates, updatedAt: now } : p
                ),
                updatedAt: now,
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: now,
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },
```

- [ ] **Step 5: Implement deletePath**

```typescript
      // Delete path
      deletePath: (objectApi, pathId) => {
        const { schema } = get();
        if (!schema) return;

        const now = new Date().toISOString();
        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi
            ? {
                ...obj,
                paths: (obj.paths || []).filter(p => p.id !== pathId),
                updatedAt: now,
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: now,
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/schema-store.ts
git commit -m "feat(path): add path CRUD operations to schema store"
```

---

## Task 3: Create Path Settings UI

**Files:**
- Create: `apps/web/app/object-manager/[objectApi]/paths.tsx`
- Modify: `apps/web/app/object-manager/[objectApi]/page.tsx`

- [ ] **Step 1: Create the Paths component**

Create `apps/web/app/object-manager/[objectApi]/paths.tsx`. This is the largest new file — it contains the path list view and the path editor. It follows the same pattern as `workflow-triggers.tsx`:

```typescript
'use client';

import { useState } from 'react';
import {
  Plus, Trash2, ChevronRight, ChevronDown, GripVertical,
  Save, Pencil, Copy, MoreVertical, GitBranch,
} from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';
import type { PathDef, PathStage } from '@/lib/schema';

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

// ── Main component ─────────────────────────────────────────────────

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

  // ── Editor mode ────────────────────────────────────────────────────

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

  // ── List mode ──────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
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

      {/* Path list */}
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
                {/* Mini stage preview */}
                <div className="hidden sm:flex gap-0.5">
                  {path.stages
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

                {/* Overflow menu */}
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

// ── Path Editor ──────────────────────────────────────────────────────────────

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

  const sortedStages = [...path.stages].sort((a, b) => a.order - b.order);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {isNew ? 'New Path' : `Edit: ${path.name}`}
        </h2>
      </div>

      {/* Name / Description / Active */}
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

      {/* Stages */}
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
                {/* Stage header row */}
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

                {/* Expanded stage editor */}
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

                    {/* Key Fields */}
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
                      {/* Field picker */}
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

                    {/* Guidance */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Guidance for Success</label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
                        value={stage.guidance || ''}
                        onChange={e => updateStage(stage.id, { guidance: e.target.value })}
                        placeholder="Tips and guidance for completing this stage..."
                      />
                    </div>

                    {/* Delete stage */}
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

      {/* Action bar */}
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
```

- [ ] **Step 2: Add "Paths" section to Object Manager sidebar**

In `apps/web/app/object-manager/[objectApi]/page.tsx`:

Add import for Paths component (after line 29):

```typescript
import Paths from './paths';
```

Add the Paths section to `SIDEBAR_SECTIONS` array. Insert after the `workflow-rules` entry (after line 117):

```typescript
  {
    id: 'paths',
    label: 'Paths',
    icon: GitBranch,
    description: 'Define stage progressions for records',
    category: 'Automation',
  },
```

Note: `GitBranch` is already imported on line 18.

- [ ] **Step 3: Add Paths render block**

In the same file, add a conditional render block for the paths section. Insert after the `workflow-rules` block (after line 429):

```typescript
          {activeSection === 'paths' && (
            <div className="px-6 py-6">
              <Paths objectApiName={objectApi} />
            </div>
          )}
```

Also update the fallback condition on line 431 to exclude `'paths'`:

Change:
```typescript
{activeSection !== 'details' && activeSection !== 'fields' && activeSection !== 'page-editor' && activeSection !== 'home-layout' && activeSection !== 'search-settings' && activeSection !== 'workflow-rules' && (
```

To:
```typescript
{activeSection !== 'details' && activeSection !== 'fields' && activeSection !== 'page-editor' && activeSection !== 'home-layout' && activeSection !== 'search-settings' && activeSection !== 'workflow-rules' && activeSection !== 'paths' && (
```

- [ ] **Step 4: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/paths.tsx apps/web/app/object-manager/\[objectApi\]/page.tsx
git commit -m "feat(path): add Path settings UI in Object Manager"
```

---

## Task 4: Create Path Widget Manifest and Registration

**Files:**
- Create: `apps/web/widgets/internal/path/widget.config.ts`
- Modify: `apps/web/widgets/internal/registry.ts`

- [ ] **Step 1: Create the widget manifest**

Create `apps/web/widgets/internal/path/widget.config.ts`:

```typescript
import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'path',
  name: 'Path',
  description: 'Visual stage progression for records',
  icon: 'GitBranch',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
```

- [ ] **Step 2: Register in the internal widget registry**

In `apps/web/widgets/internal/registry.ts`:

Add manifest import (after line 9):

```typescript
import { config as pathManifest } from './path/widget.config'
```

Add ConfigPanel import (after line 13):

```typescript
import PathConfigPanel from './path/ConfigPanel'
```

Add registration entry to the `internalWidgetRegistrations` array (before the closing `]` on line 57):

```typescript
  {
    manifest: pathManifest,
    widgetConfigType: 'Path',
    Component: dynamic(() => import('./path/index')),
    ConfigPanel: PathConfigPanel,
  },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/internal/path/widget.config.ts apps/web/widgets/internal/registry.ts
git commit -m "feat(path): register Path widget manifest in internal registry"
```

---

## Task 5: Create Path Widget Component

**Files:**
- Create: `apps/web/widgets/internal/path/index.tsx`

- [ ] **Step 1: Create the Path widget component**

Create `apps/web/widgets/internal/path/index.tsx`:

```typescript
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, Star, X } from 'lucide-react';
import type { WidgetProps } from '@/lib/widgets/types';
import type { PathDef, PathStage } from '@/lib/schema';
import { useSchemaStore } from '@/lib/schema-store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function PathWidget({ config, record, object }: WidgetProps) {
  const schema = useSchemaStore((s) => s.schema);
  const pathId = config.pathId as string;
  const showLabel = (config.showLabel as boolean) ?? true;
  const showGuidance = (config.showGuidance as boolean) ?? true;
  const showKeyFields = (config.showKeyFields as boolean) ?? true;
  const compact = (config.compact as boolean) ?? false;

  const [popoverStageId, setPopoverStageId] = useState<string | null>(null);
  const [confirmBack, setConfirmBack] = useState<PathStage | null>(null);
  const [updating, setUpdating] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Find the path definition from schema
  const objectDef = schema?.objects.find(o => o.apiName === object.apiName);
  const pathDef = objectDef?.paths?.find(p => p.id === pathId);

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverStageId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!pathDef || !pathDef.active) return null;

  const sortedStages = [...pathDef.stages].sort((a, b) => a.order - b.order);
  const currentStageId = record[pathDef.trackingFieldApiName] as string | undefined;
  const currentStageIdx = sortedStages.findIndex(s => s.id === currentStageId);
  const effectiveIdx = currentStageIdx >= 0 ? currentStageIdx : 0;
  const currentStage = sortedStages[effectiveIdx];

  const isClosed = currentStage?.category === 'closed-won' || currentStage?.category === 'closed-lost';
  const isWon = currentStage?.category === 'closed-won';
  const isLost = currentStage?.category === 'closed-lost';

  async function advanceToStage(stage: PathStage) {
    if (updating) return;
    const recordId = record.id as string;
    if (!recordId) return;

    setUpdating(true);
    try {
      await apiClient.put(`/objects/${object.apiName}/records/${recordId}`, {
        [pathDef!.trackingFieldApiName]: stage.id,
      });
      // Trigger a record refresh by updating the record object in-place
      // The parent component should handle refetching
      record[pathDef!.trackingFieldApiName] = stage.id;
    } finally {
      setUpdating(false);
      setPopoverStageId(null);
      setConfirmBack(null);
    }
  }

  function handleStageClick(stage: PathStage, idx: number) {
    if (compact) {
      // Compact mode: click directly advances/reverts
      if (idx < effectiveIdx) {
        setConfirmBack(stage);
      } else {
        advanceToStage(stage);
      }
    } else {
      setPopoverStageId(popoverStageId === stage.id ? null : stage.id);
    }
  }

  function handleMarkStage(stage: PathStage, idx: number) {
    if (idx < effectiveIdx) {
      setConfirmBack(stage);
    } else {
      advanceToStage(stage);
    }
  }

  // Determine visual state label
  let statusLabel = '';
  if (isWon) statusLabel = 'Closed Won';
  if (isLost) statusLabel = 'Closed Lost';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Path name label */}
      {showLabel && (
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          {pathDef.name}
          {statusLabel && (
            <>
              {' — '}
              <span className={isWon ? 'text-green-500' : 'text-red-500'}>{statusLabel}</span>
            </>
          )}
        </div>
      )}

      {/* Chevron bar */}
      <div className="flex items-stretch h-9 rounded-md overflow-hidden">
        {sortedStages.map((stage, idx) => {
          const isCompleted = idx < effectiveIdx;
          const isCurrent = idx === effectiveIdx;
          const isFuture = idx > effectiveIdx;
          const isClosedWonStage = stage.category === 'closed-won';
          const isClosedLostStage = stage.category === 'closed-lost';
          const isFirst = idx === 0;
          const isLast = idx === sortedStages.length - 1;

          let bg = '';
          let text = '';
          let icon: React.ReactNode = null;

          if (isClosed) {
            // Terminal state coloring
            if (isWon) {
              if (isCompleted) { bg = 'bg-green-900'; text = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
              else if (isCurrent && isClosedWonStage) { bg = 'bg-green-500'; text = 'text-white font-bold'; icon = <Star className="w-3 h-3 mr-0.5" />; }
              else { bg = 'bg-gray-100'; text = 'text-gray-300'; }
            } else {
              if (isCompleted) { bg = 'bg-red-900'; text = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
              else if (isCurrent && isClosedLostStage) { bg = 'bg-red-500'; text = 'text-white font-bold'; icon = <X className="w-3 h-3 mr-0.5" />; }
              else { bg = 'bg-gray-100'; text = 'text-gray-300'; }
            }
          } else {
            // Active state coloring
            if (isCompleted) { bg = 'bg-[#1e3a5f]'; text = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
            else if (isCurrent) { bg = 'bg-blue-500'; text = 'text-white font-semibold'; }
            else if (isClosedWonStage && isFuture) { bg = 'bg-green-50'; text = 'text-green-700'; }
            else if (isClosedLostStage && isFuture) { bg = 'bg-red-50'; text = 'text-red-700'; }
            else { bg = 'bg-gray-200'; text = 'text-gray-600'; }
          }

          const clipFirst = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)';
          const clipMiddle = 'polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%)';
          const clipLast = 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 10px 100%, 0 50%)';
          const clipPath = isFirst ? clipFirst : isLast ? clipLast : clipMiddle;

          return (
            <div
              key={stage.id}
              className={cn(
                'flex-1 flex items-center justify-center text-xs cursor-pointer transition-opacity relative',
                bg, text,
                !isFirst && '-ml-1.5',
                (isClosedWonStage || isClosedLostStage) && 'flex-[0.8]',
                updating && 'opacity-60 pointer-events-none',
              )}
              style={{ clipPath }}
              onClick={() => handleStageClick(stage, idx)}
            >
              <span className="flex items-center gap-0.5 px-2 truncate">
                {icon}
                {stage.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Popover */}
      {!compact && popoverStageId && (() => {
        const stage = sortedStages.find(s => s.id === popoverStageId);
        const stageIdx = sortedStages.findIndex(s => s.id === popoverStageId);
        if (!stage) return null;
        const keyFields = (showKeyFields && stage.keyFields) || [];
        const guidance = showGuidance ? stage.guidance : undefined;
        const hasContent = keyFields.length > 0 || guidance;

        return (
          <div ref={popoverRef} className="relative mt-2">
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
              <div className="font-semibold text-sm text-gray-900 mb-3">{stage.name}</div>

              {keyFields.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Fields</div>
                  <div className="grid grid-cols-2 gap-2">
                    {keyFields.map(fieldApi => {
                      const fieldDef = object.fields.find(f => f.apiName === fieldApi);
                      const value = record[fieldApi];
                      return (
                        <div key={fieldApi}>
                          <div className="text-[11px] text-gray-400">{fieldDef?.label || fieldApi}</div>
                          <div className={cn('text-sm font-medium', value ? 'text-gray-900' : 'text-red-500')}>
                            {value != null && value !== '' ? String(value) : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {guidance && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Guidance for Success</div>
                  <div className="text-sm text-gray-600 leading-relaxed">{guidance}</div>
                </div>
              )}

              <button
                onClick={() => handleMarkStage(stage, stageIdx)}
                disabled={updating || stageIdx === effectiveIdx}
                className="w-full py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stageIdx === effectiveIdx ? 'Current Stage' : 'Mark as Current Stage'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Backward confirmation dialog */}
      {confirmBack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Move backward?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to move back to <strong>{confirmBack.name}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmBack(null)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => advanceToStage(confirmBack)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/internal/path/index.tsx
git commit -m "feat(path): create Path widget component with chevron bar and popover"
```

---

## Task 6: Create Path Widget Config Panel

**Files:**
- Create: `apps/web/widgets/internal/path/ConfigPanel.tsx`

- [ ] **Step 1: Create the ConfigPanel component**

Create `apps/web/widgets/internal/path/ConfigPanel.tsx`:

```typescript
'use client';

import React from 'react';
import type { ConfigPanelProps } from '@/lib/widgets/types';
import { useSchemaStore } from '@/lib/schema-store';
import { Label } from '@/components/ui/label';

export default function PathConfigPanel({ config, onChange, object }: ConfigPanelProps) {
  const schema = useSchemaStore((s) => s.schema);
  const objectDef = schema?.objects.find(o => o.apiName === object.apiName);
  const paths = (objectDef?.paths || []).filter(p => p.active);

  const pathId = (config.pathId as string) || '';
  const showLabel = (config.showLabel as boolean) ?? true;
  const showGuidance = (config.showGuidance as boolean) ?? true;
  const showKeyFields = (config.showKeyFields as boolean) ?? true;
  const compact = (config.compact as boolean) ?? false;

  // Auto-select if only one path exists
  const effectivePathId = pathId || (paths.length === 1 ? paths[0].id : '');

  return (
    <div className="space-y-4">
      {/* Path selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Path</Label>
        {paths.length === 0 ? (
          <div className="text-xs text-gray-400 py-1">
            No active paths configured for this object. Create one in Object Manager → Paths.
          </div>
        ) : (
          <select
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
            value={effectivePathId}
            onChange={e => onChange({ ...config, pathId: e.target.value })}
          >
            <option value="">Select a path...</option>
            {paths.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.stages.length} stages)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Display options */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <Label className="text-xs text-gray-500 uppercase font-semibold">Display Options</Label>

        <ToggleOption
          label="Show path name"
          checked={showLabel}
          onChange={v => onChange({ ...config, showLabel: v })}
        />
        <ToggleOption
          label="Show guidance"
          checked={showGuidance}
          onChange={v => onChange({ ...config, showGuidance: v })}
        />
        <ToggleOption
          label="Show key fields"
          checked={showKeyFields}
          onChange={v => onChange({ ...config, showKeyFields: v })}
        />
        <ToggleOption
          label="Compact mode"
          description="Click stages to advance directly, no popover"
          checked={compact}
          onChange={v => onChange({ ...config, compact: v })}
        />
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-xs text-gray-700">{label}</div>
        {description && <div className="text-[10px] text-gray-400">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 ${
          checked ? 'bg-brand-navy' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/widgets/internal/path/ConfigPanel.tsx
git commit -m "feat(path): create Path widget config panel for page builder"
```

---

## Task 7: Wire Up Page Builder Integration

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/dnd/drag-parser.ts`
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/canvas-widget.tsx`
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/properties/widget-config-panel.tsx`
- Modify: `apps/web/components/layout-widgets-inline.tsx`

- [ ] **Step 1: Add 'Path' to WIDGET_TYPES in drag-parser.ts**

In `apps/web/app/object-manager/[objectApi]/page-editor/dnd/drag-parser.ts`, add `'Path'` to the `WIDGET_TYPES` set (line 50-60):

```typescript
const WIDGET_TYPES: ReadonlySet<string> = new Set<string>([
  'RelatedList',
  'CustomComponent',
  'ActivityFeed',
  'FileFolder',
  'Spacer',
  'HeaderHighlights',
  'TeamMembersRollup',
  'TeamMemberAssociations',
  'ExternalWidget',
  'Path',
]);
```

- [ ] **Step 2: Add Path to canvas-widget.tsx**

In `apps/web/app/object-manager/[objectApi]/page-editor/canvas-widget.tsx`:

Add `GitBranch` to the Lucide import (line 10-22). Add it after `Users`:

```typescript
import {
  Sparkles,
  Trash2,
  LayoutGrid,
  Activity,
  FolderOpen,
  Component,
  Minus,
  Puzzle,
  Rows3,
  List,
  Users,
  GitBranch,
} from 'lucide-react';
```

Add entry to `WIDGET_ICONS` (line 28-38):

```typescript
const WIDGET_ICONS: Partial<Record<LayoutWidget['widgetType'], React.ElementType>> = {
  RelatedList: List,
  ActivityFeed: Activity,
  FileFolder: FolderOpen,
  CustomComponent: Component,
  Spacer: Minus,
  HeaderHighlights: Sparkles,
  TeamMembersRollup: Users,
  TeamMemberAssociations: Users,
  ExternalWidget: Puzzle,
  Path: GitBranch,
};
```

Add entry to `WIDGET_LABELS` (line 40-49):

```typescript
const WIDGET_LABELS: Partial<Record<LayoutWidget['widgetType'], string>> = {
  RelatedList: 'Related List',
  ActivityFeed: 'Activity Feed',
  FileFolder: 'File Folder',
  CustomComponent: 'Custom Component',
  Spacer: 'Spacer',
  HeaderHighlights: 'Header Highlights',
  TeamMembersRollup: 'Team Members',
  TeamMemberAssociations: 'Team Member Associations',
  Path: 'Path',
};
```

Add case to `summarizeWidget` function (insert before the `default:` case on line 80):

```typescript
    case 'Path': {
      const schema = useSchemaStore.getState().schema;
      const obj = schema?.objects.find(o => (o.paths || []).some(p => p.id === widget.config.pathId));
      const path = obj?.paths?.find(p => p.id === widget.config.pathId);
      return path?.name || 'No path selected';
    }
```

Add the import for `useSchemaStore` at the top of the file (after line 8):

```typescript
import { useSchemaStore } from '@/lib/schema-store';
```

- [ ] **Step 3: Add Path handling to widget-config-panel.tsx**

In `apps/web/app/object-manager/[objectApi]/page-editor/properties/widget-config-panel.tsx`:

The Path widget uses a ConfigPanel, so it's automatically handled by the existing block on lines 40-65. Add `'Path'` to the condition on line 40:

```typescript
      {(selection.widget.config.type === 'RelatedList' ||
        selection.widget.config.type === 'HeaderHighlights' ||
        selection.widget.config.type === 'TeamMembersRollup' ||
        selection.widget.config.type === 'TeamMemberAssociations' ||
        selection.widget.config.type === 'Path') && (() => {
```

- [ ] **Step 4: Add Path label to layout-widgets-inline.tsx**

In `apps/web/components/layout-widgets-inline.tsx`, add a case for `'Path'` in the `getWidgetLabel` function (before the `default:` case around line 131):

```typescript
    case 'Path':
      return 'Path'
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/dnd/drag-parser.ts \
       apps/web/app/object-manager/\[objectApi\]/page-editor/canvas-widget.tsx \
       apps/web/app/object-manager/\[objectApi\]/page-editor/properties/widget-config-panel.tsx \
       apps/web/components/layout-widgets-inline.tsx
git commit -m "feat(path): wire Path widget into page builder (DnD, canvas, config panel)"
```

---

## Task 8: Verification

- [ ] **Step 1: Start the dev server**

Run: `cd apps/web && npm run dev`

- [ ] **Step 2: Test Path settings UI**

1. Navigate to Object Manager → select Opportunity → click "Paths" in sidebar
2. Click "+ New Path"
3. Enter name "Sales Process", add 4+ stages:
   - Prospecting (Active)
   - Qualification (Active) — add key fields: budget, decision maker
   - Proposal (Active)
   - Negotiation (Active) — add guidance text
   - Closed Won (Closed Won)
   - Closed Lost (Closed Lost)
4. Save the path
5. Verify it appears in the list with stage preview chips
6. Click Edit — verify all data persists
7. Test Duplicate and Delete from overflow menu

- [ ] **Step 3: Test Page Builder integration**

1. Go to Object Manager → Opportunity → Page Editor
2. From the widget palette, drag a "Path" widget into a region
3. In the config panel, select the "Sales Process" path
4. Toggle display options (show label, guidance, key fields, compact mode)
5. Verify the canvas shows "Path" with the path name summary

- [ ] **Step 4: Test Path widget on record detail**

1. Navigate to an Opportunity record
2. Verify the path widget renders with chevron stages
3. Click a stage — popover shows key fields + guidance + "Mark as Current Stage"
4. Click "Mark as Current Stage" on a future stage — bar updates
5. Click a previous stage — confirmation dialog appears
6. Test closed states (set to Closed Won / Closed Lost)

- [ ] **Step 5: Final commit**

If any fixes were needed during testing, commit them:

```bash
git add -A
git commit -m "fix(path): address issues found during verification testing"
```
