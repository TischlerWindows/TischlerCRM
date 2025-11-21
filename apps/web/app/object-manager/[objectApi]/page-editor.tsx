'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSchemaStore } from '@/lib/schema-store';
import { FieldDef, PageLayout, PageTab, PageSection, FieldType } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Save,
  Layout,
  ChevronRight,
  ChevronDown,
  Columns2,
  Columns3,
  Grid2x2,
} from 'lucide-react';

interface PageEditorProps {
  objectApiName: string;
}

type LayoutMode = 'new' | 'existing';
type ColumnCount = 1 | 2 | 3;

interface DraggedField {
  id: string;
  label: string;
  apiName: string;
  type: FieldType;
  required: boolean;
}

interface CanvasField {
  id: string;
  fieldApiName: string;
  sectionId: string;
  column: number;
  order: number;
}

interface CanvasSection {
  id: string;
  label: string;
  tabId: string;
  columns: ColumnCount;
  order: number;
  collapsed: boolean;
}

interface CanvasTab {
  id: string;
  label: string;
  order: number;
}

export default function PageEditor({ objectApiName }: PageEditorProps) {
  const { schema, updateObject } = useSchemaStore();
  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('new');
  const [tabs, setTabs] = useState<CanvasTab[]>([
    { id: 'tab-1', label: 'General Information', order: 0 },
  ]);
  const [sections, setSections] = useState<CanvasSection[]>([
    {
      id: 'section-1',
      label: 'Basic Details',
      tabId: 'tab-1',
      columns: 2,
      order: 0,
      collapsed: false,
    },
  ]);
  const [fields, setFields] = useState<CanvasField[]>([]);
  const [activeTab, setActiveTab] = useState<string>('tab-1');
  const [selectedElement, setSelectedElement] = useState<{
    type: 'tab' | 'section' | 'field';
    id: string;
  } | null>(null);
  const [draggedItem, setDraggedItem] = useState<DraggedField | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!object) {
    return <div className="p-6">Object not found</div>;
  }

  // Field palette
  const availableFields = object.fields.filter(
    (field) => !fields.some((f) => f.fieldApiName === field.apiName)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const field = availableFields.find((f) => f.apiName === event.active.id);
    if (field) {
      setDraggedItem({
        id: field.apiName,
        label: field.label,
        apiName: field.apiName,
        type: field.type,
        required: field.required || false,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over) return;

    // Check if dropping a field into a section
    const targetSectionId = over.id.toString();
    const targetSection = sections.find((s) => s.id === targetSectionId);

    if (targetSection) {
      // Check if this field is already in the layout
      const existingField = fields.find((f) => f.fieldApiName === active.id.toString());
      
      if (!existingField) {
        // Add new field to section
        const fieldApiName = active.id.toString();
        const sectionFields = fields.filter((f) => f.sectionId === targetSectionId);
        const newField: CanvasField = {
          id: `field-${Date.now()}`,
          fieldApiName,
          sectionId: targetSectionId,
          column: 0,
          order: sectionFields.length,
        };
        setFields([...fields, newField]);
      }
    }
  };

  const addTab = () => {
    const newTab: CanvasTab = {
      id: `tab-${Date.now()}`,
      label: `New Tab ${tabs.length + 1}`,
      order: tabs.length,
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  const addSection = () => {
    const newSection: CanvasSection = {
      id: `section-${Date.now()}`,
      label: `New Section ${sections.filter((s) => s.tabId === activeTab).length + 1}`,
      tabId: activeTab,
      columns: 2,
      order: sections.filter((s) => s.tabId === activeTab).length,
      collapsed: false,
    };
    setSections([...sections, newSection]);
  };

  const deleteTab = (tabId: string) => {
    if (tabs.length === 1) return; // Keep at least one tab
    const remainingTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(remainingTabs);
    setSections(sections.filter((s) => s.tabId !== tabId));
    setFields(fields.filter((f) => !sections.some((s) => s.id === f.sectionId && s.tabId === tabId)));
    if (activeTab === tabId && remainingTabs.length > 0 && remainingTabs[0]) {
      setActiveTab(remainingTabs[0].id);
    }
  };

  const deleteSection = (sectionId: string) => {
    setSections(sections.filter((s) => s.id !== sectionId));
    setFields(fields.filter((f) => f.sectionId !== sectionId));
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };

  const updateTabLabel = (tabId: string, label: string) => {
    setTabs(tabs.map((t) => (t.id === tabId ? { ...t, label } : t)));
  };

  const updateSectionLabel = (sectionId: string, label: string) => {
    setSections(sections.map((s) => (s.id === sectionId ? { ...s, label } : s)));
  };

  const updateSectionColumns = (sectionId: string, columns: ColumnCount) => {
    setSections(sections.map((s) => (s.id === sectionId ? { ...s, columns } : s)));
  };

  const toggleSectionCollapsed = (sectionId: string) => {
    setSections(
      sections.map((s) => (s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s))
    );
  };

  const saveLayout = () => {
    if (!object) return;

    // Convert canvas state to PageLayout
    const pageLayout: PageLayout = {
      id: `layout-${layoutMode}-${Date.now()}`,
      name: `${layoutMode === 'new' ? 'New' : 'Edit'} Record Layout`,
      layoutType: layoutMode === 'new' ? 'create' : 'edit',
      tabs: tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        order: tab.order,
        sections: sections
          .filter((s) => s.tabId === tab.id)
          .map((section) => ({
            id: section.id,
            label: section.label,
            columns: section.columns,
            order: section.order,
            fields: fields
              .filter((f) => f.sectionId === section.id)
              .map((f) => ({
                apiName: f.fieldApiName,
                column: f.column,
                order: f.order,
              })),
          })),
      })),
    };

    // Update object with new page layout
    const existingLayouts = object.pageLayouts || [];
    const updatedLayouts = existingLayouts.filter(
      (l) => l.layoutType !== pageLayout.layoutType
    );
    updatedLayouts.push(pageLayout);

    updateObject(objectApiName, {
      pageLayouts: updatedLayouts,
    });

    alert(`Layout saved for ${layoutMode === 'new' ? 'New Record' : 'Existing Record'} mode!`);
  };

  const loadLayout = (mode: LayoutMode) => {
    if (!object) return;

    const layout = object.pageLayouts?.find(
      (l) => l.layoutType === (mode === 'new' ? 'create' : 'edit')
    );

    if (!layout) {
      // Reset to default
      setTabs([{ id: 'tab-1', label: 'General Information', order: 0 }]);
      setSections([
        {
          id: 'section-1',
          label: 'Basic Details',
          tabId: 'tab-1',
          columns: 2,
          order: 0,
          collapsed: false,
        },
      ]);
      setFields([]);
      setActiveTab('tab-1');
      return;
    }

    // Convert PageLayout to canvas state
    const newTabs: CanvasTab[] = layout.tabs.map((tab, idx) => ({
      id: `tab-${idx + 1}`,
      label: tab.label,
      order: tab.order,
    }));

    const newSections: CanvasSection[] = [];
    const newFields: CanvasField[] = [];
    let sectionCounter = 1;
    let fieldCounter = 1;

    layout.tabs.forEach((tab, tabIdx) => {
      const tabId = `tab-${tabIdx + 1}`;
      tab.sections.forEach((section) => {
        const sectionId = `section-${sectionCounter++}`;
        newSections.push({
          id: sectionId,
          label: section.label,
          tabId,
          columns: section.columns,
          order: section.order,
          collapsed: false,
        });

        section.fields.forEach((field) => {
          newFields.push({
            id: `field-${fieldCounter++}`,
            fieldApiName: field.apiName,
            sectionId,
            column: field.column,
            order: field.order,
          });
        });
      });
    });

    setTabs(newTabs);
    setSections(newSections);
    setFields(newFields);
    setActiveTab(newTabs[0]?.id || 'tab-1');
  };

  const handleLayoutModeChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    loadLayout(mode);
  };

  const getFieldDef = (apiName: string): FieldDef | undefined => {
    return object?.fields.find((f) => f.apiName === apiName);
  };

  const DraggableField = ({ field }: { field: FieldDef }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: field.apiName,
      data: { field },
    });

    const style = transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
      : undefined;

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`flex items-center gap-2 p-2 rounded border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-move ${
          isDragging ? 'opacity-50' : ''
        }`}
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{field.label}</div>
          <div className="text-xs text-gray-500">{field.type}</div>
        </div>
        {field.required && <span className="text-red-500 text-xs">*</span>}
      </div>
    );
  };

  const DroppableSection = ({
    section,
    children,
  }: {
    section: CanvasSection;
    children: React.ReactNode;
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: section.id,
      data: { section },
    });

    return (
      <div
        ref={setNodeRef}
        className={`p-4 grid gap-4 ${
          section.columns === 1
            ? 'grid-cols-1'
            : section.columns === 2
            ? 'grid-cols-2'
            : 'grid-cols-3'
        } ${isOver ? 'bg-blue-50 border-2 border-dashed border-blue-400 rounded' : ''}`}
      >
        {children}
      </div>
    );
  };

  const activeSections = sections.filter((s) => s.tabId === activeTab);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full">
        {/* Left Palette */}
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Layout Mode</h3>
            <div className="flex gap-2">
              <Button
                variant={layoutMode === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLayoutModeChange('new')}
                className="flex-1"
              >
                New
              </Button>
              <Button
                variant={layoutMode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLayoutModeChange('existing')}
                className="flex-1"
              >
                Edit
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Available Fields</h3>
            <div className="text-xs text-gray-500 mb-2">
              {availableFields.length} of {object.fields.length} fields
            </div>
          </div>

          <div className="space-y-2">
            {availableFields.map((field) => (
              <DraggableField key={field.apiName} field={field} />
            ))}
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`px-4 py-2 cursor-pointer relative group ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-500 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tabs.length > 1 && (
                  <button
                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTab(tab.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addTab}
              className="px-3 py-2 text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Tab
            </button>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {activeSections.map((section) => (
              <div
                key={section.id}
                className="border rounded-lg bg-white"
                onClick={() => setSelectedElement({ type: 'section', id: section.id })}
              >
                <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleSectionCollapsed(section.id)}>
                      {section.collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <span className="font-medium">{section.label}</span>
                    <span className="text-xs text-gray-500">
                      ({section.columns} column{section.columns > 1 ? 's' : ''})
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSection(section.id);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {!section.collapsed && (
                  <DroppableSection section={section}>
                    {fields
                      .filter((f) => f.sectionId === section.id)
                      .sort((a, b) => a.order - b.order)
                      .map((field) => {
                        const fieldDef = getFieldDef(field.fieldApiName);
                        if (!fieldDef) return null;
                        return (
                          <div
                            key={field.id}
                            className="p-3 border rounded bg-gray-50 relative group"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedElement({ type: 'field', id: field.id });
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium flex items-center gap-1">
                                  {fieldDef.label}
                                  {fieldDef.required && <span className="text-red-500">*</span>}
                                </div>
                                <div className="text-xs text-gray-500">{fieldDef.type}</div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteField(field.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {fields.filter((f) => f.sectionId === section.id).length === 0 && (
                      <div className="col-span-full p-8 border-2 border-dashed border-gray-300 rounded text-center text-gray-400">
                        Drop fields here
                      </div>
                    )}
                  </DroppableSection>
                )}
              </div>
            ))}

            <Button onClick={addSection} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-4">Properties</h3>

          {selectedElement ? (
            <>
              {selectedElement.type === 'tab' && (
                <div>
                  <Label>Tab Label</Label>
                  <Input
                    value={tabs.find((t) => t.id === selectedElement.id)?.label || ''}
                    onChange={(e) => updateTabLabel(selectedElement.id, e.target.value)}
                  />
                </div>
              )}

              {selectedElement.type === 'section' && (
                <div className="space-y-4">
                  <div>
                    <Label>Section Label</Label>
                    <Input
                      value={sections.find((s) => s.id === selectedElement.id)?.label || ''}
                      onChange={(e) => updateSectionLabel(selectedElement.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Columns</Label>
                    <div className="flex gap-2 mt-2">
                      {[1, 2, 3].map((num) => {
                        const section = sections.find((s) => s.id === selectedElement.id);
                        return (
                          <Button
                            key={num}
                            variant={section?.columns === num ? 'default' : 'outline'}
                            size="sm"
                            onClick={() =>
                              updateSectionColumns(selectedElement.id, num as ColumnCount)
                            }
                          >
                            {num === 1 ? (
                              <Layout className="h-4 w-4" />
                            ) : num === 2 ? (
                              <Columns2 className="h-4 w-4" />
                            ) : (
                              <Columns3 className="h-4 w-4" />
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {selectedElement.type === 'field' && (
                <div>
                  <div className="text-sm text-gray-600 mb-2">Field Properties</div>
                  {(() => {
                    const field = fields.find((f) => f.id === selectedElement.id);
                    const fieldDef = field ? getFieldDef(field.fieldApiName) : null;
                    if (!fieldDef) return <div>Field not found</div>;
                    return (
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-gray-500">Label:</span>
                          <div className="font-medium">{fieldDef.label}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">API Name:</span>
                          <div className="font-medium text-xs">{fieldDef.apiName}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Type:</span>
                          <div className="font-medium">{fieldDef.type}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Required:</span>
                          <div className="font-medium">
                            {fieldDef.required ? 'Yes' : 'No'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500">
              Select a tab, section, or field to view properties
            </div>
          )}

          <div className="mt-6 space-y-2">
            <Button onClick={saveLayout} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Layout
            </Button>
            <Button variant="outline" className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              Preview Form
            </Button>
          </div>

          <div className="mt-6 p-3 bg-blue-50 rounded text-xs text-blue-800">
            <div className="font-semibold mb-1">💡 Tips:</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Drag fields from the left panel</li>
              <li>Drop into sections to add them</li>
              <li>Click elements to configure</li>
              <li>Use tabs for complex layouts</li>
            </ul>
          </div>
        </div>
      </div>

      <DragOverlay>
        {draggedItem ? (
          <div className="p-2 bg-white border-2 border-blue-400 rounded shadow-lg">
            <div className="font-medium">{draggedItem.label}</div>
            <div className="text-xs text-gray-500">{draggedItem.type}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
