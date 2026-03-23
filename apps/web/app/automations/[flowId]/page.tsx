'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Play, Plus, Trash2, Settings, ChevronDown,
  Zap, GitBranch, Database, Mail, Repeat, Monitor, Pencil,
  ArrowRight, Check, X, MoreVertical, ChevronRight,
  FileEdit, Search as SearchIcon, Upload, Download, Copy
} from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';
import type {
  FlowDefinition, FlowElement, FlowElementType, FlowConnector,
  ConditionExpr,
} from '@/lib/schema';

// ── Element type metadata ──────────────────────────────────────────

const ELEMENT_PALETTE: {
  type: FlowElementType;
  label: string;
  description: string;
  icon: typeof Zap;
  color: string;
  category: string;
}[] = [
  { type: 'assignment',     label: 'Assignment',       description: 'Set field values on a variable or record',   icon: FileEdit,    color: 'bg-orange-500',  category: 'Logic' },
  { type: 'decision',       label: 'Decision',         description: 'Create branching paths based on conditions', icon: GitBranch,   color: 'bg-amber-500',   category: 'Logic' },
  { type: 'loop',           label: 'Loop',             description: 'Iterate over a collection of records',       icon: Repeat,      color: 'bg-pink-500',    category: 'Logic' },
  { type: 'get-records',    label: 'Get Records',      description: 'Look up records from an object',             icon: SearchIcon,  color: 'bg-blue-500',    category: 'Data' },
  { type: 'create-record',  label: 'Create Record',    description: 'Create a new record',                        icon: Plus,        color: 'bg-green-500',   category: 'Data' },
  { type: 'update-records', label: 'Update Records',   description: 'Update existing records',                    icon: Upload,      color: 'bg-teal-500',    category: 'Data' },
  { type: 'delete-records', label: 'Delete Records',   description: 'Delete records',                             icon: Trash2,      color: 'bg-red-500',     category: 'Data' },
  { type: 'send-email',     label: 'Send Email',       description: 'Send an email alert',                        icon: Mail,        color: 'bg-indigo-500',  category: 'Actions' },
  { type: 'screen',         label: 'Screen',           description: 'Display a form or information to the user',  icon: Monitor,     color: 'bg-purple-500',  category: 'Interaction' },
  { type: 'action',         label: 'Action',           description: 'Execute a custom action',                    icon: Zap,         color: 'bg-gray-500',    category: 'Actions' },
];

const DEFAULT_META = { type: 'action' as FlowElementType, label: 'Action', description: '', icon: Zap, color: 'bg-gray-500', category: 'Actions' };

function getElementMeta(type: FlowElementType) {
  return ELEMENT_PALETTE.find(e => e.type === type) ?? DEFAULT_META;
}

// ── Canvas constants ───────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;
const GRID_SIZE = 20;

function snapToGrid(v: number) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

// ── Flow Node component ────────────────────────────────────────────

function FlowNode({
  element,
  selected,
  onSelect,
  onDragStart,
  onConnect,
}: {
  element: FlowElement;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onConnect: () => void;
}) {
  const meta = getElementMeta(element.type);
  const Icon = element.type === 'start' ? Play : meta.icon;
  const bgColor = element.type === 'start' ? 'bg-green-500' : meta.color;

  return (
    <div
      className={cn(
        'absolute group cursor-move select-none',
      )}
      style={{
        left: element.position.x,
        top: element.position.y,
        width: NODE_WIDTH,
      }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(); onDragStart(e); }}
    >
      <div className={cn(
        'bg-white rounded-xl border-2 shadow-sm transition-all hover:shadow-md',
        selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200',
      )}>
        <div className="flex items-center gap-2.5 px-3 py-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', bgColor)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-gray-900 truncate">{element.label}</div>
            <div className="text-[10px] text-gray-400 truncate">
              {element.type === 'start' ? 'Trigger' : meta.label}
            </div>
          </div>
        </div>
      </div>

      {/* Add connector button (bottom center) */}
      <button
        onClick={(e) => { e.stopPropagation(); onConnect(); }}
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-blue-600 z-10"
        title="Add next element"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Connection line (SVG) ──────────────────────────────────────────

function ConnectionLine({
  from,
  to,
  label,
  elements,
}: {
  from: string;
  to: string;
  label?: string;
  elements: FlowElement[];
}) {
  const fromEl = elements.find(e => e.id === from);
  const toEl = elements.find(e => e.id === to);
  if (!fromEl || !toEl) return null;

  const x1 = fromEl.position.x + NODE_WIDTH / 2;
  const y1 = fromEl.position.y + NODE_HEIGHT;
  const x2 = toEl.position.x + NODE_WIDTH / 2;
  const y2 = toEl.position.y;

  const midY = (y1 + y2) / 2;

  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2}
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <text
          x={(x1 + x2) / 2}
          y={midY - 6}
          textAnchor="middle"
          className="text-[10px] fill-gray-400 font-medium"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ── Add Element Panel (right-side sheet) ───────────────────────────

function AddElementPanel({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (type: FlowElementType) => void;
}) {
  const [search, setSearch] = useState('');

  if (!open) return null;

  const categories = ['Logic', 'Data', 'Actions', 'Interaction'];
  const filtered = ELEMENT_PALETTE.filter(e =>
    e.label.toLowerCase().includes(search.toLowerCase()) ||
    e.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-xl z-20 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Add Element</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-4 py-2">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search elements…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {categories.map(cat => {
          const items = filtered.filter(e => e.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mt-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{cat}</div>
              <div className="space-y-1.5">
                {items.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      onClick={() => onAdd(item.type)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                    >
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.color)}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.label}</div>
                        <div className="text-[11px] text-gray-400">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Element Config Panel (right-side sheet) ────────────────────────

function ElementConfigPanel({
  element,
  flow,
  onUpdate,
  onDelete,
  onClose,
}: {
  element: FlowElement;
  flow: FlowDefinition;
  onUpdate: (updates: Partial<FlowElement>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { schema } = useSchemaStore();
  const meta = getElementMeta(element.type);
  const objects = schema?.objects?.filter(o => o.apiName !== 'Home') || [];

  const updateConfig = (key: string, value: any) => {
    onUpdate({ config: { ...element.config, [key] : value } });
  };

  return (
    <div className={cn(
      "absolute right-0 top-0 bottom-0 bg-white border-l border-gray-200 shadow-xl z-20 flex flex-col",
      element.type === 'update-records' || element.type === 'get-records' || element.type === 'create-record' || element.type === 'delete-records'
        ? 'w-[480px]' : 'w-96'
    )}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', meta.color)}>
            <meta.icon className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">{meta.label}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
          <input
            value={element.label}
            onChange={e => onUpdate({ label: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea
            value={element.description || ''}
            onChange={e => onUpdate({ description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
        </div>

        {/* ── Type-specific config sections ── */}

        {/* START element — trigger config */}
        {element.type === 'start' && flow.type === 'record-triggered' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Object</label>
              <select
                value={flow.objectApiName || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
              >
                <option>{flow.objectApiName || 'Not set'}</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Set when creating the flow.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trigger Event</label>
              <select
                value={element.config.triggerEvent || flow.triggerEvent || 'create_or_update'}
                onChange={e => updateConfig('triggerEvent', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="create">A record is created</option>
                <option value="update">A record is updated</option>
                <option value="create_or_update">A record is created or updated</option>
                <option value="delete">A record is deleted</option>
              </select>
            </div>
          </>
        )}

        {element.type === 'start' && flow.type === 'schedule-triggered' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
              <select
                value={element.config.frequency || 'daily'}
                onChange={e => updateConfig('frequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="once">Once</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={element.config.time || '09:00'}
                onChange={e => updateConfig('time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </>
        )}

        {/* ASSIGNMENT */}
        {element.type === 'assignment' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target Object</label>
              <select
                value={element.config.objectApiName || flow.objectApiName || ''}
                onChange={e => updateConfig('objectApiName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select object…</option>
                {objects.map(o => <option key={o.apiName} value={o.apiName}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Assignments</label>
              {(element.config.assignments || []).map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    value={a.field || ''}
                    onChange={e => {
                      const updated = [...(element.config.assignments || [])];
                      updated[i] = { ...a, field: e.target.value };
                      updateConfig('assignments', updated);
                    }}
                    placeholder="Field API name"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-gray-400">=</span>
                  <input
                    value={a.value || ''}
                    onChange={e => {
                      const updated = [...(element.config.assignments || [])];
                      updated[i] = { ...a, value: e.target.value };
                      updateConfig('assignments', updated);
                    }}
                    placeholder="Value"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={() => {
                      const updated = (element.config.assignments || []).filter((_: any, j: number) => j !== i);
                      updateConfig('assignments', updated);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateConfig('assignments', [...(element.config.assignments || []), { field: '', value: '' }])}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
              >
                <Plus className="w-3 h-3" /> Add Assignment
              </button>
            </div>
          </>
        )}

        {/* DECISION */}
        {element.type === 'decision' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Outcomes</label>
            <p className="text-[11px] text-gray-400 mb-2">
              Define conditions for each branch. The first matching outcome is followed. Unmatched records go to the default outcome.
            </p>
            {(element.config.outcomes || []).map((outcome: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <input
                    value={outcome.label || `Outcome ${i + 1}`}
                    onChange={e => {
                      const updated = [...(element.config.outcomes || [])];
                      updated[i] = { ...outcome, label: e.target.value };
                      updateConfig('outcomes', updated);
                    }}
                    className="text-sm font-medium border-none p-0 focus:ring-0 bg-transparent"
                  />
                  <button
                    onClick={() => {
                      const updated = (element.config.outcomes || []).filter((_: any, j: number) => j !== i);
                      updateConfig('outcomes', updated);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={outcome.field || ''}
                    onChange={e => {
                      const updated = [...(element.config.outcomes || [])];
                      updated[i] = { ...outcome, field: e.target.value };
                      updateConfig('outcomes', updated);
                    }}
                    placeholder="Field"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <select
                    value={outcome.op || '=='}
                    onChange={e => {
                      const updated = [...(element.config.outcomes || [])];
                      updated[i] = { ...outcome, op: e.target.value };
                      updateConfig('outcomes', updated);
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                  >
                    <option value="==">Equals</option>
                    <option value="!=">Not Equal</option>
                    <option value=">">Greater Than</option>
                    <option value="<">Less Than</option>
                    <option value="CONTAINS">Contains</option>
                  </select>
                  <input
                    value={outcome.value || ''}
                    onChange={e => {
                      const updated = [...(element.config.outcomes || [])];
                      updated[i] = { ...outcome, value: e.target.value };
                      updateConfig('outcomes', updated);
                    }}
                    placeholder="Value"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => updateConfig('outcomes', [...(element.config.outcomes || []), { label: '', field: '', op: '==', value: '' }])}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Outcome
            </button>
          </div>
        )}

        {/* GET RECORDS */}
        {element.type === 'get-records' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Object</label>
              <select
                value={element.config.objectApiName || ''}
                onChange={e => updateConfig('objectApiName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select object…</option>
                {objects.map(o => <option key={o.apiName} value={o.apiName}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Filter Conditions</label>
              <p className="text-[11px] text-gray-400 mb-2">Only records matching all conditions are returned.</p>
              {(element.config.filters || []).map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    value={f.field || ''}
                    onChange={e => { const u = [...(element.config.filters || [])]; u[i] = { ...f, field: e.target.value }; updateConfig('filters', u); }}
                    placeholder="Field"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <select
                    value={f.op || '=='}
                    onChange={e => { const u = [...(element.config.filters || [])]; u[i] = { ...f, op: e.target.value }; updateConfig('filters', u); }}
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                  >
                    <option value="==">Equals</option>
                    <option value="!=">Not Equal</option>
                    <option value="CONTAINS">Contains</option>
                  </select>
                  <input
                    value={f.value || ''}
                    onChange={e => { const u = [...(element.config.filters || [])]; u[i] = { ...f, value: e.target.value }; updateConfig('filters', u); }}
                    placeholder="Value"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <button onClick={() => updateConfig('filters', (element.config.filters || []).filter((_: any, j: number) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button
                onClick={() => updateConfig('filters', [...(element.config.filters || []), { field: '', op: '==', value: '' }])}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Filter
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Limit</label>
              <input
                type="number"
                value={element.config.limit || ''}
                onChange={e => updateConfig('limit', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="No limit"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </>
        )}

        {/* CREATE RECORD */}
        {element.type === 'create-record' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Object</label>
              <select
                value={element.config.objectApiName || ''}
                onChange={e => updateConfig('objectApiName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select object…</option>
                {objects.map(o => <option key={o.apiName} value={o.apiName}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Values</label>
              {(element.config.fieldValues || []).map((fv: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    value={fv.field || ''}
                    onChange={e => { const u = [...(element.config.fieldValues || [])]; u[i] = { ...fv, field: e.target.value }; updateConfig('fieldValues', u); }}
                    placeholder="Field"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <span className="text-gray-400">=</span>
                  <input
                    value={fv.value || ''}
                    onChange={e => { const u = [...(element.config.fieldValues || [])]; u[i] = { ...fv, value: e.target.value }; updateConfig('fieldValues', u); }}
                    placeholder="Value"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <button onClick={() => updateConfig('fieldValues', (element.config.fieldValues || []).filter((_: any, j: number) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button
                onClick={() => updateConfig('fieldValues', [...(element.config.fieldValues || []), { field: '', value: '' }])}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Field Value
              </button>
            </div>
          </>
        )}

        {/* UPDATE RECORDS — Salesforce-style */}
        {element.type === 'update-records' && (() => {
          const findMode = element.config.findMode || 'trigger-record';
          const conditionLogic = element.config.conditionLogic || 'all';
          const selectedObj = objects.find(o => o.apiName === (element.config.objectApiName || flow.objectApiName));
          const objFields = selectedObj?.fields || [];
          const triggerObj = objects.find(o => o.apiName === flow.objectApiName);
          const triggerObjLabel = triggerObj?.label || flow.objectApiName || 'record';

          return (
          <>
            {/* API Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <span className="text-red-500">*</span> API Name
              </label>
              <input
                value={element.config.apiName || element.label.replace(/\s+/g, '_')}
                onChange={e => updateConfig('apiName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>

            {/* How to find records */}
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-xs font-bold text-gray-900 mb-1">
                <span className="text-red-500">*</span> How to Find Records to Update and Set Their Values
              </label>
              <div className="space-y-2 mt-2">
                {flow.type === 'record-triggered' && (
                  <>
                    <label className="flex items-start gap-2 p-2 rounded-lg border border-transparent hover:border-gray-200 cursor-pointer">
                      <input
                        type="radio"
                        name={`findMode-${element.id}`}
                        checked={findMode === 'trigger-record'}
                        onChange={() => updateConfig('findMode', 'trigger-record')}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-gray-700">Use the {triggerObjLabel.toLowerCase()} record that triggered the flow</span>
                    </label>
                    <label className="flex items-start gap-2 p-2 rounded-lg border border-transparent hover:border-gray-200 cursor-pointer">
                      <input
                        type="radio"
                        name={`findMode-${element.id}`}
                        checked={findMode === 'related-record'}
                        onChange={() => updateConfig('findMode', 'related-record')}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-gray-700">Update records related to the {triggerObjLabel.toLowerCase()} record that triggered the flow</span>
                    </label>
                  </>
                )}
                <label className="flex items-start gap-2 p-2 rounded-lg border border-transparent hover:border-gray-200 cursor-pointer">
                  <input
                    type="radio"
                    name={`findMode-${element.id}`}
                    checked={findMode === 'ids-from-collection'}
                    onChange={() => updateConfig('findMode', 'ids-from-collection')}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-gray-700">Use the IDs and all field values from a record or record collection</span>
                </label>
                <label className="flex items-start gap-2 p-2 rounded-lg border border-transparent hover:border-gray-200 cursor-pointer">
                  <input
                    type="radio"
                    name={`findMode-${element.id}`}
                    checked={findMode === 'specify-conditions'}
                    onChange={() => updateConfig('findMode', 'specify-conditions')}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-gray-700">Specify conditions to identify records, and set fields individually</span>
                </label>
              </div>
            </div>

            {/* Object selector — for specify-conditions and related-record modes */}
            {(findMode === 'specify-conditions' || findMode === 'related-record') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  <span className="text-red-500">*</span> Object
                </label>
                <select
                  value={element.config.objectApiName || flow.objectApiName || ''}
                  onChange={e => updateConfig('objectApiName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select object…</option>
                  {objects.map(o => <option key={o.apiName} value={o.apiName}>{o.label}</option>)}
                </select>
              </div>
            )}

            {/* Record variable — for ids-from-collection mode */}
            {findMode === 'ids-from-collection' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  <span className="text-red-500">*</span> Record or Record Collection
                </label>
                <input
                  value={element.config.recordVariable || ''}
                  onChange={e => updateConfig('recordVariable', e.target.value)}
                  placeholder="e.g. GetRecords.records"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">Reference the output of a Get Records or other element.</p>
              </div>
            )}

            {/* Filter Conditions — for specify-conditions and trigger/related modes */}
            {(findMode === 'trigger-record' || findMode === 'related-record' || findMode === 'specify-conditions') && (
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-xs font-bold text-gray-900 mb-2">Set Filter Conditions</label>

                {/* Condition logic */}
                <div className="mb-3">
                  <label className="block text-[11px] text-gray-500 mb-1">Condition Requirements to Update Record</label>
                  <select
                    value={conditionLogic}
                    onChange={e => updateConfig('conditionLogic', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Conditions Are Met (AND)</option>
                    <option value="any">Any Condition Is Met (OR)</option>
                    <option value="none">No conditions — update all matching records</option>
                  </select>
                </div>

                {/* Condition rows */}
                {conditionLogic !== 'none' && (
                  <div className="space-y-2">
                    {(element.config.filters || []).map((f: any, i: number) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">
                            {i === 0 ? 'Row' : conditionLogic === 'any' ? 'OR Row' : 'AND Row'}
                          </span>
                          <button
                            onClick={() => updateConfig('filters', (element.config.filters || []).filter((_: any, j: number) => j !== i))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Field</label>
                            <select
                              value={f.field || ''}
                              onChange={e => { const u = [...(element.config.filters || [])]; u[i] = { ...f, field: e.target.value }; updateConfig('filters', u); }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                            >
                              <option value="">Select…</option>
                              {objFields.map(fd => <option key={fd.apiName} value={fd.apiName}>{fd.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Operator</label>
                            <select
                              value={f.op || '=='}
                              onChange={e => { const u = [...(element.config.filters || [])]; u[i] = { ...f, op: e.target.value }; updateConfig('filters', u); }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                            >
                              <option value="==">Equals</option>
                              <option value="!=">Does Not Equal</option>
                              <option value=">">Greater Than</option>
                              <option value="<">Less Than</option>
                              <option value=">=">Greater or Equal</option>
                              <option value="<=">Less or Equal</option>
                              <option value="CONTAINS">Contains</option>
                              <option value="STARTS_WITH">Starts With</option>
                              <option value="IS_NULL">Is Null</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Value</label>
                            <input
                              value={f.value || ''}
                              onChange={e => { const u = [...(element.config.filters || [])]; u[i] = { ...f, value: e.target.value }; updateConfig('filters', u); }}
                              placeholder="Value"
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => updateConfig('filters', [...(element.config.filters || []), { field: '', op: '==', value: '' }])}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
                    >
                      <Plus className="w-3 h-3" /> Add Condition
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Set Field Values */}
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-xs font-bold text-gray-900 mb-2">
                Set Field Values for the {selectedObj?.label || triggerObjLabel} Record
              </label>
              <div className="space-y-2">
                {(element.config.fieldValues || []).map((fv: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Field Assignment</span>
                      <button
                        onClick={() => updateConfig('fieldValues', (element.config.fieldValues || []).filter((_: any, j: number) => j !== i))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Field</label>
                        <select
                          value={fv.field || ''}
                          onChange={e => { const u = [...(element.config.fieldValues || [])]; u[i] = { ...fv, field: e.target.value }; updateConfig('fieldValues', u); }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                        >
                          <option value="">Select…</option>
                          {objFields.map(fd => <option key={fd.apiName} value={fd.apiName}>{fd.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Value</label>
                        <input
                          value={fv.value || ''}
                          onChange={e => { const u = [...(element.config.fieldValues || [])]; u[i] = { ...fv, value: e.target.value }; updateConfig('fieldValues', u); }}
                          placeholder="Value"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => updateConfig('fieldValues', [...(element.config.fieldValues || []), { field: '', value: '' }])}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
                >
                  <Plus className="w-3 h-3" /> Add Field Value
                </button>
              </div>
            </div>
          </>
          );
        })()}

        {/* SEND EMAIL */}
        {element.type === 'send-email' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To (email address or {'{{field}}'} merge)</label>
              <input
                value={element.config.to || ''}
                onChange={e => updateConfig('to', e.target.value)}
                placeholder="e.g. {{email}} or user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
              <input
                value={element.config.subject || ''}
                onChange={e => updateConfig('subject', e.target.value)}
                placeholder="Email subject…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
              <textarea
                value={element.config.body || ''}
                onChange={e => updateConfig('body', e.target.value)}
                rows={4}
                placeholder="Hello {{name}},\n\nYour {{objectName}} has been updated."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">Use {'{{fieldApiName}}'} for merge tokens.</p>
            </div>
          </>
        )}

        {/* LOOP */}
        {element.type === 'loop' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Collection Variable</label>
            <input
              value={element.config.collectionVariable || ''}
              onChange={e => updateConfig('collectionVariable', e.target.value)}
              placeholder="e.g. GetRecords.records"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Reference the output of a Get Records element.</p>
          </div>
        )}

        {/* SCREEN */}
        {element.type === 'screen' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Screen Title</label>
              <input
                value={element.config.screenTitle || ''}
                onChange={e => updateConfig('screenTitle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
              <textarea
                value={element.config.instructions || ''}
                onChange={e => updateConfig('instructions', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fields to Display</label>
              {(element.config.screenFields || []).map((sf: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input value={sf.label||''} onChange={e => { const u=[...(element.config.screenFields||[])]; u[i]={...sf,label:e.target.value}; updateConfig('screenFields',u); }} placeholder="Label" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs" />
                  <select value={sf.type||'text'} onChange={e => { const u=[...(element.config.screenFields||[])]; u[i]={...sf,type:e.target.value}; updateConfig('screenFields',u); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs">
                    <option value="text">Text</option><option value="number">Number</option><option value="email">Email</option><option value="textarea">Text Area</option><option value="checkbox">Checkbox</option><option value="picklist">Picklist</option>
                  </select>
                  <button onClick={() => updateConfig('screenFields',(element.config.screenFields||[]).filter((_:any,j:number)=>j!==i))} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => updateConfig('screenFields',[...(element.config.screenFields||[]),{label:'',type:'text'}])} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Field</button>
            </div>
          </>
        )}

        {/* DELETE RECORDS */}
        {element.type === 'delete-records' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Object</label>
              <select
                value={element.config.objectApiName || ''}
                onChange={e => updateConfig('objectApiName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select object…</option>
                {objects.map(o => <option key={o.apiName} value={o.apiName}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Filter (records to delete)</label>
              {(element.config.filters || []).map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input value={f.field||''} onChange={e => { const u=[...(element.config.filters||[])]; u[i]={...f,field:e.target.value}; updateConfig('filters',u); }} placeholder="Field" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs" />
                  <select value={f.op||'=='} onChange={e => { const u=[...(element.config.filters||[])]; u[i]={...f,op:e.target.value}; updateConfig('filters',u); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs">
                    <option value="==">Equals</option><option value="!=">Not Equal</option>
                  </select>
                  <input value={f.value||''} onChange={e => { const u=[...(element.config.filters||[])]; u[i]={...f,value:e.target.value}; updateConfig('filters',u); }} placeholder="Value" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs" />
                  <button onClick={() => updateConfig('filters',(element.config.filters||[]).filter((_:any,j:number)=>j!==i))} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => updateConfig('filters',[...(element.config.filters||[]),{field:'',op:'==',value:''}])} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Filter</button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {element.type !== 'start' && (
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onDelete}
            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Element
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Flow Builder Page ─────────────────────────────────────────

export default function FlowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.flowId as string;
  const { schema, updateFlow, getFlow } = useSchemaStore();

  const flow = getFlow(flowId);

  const [elements, setElements] = useState<FlowElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ elementId: string; startX: number; startY: number; elStartX: number; elStartY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);

  // Load flow elements
  useEffect(() => {
    if (flow) setElements(flow.elements.map(e => ({ ...e, connectors: (e.connectors || []).filter(Boolean) })));
  }, [flowId]);

  const selectedElement = selectedElementId ? elements.find(e => e.id === selectedElementId) : null;

  // Save to schema store
  const handleSave = useCallback(() => {
    if (!flow) return;
    updateFlow(flowId, { elements });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [flow, flowId, elements, updateFlow]);

  // Add element
  const handleAddElement = useCallback((type: FlowElementType) => {
    // Position below the last element or below the connecting element
    let y = 200;
    let x = 400;

    if (connectingFromId) {
      const fromEl = elements.find(e => e.id === connectingFromId);
      if (fromEl) {
        x = fromEl.position.x;
        y = fromEl.position.y + NODE_HEIGHT + 80;
      }
    } else {
      // Place below the lowest element
      const maxY = Math.max(...elements.map(e => e.position.y), 0);
      y = maxY + NODE_HEIGHT + 80;
    }

    const meta = getElementMeta(type);
    const newId = `el_${Date.now().toString(36)}`;
    const newElement: FlowElement = {
      id: newId,
      type,
      label: meta.label,
      position: { x: snapToGrid(x), y: snapToGrid(y) },
      config: {},
      connectors: [],
    };

    let updatedElements = [...elements, newElement];

    // Auto-connect if we were connecting from another element
    if (connectingFromId) {
      updatedElements = updatedElements.map(e =>
        e.id === connectingFromId
          ? { ...e, connectors: [...(e.connectors || []), { id: `conn_${Date.now().toString(36)}`, targetElementId: newId }] }
          : e
      );
    }

    setElements(updatedElements);
    setSelectedElementId(newId);
    setShowAddPanel(false);
    setConnectingFromId(null);
  }, [elements, connectingFromId]);

  // Update element
  const handleUpdateElement = useCallback((elementId: string, updates: Partial<FlowElement>) => {
    setElements(prev => prev.map(e =>
      e.id === elementId ? { ...e, ...updates } : e
    ));
  }, []);

  // Delete element
  const handleDeleteElement = useCallback((elementId: string) => {
    setElements(prev => {
      // Remove the element and any connectors pointing to it
      return prev
        .filter(e => e.id !== elementId)
        .map(e => ({
          ...e,
          connectors: (e.connectors || []).filter(c => c && c.targetElementId !== elementId),
        }));
    });
    setSelectedElementId(null);
  }, []);

  // Node dragging
  const handleNodeDragStart = useCallback((elementId: string, e: React.MouseEvent) => {
    const el = elements.find(el => el.id === elementId);
    if (!el) return;
    dragRef.current = { elementId, startX: e.clientX, startY: e.clientY, elStartX: el.position.x, elStartY: el.position.y };
  }, [elements]);

  // Canvas panning
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setSelectedElementId(null);
      panRef.current = { startX: e.clientX, startY: e.clientY, panStartX: pan.x, panStartY: pan.y };
    }
  }, [pan]);

  // Mouse move — handle drag and pan
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startX) / zoom;
        const dy = (e.clientY - dragRef.current.startY) / zoom;
        setElements(prev => prev.map(el =>
          el.id === dragRef.current!.elementId
            ? { ...el, position: { x: snapToGrid(dragRef.current!.elStartX + dx), y: snapToGrid(dragRef.current!.elStartY + dy) } }
            : el
        ));
      }
      if (panRef.current) {
        const dx = e.clientX - panRef.current.startX;
        const dy = e.clientY - panRef.current.startY;
        setPan({ x: panRef.current.panStartX + dx, y: panRef.current.panStartY + dy });
      }
    };
    const handleMouseUp = () => { dragRef.current = null; panRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [zoom]);

  // Zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom(prev => Math.max(0.25, Math.min(2, prev - e.deltaY * 0.001)));
      }
    };
    const canvas = canvasRef.current;
    canvas?.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas?.removeEventListener('wheel', handleWheel);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'Delete' && selectedElementId && selectedElementId !== 'start') { handleDeleteElement(selectedElementId); }
      if (e.key === 'Escape') { setSelectedElementId(null); setShowAddPanel(false); setConnectingFromId(null); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSave, selectedElementId, handleDeleteElement]);

  if (!flow) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Flow Not Found</h2>
          <p className="text-gray-500 mb-4">This automation doesn&apos;t exist or was deleted.</p>
          <Link href="/automations" className="text-sm text-blue-600 hover:text-blue-700">← Back to Automations</Link>
        </div>
      </div>
    );
  }

  // Collect all connections
  const connections: { fromId: string; toId: string; label?: string }[] = [];
  for (const el of elements) {
    for (const conn of (el.connectors || [])) {
      if (conn?.targetElementId) {
        connections.push({ fromId: el.id, toId: conn.targetElementId, label: conn.label });
      }
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <Link href="/automations" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-gray-900">{flow.name}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium capitalize',
                flow.status === 'active' ? 'bg-green-100 text-green-700' : flow.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700',
              )}>
                {flow.status}
              </span>
              <span>•</span>
              <span>{flow.type.replace('-', ' ')}</span>
              {flow.objectApiName && <><span>•</span><span>{flow.objectApiName}</span></>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom indicator */}
          <span className="text-xs text-gray-400 mr-2">{Math.round(zoom * 100)}%</span>

          <button
            onClick={handleSave}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              saved ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved' : 'Save'}
          </button>

          {flow.status !== 'active' && (
            <button
              onClick={() => { handleSave(); updateFlow(flowId, { status: 'active' }); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              <Play className="w-4 h-4" />
              Activate
            </button>
          )}

          {flow.status === 'active' && (
            <button
              onClick={() => updateFlow(flowId, { status: 'inactive' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden" ref={canvasRef} onMouseDown={handleCanvasMouseDown}>
        {/* Grid background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
          <defs>
            <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.5} fill="#e5e7eb" />
            </pattern>
            <marker id="arrowhead" markerWidth={10} markerHeight={7} refX={10} refY={3.5} orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
          <rect width="4000" height="4000" x="-1000" y="-500" fill="url(#grid)" />
        </svg>

        {/* Connections (SVG layer) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          <defs>
            <marker id="arrowhead2" markerWidth={10} markerHeight={7} refX={10} refY={3.5} orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
          {connections.map((conn, i) => (
            <ConnectionLine key={i} from={conn.fromId} to={conn.toId} label={conn.label} elements={elements} />
          ))}
        </svg>

        {/* Nodes */}
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {elements.map(el => (
            <FlowNode
              key={el.id}
              element={el}
              selected={selectedElementId === el.id}
              onSelect={() => { setSelectedElementId(el.id); setShowAddPanel(false); }}
              onDragStart={(e) => handleNodeDragStart(el.id, e)}
              onConnect={() => { setConnectingFromId(el.id); setShowAddPanel(true); setSelectedElementId(null); }}
            />
          ))}
        </div>

        {/* Floating add button */}
        {!showAddPanel && !selectedElement && (
          <button
            onClick={() => { setShowAddPanel(true); setConnectingFromId(null); }}
            className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-10"
            title="Add Element"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        {/* Add Element Panel */}
        <AddElementPanel
          open={showAddPanel && !selectedElement}
          onClose={() => { setShowAddPanel(false); setConnectingFromId(null); }}
          onAdd={handleAddElement}
        />

        {/* Element Config Panel */}
        {selectedElement && (
          <ElementConfigPanel
            element={selectedElement}
            flow={flow}
            onUpdate={(updates) => handleUpdateElement(selectedElement.id, updates)}
            onDelete={() => handleDeleteElement(selectedElement.id)}
            onClose={() => setSelectedElementId(null)}
          />
        )}
      </div>
    </div>
  );
}
