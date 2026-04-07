'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PageLayout } from '@/lib/schema';
import type { SetLayoutActiveResult } from '@/lib/schema-store';
import { ArrowRightLeft, Copy, Layout, Pencil, Plus, Star, Trash2 } from 'lucide-react';

interface LayoutListViewProps {
  objectLabel?: string;
  layouts: PageLayout[];
  onCreate: () => void;
  onEdit: (layoutId: string) => void;
  onDelete: (layoutId: string) => void | Promise<void>;
  onSetActive: (
    layoutId: string,
    active: boolean,
    options?: { force?: boolean },
  ) => Promise<SetLayoutActiveResult>;
  onSetDefault: (layoutId: string) => Promise<void>;
  onSetRoles: (layoutId: string, roles: string[]) => Promise<void>;
  availableRoles: string[];
  onDuplicate?: (layoutId: string) => void | Promise<void>;
  onMigrateLayouts?: (fromPageLayoutId: string) => Promise<{ updatedCount: number }>;
}

function formatLastModified(layout: PageLayout): string {
  const maybeUpdatedAt = layout.updatedAt;
  if (!maybeUpdatedAt) return '—';
  const parsed = new Date(maybeUpdatedAt);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function getStatus(layout: PageLayout): 'Active' | 'Default' | 'Draft' {
  if (layout.active) return 'Active';
  if (layout.isDefault) return 'Default';
  return 'Draft';
}

export function LayoutListView({
  objectLabel,
  layouts,
  onCreate,
  onEdit,
  onDelete,
  onSetActive,
  onSetDefault,
  onSetRoles,
  availableRoles,
  onDuplicate,
  onMigrateLayouts,
}: LayoutListViewProps) {
  const [rolesLayoutId, setRolesLayoutId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [pendingActiveLayoutId, setPendingActiveLayoutId] = useState<string | null>(null);
  const [pendingDefaultLayoutId, setPendingDefaultLayoutId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Migrate records dialog state ──────────────────────────────────────
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [migrateFromId, setMigrateFromId] = useState<string>('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<number | null>(null);
  const [migrateError, setMigrateError] = useState<string | null>(null);

  const openMigrateDialog = () => {
    setMigrateFromId(layouts[0]?.id ?? '');
    setMigrateResult(null);
    setMigrateError(null);
    setShowMigrateDialog(true);
  };

  const closeMigrateDialog = () => {
    if (isMigrating) return;
    setShowMigrateDialog(false);
    setMigrateResult(null);
    setMigrateError(null);
  };

  const runMigration = async () => {
    if (!onMigrateLayouts || !migrateFromId) return;
    setIsMigrating(true);
    setMigrateError(null);
    setMigrateResult(null);
    try {
      const { updatedCount } = await onMigrateLayouts(migrateFromId);
      setMigrateResult(updatedCount);
    } catch (err) {
      console.error('Failed to migrate record layouts:', err);
      setMigrateError('Migration failed. Please try again.');
    } finally {
      setIsMigrating(false);
    }
  };

  const roleOptions = useMemo(
    () => Array.from(new Set(availableRoles.filter(Boolean))),
    [availableRoles],
  );

  const editingLayout = layouts.find((layout) => layout.id === rolesLayoutId);

  const openRolesDialog = (layout: PageLayout) => {
    setRolesLayoutId(layout.id);
    setSelectedRoles(layout.roles ?? []);
  };

  const closeRolesDialog = () => {
    if (savingRoles) return;
    setRolesLayoutId(null);
    setSelectedRoles([]);
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  };

  const saveRoles = async () => {
    if (!editingLayout) return;
    setSavingRoles(true);
    setErrorMessage(null);
    try {
      await onSetRoles(editingLayout.id, selectedRoles);
      setRolesLayoutId(null);
      setSelectedRoles([]);
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to save roles:', error);
      setErrorMessage('Failed to update roles. Please try again.');
    } finally {
      setSavingRoles(false);
    }
  };

  const toggleActive = async (layout: PageLayout) => {
    const nextActive = !Boolean(layout.active);
    setPendingActiveLayoutId(layout.id);
    setErrorMessage(null);
    try {
      const result = await onSetActive(layout.id, nextActive);
      if (nextActive && !result.updated && result.conflicts.length > 0) {
        const firstConflict = result.conflicts[0];
        if (!firstConflict) return;
        const firstRole = firstConflict.sharedRoleIds[0] ?? 'this role';
        const confirmed = confirm(
          `${firstConflict.layoutName} is already active for ${firstRole}. Replace it?`,
        );
        if (confirmed) {
          await onSetActive(layout.id, true, { force: true });
        }
      }
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to update active status:', error);
      setErrorMessage('Failed to update active status. Please try again.');
    } finally {
      setPendingActiveLayoutId(null);
    }
  };

  const setDefault = async (layoutId: string) => {
    setPendingDefaultLayoutId(layoutId);
    setErrorMessage(null);
    try {
      await onSetDefault(layoutId);
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to set default layout:', error);
      setErrorMessage('Failed to set default layout. Please try again.');
    } finally {
      setPendingDefaultLayoutId(null);
    }
  };

  const handleDelete = async (layoutId: string) => {
    setErrorMessage(null);
    try {
      await Promise.resolve(onDelete(layoutId));
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to delete layout:', error);
      setErrorMessage('Failed to delete layout. Please try again.');
    }
  };

  const handleDuplicate = async (layoutId: string) => {
    if (!onDuplicate) return;
    setErrorMessage(null);
    try {
      await Promise.resolve(onDuplicate(layoutId));
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to duplicate layout:', error);
      setErrorMessage('Failed to duplicate layout. Please try again.');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Page Layouts</h2>
        <p className="text-gray-600">
          Manage layouts for <strong className="font-medium">{objectLabel ?? 'this object'}</strong>,
          including role assignment, active status, and default behavior.
        </p>
      </div>
      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="mb-6 flex items-center gap-3">
        <Button onClick={onCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Layout
        </Button>
        {onMigrateLayouts && layouts.length > 0 && (
          <Button
            variant="outline"
            onClick={openMigrateDialog}
            className="flex items-center gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Migrate Records to New Layout
          </Button>
        )}
      </div>

      {layouts.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Page Layouts</h3>
          <p className="text-gray-600 mb-4">
            Create your first page layout to define how forms appear for this object.
          </p>
          <Button onClick={onCreate} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Layout
          </Button>
        </div>
      ) : (
        <Card className="rounded-lg border border-gray-200 shadow-none">
          <CardContent className="p-0">
            <div role="table" aria-label="Page layouts">
              <div role="rowgroup" className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="grid grid-cols-[1.6fr_1.3fr_0.8fr_1fr_1.4fr] gap-3 text-xs font-semibold uppercase tracking-wide text-gray-600" role="row">
                  <span role="columnheader">Layout Name</span>
                  <span role="columnheader">Assigned Roles</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Last Modified</span>
                  <span role="columnheader">Actions</span>
                </div>
              </div>
              <div className="divide-y divide-gray-100" role="rowgroup">
                {layouts.map((layout) => {
                  const status = getStatus(layout);
                  const isActiveUpdating = pendingActiveLayoutId === layout.id;
                  const isDefaultUpdating = pendingDefaultLayoutId === layout.id;
                  return (
                    <div
                      key={layout.id}
                      className="grid grid-cols-[1.6fr_1.3fr_0.8fr_1fr_1.4fr] gap-3 px-4 py-3 text-sm"
                      role="row"
                    >
                      <div className="min-w-0" role="cell">
                        <p className="truncate font-medium text-gray-900">{layout.name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2" role="cell">
                        {(layout.roles ?? []).length > 0 ? (
                          (layout.roles ?? []).map((role) => (
                            <button
                              key={`${layout.id}-${role}`}
                              type="button"
                              className="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
                              onClick={() => openRolesDialog(layout)}
                              title="Edit assigned roles"
                              aria-label={`Edit roles for ${layout.name}. Selected role ${role}`}
                            >
                              {role}
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                            onClick={() => openRolesDialog(layout)}
                            aria-label={`Edit roles for ${layout.name}`}
                          >
                            Assign roles
                          </button>
                        )}
                      </div>
                      <div className="flex items-center" role="cell">
                        <Badge
                          variant={status === 'Draft' ? 'outline' : status === 'Default' ? 'secondary' : 'default'}
                          className="w-fit"
                        >
                          {status}
                        </Badge>
                      </div>
                      <div className="flex items-center text-gray-600" role="cell">{formatLastModified(layout)}</div>
                      <div className="flex items-center gap-1" role="cell">
                        <label className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean(layout.active)}
                            onChange={() => void toggleActive(layout)}
                            disabled={isActiveUpdating}
                            aria-label={`Toggle active for ${layout.name}`}
                          />
                          Active
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={layout.isDefault ? 'text-amber-500' : 'text-gray-500'}
                          onClick={() => void setDefault(layout.id)}
                          disabled={isDefaultUpdating}
                          aria-label={`Set ${layout.name} as default`}
                          title="Set default"
                        >
                          <Star className={`h-4 w-4 ${layout.isDefault ? 'fill-current' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(layout.id)}
                          aria-label={`Edit layout ${layout.name}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {onDuplicate ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDuplicate(layout.id)}
                            aria-label={`Duplicate layout ${layout.name}`}
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(layout.id)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          aria-label={`Delete layout ${layout.name}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(rolesLayoutId)} onOpenChange={(open) => !open && closeRolesDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign roles</DialogTitle>
            <DialogDescription>
              Choose which roles can use{' '}
              <span className="font-medium text-gray-800">{editingLayout?.name ?? 'this layout'}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {roleOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No roles available.</p>
            ) : (
              roleOptions.map((role) => {
                const checked = selectedRoles.includes(role);
                return (
                  <label
                    key={role}
                    className="flex cursor-pointer items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span>{role}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(role)}
                      disabled={savingRoles}
                    />
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRolesDialog} disabled={savingRoles}>
              Cancel
            </Button>
            <Button onClick={() => void saveRoles()} disabled={savingRoles}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Migrate records to new layout dialog ─────────────────────────── */}
      <Dialog open={showMigrateDialog} onOpenChange={(open) => !open && closeMigrateDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Migrate existing records to new layout</DialogTitle>
            <DialogDescription>
              Select the <strong>old layout</strong> that records are currently pinned to. All
              matching records will have their per-record layout override removed so they follow
              the object&apos;s current record-type or default layout going forward.
            </DialogDescription>
          </DialogHeader>

          {migrateResult === null ? (
            <div className="space-y-4 py-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  From layout (records currently pinned to)
                </label>
                <select
                  value={migrateFromId}
                  onChange={(e) => setMigrateFromId(e.target.value)}
                  disabled={isMigrating}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                >
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This action is not reversible. Records will no longer be pinned to the selected
                layout and will instead use the current record-type or default layout.
              </div>
              {migrateError && (
                <p className="text-sm text-red-600">{migrateError}</p>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-lg font-semibold text-gray-900">
                {migrateResult === 0
                  ? 'No records were pinned to that layout.'
                  : `${migrateResult} record${migrateResult !== 1 ? 's' : ''} updated successfully.`}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Those records will now follow the current record-type or default layout.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeMigrateDialog} disabled={isMigrating}>
              {migrateResult !== null ? 'Close' : 'Cancel'}
            </Button>
            {migrateResult === null && (
              <Button
                onClick={() => void runMigration()}
                disabled={isMigrating || !migrateFromId}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isMigrating ? 'Migrating…' : 'Migrate Records'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
