'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, Plus, Save, Wand2, X } from 'lucide-react';
import { useEditorStore } from './editor-store';
import type { EditorPageLayout } from './types';
import { useSchemaStore } from '@/lib/schema-store';

export function EditorToolbar({
  onSave,
  onPreview,
  onOpenRules,
  onRequestNavigate,
  objectManagerHref,
  objectListHref: _objectListHref,
  objectListLabel: _objectListLabel,
  layoutAssignmentNote: _layoutAssignmentNote,
}: {
  onSave: () => void;
  onPreview: () => void;
  onOpenRules: () => void;
  onRequestNavigate: (href: string) => void;
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
  const pushUndo = useEditorStore((s) => s.pushUndo);

  const schema = useSchemaStore((s) => s.schema);
  const setLayoutActive = useSchemaStore((s) => s.setLayoutActive);

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(layout.name);
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [isActiveUpdating, setIsActiveUpdating] = useState(false);
  const [activeError, setActiveError] = useState('');
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
    (patch: Partial<EditorPageLayout>) => {
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

  const handleToggleRole = useCallback(
    (roleId: string) => {
      const hasRole = layout.roles.includes(roleId);
      const nextRoles = hasRole
        ? layout.roles.filter((id) => id !== roleId)
        : [...layout.roles, roleId];
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
          const confirmForce = window.confirm(
            `This will deactivate conflicting layouts: ${conflictNames}. Continue?`,
          );
          if (!confirmForce) {
            setActiveError('Activation cancelled due to conflicting active layouts.');
            return;
          }
          const forced = await setLayoutActive(objectApi, layout.id, true, { force: true });
          if (forced.updated) {
            patchLayoutWithUndo({ active: true });
            setActiveError('');
          } else {
            setActiveError('Unable to activate this layout after resolving conflicts.');
          }
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

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onRequestNavigate(objectManagerHref)}
            className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-navy"
          >
            ← Layouts
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
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isActiveTab
                        ? 'border-brand-navy bg-brand-navy text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{tab.label}</span>
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
              {layout.roles.length > 0 ? (
                layout.roles.map((role) => (
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
                        checked={layout.roles.includes(roleId)}
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
          </Button>
        </div>
      </div>
    </div>
  );
}
