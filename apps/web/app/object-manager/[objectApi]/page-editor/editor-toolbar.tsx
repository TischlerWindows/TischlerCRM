'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPreset, setResetPreset] = useState<LayoutPresetId | ''>('');

  const confirmResetTabStructure = () => {
    if (!resetPreset) return;
    applyLayoutPreset(resetPreset);
    setResetDialogOpen(false);
    setResetPreset('');
  };

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs shrink-0"
              onClick={() => setResetDialogOpen(true)}
            >
              <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Reset tab structure…</span>
              <span className="sm:hidden">Reset tab</span>
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onOpenRules}>
              <Wand2 className="h-4 w-4 mr-1.5" />
              Rules ({formattingRules.length})
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={onPreview}>
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

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace this tab&apos;s structure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This removes every section, field, and widget on the <strong>active tab</strong> and
            replaces it with the template you choose. Other tabs are unchanged. This cannot be undone
            except with Undo in the editor.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">New structure</label>
            <select
              className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
              value={resetPreset}
              onChange={(e) => setResetPreset(e.target.value as LayoutPresetId | '')}
            >
              <option value="">Choose a template…</option>
              {LAYOUT_PRESET_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!resetPreset}
              onClick={confirmResetTabStructure}
            >
              Replace active tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
