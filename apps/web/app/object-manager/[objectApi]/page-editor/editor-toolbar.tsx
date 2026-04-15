'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Eye, Plus, Redo2, Save, Settings, Undo2, Wand2, X } from 'lucide-react';
import { useEditorStore } from './editor-store';
import { selectUndoCount, selectRedoCount } from './store';
import type { PageLayout } from './types';
import { useSchemaStore } from '@/lib/schema-store';

export function EditorToolbar({
  onSave,
  onPreview,
  onOpenRules,
  onRequestNavigate,
  backHref,
  backLabel,
  objectManagerHref,
  objectListHref: _objectListHref,
  objectListLabel: _objectListLabel,
  layoutAssignmentNote,
}: {
  onSave: () => void;
  onPreview: () => void;
  onOpenRules: () => void;
  onRequestNavigate: (href: string) => void;
  backHref: string;
  backLabel: string;
  objectManagerHref: string;
  objectListHref: string | null;
  objectListLabel: string;
  /** Explains record-type assignment vs list-view preferences */
  layoutAssignmentNote?: string | null;
}) {
  const layout = useEditorStore((s) => s.layout);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const setLayoutName = useEditorStore((s) => s.setLayoutName);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const addTab = useEditorStore((s) => s.addTab);
  const removeTab = useEditorStore((s) => s.removeTab);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const previewMode = useEditorStore((s) => s.previewMode);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const undoCount = useEditorStore(selectUndoCount);
  const redoCount = useEditorStore(selectRedoCount);

  const schema = useSchemaStore((s) => s.schema);
  const setLayoutActive = useSchemaStore((s) => s.setLayoutActive);

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(layout.name);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTabLabel, setDraftTabLabel] = useState('');
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [isActiveUpdating, setIsActiveUpdating] = useState(false);
  const [activeError, setActiveError] = useState('');
  const [pendingForceActivate, setPendingForceActivate] = useState<{
    conflictNames: string;
  } | null>(null);
  const rolesPopoverRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingName) setDraftName(layout.name);
  }, [layout.name, isEditingName]);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  useEffect(() => {
    if (!isRolesOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rolesPopoverRef.current?.contains(event.target as Node)) {
        setIsRolesOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRolesOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isRolesOpen]);

  const objectApi = useMemo(() => {
    if (layout.objectApi) return layout.objectApi;
    const match = objectManagerHref.match(/^\/object-manager\/([^/?#]+)/);
    if (!match?.[1]) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [layout.objectApi, objectManagerHref]);

  const sortedTabs = useMemo(
    () => [...layout.tabs].sort((a, b) => a.order - b.order),
    [layout.tabs],
  );

  const activeRulesCount = useMemo(
    () => (layout.formattingRules ?? []).filter((r) => r.active !== false).length,
    [layout.formattingRules],
  );

  const roleOptions = useMemo(() => {
    const roleSet = new Set<string>(layout.roles);
    const objectDef = schema?.objects.find((obj) => obj.apiName === objectApi);
    for (const existingLayout of objectDef?.pageLayouts ?? []) {
      for (const roleId of existingLayout.roles ?? []) {
        if (roleId) roleSet.add(roleId);
      }
    }
    if (roleSet.size === 0) {
      roleSet.add('Admin');
      roleSet.add('Manager');
      roleSet.add('Sales');
    }
    return Array.from(roleSet).sort((a, b) => a.localeCompare(b));
  }, [layout.roles, objectApi, schema]);

  const patchLayoutWithUndo = useCallback(
    (patch: Partial<PageLayout>) => {
      pushUndo();
      useEditorStore.setState((state) => ({
        layout: { ...state.layout, ...patch },
        isDirty: true,
      }));
    },
    [pushUndo],
  );

  const commitName = useCallback(() => {
    setIsEditingName(false);
    if (draftName !== layout.name) {
      setLayoutName(draftName);
    }
  }, [draftName, layout.name, setLayoutName]);

  const cancelNameEdit = useCallback(() => {
    setDraftName(layout.name);
    setIsEditingName(false);
  }, [layout.name]);

  const commitTabRename = useCallback((tabId: string) => {
    const next = draftTabLabel.trim();
    if (next && next !== sortedTabs.find(t => t.id === tabId)?.label) {
      pushUndo();
      useEditorStore.setState((state) => ({
        layout: {
          ...state.layout,
          tabs: state.layout.tabs.map((t) =>
            t.id === tabId ? { ...t, label: next } : t
          ),
        },
        isDirty: true,
      }));
    }
    setEditingTabId(null);
  }, [draftTabLabel, pushUndo, sortedTabs]);

  const handleToggleRole = useCallback(
    (roleId: string) => {
      const roles = layout.roles ?? [];
      const hasRole = roles.includes(roleId);
      const nextRoles = hasRole
        ? roles.filter((id) => id !== roleId)
        : [...roles, roleId];
      patchLayoutWithUndo({ roles: nextRoles });
    },
    [layout.roles, patchLayoutWithUndo],
  );

  const handleActiveToggle = useCallback(async () => {
    if (!objectApi || !layout.id || isActiveUpdating) return;
    setIsActiveUpdating(true);
    try {
      const nextActive = !layout.active;
      if (nextActive) {
        const result = await setLayoutActive(objectApi, layout.id, true);
        if (result.updated) {
          patchLayoutWithUndo({ active: true });
          setActiveError('');
          return;
        }
        if (result.conflicts.length > 0) {
          const conflictNames = result.conflicts.map((c) => c.layoutName).join(', ');
          setPendingForceActivate({ conflictNames });
          setIsActiveUpdating(false);
          return;
        } else {
          setActiveError('Unable to activate this layout. Please try again.');
        }
        return;
      }

      const result = await setLayoutActive(objectApi, layout.id, false);
      if (result.updated) {
        patchLayoutWithUndo({ active: false });
        setActiveError('');
      } else {
        setActiveError('Unable to deactivate this layout. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update layout active state', error);
      setActiveError('Failed to update active state. Please try again.');
    } finally {
      setIsActiveUpdating(false);
    }
  }, [isActiveUpdating, layout.active, layout.id, objectApi, patchLayoutWithUndo, setLayoutActive]);

  const handleForceActivate = useCallback(async () => {
    if (!objectApi || !layout.id) return;
    setPendingForceActivate(null);
    setIsActiveUpdating(true);
    try {
      const forced = await setLayoutActive(objectApi, layout.id, true, { force: true });
      if (forced.updated) {
        patchLayoutWithUndo({ active: true });
        setActiveError('');
      } else {
        setActiveError('Unable to activate this layout after resolving conflicts.');
      }
    } catch {
      setActiveError('Failed to update active state. Please try again.');
    } finally {
      setIsActiveUpdating(false);
    }
  }, [layout.id, objectApi, patchLayoutWithUndo, setLayoutActive]);

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onRequestNavigate(backHref)}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-brand-navy"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
          <div className="h-5 w-px bg-gray-200" />
          {isEditingName ? (
            <Input
              ref={nameInputRef}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelNameEdit();
                }
              }}
              className="h-8 w-64 text-base font-semibold"
              aria-label="Layout name"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="max-w-[18rem] truncate rounded px-2 py-1 text-left text-base font-semibold text-gray-900 hover:bg-gray-100"
              title={layout.name || 'Untitled layout'}
            >
              {layout.name || 'Untitled layout'}
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 px-1">
            {sortedTabs.map((tab) => {
              const isActiveTab = tab.id === activeTabId;
              return (
                <div key={tab.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    onDoubleClick={!isActiveTab ? (e) => {
                      e.stopPropagation();
                      setDraftTabLabel(tab.label);
                      setEditingTabId(tab.id);
                    } : undefined}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isActiveTab
                        ? 'border-brand-navy bg-brand-navy text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isActiveTab ? (
                      editingTabId === tab.id ? (
                        <input
                          autoFocus
                          value={draftTabLabel}
                          onChange={(e) => setDraftTabLabel(e.target.value)}
                          onBlur={() => commitTabRename(tab.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                            if (e.key === 'Escape') { e.preventDefault(); setEditingTabId(null); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-24 bg-transparent text-sm font-medium text-white outline-none"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setDraftTabLabel(tab.label);
                              setEditingTabId(tab.id);
                            }}
                            title="Double-click to rename"
                          >
                            {tab.label}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedElement({ type: 'tab', id: tab.id });
                            }}
                            className="ml-0.5 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                            aria-label={`${tab.label} tab settings`}
                            title="Tab properties"
                          >
                            <Settings className="h-3 w-3" />
                          </button>
                        </span>
                      )
                    ) : (
                      <span>{tab.label}</span>
                    )}
                  </button>
                  {!isActiveTab && sortedTabs.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Close ${tab.label} tab`}
                      className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex group-focus-within:flex"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeTab(tab.id);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => addTab()}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Tab
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative" ref={rolesPopoverRef}>
            <button
              type="button"
              onClick={() => setIsRolesOpen((open) => !open)}
              aria-expanded={isRolesOpen}
              aria-controls="layout-roles-popover"
              className="flex max-w-xs flex-wrap items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              {(layout.roles ?? []).length > 0 ? (
                (layout.roles ?? []).map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
                  >
                    {role}
                  </span>
                ))
              ) : (
                <span className="text-gray-500">No roles assigned</span>
              )}
            </button>
            {isRolesOpen ? (
              <div
                id="layout-roles-popover"
                role="dialog"
                aria-label="Assigned roles"
                className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
              >
                <p className="mb-2 text-xs font-medium text-gray-500">Assigned roles</p>
                <div className="max-h-52 space-y-1 overflow-auto">
                  {roleOptions.map((roleId) => (
                    <label
                      key={roleId}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={(layout.roles ?? []).includes(roleId)}
                        onChange={() => handleToggleRole(roleId)}
                      />
                      <span>{roleId}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              void handleActiveToggle();
            }}
            role="switch"
            aria-checked={!!layout.active}
            disabled={!layout.id || !objectApi || isActiveUpdating}
            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
              layout.active
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-300 bg-white text-gray-700'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span>Active</span>
            <span
              className={`h-4 w-8 rounded-full p-0.5 transition ${
                layout.active ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`block h-3 w-3 rounded-full bg-white transition ${
                  layout.active ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
          {activeError ? <p className="text-xs text-red-600">{activeError}</p> : null}

          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={undo}
            disabled={undoCount === 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
            {undoCount > 0 && (
              <span className="ml-1 text-xs text-gray-500">({undoCount})</span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={redo}
            disabled={redoCount === 0}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
            {redoCount > 0 && (
              <span className="ml-1 text-xs text-gray-500">({redoCount})</span>
            )}
          </Button>
          <div
            className="flex items-center gap-1.5"
            title="See what this mode looks like. Fields appear in all modes unless you check 'Hide on New/View/Edit'."
          >
            <Eye className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-500">Preview:</span>
            <div className="flex items-center rounded-md border border-gray-200 bg-gray-100 p-0.5" role="radiogroup" aria-label="Preview mode">
              {(['new', 'view', 'edit'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={previewMode === mode}
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    previewMode === mode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <Button variant="outline" size="sm" type="button" onClick={onPreview}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
          <Button
            onClick={onSave}
            size="sm"
            disabled={!isDirty}
            className="bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-60"
          >
            <Save className="mr-1.5 h-4 w-4" />
            Save
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={onOpenRules}>
            <Wand2 className="mr-1.5 h-4 w-4" />
            Formatting Rules
            {activeRulesCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                {activeRulesCount}
              </span>
            )}
          </Button>
        </div>
      </div>
      {layoutAssignmentNote && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
          <span className="text-amber-500">ⓘ</span>
          {layoutAssignmentNote}
        </div>
      )}

      <ConfirmDialog
        open={pendingForceActivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingForceActivate(null);
            setActiveError('Activation cancelled.');
          }
        }}
        title="Conflicting active layouts"
        description={`This will deactivate: ${pendingForceActivate?.conflictNames ?? ''}. Continue?`}
        confirmLabel="Activate Anyway"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => { void handleForceActivate(); }}
      />
    </div>
  );
}
