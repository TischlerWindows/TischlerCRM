'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Edit, Trash2, Database, ChevronDown, Settings, ExternalLink, Copy, Printer, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/toast';
import { PageLayout, type ObjectDef } from '@/lib/schema';
import { recordsService, RecordData } from '@/lib/records-service';

// ── Types ──────────────────────────────────────────────────────────────

export interface RecordActionsProps {
  objectApiName: string;
  backRoute: string;
  record: Record<string, any> | null;
  rawRecord: RecordData | null;
  pageLayout: PageLayout | null;
  objectDef: ObjectDef | undefined;
  title: string;
  canEdit: boolean;
  canDelete: boolean;
  canCustomize: boolean;
  /** Visible action buttons (from HeaderHighlights widget config) */
  visibleActions: Array<'edit' | 'delete' | 'clone' | 'print' | 'requote'>;
  /** Called after a successful edit to update parent state */
  onRecordUpdated: (raw: RecordData, flat: Record<string, any>) => void;
}

/**
 * Action bar + dialogs for a record detail page.
 *
 * Renders edit/clone/print/delete buttons based on permissions and
 * layout config, and handles the corresponding dialogs/operations.
 */
export function RecordActions({
  objectApiName,
  backRoute,
  record,
  rawRecord,
  pageLayout,
  objectDef,
  title,
  canEdit,
  canDelete,
  canCustomize,
  visibleActions,
  onRecordUpdated,
}: RecordActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isRequoting, setIsRequoting] = useState(false);
  const [showRequotePrompt, setShowRequotePrompt] = useState(false);
  const [requoteName, setRequoteName] = useState('');

  // Auto-open edit form when navigated with ?edit=true (e.g. after requote)
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && record && pageLayout) {
      setShowEditForm(true);
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, record, pageLayout, pathname, router]);

  // Lock body scroll when the admin menu overlay is open
  useEffect(() => {
    if (showAdminMenu) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [showAdminMenu]);

  const showEdit = visibleActions.includes('edit');
  const showDelete = visibleActions.includes('delete');
  const showClone = visibleActions.includes('clone');
  const showPrint = visibleActions.includes('print');
  const showRequote = visibleActions.includes('requote');

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (!pageLayout) {
      showToast('No page layout found for this record.', 'error');
      return;
    }
    setShowEditForm(true);
  };

  const handleEditSubmit = async (data: Record<string, any>) => {
    if (!record) return;
    try {
      const normalizedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        const cleanKey = key.replace(/^[A-Za-z]+__/, '');
        normalizedData[cleanKey] = value;
      }
      const updated = await recordsService.updateRecord(objectApiName, record.id, { data: normalizedData });
      if (updated) {
        onRecordUpdated(updated, recordsService.flattenRecord(updated));
      }
    } catch (err) {
      console.error('Failed to update record:', err);
      // Optimistic update
      onRecordUpdated(rawRecord!, { ...record, ...data });
    }
    setShowEditForm(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!record) return;
    setShowDeleteConfirm(false);
    try {
      await recordsService.deleteRecord(objectApiName, record.id);
    } catch (err) {
      console.error('Failed to delete record:', err);
      showToast('Failed to delete record. Please try again.', 'error');
      return;
    }
    router.push(backRoute);
  };

  const handleClone = async () => {
    if (!record || !rawRecord) return;
    setIsCloning(true);
    try {
      const cloneData = { ...(rawRecord.data as Record<string, unknown>) };
      const cloned = await recordsService.createRecord(objectApiName, {
        data: cloneData,
        pageLayoutId: rawRecord.pageLayoutId ?? undefined,
      });
      if (cloned) {
        showToast('Record cloned successfully', 'success');
        router.push(`/${backRoute.replace(/^\//, '').split('/')[0]}/${cloned.id}`);
      }
    } catch (err) {
      console.error('Failed to clone record:', err);
      showToast('Failed to clone record. Please try again.', 'error');
    } finally {
      setIsCloning(false);
    }
  };

  const handleRequoteClick = () => {
    // Pre-fill with existing opportunity name
    const existing = record?.Opportunity__opportunityName || record?.opportunityName || record?.name || '';
    setRequoteName(existing);
    setShowRequotePrompt(true);
  };

  const handleRequoteConfirm = async () => {
    if (!record || !rawRecord || !requoteName.trim()) return;
    setShowRequotePrompt(false);
    setIsRequoting(true);
    try {
      const requoted = await apiClient.createRequote(objectApiName, record.id, requoteName.trim());
      if (requoted) {
        showToast('Requote created — opening in edit mode', 'success');
        router.push(`/${backRoute.replace(/^\//, '').split('/')[0]}/${requoted.id}?edit=true`);
      }
    } catch (err) {
      console.error('Failed to create requote:', err);
      showToast('Failed to create requote. Please try again.', 'error');
    } finally {
      setIsRequoting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {showEdit && canEdit && (
          <button
            onClick={handleEdit}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Edit className="w-4 h-4 mr-1.5" />
            Edit
          </button>
        )}
        {showClone && canEdit && (
          <button
            onClick={handleClone}
            disabled={isCloning}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy className="w-4 h-4 mr-1.5" />
            {isCloning ? 'Cloning\u2026' : 'Clone'}
          </button>
        )}
        {showRequote && objectApiName === 'Opportunity' && canEdit && (
          <button
            onClick={handleRequoteClick}
            disabled={isRequoting}
            className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isRequoting ? 'animate-spin' : ''}`} />
            {isRequoting ? 'Creating\u2026' : 'Create Requote'}
          </button>
        )}
        {showPrint && (
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Print
          </button>
        )}
        {showDelete && canDelete && (
          <button
            onClick={handleDelete}
            className="inline-flex items-center px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 bg-white hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete
          </button>
        )}
        {canCustomize && (
          <div className="relative">
            <button
              onClick={() => setShowAdminMenu((prev) => !prev)}
              className="inline-flex items-center px-2.5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
              title="Page setup"
            >
              <Settings className="w-4 h-4" />
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </button>
            {showAdminMenu && (
              <>
                <div className="fixed inset-0 z-overlay" onClick={() => setShowAdminMenu(false)} />
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-modal">
                  <Link
                    href={`/object-manager/${encodeURIComponent(objectApiName)}?returnTo=${encodeURIComponent(pathname)}`}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowAdminMenu(false)}
                  >
                    <Database className="w-4 h-4 text-gray-400" />
                    Edit Object
                    <ExternalLink className="w-3 h-3 text-gray-300 ml-auto" />
                  </Link>
                  {pageLayout && (
                    <Link
                      href={`/object-manager/${encodeURIComponent(objectApiName)}/page-editor/${encodeURIComponent(pageLayout.id)}?returnTo=${encodeURIComponent(pathname)}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowAdminMenu(false)}
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                      Edit Page Layout
                      <ExternalLink className="w-3 h-3 text-gray-300 ml-auto" />
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      {pageLayout && (
        <DynamicFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          objectApiName={objectApiName}
          layoutType="edit"
          layoutId={pageLayout.id}
          recordData={record ?? undefined}
          onSubmit={handleEditSubmit}
          title={`Edit ${title}`}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${objectDef?.label ?? 'record'}`}
        description={`Are you sure you want to delete "${title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="destructive"
        onConfirm={() => { void confirmDelete(); }}
      />

      {/* Requote name prompt */}
      {showRequotePrompt && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowRequotePrompt(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Create Requote</h3>
              <p className="text-sm text-gray-500 mb-4">Enter the name for this requote. This will appear as the Opportunity Name.</p>
              <input
                autoFocus
                type="text"
                value={requoteName}
                onChange={(e) => setRequoteName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && requoteName.trim()) void handleRequoteConfirm(); }}
                placeholder="e.g. Project Name - Requote 2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowRequotePrompt(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleRequoteConfirm()}
                  disabled={!requoteName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Requote
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
