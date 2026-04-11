'use client';

import React, { useEffect } from 'react';
import type { ConfigPanelProps } from '@/lib/widgets/types';
import { useSchemaStore } from '@/lib/schema-store';
import { Label } from '@/components/ui/label';

export default function PathConfigPanel({ config, onChange, object }: ConfigPanelProps) {
  const schema = useSchemaStore((s) => s.schema);
  const objectDef = schema?.objects.find(o => o.apiName === object.apiName);
  const paths = (objectDef?.paths || []).filter(p => p.active);

  const pathId = (config.pathId as string) || '';
  const showLabel = (config.showLabel as boolean) ?? true;
  const showGuidance = (config.showGuidance as boolean) ?? true;
  const showKeyFields = (config.showKeyFields as boolean) ?? true;
  const compact = (config.compact as boolean) ?? false;

  // Auto-select if only one path exists and persist to config
  const effectivePathId = pathId || (paths.length === 1 ? paths[0].id : '');

  useEffect(() => {
    if (!pathId && paths.length === 1) {
      onChange({ ...config, pathId: paths[0].id });
    }
  }, [pathId, paths.length]);

  return (
    <div className="space-y-4">
      {/* Path selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Path</Label>
        {paths.length === 0 ? (
          <div className="text-xs text-gray-400 py-1">
            No active paths configured for this object. Create one in Object Manager → Paths.
          </div>
        ) : (
          <select
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
            value={effectivePathId}
            onChange={e => onChange({ ...config, pathId: e.target.value })}
          >
            <option value="">Select a path...</option>
            {paths.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.stages.length} stages)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Display options */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <Label className="text-xs text-gray-500 uppercase font-semibold">Display Options</Label>

        <ToggleOption
          label="Show path name"
          checked={showLabel}
          onChange={v => onChange({ ...config, showLabel: v })}
        />
        <ToggleOption
          label="Show guidance"
          checked={showGuidance}
          onChange={v => onChange({ ...config, showGuidance: v })}
        />
        <ToggleOption
          label="Show key fields"
          checked={showKeyFields}
          onChange={v => onChange({ ...config, showKeyFields: v })}
        />
        <ToggleOption
          label="Compact mode"
          description="Click stages to advance directly, no popover"
          checked={compact}
          onChange={v => onChange({ ...config, compact: v })}
        />
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-xs text-gray-700">{label}</div>
        {description && <div className="text-[10px] text-gray-400">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
          checked ? 'bg-brand-navy' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </div>
  );
}
