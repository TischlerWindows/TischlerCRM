'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Zap, Plus, Search, MoreVertical, ChevronRight, Trash2, Copy, Pencil,
  PlayCircle, PauseCircle, Clock, Monitor, Rocket, Database, Mail,
  GitBranch, Filter, LayoutGrid, List, ArrowUpDown,
} from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';
import type { FlowDefinition, FlowType, FlowStatus } from '@/lib/schema';

// ── Category definitions ───────────────────────────────────────────

const CATEGORIES: {
  id: FlowType | 'all';
  label: string;
  description: string;
  icon: typeof Zap;
  color: string;
}[] = [
  {
    id: 'all',
    label: 'All Automations',
    description: 'View every automation in your org.',
    icon: Zap,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    id: 'record-triggered',
    label: 'Triggered Automations',
    description: 'Automations launched by records and events. Runs without user interaction.',
    icon: Database,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'schedule-triggered',
    label: 'Scheduled Automations',
    description: 'Time-based automations that launch at a specific time or frequency.',
    icon: Clock,
    color: 'bg-amber-100 text-amber-600',
  },
  {
    id: 'screen',
    label: 'Screen Automations',
    description: 'Interface-driven automations that guide users through business processes.',
    icon: Monitor,
    color: 'bg-green-100 text-green-600',
  },
  {
    id: 'autolaunched',
    label: 'Autolaunched Automations',
    description: 'Automations that launch when invoked by APIs, processes, or other automations.',
    icon: Rocket,
    color: 'bg-purple-100 text-purple-600',
  },
];

// ── Frequently-used flow type cards ────────────────────────────────

const QUICK_CREATE: {
  type: FlowType;
  label: string;
  description: string;
  icon: typeof Zap;
}[] = [
  {
    type: 'record-triggered',
    label: 'Record-Triggered Flow',
    description: 'Launches when a record is created, updated, or deleted. Runs in the background.',
    icon: Database,
  },
  {
    type: 'screen',
    label: 'Screen Flow',
    description: 'Guides users through a business process launched from pages, quick actions, and more.',
    icon: Monitor,
  },
  {
    type: 'schedule-triggered',
    label: 'Schedule-Triggered Flow',
    description: 'Launches at a specified time and frequency for each record in a batch.',
    icon: Clock,
  },
  {
    type: 'autolaunched',
    label: 'Autolaunched Flow (No Trigger)',
    description: 'Launches when invoked by other automations, REST API, and more.',
    icon: Rocket,
  },
];

// ── New Flow Modal ─────────────────────────────────────────────────

function NewFlowModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, type: FlowType, objectApiName?: string) => void;
}) {
  const { schema } = useSchemaStore();
  const [step, setStep] = useState<'type' | 'config'>('type');
  const [selectedType, setSelectedType] = useState<FlowType | null>(null);
  const [flowName, setFlowName] = useState('');
  const [objectApi, setObjectApi] = useState('');

  const reset = () => { setStep('type'); setSelectedType(null); setFlowName(''); setObjectApi(''); };

  if (!open) return null;

  const objects = schema?.objects?.filter(o => o.apiName !== 'Home') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {step === 'type' ? 'New Automation' : 'Configure Flow'}
          </h2>
          <button onClick={() => { onClose(); reset(); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {step === 'type' && (
          <div className="p-6 overflow-y-auto flex-1">
            <p className="text-sm text-gray-500 mb-5">Select a flow type to get started.</p>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Frequently Used</h3>
                <div className="grid grid-cols-2 gap-3">
                  {QUICK_CREATE.map(qc => {
                    const Icon = qc.icon;
                    return (
                      <button
                        key={qc.type}
                        onClick={() => { setSelectedType(qc.type); setStep('config'); }}
                        className="text-left border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{qc.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{qc.description}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'config' && selectedType && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Flow Name</label>
              <input
                autoFocus
                value={flowName}
                onChange={e => setFlowName(e.target.value)}
                placeholder="e.g. Auto-assign Lead Owner"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {selectedType === 'record-triggered' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Object</label>
                <select
                  value={objectApi}
                  onChange={e => setObjectApi(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select an object…</option>
                  {objects.map(o => (
                    <option key={o.apiName} value={o.apiName}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setStep('type')} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Back</button>
              <button
                disabled={!flowName.trim() || (selectedType === 'record-triggered' && !objectApi)}
                onClick={() => { onCreate(flowName.trim(), selectedType, objectApi || undefined); reset(); }}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Flow
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Flow row actions dropdown ──────────────────────────────────────

function FlowActions({
  flow,
  onActivate,
  onDeactivate,
  onDuplicate,
  onDelete,
}: {
  flow: FlowDefinition;
  onActivate: () => void;
  onDeactivate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm">
            {flow.status !== 'active' && (
              <button onClick={() => { onActivate(); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-green-500" /> Activate
              </button>
            )}
            {flow.status === 'active' && (
              <button onClick={() => { onDeactivate(); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-amber-500" /> Deactivate
              </button>
            )}
            <button onClick={() => { onDuplicate(); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
              <Copy className="w-4 h-4 text-gray-400" /> Duplicate
            </button>
            <button onClick={() => { onDelete(); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: FlowStatus }) {
  const styles: Record<FlowStatus, string> = {
    active: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-600',
    inactive: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', styles[status])}>
      {status}
    </span>
  );
}

// ── Type label helper ──────────────────────────────────────────────

const TYPE_LABELS: Record<FlowType, string> = {
  'record-triggered': 'Record-Triggered',
  'schedule-triggered': 'Schedule-Triggered',
  'screen': 'Screen',
  'autolaunched': 'Autolaunched',
};

// ── Main Page ──────────────────────────────────────────────────────

export default function AutomationsPage() {
  const router = useRouter();
  const { schema, addFlow, updateFlow, deleteFlow } = useSchemaStore();
  const [showNew, setShowNew] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FlowType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const flows = schema?.flows || [];

  // Filter by category + search
  const filteredFlows = useMemo(() => {
    let result = flows;
    if (activeCategory !== 'all') result = result.filter(f => f.type === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (f.objectApiName || '').toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [flows, activeCategory, searchQuery]);

  const handleCreate = (name: string, type: FlowType, objectApiName?: string) => {
    const flowId = addFlow({
      name,
      type,
      status: 'draft',
      version: 1,
      objectApiName,
      elements: [
        {
          id: 'start',
          type: 'start',
          label: 'Start',
          position: { x: 400, y: 80 },
          config: {},
          connectors: [],
        },
      ],
    });
    setShowNew(false);
    router.push(`/automations/${flowId}`);
  };

  const handleDuplicate = (flow: FlowDefinition) => {
    addFlow({
      name: `${flow.name} (Copy)`,
      type: flow.type,
      status: 'draft',
      version: 1,
      objectApiName: flow.objectApiName,
      triggerEvent: flow.triggerEvent,
      triggerConditions: flow.triggerConditions,
      schedule: flow.schedule,
      elements: flow.elements.map(e => ({ ...e })),
    });
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: flows.length };
    for (const f of flows) counts[f.type] = (counts[f.type] || 0) + 1;
    return counts;
  }, [flows]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-600" />
              Process Automation
            </h1>
            <p className="text-sm text-gray-500 mt-1">Build, manage, and monitor your automated business processes.</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Flow
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Category cards */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'text-left rounded-xl border p-4 transition-all',
                  isActive
                    ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', cat.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-400">{categoryCounts[cat.id] || 0}</span>
                </div>
                <div className="text-sm font-semibold text-gray-900 truncate">{cat.label}</div>
              </button>
            );
          })}
        </div>

        {/* Search + view toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search automations…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-2', viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-2', viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Empty state */}
        {filteredFlows.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {flows.length === 0 ? 'Get Started with Automations' : 'No matching automations'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {flows.length === 0
                ? 'Create your first flow to automate business processes. Select a flow type to begin.'
                : 'Try adjusting your search or category filter.'}
            </p>
            {flows.length === 0 && (
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New Flow
              </button>
            )}
          </div>
        )}

        {/* List view */}
        {filteredFlows.length > 0 && viewMode === 'list' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Object</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Last Modified</th>
                  <th className="w-12 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFlows.map(flow => (
                  <tr key={flow.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/automations/${flow.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {flow.name}
                      </Link>
                      {flow.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{flow.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{TYPE_LABELS[flow.type]}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{flow.objectApiName || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={flow.status} /></td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {new Date(flow.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <FlowActions
                        flow={flow}
                        onActivate={() => updateFlow(flow.id, { status: 'active' })}
                        onDeactivate={() => updateFlow(flow.id, { status: 'inactive' })}
                        onDuplicate={() => handleDuplicate(flow)}
                        onDelete={() => deleteFlow(flow.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Grid view */}
        {filteredFlows.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-3 gap-4">
            {filteredFlows.map(flow => {
              const cat = CATEGORIES.find(c => c.id === flow.type);
              const Icon = cat?.icon || Zap;
              return (
                <div key={flow.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', cat?.color || 'bg-gray-100')}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <FlowActions
                      flow={flow}
                      onActivate={() => updateFlow(flow.id, { status: 'active' })}
                      onDeactivate={() => updateFlow(flow.id, { status: 'inactive' })}
                      onDuplicate={() => handleDuplicate(flow)}
                      onDelete={() => deleteFlow(flow.id)}
                    />
                  </div>
                  <Link href={`/automations/${flow.id}`} className="block group">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 mb-1">{flow.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2">{flow.description || TYPE_LABELS[flow.type]}</p>
                  </Link>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <StatusBadge status={flow.status} />
                    <span className="text-xs text-gray-400">{new Date(flow.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New flow modal */}
      <NewFlowModal open={showNew} onClose={() => setShowNew(false)} onCreate={handleCreate} />
    </div>
  );
}
