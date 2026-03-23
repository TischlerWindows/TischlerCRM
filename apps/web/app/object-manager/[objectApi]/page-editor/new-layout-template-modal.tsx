'use client';

import { Button } from '@/components/ui/button';
import { LAYOUT_PRESET_OPTIONS, type LayoutPresetId } from './layout-presets';
import { LayoutTemplate } from 'lucide-react';

export function NewLayoutTemplateModal({
  open,
  onChoose,
}: {
  open: boolean;
  onChoose: (presetId: LayoutPresetId) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-layout-template-title"
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-brand-navy mb-2">
            <LayoutTemplate className="h-6 w-6" />
          </div>
          <h2 id="new-layout-template-title" className="text-xl font-semibold text-gray-900">
            Choose a starting template
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Pick how the first tab is structured. You can still add sections and widgets afterward—this
            only sets the initial layout, similar to Salesforce Lightning App Builder.
          </p>
        </div>
        <div className="p-4 space-y-2">
          {LAYOUT_PRESET_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4 text-left border-gray-200 hover:border-brand-navy/40 hover:bg-brand-navy/[0.04]"
              onClick={() => onChoose(opt.id)}
            >
              <div>
                <div className="font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 font-normal mt-0.5">{opt.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
