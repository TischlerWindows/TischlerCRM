'use client';

import { useCallback } from 'react';
import type {
  BlockType,
  LetterheadConfig,
  PricingTableConfig,
  BaseBidLineConfig,
  AdditionsTableConfig,
  ExclusionsHeaderConfig,
  ClosingSignatureConfig,
  InstallationHeaderConfig,
  FooterConfig,
} from '@crm/types';

interface Props {
  blockType: BlockType;
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function BlockConfigForm({ blockType, config, onChange }: Props) {
  const update = useCallback(
    (patch: Record<string, unknown>) => {
      onChange({ ...config, ...patch });
    },
    [config, onChange],
  );

  switch (blockType) {
    case 'LETTERHEAD':
      return <LetterheadForm config={config as LetterheadConfig} update={update} />;
    case 'PRICING_TABLE':
      return <PricingTableForm config={config as PricingTableConfig} update={update} />;
    case 'BASE_BID_LINE':
      return <BaseBidLineForm config={config as BaseBidLineConfig} update={update} />;
    case 'ADDITIONS_TABLE':
      return <AdditionsTableForm config={config as AdditionsTableConfig} update={update} />;
    case 'EXCLUSIONS_HEADER':
      return <SingleStringForm
        config={config as ExclusionsHeaderConfig}
        update={update}
        field="heading"
        label="Heading"
        defaultText="Our Base Bid does not include:"
      />;
    case 'CLOSING_SIGNATURE':
      return <ClosingSignatureForm config={config as ClosingSignatureConfig} update={update} />;
    case 'INSTALLATION_HEADER':
      return <InstallationHeaderForm config={config as InstallationHeaderConfig} update={update} />;
    case 'FOOTER':
      return <FooterForm config={config as FooterConfig} update={update} />;
    case 'PAGE_BREAK':
      return (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50/60 px-3 py-3 text-[11px] text-gray-500">
          Page breaks have no settings. The renderer starts a fresh page wherever this block sits.
        </div>
      );
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Reusable form pieces
// ─────────────────────────────────────────────────────────────────────

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-gray-500 mb-1">{label}</span>
      <input
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
      />
    </label>
  );
}

function CheckboxField({
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
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/20"
      />
      <div className="text-xs text-gray-700">
        {label}
        {description && (
          <div className="text-[10px] text-gray-400 mt-0.5 font-normal">{description}</div>
        )}
      </div>
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-2">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Per-type forms
// ─────────────────────────────────────────────────────────────────────

function LetterheadForm({
  config,
  update,
}: {
  config: LetterheadConfig;
  update: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[10.5px] text-gray-500 leading-snug">
        Text shown when no first-page logo rule from the Branding tab matches.
        The logo (if configured) overlays this band.
      </p>
      <TextField
        label="Wordmark text"
        value={config.wordmarkText}
        placeholder="TISCHLER UND SOHN"
        onChange={(v) => update({ wordmarkText: v || undefined })}
      />
      <TextField
        label="Tagline"
        value={config.taglineText}
        placeholder="European Wood Windows & Doors"
        onChange={(v) => update({ taglineText: v || undefined })}
      />
      <CheckboxField
        label="Show red separator rule below"
        checked={config.showRule !== false}
        onChange={(v) => update({ showRule: v })}
      />
    </div>
  );
}

function PricingTableForm({
  config,
  update,
}: {
  config: PricingTableConfig;
  update: (patch: Record<string, unknown>) => void;
}) {
  const rowLabels = config.rowLabels ?? {};
  const hide = config.hide ?? {};
  const setRowLabel = (key: keyof NonNullable<PricingTableConfig['rowLabels']>, v: string) => {
    update({ rowLabels: { ...rowLabels, [key]: v || undefined } });
  };
  const setHide = (key: keyof NonNullable<PricingTableConfig['hide']>, v: boolean) => {
    update({ hide: { ...hide, [key]: v || undefined } });
  };
  return (
    <div className="space-y-3">
      <TextField
        label="Section heading"
        value={config.heading}
        placeholder="PRICING"
        onChange={(v) => update({ heading: v || undefined })}
      />
      <SectionLabel>Row labels</SectionLabel>
      <TextField
        label="Euro Windows"
        value={rowLabels.euroWindows}
        placeholder="Euro Windows"
        onChange={(v) => setRowLabel('euroWindows', v)}
      />
      <TextField
        label="Double Hung Windows"
        value={rowLabels.doubleHung}
        placeholder="Double Hung Windows"
        onChange={(v) => setRowLabel('doubleHung', v)}
      />
      <TextField
        label="Euro Doors"
        value={rowLabels.euroDoors}
        placeholder="Euro Doors"
        onChange={(v) => setRowLabel('euroDoors', v)}
      />
      <SectionLabel>Hide rows</SectionLabel>
      <CheckboxField
        label="Hide Euro Windows"
        checked={!!hide.euroWindows}
        onChange={(v) => setHide('euroWindows', v)}
      />
      <CheckboxField
        label="Hide Double Hung Windows"
        checked={!!hide.doubleHung}
        onChange={(v) => setHide('doubleHung', v)}
      />
      <CheckboxField
        label="Hide Euro Doors"
        checked={!!hide.euroDoors}
        onChange={(v) => setHide('euroDoors', v)}
      />
    </div>
  );
}

function BaseBidLineForm({
  config,
  update,
}: {
  config: BaseBidLineConfig;
  update: (patch: Record<string, unknown>) => void;
}) {
  return (
    <TextField
      label="Label"
      value={config.label}
      placeholder="BASE BID PRICE"
      onChange={(v) => update({ label: v || undefined })}
    />
  );
}

function AdditionsTableForm({
  config,
  update,
}: {
  config: AdditionsTableConfig;
  update: (patch: Record<string, unknown>) => void;
}) {
  const rowLabels = config.rowLabels ?? {};
  const hide = config.hide ?? {};
  const setRowLabel = (key: string, v: string) => {
    update({ rowLabels: { ...rowLabels, [key]: v || undefined } });
  };
  const setHide = (key: string, v: boolean) => {
    update({ hide: { ...hide, [key]: v || undefined } });
  };
  const rows: Array<{ key: string; placeholder: string }> = [
    { key: 'windowScreens', placeholder: 'Window Screens (qty)' },
    { key: 'doorScreenSash', placeholder: 'Door Screen Sash (qty)' },
    { key: 'entryDoor', placeholder: 'Entry Door (qty)' },
    { key: 'jambExtensions', placeholder: 'Jamb Extensions' },
    { key: 'magneticContacts', placeholder: 'Magnetic Alarm Contacts (qty)' },
    { key: 'finalFinish', placeholder: 'Final Finish' },
  ];
  return (
    <div className="space-y-3">
      <TextField
        label="Section heading"
        value={config.heading}
        placeholder="ADDITIONS OR DEDUCTIONS TO OUR BASE BID"
        onChange={(v) => update({ heading: v || undefined })}
      />
      <SectionLabel>Per-row labels (leave blank to keep the default)</SectionLabel>
      {rows.map((row) => (
        <TextField
          key={row.key}
          label={row.placeholder}
          value={rowLabels[row.key]}
          placeholder={row.placeholder}
          onChange={(v) => setRowLabel(row.key, v)}
        />
      ))}
      <SectionLabel>Hide rows</SectionLabel>
      {rows.map((row) => (
        <CheckboxField
          key={row.key}
          label={`Hide ${row.placeholder}`}
          checked={!!hide[row.key]}
          onChange={(v) => setHide(row.key, v)}
        />
      ))}
    </div>
  );
}

function SingleStringForm({
  config,
  update,
  field,
  label,
  defaultText,
}: {
  config: Record<string, unknown>;
  update: (patch: Record<string, unknown>) => void;
  field: string;
  label: string;
  defaultText: string;
}) {
  return (
    <TextField
      label={label}
      value={(config as Record<string, string | undefined>)[field]}
      placeholder={defaultText}
      onChange={(v) => update({ [field]: v || undefined })}
    />
  );
}

function ClosingSignatureForm({
  config,
  update,
}: {
  config: ClosingSignatureConfig;
  update: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField
        label="Closing line"
        value={config.closingText}
        placeholder="Sincerely,"
        onChange={(v) => update({ closingText: v || undefined })}
      />
      <TextField
        label="Company line (shown when no signature font is set)"
        value={config.companyLine}
        placeholder="Tischler und Sohn"
        onChange={(v) => update({ companyLine: v || undefined })}
      />
      <CheckboxField
        label="Use signature font for salesman name"
        description="Renders the salesman's name in the brand signature font when available."
        checked={config.useSignatureFont !== false}
        onChange={(v) => update({ useSignatureFont: v })}
      />
      <CheckboxField
        label="Show Estimator line"
        description='Adds an "Estimator: ..." line under the signature when one is on the summary.'
        checked={config.showEstimator !== false}
        onChange={(v) => update({ showEstimator: v })}
      />
    </div>
  );
}

function InstallationHeaderForm({
  config,
  update,
}: {
  config: InstallationHeaderConfig;
  update: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField
        label="Heading"
        value={config.heading}
        placeholder="INSTALLATION"
        onChange={(v) => update({ heading: v || undefined })}
      />
      <TextField
        label="Cost label"
        value={config.costLabel}
        placeholder="Installation Cost:"
        onChange={(v) => update({ costLabel: v || undefined })}
      />
    </div>
  );
}

function FooterForm({
  config,
  update,
}: {
  config: FooterConfig;
  update: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField
        label="Footer text"
        value={config.text}
        placeholder="Tischler und Sohn  |  Confidential"
        onChange={(v) => update({ text: v || undefined })}
      />
      <CheckboxField
        label="Hide page numbers"
        description="By default the right side of the footer shows 'Page N of M'."
        checked={!!config.hidePageNumbers}
        onChange={(v) => update({ hidePageNumbers: v })}
      />
    </div>
  );
}
