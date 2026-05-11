'use client';

import { Trash2, Eye, EyeOff } from 'lucide-react';
import { ConditionBuilder, type DraftCondition } from './condition-builder';
import { VariantEditor, type DraftVariant } from './variant-editor';

const SECTIONS = ['CONSTANT', 'SPECIFICATION', 'OPTION', 'EXCLUSION', 'INSTALLATION'] as const;
type Section = typeof SECTIONS[number];

const DRIVER_FIELDS = [
  { value: '', label: 'None (simple block)' },
  { value: 'glassType', label: 'Glass Type' },
  { value: 'jobType', label: 'Job Type' },
  { value: 'productTypes', label: 'Product Types' },
  { value: 'woodType', label: 'Wood Type' },
  { value: 'finishType', label: 'Finish Type' },
  { value: 'spacerBarType', label: 'Spacer Bar Type' },
  { value: 'sdlType', label: 'SDL Type' },
];

interface Props {
  isNew: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
  section: Section;
  onSectionChange: (v: Section) => void;
  alwaysIncluded: boolean;
  onAlwaysIncludedChange: (v: boolean) => void;
  active: boolean;
  onActiveChange: (v: boolean) => void;
  driverField: string;
  onDriverFieldChange: (v: string) => void;
  conditions: DraftCondition[];
  onConditionsChange: (v: DraftCondition[]) => void;
  variants: DraftVariant[];
  onVariantsChange: (v: DraftVariant[]) => void;
  onDelete: () => void;
  bodyTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function BlockEditor({
  isNew,
  title,
  onTitleChange,
  body,
  onBodyChange,
  section,
  onSectionChange,
  alwaysIncluded,
  onAlwaysIncludedChange,
  active,
  onActiveChange,
  driverField,
  onDriverFieldChange,
  conditions,
  onConditionsChange,
  variants,
  onVariantsChange,
  onDelete,
  bodyTextareaRef,
}: Props) {
  const isVariantMode = !!driverField;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {isNew ? 'New Block' : 'Edit Block'}
        </h3>
        {!isNew && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Title</label>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g., Glass Specification"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
        </div>

        {/* Section pills */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 mb-1.5 block">Section</label>
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSectionChange(s)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-colors ${
                  section === s
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Driver field */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Driver Variable</label>
          <select
            value={driverField}
            onChange={(e) => onDriverFieldChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          >
            {DRIVER_FIELDS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {isVariantMode
              ? 'Content varies by this field — define variants below.'
              : 'Leave empty for a single body text.'}
          </p>
        </div>

        {/* Body or Variants */}
        {isVariantMode ? (
          <VariantEditor
            variants={variants}
            onChange={onVariantsChange}
            driverField={driverField}
          />
        ) : (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
              Body Text
              <span className="font-normal text-gray-400 ml-1">Use {'{{tokenName}}'} for variables</span>
            </label>
            <textarea
              ref={bodyTextareaRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={12}
              placeholder="All windows and doors shall be glazed with {{glassType}} glass..."
              className="w-full min-h-[180px] px-2.5 py-2 text-xs leading-relaxed border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/20 font-mono resize-y"
            />
          </div>
        )}

        {/* Toggles */}
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={alwaysIncluded}
              onChange={(e) => onAlwaysIncludedChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/20"
            />
            <span className="text-xs text-gray-700">Always included</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => onActiveChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/20"
            />
            <span className="text-xs text-gray-700 flex items-center gap-1">
              {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Active
            </span>
          </label>
        </div>

        {/* Conditions (only when not always-included) */}
        {!alwaysIncluded && (
          <ConditionBuilder conditions={conditions} onChange={onConditionsChange} />
        )}
      </div>
    </div>
  );
}
