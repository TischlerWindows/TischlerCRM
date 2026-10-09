'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { PageLayout } from '@/lib/schema';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { DndContextWrapper } from '../dnd-context-wrapper';
import { EditorToolbar } from '../editor-toolbar';
import { LazyFormattingRulesDialog } from '../formatting';
import { LayoutPreviewDialog } from '../layout-preview-dialog';
import { TemplateGallery } from '../template-gallery';
import { useEditorStore } from '../editor-store';
import { useEditorLifecycle } from './use-editor-lifecycle';
import { EditorCanvas } from './editor-canvas';

/* ------------------------------------------------------------------ */
/*  EditorPage — shell component                                       */
/* ------------------------------------------------------------------ */

export default function EditorPage() {
  const router = useRouter();
  const lifecycle = useEditorLifecycle();

  const layout = useEditorStore((s) => s.layout);
  const setFormattingRules = useEditorStore((s) => s.setFormattingRules);
  const { schema } = useSchemaStore();

  if (!lifecycle.object) {
    return <div className="p-6">Object not found</div>;
  }

  if (lifecycle.layoutId !== 'new' && lifecycle.layoutLockStatus !== 'held') {
    const isChecking = lifecycle.layoutLockStatus === 'checking';
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <section className="w-full max-w-lg space-y-3 rounded-md border border-gray-200 bg-white p-6 shadow-sm" aria-live="polite">
          <h1 className="text-lg font-semibold text-gray-900">
            {isChecking ? 'Checking layout access' : 'Layout is being edited'}
          </h1>
          <p className="text-sm text-gray-600">
            {isChecking
              ? 'Checking whether another person is editing this layout.'
              : lifecycle.layoutLockMessage || 'This layout is locked by another editor.'}
          </p>
          {!isChecking && (
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={lifecycle.retryLayoutLock}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => router.push(lifecycle.backHref)}
                className="rounded bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
              >
                {lifecycle.backLabel}
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <EditorToolbar
        onSave={lifecycle.handleSave}
        onPreview={() => lifecycle.setShowPreview(true)}
        onOpenRules={() => lifecycle.setShowFormattingRulesDialog(true)}
        onRequestNavigate={lifecycle.requestNavigate}
        backHref={lifecycle.backHref}
        backLabel={lifecycle.backLabel}
        objectManagerHref={lifecycle.objectManagerHref}
        objectListHref={lifecycle.objectListHref}
        objectListLabel={lifecycle.objectListLabel}
        layoutAssignmentNote={lifecycle.layoutAssignmentNote}
      />

      <DndContextWrapper>
        <EditorCanvas
          activeTab={lifecycle.activeTab}
          activeRegions={lifecycle.activeRegions}
          allFields={lifecycle.allFields}
          visibilityFields={lifecycle.visibilityFields}
          routeKey={lifecycle.routeKey}
          layoutId={lifecycle.layoutId}
          showTemplateGallery={lifecycle.showTemplateGallery}
          onAddSection={lifecycle.handleAddSection}
        />
      </DndContextWrapper>

      <LayoutPreviewDialog
        open={lifecycle.showPreview}
        onOpenChange={lifecycle.setShowPreview}
        layout={layout as unknown as PageLayout}
        objectApiName={lifecycle.objectApiName}
        objectDef={lifecycle.object}
        objectLabel={lifecycle.object.label}
        allFields={lifecycle.allFields}
      />

      {lifecycle.showFormattingRulesDialog && (
        <React.Suspense fallback={null}>
          <LazyFormattingRulesDialog
            open={lifecycle.showFormattingRulesDialog}
            onOpenChange={(isOpen) => {
              lifecycle.setShowFormattingRulesDialog(isOpen);
              if (!isOpen) {
                lifecycle.setRulesTargetFilter(undefined);
                lifecycle.setRulesInitialRuleId(undefined);
              }
            }}
            rules={layout.formattingRules ?? []}
            onApply={(next) => setFormattingRules(next)}
            objectFields={lifecycle.visibilityFields}
            targetFilter={lifecycle.rulesTargetFilter}
            initialRuleId={lifecycle.rulesInitialRuleId}
          />
        </React.Suspense>
      )}

      <TemplateGallery
        open={lifecycle.showTemplateGallery && lifecycle.layoutId === 'new'}
        onClose={() => lifecycle.setShowTemplateGallery(false)}
        onSelect={(tabs) => lifecycle.handleTemplateSelect(tabs)}
        savedTemplates={(schema?.customLayoutTemplates ?? []).filter(
          (template) => template.objectApi === lifecycle.objectApiName,
        )}
      />

      <ConfirmDialog
        open={lifecycle.pendingNavHref !== null}
        onOpenChange={(open) => { if (!open) lifecycle.setPendingNavHref(null); }}
        title="You have unsaved changes"
        description="Leave this page without saving? Your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={() => {
          const href = lifecycle.pendingNavHref;
          lifecycle.setPendingNavHref(null);
          if (href) router.push(href);
        }}
      />

      {(lifecycle.isSaving || lifecycle.saveSuccess) && (
        <div className={`pointer-events-none fixed bottom-4 right-4 rounded-md px-3 py-2 text-xs text-white shadow-lg transition-colors ${
          lifecycle.saveSuccess ? 'bg-emerald-600' : 'bg-gray-900'
        }`}>
          {lifecycle.saveSuccess ? 'Saved \u2713' : 'Saving...'}
        </div>
      )}
    </div>
  );
}
