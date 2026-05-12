'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Edit, Trash2, Database, ChevronDown, Settings, ExternalLink, Copy, Printer, RefreshCw, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/toast';
import { PageLayout, type ObjectDef } from '@/lib/schema';
import { recordsService, RecordData } from '@/lib/records-service';
import { assembleProposal } from '@crm/proposal-assembly';
import { findSummaryForOpportunity, getSavedSummaries } from '@/lib/proposal-summary-resolver';

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
  visibleActions: Array<'edit' | 'delete' | 'clone' | 'print' | 'requote' | 'proposal'>;
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
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
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
  const showProposal = visibleActions.includes('proposal');

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
      // Remove derived dotted keys (e.g. "address_search.city") — the parent
      // blob is authoritative. Sending stale dotted keys back would persist
      // old values that conflict with the blob.
      for (const key of Object.keys(normalizedData)) {
        if (key.includes('.') && !key.startsWith('_')) delete normalizedData[key];
      }
      const updated = await recordsService.updateRecord(objectApiName, record.id, { data: normalizedData });
      if (updated) {
        onRecordUpdated(updated, recordsService.flattenRecord(updated));
      }
      setShowEditForm(false);
      showToast('Record updated', 'success');
    } catch (err) {
      console.error('Failed to update record:', err);
      const message = err instanceof Error ? err.message : 'Failed to save changes. Please try again.';
      showToast(message, 'error');
    }
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

  const handleRequoteClick = async () => {
    // Determine the base opportunity name (strip any existing "- Requote N" suffix)
    const existing = record?.Opportunity__opportunityName || record?.opportunityName || record?.name || '';
    const baseName = String(existing).replace(/\s*-\s*Requote\s*\d+$/i, '');

    // Fetch versions to figure out the next requote number
    let nextNum = 1;
    try {
      const res = await apiClient.getRequoteVersions(objectApiName, record!.id);
      // Versions include the base OPP + all requotes; requote count = total - 1
      const requoteCount = Math.max(0, (res.versions?.length || 1) - 1);
      nextNum = requoteCount + 1;
    } catch { /* default to 1 */ }

    setRequoteName(`${baseName} - Requote ${nextNum}`);
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

  const readLookupId = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const lookup = value as Record<string, unknown>;
      for (const key of ['lookup', 'id', 'value']) {
        if (typeof lookup[key] === 'string') return lookup[key] as string;
      }
    }
    return '';
  };

  const resolveProposalContact = async () => {
    const data = (rawRecord?.data as Record<string, unknown> | undefined) ?? {};
    const contactLookup = readLookupId(
      data.individual_receiving_the_quote ??
      data.Opportunity__individual_receiving_the_quote ??
      record?.individual_receiving_the_quote ??
      record?.Opportunity__individual_receiving_the_quote
    );

    if (!contactLookup) return undefined;

    const contactRecord = await recordsService.getRecord('Contact', contactLookup);
    const contactData = contactRecord?.data ?? {};
    const name = contactData.name && typeof contactData.name === 'object'
      ? contactData.name as Record<string, unknown>
      : {};

    return {
      salutation: String(name.Contact__name_salutation ?? contactData.salutation ?? ''),
      lastName: String(name.Contact__name_lastName ?? contactData.lastName ?? ''),
    };
  };

  const handleGenerateProposal = async () => {
    if (!record) return;
    // Open the preview window synchronously inside the user-gesture handler so
    // popup blockers (Safari, Firefox, strict Chrome) don't kill it. We
    // navigate the window to the PDF blob URL once the server responds.
    const previewWindow = window.open('', '_blank');
    setIsGeneratingProposal(true);
    try {
      const summaries = await getSavedSummaries();
      const match = findSummaryForOpportunity(summaries, {
        id: record.id,
        data: { ...(rawRecord?.data as Record<string, unknown> | undefined), ...record },
      });

      if (!match.summary) {
        previewWindow?.close();
        showToast(`${match.reason} Create or link a Summary before generating a Proposal PDF.`, 'error');
        return;
      }

      const template = await apiClient.get<{ id: string; name: string; presets: unknown[] }>(
        '/quote-templates/default',
      );
      if (!template?.presets?.length) {
        previewWindow?.close();
        showToast('No active default proposal template found.', 'error');
        return;
      }

      // Pre-flight client-side assembly only to surface the unresolved-tokens
      // warning. The actual PDF is produced server-side via PDFKit.
      const contact = await resolveProposalContact();
      const assembled = assembleProposal({
        summary: match.summary,
        template: {
          id: template.id,
          name: template.name,
          presets: template.presets as Parameters<typeof assembleProposal>[0]['template']['presets'],
        },
        contact,
      });

      if (assembled.unresolvedTokens.length > 0) {
        const proceed = window.confirm(
          `This proposal has ${assembled.unresolvedTokens.length} unresolved variable(s). Generate the preview anyway?`,
        );
        if (!proceed) {
          previewWindow?.close();
          return;
        }
      }

      // Server-side render via PDFKit (Phase 3). The render route re-assembles
      // the proposal — passing only the IDs avoids serializing the full
      // assembled doc over the wire and keeps the server as the source of
      // truth for what ends up in the PDF.
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = apiClient.getToken();
      const response = await fetch(`${apiBase}/proposal-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          summaryId: (match.summary as { id: string }).id,
          templateId: template.id,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(detail.error || `Failed to render proposal PDF (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = url;
      } else {
        // Popup blocker killed the synchronous open — fall back to a download.
        const link = document.createElement('a');
        link.href = url;
        link.download = 'proposal.pdf';
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      if (assembled.warnings.length > 0) {
        showToast(`Proposal preview generated with ${assembled.warnings.length} warning(s).`, 'success');
      } else {
        showToast('Proposal preview generated', 'success');
      }
    } catch (err) {
      previewWindow?.close();
      const message = err instanceof Error ? err.message : 'Failed to generate proposal. Please try again.';
      showToast(message, 'error');
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
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
        {showProposal && objectApiName === 'Opportunity' && canEdit && (
          <button
            onClick={() => void handleGenerateProposal()}
            disabled={isGeneratingProposal}
            className="inline-flex items-center px-4 py-2 border border-brand-navy/30 rounded-lg text-sm font-medium text-brand-navy bg-white hover:bg-brand-navy/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            {isGeneratingProposal ? 'Generating...' : 'Proposal PDF'}
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
                    target="_blank"
                    rel="noopener noreferrer"
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
                      target="_blank"
                      rel="noopener noreferrer"
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
