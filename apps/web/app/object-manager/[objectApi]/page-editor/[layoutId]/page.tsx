'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSchemaStore } from '@/lib/schema-store';
import { getSetting } from '@/lib/preferences';
import type {
  FieldDef,
  FieldType,
  FormattingRule,
  PageLayout,
  PicklistDependencyRule,
} from '@/lib/schema';
import { FieldVisibilityRuleEditor } from '@/components/field-visibility-rule-editor';
import { PicklistDependencyEditor } from '@/components/picklist-dependency-editor';
import { LayoutPreviewDialog } from '../layout-preview-dialog';
import { FormattingRulesDialog } from '../formatting-rules-dialog';
import { buildPageLayoutFromCanvas } from '../build-page-layout';
import { useEditorStore } from '../editor-store';
import { EditorToolbar } from '../editor-toolbar';
import { FieldPalette } from '../field-palette';
import { CanvasSectionComponent } from '../canvas-section';
import { PropertiesPanel } from '../properties-panel';
import { UnsavedChangesDialog } from '../unsaved-changes-dialog';
import { DndContextWrapper } from '../dnd-context-wrapper';
import { LayoutHighlightsStrip } from '../layout-highlights-strip';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';
import { getObjectListHref } from '@/lib/object-list-routes';

export default function PageEditorFullPage() {
  const params = useParams();
  const router = useRouter();
  const objectApiName = params.objectApi as string;
  const layoutId = params.layoutId as string;

  const { schema, updateObject } = useSchemaStore();
  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  // Editor store
  const tabs = useEditorStore((s) => s.tabs);
  const sections = useEditorStore((s) => s.sections);
  const fields = useEditorStore((s) => s.fields);
  const widgets = useEditorStore((s) => s.widgets);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const editingLayoutId = useEditorStore((s) => s.editingLayoutId);
  const layoutName = useEditorStore((s) => s.layoutName);
  const formattingRules = useEditorStore((s) => s.formattingRules);
  const highlightFields = useEditorStore((s) => s.highlightFields);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges);

  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const addTab = useEditorStore((s) => s.addTab);
  const deleteTab = useEditorStore((s) => s.deleteTab);
  const addSection = useEditorStore((s) => s.addSection);
  const loadLayout = useEditorStore((s) => s.loadLayout);
  const reset = useEditorStore((s) => s.reset);
  const markSaved = useEditorStore((s) => s.markSaved);
  const setFormattingRules = useEditorStore((s) => s.setFormattingRules);
  const markDirty = useEditorStore((s) => s.markDirty);

  // Modal state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showFormattingRulesDialog, setShowFormattingRulesDialog] = useState(false);
  const [showVisibilityEditor, setShowVisibilityEditor] = useState(false);
  const [showSectionVisibilityEditor, setShowSectionVisibilityEditor] = useState(false);
  const [showPicklistDependencyEditor, setShowPicklistDependencyEditor] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const [unsavedDialogSaving, setUnsavedDialogSaving] = useState(false);

  // Home special fields
  const [homeReports, setHomeReports] = useState<Array<{ id: string; name: string }>>([]);
  const [homeDashboards, setHomeDashboards] = useState<Array<{ id: string; name: string }>>([]);

  const didLoad = useRef(false);

  useEffect(() => {
    didLoad.current = false;
  }, [layoutId]);

  useEffect(() => {
    return () => {
      didLoad.current = false;
    };
  }, []);

  // Load layout once per layoutId visit; do not reset when `object` reference updates (e.g. after save).
  useEffect(() => {
    if (!object) return;
    if (didLoad.current) return;
    didLoad.current = true;

    if (layoutId === 'new') {
      reset();
    } else {
      const layout = object.pageLayouts?.find((l) => l.id === layoutId);
      if (layout) {
        loadLayout(layout);
      } else {
        reset();
      }
    }
  }, [layoutId, object, loadLayout, reset]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // Load Home reports/dashboards
  useEffect(() => {
    if (objectApiName !== 'Home') return;
    (async () => {
      const customReports = (await getSetting<any[]>('customReports')) || [];
      setHomeReports(customReports.map((r: any) => ({ id: r.id, name: r.name })));
      const dashboards = (await getSetting<any[]>('dashboards')) || [];
      setHomeDashboards(dashboards.map((d: any) => ({ id: d.id, name: d.name })));
    })();
  }, [objectApiName]);

  // All fields (including Home special fields + Contact name)
  const allFields = useMemo(() => {
    if (!object) return [];
    let baseFields: FieldDef[] =
      objectApiName === 'Home'
        ? [
            ...homeReports.map((report) => ({
              id: `report-${report.id}`,
              apiName: `Home__Report__${report.id}`,
              label: `Report: ${report.name}`,
              type: 'Text' as FieldType,
              required: false,
            })),
            ...homeDashboards.map((dashboard) => ({
              id: `dashboard-${dashboard.id}`,
              apiName: `Home__Dashboard__${dashboard.id}`,
              label: `Dashboard: ${dashboard.name}`,
              type: 'Text' as FieldType,
              required: false,
            })),
          ]
        : object.fields;

    if (
      objectApiName === 'Contact' &&
      !baseFields.find((f) => f.apiName === 'Contact__name')
    ) {
      const nameField: FieldDef = {
        id: 'hardcoded-name-field',
        apiName: 'Contact__name',
        label: 'Name',
        type: 'Text',
        readOnly: true,
        custom: false,
        required: false,
        maxLength: 255,
        helpText: 'Auto-summarized full name (Salutation, First Name, Last Name)',
      };
      baseFields = [nameField, ...baseFields];
    }
    return baseFields;
  }, [objectApiName, object, homeReports, homeDashboards]);

  const getFieldDef = (apiName: string) => allFields.find((f) => f.apiName === apiName);

  // Active sections for the current tab
  const activeSections = sections
    .filter((s) => s.tabId === activeTabId)
    .sort((a, b) => a.order - b.order);

  // Preview layout
  const previewPageLayout = useMemo(
    () =>
      object
        ? buildPageLayoutFromCanvas({
            editingLayoutId,
            layoutName,
            tabs,
            sections,
            fields,
            widgets,
            objectFields: object.fields,
            formattingRules,
            highlightFields,
          })
        : null,
    [
      editingLayoutId,
      layoutName,
      tabs,
      sections,
      fields,
      widgets,
      object,
      formattingRules,
      highlightFields,
    ],
  );

  const performSave = async (silent: boolean): Promise<boolean> => {
    if (!object) return false;
    if (!layoutName.trim()) {
      if (!silent) alert('Please enter a layout name.');
      return false;
    }

    const pageLayout: PageLayout = buildPageLayoutFromCanvas({
      editingLayoutId,
      layoutName,
      tabs,
      sections,
      fields,
      widgets,
      objectFields: object.fields,
      formattingRules,
      highlightFields,
    });

    const existingLayouts = object.pageLayouts || [];
    let updatedLayouts: PageLayout[];
    if (editingLayoutId) {
      updatedLayouts = existingLayouts.map((l) => (l.id === editingLayoutId ? pageLayout : l));
    } else {
      const nonEmptyLayouts = existingLayouts.filter((l) =>
        l.tabs?.some((t) => t.sections?.some((s) => (s.fields?.length || 0) > 0)),
      );
      updatedLayouts = [...nonEmptyLayouts, pageLayout];
    }

    const existingRecordTypes = object.recordTypes || [];
    const updatedRecordTypes =
      existingRecordTypes.length > 0
        ? existingRecordTypes.map((rt, idx) => {
            if (
              (object.defaultRecordTypeId && rt.id === object.defaultRecordTypeId) ||
              (!object.defaultRecordTypeId && idx === 0)
            ) {
              return { ...rt, pageLayoutId: pageLayout.id };
            }
            return rt;
          })
        : existingRecordTypes;

    try {
      await updateObject(objectApiName, {
        pageLayouts: updatedLayouts,
        recordTypes: updatedRecordTypes,
      });
      if (!silent) alert(`Layout "${layoutName}" saved successfully!`);
      markSaved();
      return true;
    } catch (err) {
      console.error('Failed to save layout:', err);
      if (!silent) alert('Failed to save layout. Please try again.');
      return false;
    }
  };

  const performSaveRef = useRef(performSave);
  performSaveRef.current = performSave;

  const saveLayout = () => {
    void performSave(false);
  };

  const requestNavigate = useCallback(
    (href: string) => {
      if (!useEditorStore.getState().hasUnsavedChanges) {
        router.push(href);
        return;
      }
      setPendingNavigationHref(href);
      setShowUnsavedDialog(true);
    },
    [router],
  );

  // Phase 6E: keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void performSaveRef.current(false);
        return;
      }
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        useEditorStore.getState().setSelectedElement(null);
        return;
      }
      if (e.key === 'Delete') {
        const sel = useEditorStore.getState().selectedElement;
        if (!sel || (sel.type !== 'field' && sel.type !== 'widget')) return;
        const st = useEditorStore.getState();
        if (sel.type === 'field') st.deleteField(sel.id);
        else st.deleteWidget(sel.id);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Visibility rule handlers
  const handleSaveVisibilityRules = async (conditions: any[]) => {
    if (!selectedElement || selectedElement.type !== 'field' || !object) return;
    const field = fields.find((f) => f.id === selectedElement.id);
    if (!field) return;
    const fieldDef = object.fields.find((f) => f.apiName === field.fieldApiName);
    if (!fieldDef) return;
    const updatedFields = object.fields.map((f) =>
      f.apiName === fieldDef.apiName ? { ...f, visibleIf: conditions } : f,
    );
    try {
      await updateObject(objectApiName, { fields: updatedFields });
      setShowVisibilityEditor(false);
    } catch (err) {
      console.error('Failed to save visibility rules:', err);
    }
  };

  const handleSavePicklistDependencies = async (depRules: PicklistDependencyRule[]) => {
    if (!selectedElement || selectedElement.type !== 'field' || !object) return;
    const field = fields.find((f) => f.id === selectedElement.id);
    if (!field) return;
    const fieldDef = object.fields.find((f) => f.apiName === field.fieldApiName);
    if (!fieldDef) return;
    const updatedFields = object.fields.map((f) =>
      f.apiName === fieldDef.apiName ? { ...f, picklistDependencies: depRules } : f,
    );
    try {
      await updateObject(objectApiName, { fields: updatedFields });
      setShowPicklistDependencyEditor(false);
    } catch (err) {
      console.error('Failed to save picklist dependencies:', err);
    }
  };

  if (!object) {
    return <div className="p-6">Object not found</div>;
  }

  const objectManagerHref = `/object-manager/${encodeURIComponent(objectApiName)}?section=page-editor`;
  const objectListHref = getObjectListHref(objectApiName);
  const objectListLabel = object.pluralLabel || object.label;

  const allObjects = schema?.objects || [];

  return (
    <DndContextWrapper getFieldDef={getFieldDef}>
      <div className="flex flex-col h-screen">
        {/* Phase 6A: Light minimal toolbar */}
        <EditorToolbar
          onSave={saveLayout}
          onPreview={() => setShowPreviewDialog(true)}
          onOpenRules={() => setShowFormattingRulesDialog(true)}
          onRequestNavigate={requestNavigate}
          objectManagerHref={objectManagerHref}
          objectListHref={objectListHref}
          objectListLabel={objectListLabel}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Left palette */}
          <FieldPalette
            availableFields={allFields}
            totalFieldCount={object.fields.length}
          />

          {/* Phase 6A: Canvas with dot-grid background */}
          <div
            className="flex-1 overflow-y-auto"
            data-editor-canvas
            style={{
              backgroundColor: '#f8f9fa',
              backgroundImage:
                'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            <div className="p-6">
              {objectApiName !== 'Home' && (
                <LayoutHighlightsStrip objectFields={object.fields} />
              )}
              {/* Phase 6C: Navy pill tabs */}
              <div className="flex gap-2 mb-5 items-center">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all relative group ${
                      activeTabId === tab.id
                        ? 'bg-brand-navy text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                    }`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSelectedElement({ type: 'tab', id: tab.id });
                    }}
                  >
                    {tab.label}
                    {tabs.length > 1 && (
                      <button
                        className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-0.5 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTab(tab.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </button>
                ))}
                <button
                  onClick={addTab}
                  className="px-3 py-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-dashed border-gray-300 text-sm flex items-center gap-1 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Sections */}
              <div className="space-y-4">
                {activeSections.map((section, idx) => (
                  <div key={section.id} className="group">
                    <CanvasSectionComponent
                      section={section}
                      sectionFields={fields.filter((f) => f.sectionId === section.id)}
                      sectionWidgets={widgets.filter((w) => w.sectionId === section.id)}
                      getFieldDef={getFieldDef}
                      isFirst={idx === 0}
                      isLast={idx === activeSections.length - 1}
                    />
                  </div>
                ))}

                <Button
                  onClick={addSection}
                  variant="outline"
                  className="w-full border-dashed border-gray-300 hover:border-brand-navy hover:text-brand-navy"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>
            </div>
          </div>

          {/* Right properties panel */}
          <PropertiesPanel
            objectFields={object.fields}
            allFields={allFields}
            allObjects={allObjects}
            onOpenFieldVisibility={() => setShowVisibilityEditor(true)}
            onOpenSectionVisibility={() => setShowSectionVisibilityEditor(true)}
            onOpenPicklistDependency={() => setShowPicklistDependencyEditor(true)}
            onSave={saveLayout}
            onPreview={() => setShowPreviewDialog(true)}
          />
        </div>
      </div>

      {/* ─── Dialogs ─── */}

      <LayoutPreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        pageLayout={previewPageLayout}
        allFields={allFields}
        objectLabel={object.label}
      />

      <FormattingRulesDialog
        open={showFormattingRulesDialog}
        onOpenChange={setShowFormattingRulesDialog}
        rules={formattingRules}
        onApply={(next) => {
          setFormattingRules(next);
          markDirty();
        }}
        sections={sections.map((s) => ({ id: s.id, label: s.label }))}
        objectFields={object.fields}
      />

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        isSaving={unsavedDialogSaving}
        onKeepEditing={() => {
          setShowUnsavedDialog(false);
          setPendingNavigationHref(null);
        }}
        onLeaveWithoutSaving={() => {
          const dest = pendingNavigationHref;
          setShowUnsavedDialog(false);
          setPendingNavigationHref(null);
          if (layoutId === 'new') {
            reset();
          } else {
            const layout = object.pageLayouts?.find((l) => l.id === layoutId);
            if (layout) loadLayout(layout);
            else reset();
          }
          markSaved();
          if (dest) router.push(dest);
        }}
        onSaveAndLeave={() => {
          void (async () => {
            setUnsavedDialogSaving(true);
            try {
              const dest = pendingNavigationHref;
              const ok = await performSave(true);
              if (ok) {
                setShowUnsavedDialog(false);
                setPendingNavigationHref(null);
                if (dest) router.push(dest);
              }
            } finally {
              setUnsavedDialogSaving(false);
            }
          })();
        }}
      />

      {/* Section Visibility Rule Editor Modal */}
      {showSectionVisibilityEditor &&
        selectedElement &&
        selectedElement.type === 'section' &&
        (() => {
          const section = sections.find((s) => s.id === selectedElement.id);
          if (!section) return null;
          const fakeField = {
            label: section.label,
            apiName: section.id,
            visibleIf: section.visibleIf || [],
          } as FieldDef;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Section Visibility Rules: {section.label}
                  </h3>
                  <button
                    onClick={() => setShowSectionVisibilityEditor(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  <FieldVisibilityRuleEditor
                    field={fakeField}
                    availableFields={object.fields}
                    onSave={(conditions) => {
                      useEditorStore.getState().updateSection(selectedElement.id, {
                        visibleIf: conditions,
                      });
                      markDirty();
                      setShowSectionVisibilityEditor(false);
                    }}
                    onCancel={() => setShowSectionVisibilityEditor(false)}
                  />
                </div>
              </div>
            </div>
          );
        })()}

      {/* Field Visibility Rule Editor Modal */}
      {showVisibilityEditor &&
        selectedElement &&
        selectedElement.type === 'field' &&
        (() => {
          const field = fields.find((f) => f.id === selectedElement.id);
          const fieldDef = field ? getFieldDef(field.fieldApiName) : null;
          if (!fieldDef) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Field Visibility Rules: {fieldDef.label}
                  </h3>
                  <button
                    onClick={() => setShowVisibilityEditor(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  <FieldVisibilityRuleEditor
                    field={fieldDef}
                    availableFields={object.fields.filter(
                      (f) => f.apiName !== fieldDef.apiName,
                    )}
                    onSave={handleSaveVisibilityRules}
                    onCancel={() => setShowVisibilityEditor(false)}
                  />
                </div>
              </div>
            </div>
          );
        })()}

      {/* Picklist Dependency Editor Modal */}
      {showPicklistDependencyEditor &&
        selectedElement &&
        selectedElement.type === 'field' &&
        (() => {
          const field = fields.find((f) => f.id === selectedElement.id);
          const fieldDef = field ? getFieldDef(field.fieldApiName) : null;
          if (!fieldDef || !fieldDef.picklistValues) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                  <h3 className="text-lg font-semibold">
                    Value Dependencies: {fieldDef.label}
                  </h3>
                  <button
                    onClick={() => setShowPicklistDependencyEditor(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  <PicklistDependencyEditor
                    field={fieldDef}
                    availableFields={object.fields.filter(
                      (f) => f.apiName !== fieldDef.apiName,
                    )}
                    onSave={handleSavePicklistDependencies}
                    onCancel={() => setShowPicklistDependencyEditor(false)}
                  />
                </div>
              </div>
            </div>
          );
        })()}
    </DndContextWrapper>
  );
}
