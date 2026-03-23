'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Eye, LayoutTemplate, Save, Wand2 } from 'lucide-react';
import { useEditorStore } from './editor-store';
import { LAYOUT_PRESET_OPTIONS, type LayoutPresetId } from './layout-presets';

export function EditorToolbar({
  onSave,
  onPreview,
  onOpenRules,
  onRequestNavigate,
  objectManagerHref,
  objectListHref,
  objectListLabel,
  layoutAssignmentNote,
}: {
  onSave: () => void;
  onPreview: () => void;
  onOpenRules: () => void;
  onRequestNavigate: (href: string) => void;
  objectManagerHref: string;
  objectListHref: string | null;
  objectListLabel: string;
  /** Explains record-type assignment vs list-view preferences */
  layoutAssignmentNote?: string | null;
}) {
  const layoutName = useEditorStore((s) => s.layoutName);
  const setLayoutName = useEditorStore((s) => s.setLayoutName);
  const formattingRules = useEditorStore((s) => s.formattingRules);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges);
  const applyLayoutPreset = useEditorStore((s) => s.applyLayoutPreset);

  const [presetSelectValue, setPresetSelectValue] = useState('');

  return (
    <div className="border-b bg-white">
      {/* Top row */}
      <div className="px-4 py-2 flex items-start gap-3 flex-wrap border-b border-gray-100">
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => onRequestNavigate(objectManagerHref)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-navy transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Object Manager
          </button>
          {objectListHref && objectListLabel ? (
            <button
              type="button"
              onClick={() => onRequestNavigate(objectListHref)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-navy transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to {objectListLabel}
            </button>
          ) : null}
        </div>
        {hasUnsavedChanges && (
          <span className="text-xs text-amber-600 font-medium self-center">Unsaved changes</span>
        )}
      </div>

      {/* Bottom row */}
      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              placeholder="Layout name..."
              className="text-lg font-semibold h-9 w-72 border-dashed focus:border-brand-navy"
            />
            <label className="flex items-center gap-2 text-xs text-gray-600 shrink-0">
              <LayoutTemplate className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Layout preset</span>
              <select
                className="border border-gray-300 rounded px-2 py-1 text-xs bg-white min-w-[10rem]"
                value={presetSelectValue}
                onChange={(e) => {
                  const v = e.target.value as LayoutPresetId | '';
                  if (!v) return;
                  applyLayoutPreset(v);
                  setPresetSelectValue('');
                }}
              >
                <option value="">Replace active tab layout…</option>
                {LAYOUT_PRESET_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onOpenRules}
            >
              <Wand2 className="h-4 w-4 mr-1.5" />
              Rules ({formattingRules.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onPreview}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              Preview
            </Button>
            <Button
              onClick={onSave}
              size="sm"
              className="bg-brand-navy hover:bg-brand-navy/90 text-white"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save Layout
            </Button>
          </div>
        </div>
        {layoutAssignmentNote ? (
          <p className="text-xs text-gray-500 max-w-4xl leading-relaxed">{layoutAssignmentNote}</p>
        ) : null}
      </div>
    </div>
  );
}
