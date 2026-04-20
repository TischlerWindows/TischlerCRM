'use client';

import React, { useCallback, useState } from 'react';
import { ChevronRight, PanelLeftClose, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FieldDef } from '@/lib/schema';
import { CanvasRegion } from '../canvas-section';
import { FloatingProperties } from '../floating-properties';
import { PaletteComponents } from '../palette-components';
import { PaletteFields } from '../palette-fields';
import { useEditorStore } from '../editor-store';
import { useEditorSidePanels } from '../use-editor-side-panels';
import { useEnabledWidgetIds } from '@/lib/use-widget-settings';
import type { LayoutSection, LayoutTab } from '../types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface EditorCanvasProps {
  activeTab: LayoutTab | null;
  activeRegions: LayoutSection[];
  allFields: FieldDef[];
  routeKey: string;
  layoutId: string;
  showTemplateGallery: boolean;
  onAddSection: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EditorCanvas({
  activeTab,
  activeRegions,
  allFields,
  routeKey,
  layoutId,
  showTemplateGallery,
  onAddSection,
}: EditorCanvasProps) {
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);

  const [paletteTab, setPaletteTab] = useState<'fields' | 'components'>('fields');

  const { ids: enabledWidgetIds } = useEnabledWidgetIds();
  const sidePanels = useEditorSidePanels();
  const leftPanelContainerId = `page-editor-left-panel-${encodeURIComponent(routeKey || 'new')}`;

  const handleLeftResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        sidePanels.adjustLeftWidth(-16);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        sidePanels.adjustLeftWidth(16);
      }
    },
    [sidePanels],
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Left palette panel */}
      <div
        id={leftPanelContainerId}
        className="relative flex shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-150"
        style={{
          width: sidePanels.leftCollapsed ? 40 : sidePanels.leftWidth,
          minWidth: sidePanels.leftCollapsed ? 40 : undefined,
        }}
      >
        <button
          type="button"
          title={sidePanels.leftCollapsed ? 'Show fields panel' : 'Hide fields panel'}
          onClick={() => sidePanels.toggleLeftCollapsed()}
          aria-label={sidePanels.leftCollapsed ? 'Expand fields panel' : 'Collapse fields panel'}
          aria-expanded={!sidePanels.leftCollapsed}
          aria-controls={leftPanelContainerId}
          className="absolute right-0 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-l-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
        >
          {sidePanels.leftCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        {!sidePanels.leftCollapsed && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="grid grid-cols-2 border-b border-gray-200 bg-white p-2">
              <button
                type="button"
                onClick={() => setPaletteTab('fields')}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  paletteTab === 'fields'
                    ? 'bg-brand-navy text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                Fields
              </button>
              <button
                type="button"
                onClick={() => setPaletteTab('components')}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  paletteTab === 'components'
                    ? 'bg-brand-navy text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                Components
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {paletteTab === 'fields' ? (
                <PaletteFields availableFields={allFields} />
              ) : (
                <PaletteComponents enabledWidgetIds={enabledWidgetIds} />
              )}
            </div>
          </div>
        )}
      </div>
      {!sidePanels.leftCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize fields panel"
          aria-valuemin={200}
          aria-valuemax={520}
          aria-valuenow={Math.round(sidePanels.leftWidth)}
          tabIndex={0}
          onMouseDown={sidePanels.startResizeLeft}
          onKeyDown={handleLeftResizeKeyDown}
          className="w-1.5 shrink-0 cursor-col-resize border-r border-transparent bg-gray-200/80 hover:bg-brand-navy/20"
        />
      )}

      {/* Center canvas */}
      <main className="min-w-0 flex-1 overflow-y-auto bg-gray-100 p-6" data-editor-canvas>
        <div className={showTemplateGallery && layoutId === 'new' ? 'pointer-events-none opacity-40' : ''}>
          {activeTab ? (
            <>
              <div className="grid grid-cols-12 gap-4">
                {activeRegions.map((region) => (
                  <CanvasRegion key={region.id} region={region} tabId={activeTab.id} />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full border-dashed border-gray-300 hover:border-brand-navy hover:text-brand-navy"
                onClick={onAddSection}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
              No tabs are available for this layout.
            </div>
          )}
        </div>
      </main>

      {/* Right properties sidebar */}
      <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white">
        <FloatingProperties
          onClose={() => setSelectedElement(null)}
          availableFields={allFields}
        />
      </div>
    </div>
  );
}
