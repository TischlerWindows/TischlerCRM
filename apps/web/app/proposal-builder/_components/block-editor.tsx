'use client';

import { Trash2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { ConditionBuilder, type DraftCondition } from './condition-builder';
import { VariantEditor, type DraftVariant } from './variant-editor';
import { BodyEditor, type BodyEditorHandle } from './body-editor';
import { BlockConfigForm } from './block-config-form';
import { HelpHint } from './help-hint';
import { BLOCK_TYPE_META, type BlockType } from '@crm/types';

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
  blockType: BlockType | null;
  config: Record<string, unknown>;
  onConfigChange: (v: Record<string, unknown>) => void;
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
  /** Ref to the body editor — used by the Variables chip panel to insert tokens at cursor. */
  bodyEditorRef?: React.RefObject<BodyEditorHandle | null>;
  /** Inclusion decision for the currently-edited block against the active summary, if any. */
  decision?: { included: boolean; reason: string } | null;
}

/** Layout-only block types — these don't render the body text editor. */
const LAYOUT_ONLY_TYPES: BlockType[] = [
  'LETTERHEAD',
  'PRICING_TABLE',
  'BASE_BID_LINE',
  'ADDITIONS_TABLE',
  'EXCLUSIONS_HEADER',
  'CLOSING_SIGNATURE',
  'PAGE_BREAK',
  'INSTALLATION_HEADER',
  'FOOTER',
];

export function BlockEditor({
  isNew,
  title,
  onTitleChange,
  body,
  onBodyChange,
  section,
  onSectionChange,
  blockType,
  config,
  onConfigChange,
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
  bodyEditorRef,
  decision,
}: Props) {
  const isVariantMode = !!driverField;
  const isLayoutOnly = blockType !== null && LAYOUT_ONLY_TYPES.includes(blockType);
  const blockTypeMeta = blockType ? BLOCK_TYPE_META[blockType] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header — left padding leaves room for the panel-collapse toggle button
          that page.tsx positions absolute at top-left of this panel. */}
      <div className="pl-12 pr-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
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

      {/* Decision banner — shows whether this block appears in the current preview, and why. */}
      {decision && !isNew && (
        <div
          className={`flex items-start gap-2 px-4 py-2 border-b text-[11px] ${
            decision.included
              ? 'bg-green-50 border-green-100 text-green-800'
              : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}
        >
          {decision.included ? (
            <CheckCircle2 className="w-3.5 h-3.5 mt-px flex-shrink-0" />
          ) : (
            <XCircle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-semibold">
              {decision.included ? 'Included in current preview' : 'Hidden from current preview'}
            </div>
            <div className="opacity-80 mt-0.5 break-words">{decision.reason}</div>
          </div>
        </div>
      )}

      {/* Scrollable body */}
      <div data-scroll-panel className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 pb-16">
        {/* Block type badge */}
        {blockTypeMeta && (
          <div className="rounded-md border border-brand-navy/15 bg-brand-navy/[0.03] px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-brand-navy/70">
              {blockTypeMeta.group}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-brand-navy">
              {blockTypeMeta.label}
            </div>
            <div className="mt-0.5 text-[10.5px] text-gray-500 leading-snug">
              {blockTypeMeta.description}
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
            {isLayoutOnly ? 'Internal name' : 'Title'}
          </label>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={isLayoutOnly ? 'Shown only in the block list' : 'e.g., Glass Specification'}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
        </div>

        {/* Type-specific config form */}
        {blockType && (
          <BlockConfigForm
            blockType={blockType}
            config={config}
            onChange={onConfigChange}
          />
        )}

        {/* Section pills — hidden for layout-only blocks since their
            block type already determines render behavior. */}
        {!isLayoutOnly && (
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <label className="text-[10px] font-semibold text-gray-500">Section</label>
            <HelpHint
              label="Section help"
              title="Where this block appears"
              description="Each section renders in a fixed region of the proposal PDF. Pick the one that matches the role of this block."
              example={`SPECIFICATION → numbered list ("1. Glass Specification…")
OPTION → "Additions or Deductions to our base bid"
EXCLUSION → "Our base bid does not include"
INSTALLATION → installation appendix page
CONSTANT → intro paragraphs and closing (no number)`}
            />
          </div>
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
        )}

        {/* Driver field — only meaningful for content blocks. */}
        {!isLayoutOnly && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-[10px] font-semibold text-gray-500">Driver Variable</label>
            <HelpHint
              label="Driver Variable help"
              title="Variant by field value"
              description="A simple block has one Body Text. Set a Driver Variable to make the body change based on a summary field — for example, different wording per Glass Type. Each value gets its own variant card below."
              example={`Driver = "glassType"
  → variant matching #28 renders one paragraph
  → variant matching #3 renders another
A project with multiple glass types prints all matches.`}
            />
          </div>
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
              ? `Body text now varies by ${driverField} — define one variant per value below.`
              : 'Leave empty for a single body text.'}
          </p>
        </div>
        )}

        {/* Body or Variants — only for content blocks. */}
        {!isLayoutOnly && (isVariantMode ? (
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
            <BodyEditor
              ref={bodyEditorRef}
              value={body}
              onChange={onBodyChange}
              placeholder="Bold, italic, lists supported"
            />
          </div>
        ))}

        {/* Toggles */}
        <div className="flex items-center gap-5 flex-wrap">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={alwaysIncluded}
              onChange={(e) => onAlwaysIncludedChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/20"
            />
            <span className="text-xs text-gray-700">Always included</span>
            <HelpHint
              label="Always included help"
              title="Bypass conditions"
              description="When on, this block always renders — conditions below are ignored. When off, the block only renders if every AND condition passes AND (if any OR conditions exist) at least one OR also passes."
              example={`On  → block always in the PDF.
Off + no conditions → block never renders.
Off + conditions → evaluated against the active summary.`}
            />
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
            <HelpHint
              label="Active help"
              title="Draft toggle"
              description="When off, this block is treated as a draft — it never renders in the preview or the generated PDF, regardless of conditions or 'Always included'. Use to retire a block without deleting it."
            />
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
