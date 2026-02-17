'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
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
import { FieldDef, PageLayout, PageTab, PageSection, FieldType, ConditionExpr } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldVisibilityRuleEditor } from '@/components/field-visibility-rule-editor';
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
  Search as SearchIcon,
  X,
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
  visibleIf?: ConditionExpr[];
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
  const [overId, setOverId] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'top' | 'right' | 'bottom' | 'left' | null>(null);
  const [overColumn, setOverColumn] = useState<{ sectionId: string; columnIndex: number } | null>(null);
  const [fieldSearchTerm, setFieldSearchTerm] = useState<string>('');
  const [selectedFieldObjects, setSelectedFieldObjects] = useState<string[]>([objectApiName]);
  const [showVisibilityEditor, setShowVisibilityEditor] = useState(false);
  const [homeReports, setHomeReports] = useState<Array<{ id: string; name: string }>>([]);
  const [homeDashboards, setHomeDashboards] = useState<Array<{ id: string; name: string }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!object) {
    return <div className="p-6">Object not found</div>;
  }

  // Get all objects for filtering
  const allObjects = schema?.objects || [];
  
  useEffect(() => {
    if (objectApiName !== 'Home') return;

    const savedReports = localStorage.getItem('customReports');
    const customReports = savedReports ? JSON.parse(savedReports) : [];
    setHomeReports(customReports.map((r: any) => ({ id: r.id, name: r.name })));

    const savedDashboards = localStorage.getItem('dashboards');
    const dashboards = savedDashboards ? JSON.parse(savedDashboards) : [];
    setHomeDashboards(dashboards.map((d: any) => ({ id: d.id, name: d.name })));
  }, [objectApiName]);

  const availableFields = useMemo(() => {
    let baseFields: FieldDef[] = objectApiName === 'Home'
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

    // Add hardcoded Name field for Contact objects
    if (objectApiName === 'Contact' && !baseFields.find(f => f.apiName === 'Contact__name')) {
      const nameField: FieldDef = {
        id: 'hardcoded-name-field',
        apiName: 'Contact__name',
        label: 'Name',
        type: 'Text',
        readOnly: true,
        custom: false,
        required: false,
        maxLength: 255,
        helpText: 'Auto-summarized full name (Salutation, First Name, Last Name)'
      };
      baseFields = [nameField, ...baseFields];
    }

    if (!fieldSearchTerm.trim()) {
      return baseFields;
    }

    const searchLower = fieldSearchTerm.toLowerCase();
    return baseFields.filter((field) =>
      field.label.toLowerCase().includes(searchLower) ||
      field.apiName.toLowerCase().includes(searchLower)
    );
  }, [objectApiName, object.fields, homeReports, homeDashboards, fieldSearchTerm]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id.toString();
    
    // Check if dragging from palette
    if (activeId.startsWith('field-')) {
      const fieldApiName = activeId.replace('field-', '');
      const field = availableFields.find((f) => f.apiName === fieldApiName);
      if (field) {
        setDraggedItem({
          id: field.apiName,
          label: field.label,
          apiName: field.apiName,
          type: field.type,
          required: field.required || false,
        });
      }
    }
    // Check if dragging a placed field (for reordering)
    else if (activeId.startsWith('placed-')) {
      const placedField = fields.find((f) => f.id === activeId);
      if (placedField) {
        const fieldDef = object.fields.find((f) => f.apiName === placedField.fieldApiName);
        if (fieldDef) {
          setDraggedItem({
            id: placedField.id,
            label: fieldDef.label,
            apiName: fieldDef.apiName,
            type: fieldDef.type,
            required: fieldDef.required || false,
          });
        }
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const id = over ? over.id.toString() : null;
    setOverId(id);
    
    // Track which column is being hovered
    if (id && id.includes('-col-')) {
      const colMatch = id.match(/^(.+)-col-(\d+)$/);
      if (colMatch) {
        setOverColumn({
          sectionId: colMatch[1],
          columnIndex: parseInt(colMatch[2])
        });
      }
    } else if (id && id.startsWith('placed-')) {
      const field = fields.find(f => f.id === id);
      if (field) {
        setOverColumn({
          sectionId: field.sectionId,
          columnIndex: field.column
        });
      }
    } else {
      setOverColumn(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDropSide = dropSide;
    setDraggedItem(null);
    setOverId(null);
    setDropSide(null);
    setOverColumn(null);

    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // Case 0: Dropping into an empty column
    if (overId.includes('-col-') && activeId.startsWith('field-')) {
      const fieldApiName = activeId.replace('field-', '');
      const colMatch = overId.match(/^(.+)-col-(\d+)$/);
      
      if (colMatch) {
        const targetSectionId = colMatch[1];
        const targetColumn = parseInt(colMatch[2]);
        
        // Find the highest order in this column
        const columnFields = fields.filter(
          (f) => f.sectionId === targetSectionId && f.column === targetColumn
        );
        const maxOrder = columnFields.length > 0 
          ? Math.max(...columnFields.map(f => f.order)) 
          : -1;
        
        const newField: CanvasField = {
          id: `placed-${Date.now()}-${fieldApiName}`,
          fieldApiName,
          sectionId: targetSectionId,
          column: targetColumn,
          order: maxOrder + 1,
        };
        setFields([...fields, newField]);
      }
      return;
    }

    // Only allow drops on placed fields for precise placement
    if (!overId.startsWith('placed-')) {
      return;
    }

    const overField = fields.find((f) => f.id === overId);
    if (!overField) return;

    // Only allow top/bottom drops
    if (currentDropSide !== 'top' && currentDropSide !== 'bottom') {
      return;
    }

    // Case 1: Dragging a new field from palette onto an existing field
    if (activeId.startsWith('field-')) {
      const fieldApiName = activeId.replace('field-', '');
      const targetSectionId = overField.sectionId;
      const targetColumn = overField.column;
      
      // Get all fields in the same section and column, sorted by order
      const columnFields = fields
        .filter((f) => f.sectionId === targetSectionId && f.column === targetColumn)
        .sort((a, b) => a.order - b.order);
      
      // Find the position to insert
      const overFieldIndexInColumn = columnFields.findIndex((f) => f.id === overId);
      let insertOrder = overField.order;
      
      if (currentDropSide === 'bottom') {
        // Insert after
        if (overFieldIndexInColumn < columnFields.length - 1) {
          // There's a field below, insert between
          insertOrder = (overField.order + columnFields[overFieldIndexInColumn + 1].order) / 2;
        } else {
          // Last field in column, insert after
          insertOrder = overField.order + 1;
        }
      } else {
        // Insert before
        if (overFieldIndexInColumn > 0) {
          // There's a field above, insert between
          insertOrder = (columnFields[overFieldIndexInColumn - 1].order + overField.order) / 2;
        } else {
          // First field in column, insert before
          insertOrder = overField.order - 1;
        }
      }
      
      const newField: CanvasField = {
        id: `placed-${Date.now()}-${fieldApiName}`,
        fieldApiName,
        sectionId: targetSectionId,
        column: targetColumn,
        order: insertOrder,
      };
      
      setFields([...fields, newField]);
      return;
    }

    // Case 2: Reordering a placed field within same section and column
    if (activeId.startsWith('placed-')) {
      const activeField = fields.find((f) => f.id === activeId);
      if (!activeField) return;

      // Only allow reordering within same section and column
      if (activeField.sectionId !== overField.sectionId || activeField.column !== overField.column) {
        return;
      }

      const columnFields = fields
        .filter((f) => f.sectionId === activeField.sectionId && f.column === activeField.column)
        .sort((a, b) => a.order - b.order);
      
      const activeIndexInColumn = columnFields.findIndex((f) => f.id === activeId);
      const overIndexInColumn = columnFields.findIndex((f) => f.id === overId);
      
      if (activeIndexInColumn === -1 || overIndexInColumn === -1) return;
      
      let newOrder = overField.order;
      
      if (currentDropSide === 'bottom') {
        // Place after the over field
        if (overIndexInColumn < columnFields.length - 1) {
          newOrder = (overField.order + columnFields[overIndexInColumn + 1].order) / 2;
        } else {
          newOrder = overField.order + 1;
        }
      } else {
        // Place before the over field
        if (overIndexInColumn > 0) {
          newOrder = (columnFields[overIndexInColumn - 1].order + overField.order) / 2;
        } else {
          newOrder = overField.order - 1;
        }
      }
      
      const updatedFields = fields.map((f) => 
        f.id === activeId ? { ...f, order: newOrder } : f
      );
      
      setFields(updatedFields);
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

  const saveLayout = async () => {
    if (!object) return;

    // Get existing layout name if editing, otherwise prompt for new name
    let layoutName = 'Page Layout';
    
    if (editingLayoutId) {
      const existingLayout = object.pageLayouts?.find((l) => l.id === editingLayoutId);
      if (existingLayout) {
        layoutName = existingLayout.name;
      }
    } else {
      // Only prompt for name when creating a new layout
      const promptedName = prompt('Enter a name for this layout:', 'Page Layout');
      if (!promptedName) return;
      layoutName = promptedName;
    }

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
            visibleIf: section.visibleIf,
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

    // Immediately persist to localStorage
    await saveSchema();
    console.log('Schema saved to localStorage');
    const updatedObject = schema?.objects.find((o) => o.apiName === objectApiName);
    console.log('After update - object layouts:', updatedObject?.pageLayouts);
    alert(`Layout "${layoutName}" saved successfully!`);
    setViewMode('list');
  };

  const handleSaveVisibilityRules = async (conditions: any[]) => {
    if (!selectedElement || selectedElement.type !== 'field' || !object) {
      return;
    }

    const field = fields.find((f) => f.id === selectedElement.id);
    if (!field) return;

    const fieldDef = object.fields.find((f) => f.apiName === field.fieldApiName);
    if (!fieldDef) return;

    // Update the field definition with visibility rules
    const updatedFields = object.fields.map((f) =>
      f.apiName === fieldDef.apiName
        ? { ...f, visibleIf: conditions }
        : f
    );

    updateObject(objectApiName, { fields: updatedFields });
    
    // Force schema save to persist changes immediately
    await saveSchema();
    console.log('Visibility rules saved for field:', fieldDef.apiName);
    
    setShowVisibilityEditor(false);
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
          visibleIf: section.visibleIf,
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
    return availableFields.find((f) => f.apiName === apiName);
  };

  const DraggableField = ({ field }: { field: FieldDef }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: `field-${field.apiName}`,
      data: { field },
    });

    const style = {
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className="p-2 border rounded bg-white cursor-grab active:cursor-grabbing hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium flex items-center gap-1">
              {field.label}
              {field.required && <span className="text-red-500 text-xs">*</span>}
            </div>
            <div className="text-xs text-gray-500">{field.type}</div>
          </div>
        </div>
      </div>
    );
  };

  const SortableFieldInSection = ({ field, fieldDef }: { field: CanvasField; fieldDef: FieldDef }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: field.id,
      data: { field, fieldDef },
    });

    const elementRef = React.useRef<HTMLDivElement>(null);

    const isOver = overId === field.id;

    React.useEffect(() => {
      if (!isOver || !elementRef.current) {
        return;
      }

      const handleMouseMove = (e: MouseEvent) => {
        if (!elementRef.current) return;
        const rect = elementRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const midY = rect.height / 2;
        
        // Only top or bottom based on which half of the field
        setDropSide(y < midY ? 'top' : 'bottom');
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isOver]);

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          if (node) {
            (elementRef as React.MutableRefObject<HTMLDivElement>).current = node;
          }
        }}
        style={style}
        className={`p-3 border rounded bg-gray-50 relative group cursor-move ${
          selectedElement?.type === 'field' && selectedElement?.id === field.id
            ? 'border-blue-500 border-2 shadow-md'
            : 'border-gray-300'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedElement({ type: 'field', id: field.id });
        }}
      >
        {isOver && dropSide === 'top' && (
          <div className="absolute -top-1 left-0 right-0 h-1.5 bg-blue-400 rounded-full z-10" />
        )}
        {isOver && dropSide === 'bottom' && (
          <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-blue-400 rounded-full z-10" />
        )}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-1">
                {fieldDef.label}
                {fieldDef.required && <span className="text-red-500">*</span>}
              </div>
              <div className="text-xs text-gray-500">{fieldDef.type}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fieldDef.visibleIf && fieldDef.visibleIf.length > 0 && (
              <div 
                className="p-1 bg-orange-500 rounded flex-shrink-0"
                title={`Visibility filter: ${fieldDef.visibleIf.map((f: any) => `${f.fieldApiName} ${f.operator} ${f.value}`).join(', ')}`}
              >
                <Eye 
                  className="w-3 h-3" 
                  fill="white"
                  stroke="black"
                  strokeWidth="0.5px"
                />
              </div>
            )}
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
      </div>
    );
  };

  const DroppableColumn = ({
    sectionId,
    columnIndex,
    columnFields,
  }: {
    sectionId: string;
    columnIndex: number;
    columnFields: CanvasField[];
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `${sectionId}-col-${columnIndex}`,
      data: { sectionId, columnIndex },
    });

    const isHighlighted = overColumn?.sectionId === sectionId && overColumn?.columnIndex === columnIndex;

    return (
      <div
        ref={setNodeRef}
        className={`min-h-[100px] p-2 rounded transition-all relative ${
          isOver || isHighlighted 
            ? 'bg-green-100 border-2 border-green-400 border-dashed' 
            : 'bg-gray-50 border-2 border-transparent'
        }`}
      >
        <SortableContext items={columnFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {columnFields.map((field) => {
              const fieldDef = getFieldDef(field.fieldApiName);
              if (!fieldDef) return null;
              return (
                <SortableFieldInSection key={field.id} field={field} fieldDef={fieldDef} />
              );
            })}
            {columnFields.length === 0 && (
              <div className="p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-400 text-sm">
                Drop here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    );
  };

  const DroppableSection = ({
    section,
  }: {
    section: CanvasSection;
  }) => {
    const sectionFields = fields
      .filter((f) => f.sectionId === section.id)
      .sort((a, b) => a.order - b.order);

    // Group fields by column
    const columnArrays: CanvasField[][] = [];
    for (let i = 0; i < section.columns; i++) {
      columnArrays[i] = sectionFields.filter((f) => f.column === i);
    }

    return (
      <div className="p-4">
        <div className={`grid gap-4 ${
          section.columns === 1
            ? 'grid-cols-1'
            : section.columns === 2
            ? 'grid-cols-2'
            : 'grid-cols-3'
        }`}>
          {columnArrays.map((columnFields, columnIndex) => (
            <DroppableColumn
              key={`${section.id}-col-${columnIndex}`}
              sectionId={section.id}
              columnIndex={columnIndex}
              columnFields={columnFields}
            />
          ))}
        </div>
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
            id: `placed-${fieldCounter++}-${field.apiName}`,
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

        <div className="mb-6">
          <Button onClick={createNewLayout} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create New Layout
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
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      autoScroll={true}
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
            <h3 className="text-sm font-semibold mb-3">Available Fields</h3>
            
            {/* Search Input */}
            <div className="mb-3">
              <div className="relative">
                <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search fields..."
                  value={fieldSearchTerm}
                  onChange={(e) => setFieldSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            {/* Field Count */}
            <div className="text-xs text-gray-500 mb-3">
              {availableFields.length} of {object.fields.length} fields
            </div>
          </div>
          
          <div className="space-y-2">
            {availableFields.length > 0 ? (
              availableFields.map((field) => (
                <DraggableField key={field.apiName} field={field} />
              ))
            ) : (
              <div className="text-xs text-gray-500 text-center py-4">
                No fields match your search
              </div>
            )}
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
                <div className="flex items-center justify-between p-3 bg-gray-100 border-b">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleSectionCollapsed(section.id)}>
                      {section.collapsed ? (
                        <ChevronRight className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                    <span className="font-medium text-gray-900">{section.label}</span>
                    <span className="text-xs text-gray-600">
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
                  <DroppableSection section={section} />
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
                  <div className="space-y-2">
                  </div>
                </div>
              )}

              {selectedElement.type === 'field' && (
                <div>
                  <div className="text-sm text-gray-600 mb-4">Field Properties</div>
                  {(() => {
                    const field = fields.find((f) => f.id === selectedElement.id);
                    const fieldDef = field ? getFieldDef(field.fieldApiName) : null;
                    if (!fieldDef) return <div>Field not found</div>;
                    return (
                      <>
                        <div className="space-y-2 mb-4 pb-4 border-b">
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

                        {/* Visibility Rules Section */}
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setShowVisibilityEditor(true)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {fieldDef.visibleIf && fieldDef.visibleIf.length > 0
                              ? 'Add Visibility Rules'
                              : 'Create Visibility Rules'}
                          </Button>
                          {fieldDef.visibleIf && fieldDef.visibleIf.length > 0 && (
                            <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                              <div className="font-semibold text-blue-900 mb-1">Active Rules:</div>
                              {fieldDef.visibleIf.map((condition, idx) => {
                                const condField = object?.fields.find(f => f.apiName === condition.left);
                                return (
                                  <div key={idx} className="text-blue-700">
                                    • {condField?.label} {condition.op} {condition.right}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
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

      {/* Visibility Rule Editor Modal */}
      {showVisibilityEditor && selectedElement && selectedElement.type === 'field' && (() => {
        const field = fields.find((f) => f.id === selectedElement.id);
        const fieldDef = field ? getFieldDef(field.fieldApiName) : null;
        if (!fieldDef) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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
                  availableFields={object?.fields.filter(f => f.apiName !== fieldDef.apiName) || []}
                  onSave={handleSaveVisibilityRules}
                  onCancel={() => setShowVisibilityEditor(false)}
                />
              </div>
            </div>
          </div>
        );
      })()}

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
