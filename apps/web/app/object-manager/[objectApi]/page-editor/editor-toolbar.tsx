'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Eye, Save, Wand2 } from 'lucide-react';
import { useEditorStore } from './editor-store';

export function EditorToolbar({
  objectApiName,
  onSave,
  onPreview,
  onOpenRules,
}: {
  objectApiName: string;
  onSave: () => void;
  onPreview: () => void;
  onOpenRules: () => void;
}) {
  const router = useRouter();
  const layoutName = useEditorStore((s) => s.layoutName);
  const setLayoutName = useEditorStore((s) => s.setLayoutName);
  const formattingRules = useEditorStore((s) => s.formattingRules);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges);

  return (
    <div className="border-b bg-white">
      {/* Top row */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() =>
            router.push(
              `/object-manager/${encodeURIComponent(objectApiName)}?section=page-editor`
            )
          }
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-navy transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Object Manager
        </button>
        {hasUnsavedChanges && (
          <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
        )}
      </div>

      {/* Bottom row */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="Layout name..."
            className="text-lg font-semibold h-9 w-72 border-dashed focus:border-brand-navy"
          />
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
    </div>
  );
}
