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
  const { schema, updateObject, saveSchema } = useSchemaStore();
  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
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

    const layoutName = prompt(
      'Enter a name for this layout:',
      'Page Layout'
    );
    if (!layoutName) return;

    // Convert canvas state to PageLayout
    const pageLayout: PageLayout = {
      id: editingLayoutId || `layout-${Date.now()}`,
      name: layoutName,
      layoutType: 'edit',
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
    let updatedLayouts: PageLayout[];

    if (editingLayoutId) {
      // Update existing layout
      updatedLayouts = existingLayouts.map((l) =>
        l.id === editingLayoutId ? pageLayout : l
      );
    } else {
      // Add new layout
      updatedLayouts = [...existingLayouts, pageLayout];
    }

    console.log('Saving layout for object:', objectApiName);
    console.log('Current layouts:', existingLayouts);
    console.log('New layout:', pageLayout);
    console.log('Updated layouts:', updatedLayouts);

    updateObject(objectApiName, {
      pageLayouts: updatedLayouts,
    });

    // Manually trigger persistence by calling saveSchema
    setTimeout(async () => {
      await saveSchema();
      console.log('Schema saved to localStorage');
      const updatedObject = schema?.objects.find((o) => o.apiName === objectApiName);
      console.log('After update - object layouts:', updatedObject?.pageLayouts);
      alert(`Layout "${layoutName}" saved successfully!`);
      setViewMode('list');
    }, 100);
  };

  const loadLayout = (layoutId: string) => {
    if (!object) return;

    const layout = object.pageLayouts?.find((l) => l.id === layoutId);

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

  const createNewLayout = () => {
    setEditingLayoutId(null);
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
    setViewMode('editor');
  };

  const editExistingLayout = (layoutId: string) => {
    const layout = object?.pageLayouts?.find((l) => l.id === layoutId);
    if (!layout) return;

    setEditingLayoutId(layoutId);

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
    setViewMode('editor');
  };

  const deleteLayout = (layoutId: string) => {
    if (!object) return;
    if (!confirm('Are you sure you want to delete this page layout?')) return;

    const updatedLayouts = (object.pageLayouts || []).filter((l) => l.id !== layoutId);
    updateObject(objectApiName, {
      pageLayouts: updatedLayouts,
    });
  };

  if (viewMode === 'list') {
    const existingLayouts = object?.pageLayouts || [];
    
    console.log('Page Editor List View - Object:', objectApiName);
    console.log('Page Editor List View - Layouts:', existingLayouts);

    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Page Layouts</h2>
          <p className="text-gray-600">
            Manage page layouts for {object?.label}. Page layouts control which fields appear on
            forms and their arrangement.
          </p>
        </div>

        <div className="mb-6 flex gap-2">
          <Button onClick={createNewLayout} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create New Layout
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              const stored = localStorage.getItem('schema-store');
              console.log('Raw localStorage data:', stored);
              if (stored) {
                const parsed = JSON.parse(stored);
                console.log('Parsed schema:', parsed);
                const propObj = parsed.state?.schema?.objects?.find((o: any) => o.apiName === 'Property');
                console.log('Property object from storage:', propObj);
                console.log('Property pageLayouts from storage:', propObj?.pageLayouts);
              }
            }}
          >
            Debug Storage
          </Button>
        </div>

        {existingLayouts.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Page Layouts</h3>
            <p className="text-gray-600 mb-4">
              Create your first page layout to define how forms appear for this object.
            </p>
            <Button onClick={createNewLayout} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Layout
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {existingLayouts.map((layout) => (
              <div
                key={layout.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{layout.name}</h3>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Layout className="h-4 w-4" />
                    <span>{layout.tabs.length} tab{layout.tabs.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Grid2x2 className="h-4 w-4" />
                    <span>
                      {layout.tabs.reduce((sum, tab) => sum + tab.sections.length, 0)} section
                      {layout.tabs.reduce((sum, tab) => sum + tab.sections.length, 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editExistingLayout(layout.id)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteLayout(layout.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Editor Header */}
        <div className="border-b bg-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex items-center gap-2"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              Back to Layouts
            </Button>
            <div>
              <h2 className="text-lg font-semibold">
                {editingLayoutId ? 'Edit Layout' : 'Create New Layout'}
              </h2>
              <p className="text-sm text-gray-600">
                Design how forms appear for this object
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={saveLayout} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save Layout
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
        {/* Left Palette */}
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Available Fields</h3>
            <div className="text-xs text-gray-500 mb-2">
              {availableFields.length} of {object.fields.length} fields
            </div>
          </div>          <div className="space-y-2">
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
