'use client';

import React, { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Input } from '@/components/ui/input';
import type { FieldDef } from '@/lib/schema';
import { GripVertical, Search as SearchIcon } from 'lucide-react';
import { WidgetPaletteGrid } from './widget-palette';

/* ──────────── Draggable Field Card ──────────── */

function DraggableField({ field }: { field: FieldDef }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${field.apiName}`,
    data: { field },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-2 border rounded bg-white cursor-grab active:cursor-grabbing hover:border-brand-navy hover:bg-[#f0f1fa] transition-colors"
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
}

/* ──────────── Field Palette ──────────── */

export function FieldPalette({
  availableFields,
  totalFieldCount,
}: {
  availableFields: FieldDef[];
  totalFieldCount: number;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'fields' | 'widgets'>('fields');

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return availableFields;
    const lower = searchTerm.toLowerCase();
    return availableFields.filter(
      (f) =>
        f.label.toLowerCase().includes(lower) ||
        f.apiName.toLowerCase().includes(lower),
    );
  }, [availableFields, searchTerm]);

  return (
    <div className="w-64 border-r bg-white flex flex-col h-full shadow-sm">
      {/* Tab switcher */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('fields')}
          className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'fields'
              ? 'text-brand-navy border-b-2 border-brand-navy'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Fields
        </button>
        <button
          onClick={() => setActiveTab('widgets')}
          className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'widgets'
              ? 'text-brand-navy border-b-2 border-brand-navy'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Widgets
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'fields' ? (
          <>
            {/* Search */}
            <div className="mb-3">
              <div className="relative">
                <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-3">
              {filtered.length} of {totalFieldCount} fields
            </div>

            <div className="space-y-1.5">
              {filtered.length > 0 ? (
                filtered.map((field) => (
                  <DraggableField key={field.apiName} field={field} />
                ))
              ) : (
                <div className="text-xs text-gray-500 text-center py-4">
                  No fields match your search
                </div>
              )}
            </div>
          </>
        ) : (
          <WidgetPaletteGrid />
        )}
      </div>
    </div>
  );
}
