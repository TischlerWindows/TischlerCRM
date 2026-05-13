'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  FileImage,
  Loader2,
  Palette,
  Plus,
  Trash2,
  Type as TypeIcon,
  Upload,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';

// ── Types ──────────────────────────────────────────────────────────

interface BrandLogo {
  id: string;
  name: string;
  role: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
}

// Curated role tags for logos. Matches the Tischler brand guide vocabulary so
// admins can label which logo plays which role. Free-form on the backend.
const LOGO_ROLES: Array<{ value: string; label: string }> = [
  { value: 'primary',      label: 'Primary (T icon only)' },
  { value: 'letterhead',   label: 'Letterhead (with address block)' },
  { value: 'horizontal',   label: 'Horizontal (with subtitle)' },
  { value: 'vertical',     label: 'Vertical wordmark' },
  { value: 'digital-icon', label: 'Digital icon (on background)' },
  { value: 'monochrome',   label: 'Monochrome' },
];

interface BrandFont {
  id: string;
  name: string;
  family: string;
  fileFormat: string;
  createdAt: string;
  updatedAt: string;
}

interface BrandColor {
  id: string;
  name: string;
  hex: string;
  pantone: string | null;
  role: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

type Tab = 'logos' | 'fonts' | 'colors';

const TABS: { id: Tab; label: string; icon: typeof FileImage }[] = [
  { id: 'logos', label: 'Logos', icon: FileImage },
  { id: 'fonts', label: 'Fonts', icon: TypeIcon },
  { id: 'colors', label: 'Colors', icon: Palette },
];

const LOGO_MAX_BYTES = 500 * 1024;
const FONT_MAX_BYTES = 1024 * 1024;
const ALLOWED_LOGO_MIMES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

// API base for direct-streaming bytes endpoints (preview <img src>, @font-face).
function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

async function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:<mime>;base64," prefix
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ── Main page ──────────────────────────────────────────────────────

export default function CompanyResourcesPage() {
  const [tab, setTab] = useState<Tab>('logos');
  // Bumped after any upload/edit so the defaults bar re-fetches its dropdowns
  // and the user sees newly-uploaded items immediately.
  const [resourceRev, setResourceRev] = useState(0);
  const bumpRev = () => setResourceRev((n) => n + 1);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <SettingsPageHeader
        icon={FileImage}
        title="Company Resources"
        subtitle="Brand assets the proposal builder uses — logos, fonts, and colors. Used by the PDF renderer."
      />

      <TemplateDefaultsBar resourceRev={resourceRev} />

      <div role="tablist" aria-label="Company resources tabs" className="mt-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-brand-navy text-brand-navy'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === 'logos' && <LogosTab onChange={bumpRev} />}
        {tab === 'fonts' && <FontsTab onChange={bumpRev} />}
        {tab === 'colors' && <ColorsTab onChange={bumpRev} />}
      </div>
    </div>
  );
}

// ── Template defaults bar ──────────────────────────────────────────
//
// Shows the resources the default proposal template will use when rendering.
// Picks the brand fonts + accent/emphasis colors. Per-page logo placement
// has its own editor in the Proposal Builder → Branding tab.

interface DefaultTemplate {
  id: string;
  name: string;
  signatureFontId: string | null;
  titleFontId: string | null;
  subtitleFontId: string | null;
  headingFontId: string | null;
  bodyFontId: string | null;
  accentColorHex: string | null;
  emphasisColorHex: string | null;
}

function TemplateDefaultsBar({ resourceRev }: { resourceRev: number }) {
  const [template, setTemplate] = useState<DefaultTemplate | null>(null);
  const [fonts, setFonts] = useState<BrandFont[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tpl, fontRows] = await Promise.all([
        apiClient
          .get<DefaultTemplate>('/quote-templates/default')
          .catch(() => null),
        apiClient.get<BrandFont[]>('/company-resources/fonts').catch(() => []),
      ]);
      setTemplate(tpl);
      setFonts(fontRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load defaults');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, resourceRev]);

  const patch = async (field: keyof DefaultTemplate, value: string | null) => {
    if (!template) return;
    setSaving(field);
    setError(null);
    try {
      await apiClient.patch(`/quote-templates/${template.id}`, { [field]: value });
      setTemplate({ ...template, [field]: value });
      setSaved(field);
      window.setTimeout(() => setSaved((s) => (s === field ? null : s)), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${field}`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading template defaults…
      </div>
    );
  }
  if (!template) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
        No default proposal template found. Create one in the Proposal Builder first.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400">
          Defaults for &ldquo;{template.name}&rdquo;
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          What this template uses when rendering a proposal PDF. Updates apply to every new PDF immediately.
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Logo placement notice — per-page logo rules now live in the
            Proposal Builder so a template can paint different logos on
            different pages (first page, subsequent pages, last page). */}
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <span className="font-semibold text-gray-700">Per-page logo placement</span> is configured per template in{' '}
          <a
            href="/proposal-builder"
            className="font-semibold text-brand-navy hover:underline"
          >
            Proposal Builder → Branding
          </a>
          . Upload logos here; arrange them there.
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <DefaultPickerColor
            label="Accent color"
            value={template.accentColorHex}
            placeholder="#151f6d"
            saving={saving === 'accentColorHex'}
            saved={saved === 'accentColorHex'}
            onChange={(v) => patch('accentColorHex', v)}
          />
          <DefaultPickerColor
            label="Emphasis color"
            value={template.emphasisColorHex}
            placeholder="#da291c"
            saving={saving === 'emphasisColorHex'}
            saved={saved === 'emphasisColorHex'}
            onChange={(v) => patch('emphasisColorHex', v)}
          />
        </div>

        {/* Font roles — per the brand guide each role has its own typeface. */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">
            Font roles
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DefaultPickerSelect
              label="Title font (wordmark, big headers)"
              value={template.titleFontId}
              options={fonts.map((f) => ({ value: f.id, label: `${f.name} (${f.family})` }))}
              emptyHint="Upload a font to pick one"
              saving={saving === 'titleFontId'}
              saved={saved === 'titleFontId'}
              onChange={(v) => patch('titleFontId', v)}
            />
            <DefaultPickerSelect
              label="Subtitle font (tagline under wordmark)"
              value={template.subtitleFontId}
              options={fonts.map((f) => ({ value: f.id, label: `${f.name} (${f.family})` }))}
              emptyHint="Upload a font to pick one"
              saving={saving === 'subtitleFontId'}
              saved={saved === 'subtitleFontId'}
              onChange={(v) => patch('subtitleFontId', v)}
            />
            <DefaultPickerSelect
              label="Heading font (section titles, bold runs)"
              value={template.headingFontId}
              options={fonts.map((f) => ({ value: f.id, label: `${f.name} (${f.family})` }))}
              emptyHint="Upload a font to pick one"
              saving={saving === 'headingFontId'}
              saved={saved === 'headingFontId'}
              onChange={(v) => patch('headingFontId', v)}
            />
            <DefaultPickerSelect
              label="Body font (paragraphs)"
              value={template.bodyFontId}
              options={fonts.map((f) => ({ value: f.id, label: `${f.name} (${f.family})` }))}
              emptyHint="Upload a font to pick one"
              saving={saving === 'bodyFontId'}
              saved={saved === 'bodyFontId'}
              onChange={(v) => patch('bodyFontId', v)}
            />
            <DefaultPickerSelect
              label="Signature font (salesman name in closing)"
              value={template.signatureFontId}
              options={fonts.map((f) => ({ value: f.id, label: `${f.name} (${f.family})` }))}
              emptyHint="Upload a font to pick one"
              saving={saving === 'signatureFontId'}
              saved={saved === 'signatureFontId'}
              onChange={(v) => patch('signatureFontId', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultPickerSelect({
  label,
  value,
  options,
  emptyHint,
  saving,
  saved,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  emptyHint: string;
  saving: boolean;
  saved: boolean;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="text-xs">
      <span className="flex items-center gap-1.5 font-semibold text-gray-600 mb-1">
        {label}
        {saving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" aria-hidden="true" />}
        {saved && <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={options.length === 0}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">{options.length === 0 ? emptyHint : '— default (no override) —'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

function DefaultPickerColor({
  label,
  value,
  placeholder,
  saving,
  saved,
  onChange,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  saving: boolean;
  saved: boolean;
  onChange: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === null) {
      if (value !== null) onChange(null);
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      setDraft(value ?? '');
      return;
    }
    if (trimmed.toLowerCase() !== value?.toLowerCase()) onChange(trimmed.toLowerCase());
  };

  return (
    <label className="text-xs">
      <span className="flex items-center gap-1.5 font-semibold text-gray-600 mb-1">
        {label}
        {saving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" aria-hidden="true" />}
        {saved && <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value.toLowerCase());
          }}
          aria-label={`${label} swatch`}
          className="h-9 w-12 rounded cursor-pointer flex-shrink-0 border border-gray-200"
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
        />
      </div>
    </label>
  );
}

// ── Logos tab ──────────────────────────────────────────────────────

function LogosTab({ onChange }: { onChange?: () => void }) {
  const [logos, setLogos] = useState<BrandLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await apiClient.get<BrandLogo[]>('/company-resources/logos');
      setLogos(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onPickFiles = () => fileInputRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!ALLOWED_LOGO_MIMES.includes(file.type)) {
          throw new Error(`Unsupported type: ${file.type}. Use PNG, JPEG, SVG, or WEBP.`);
        }
        if (file.size > LOGO_MAX_BYTES) {
          throw new Error(`${file.name} is ${formatBytes(file.size)} — max is ${formatBytes(LOGO_MAX_BYTES)}.`);
        }
        const dataBase64 = await readAsBase64(file);
        const name = file.name.replace(/\.[^/.]+$/, ''); // strip extension
        await apiClient.post('/company-resources/logos', {
          name,
          mimeType: file.type,
          dataBase64,
        });
      }
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renameLogo = async (id: string, current: string) => {
    const next = window.prompt('Rename logo', current);
    if (!next || next.trim() === '' || next === current) return;
    try {
      await apiClient.patch(`/company-resources/logos/${id}`, { name: next.trim() });
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename logo');
    }
  };

  const deleteLogo = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Proposals using this logo will fall back to the default wordmark.`)) return;
    try {
      await apiClient.delete(`/company-resources/logos/${id}`);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete logo');
    }
  };

  const setLogoRole = async (id: string, role: string | null) => {
    try {
      await apiClient.patch(`/company-resources/logos/${id}`, { role });
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update logo role');
    }
  };

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          PNG, JPEG, SVG, or WEBP — max {formatBytes(LOGO_MAX_BYTES)} per file. Used in the PDF letterhead.
        </p>
        <button
          type="button"
          onClick={onPickFiles}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload logo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_LOGO_MIMES.join(',')}
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : logos.length === 0 ? (
        <button
          type="button"
          onClick={onPickFiles}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-12 text-gray-500 hover:bg-gray-50"
        >
          <Upload className="w-6 h-6 text-gray-400" aria-hidden="true" />
          <span className="text-sm font-medium">Drop a logo here, or click to browse</span>
          <span className="text-xs text-gray-400">PNG, JPEG, SVG, or WEBP — up to {formatBytes(LOGO_MAX_BYTES)}</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {logos.map((logo) => (
            <div
              key={logo.id}
              className="group rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors"
            >
              <div className="aspect-[4/3] mb-2 flex items-center justify-center rounded bg-gray-50 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${apiBase()}/company-resources/logos/${logo.id}/bytes?v=${encodeURIComponent(logo.updatedAt)}`}
                  alt={logo.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => renameLogo(logo.id, logo.name)}
                title="Rename"
                className="block w-full text-left truncate text-sm font-medium text-gray-900 hover:text-brand-navy"
              >
                {logo.name}
              </button>
              <select
                value={logo.role ?? ''}
                onChange={(e) => setLogoRole(logo.id, e.target.value || null)}
                aria-label={`Set role for ${logo.name}`}
                className="mt-1 w-full text-[10.5px] py-0.5 px-1 border border-gray-200 rounded bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              >
                <option value="">— no role —</option>
                {LOGO_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <div className="mt-0.5 flex items-center justify-between text-[11px] text-gray-400">
                <span className="truncate">{logo.mimeType.replace('image/', '')}</span>
                <button
                  type="button"
                  onClick={() => deleteLogo(logo.id, logo.name)}
                  aria-label={`Delete ${logo.name}`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-red-600 hover:bg-red-50 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fonts tab ──────────────────────────────────────────────────────

function FontsTab({ onChange }: { onChange?: () => void }) {
  const [fonts, setFonts] = useState<BrandFont[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingFamily, setPendingFamily] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await apiClient.get<BrandFont[]>('/company-resources/fonts');
      setFonts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fonts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onPickFile = () => fileInputRef.current?.click();

  const onFile = (file: File | null) => {
    setError(null);
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'ttf' && ext !== 'otf') {
      setError(`Unsupported file format: .${ext}. Use TTF or OTF.`);
      return;
    }
    if (file.size > FONT_MAX_BYTES) {
      setError(`${file.name} is ${formatBytes(file.size)} — max is ${formatBytes(FONT_MAX_BYTES)}.`);
      return;
    }
    setPendingFile(file);
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setPendingName(baseName);
    setPendingFamily(baseName);
  };

  const cancelPending = () => {
    setPendingFile(null);
    setPendingName('');
    setPendingFamily('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFont = async () => {
    if (!pendingFile || !pendingName.trim() || !pendingFamily.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const ext = pendingFile.name.split('.').pop()?.toLowerCase() ?? 'ttf';
      const dataBase64 = await readAsBase64(pendingFile);
      await apiClient.post('/company-resources/fonts', {
        name: pendingName.trim(),
        family: pendingFamily.trim(),
        fileFormat: ext,
        dataBase64,
      });
      cancelPending();
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload font');
    } finally {
      setUploading(false);
    }
  };

  const deleteFont = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Templates using this font will fall back to Helvetica.`)) return;
    try {
      await apiClient.delete(`/company-resources/fonts/${id}`);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete font');
    }
  };

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          TTF or OTF — max {formatBytes(FONT_MAX_BYTES)} per file. The signature font is embedded in every PDF.
        </p>
        <button
          type="button"
          onClick={onPickFile}
          disabled={uploading || pendingFile !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Upload font
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {pendingFile && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <div className="mb-3 text-sm font-medium text-gray-900">Set up {pendingFile.name}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="text-xs">
              <span className="block font-semibold text-gray-600 mb-1">Display name</span>
              <input
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                placeholder="Signature Font"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
            </label>
            <label className="text-xs">
              <span className="block font-semibold text-gray-600 mb-1">Font family (PDFKit key)</span>
              <input
                value={pendingFamily}
                onChange={(e) => setPendingFamily(e.target.value)}
                placeholder="MyScript"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={uploadFont}
              disabled={uploading || !pendingName.trim() || !pendingFamily.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? 'Uploading…' : 'Save font'}
            </button>
            <button
              type="button"
              onClick={cancelPending}
              disabled={uploading}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : fonts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          No fonts yet. Upload a TTF or OTF file to use it in proposal templates.
        </div>
      ) : (
        <div className="space-y-3">
          {fonts.map((font) => (
            <FontRow key={font.id} font={font} onDelete={() => deleteFont(font.id, font.name)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FontRow({ font, onDelete }: { font: BrandFont; onDelete: () => void }) {
  // Inject an @font-face rule so we can render the live preview line.
  useEffect(() => {
    const styleId = `brand-font-${font.id}`;
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    // Append ?v=updatedAt to the URL so the browser doesn't reuse a stale
    // cached response (e.g. a pre-#131 fetch without Cross-Origin-Resource-Policy
    // that's still poisoning the cache). Different ID + updatedAt = different
    // cache key.
    style.textContent = `@font-face {
      font-family: "brand-${font.id}";
      src: url("${apiBase()}/company-resources/fonts/${font.id}/bytes?v=${encodeURIComponent(font.updatedAt)}") format("${
        font.fileFormat.toLowerCase() === 'otf' ? 'opentype' : 'truetype'
      }");
      font-display: swap;
    }`;
    document.head.appendChild(style);
    return () => {
      const node = document.getElementById(styleId);
      if (node) node.remove();
    };
  }, [font.id, font.fileFormat]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-gray-900">{font.name}</div>
          <div className="text-xs text-gray-500">
            Family: <span className="font-mono">{font.family}</span> · {font.fileFormat.toUpperCase()}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${font.name}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
      <div
        className="mt-3 text-2xl text-gray-900 leading-tight"
        style={{ fontFamily: `"brand-${font.id}", sans-serif` }}
      >
        The quick brown fox jumps over the lazy dog
      </div>
      <div
        className="mt-1 text-base text-gray-600"
        style={{ fontFamily: `"brand-${font.id}", sans-serif` }}
      >
        Tischler und Sohn — James G. Myers, V.P. of Sales
      </div>
    </div>
  );
}

// ── Colors tab ─────────────────────────────────────────────────────

function ColorsTab({ onChange }: { onChange?: () => void }) {
  const [colors, setColors] = useState<BrandColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ name: string; hex: string; pantone: string; role: string }>({
    name: '',
    hex: '#1e3a5f',
    pantone: '',
    role: '',
  });

  const load = useCallback(async () => {
    try {
      const rows = await apiClient.get<BrandColor[]>('/company-resources/colors');
      setColors(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load colors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = () => {
    setAdding(true);
    setDraft({ name: '', hex: '#1e3a5f', pantone: '', role: '' });
  };

  const cancelAdd = () => setAdding(false);

  const saveNew = async () => {
    if (!draft.name.trim()) return;
    if (!/^#[0-9a-fA-F]{6}$/.test(draft.hex)) {
      setError('Hex must be in the form #RRGGBB.');
      return;
    }
    try {
      await apiClient.post('/company-resources/colors', {
        name: draft.name.trim(),
        hex: draft.hex.toLowerCase(),
        pantone: draft.pantone.trim() || null,
        role: draft.role.trim() || null,
        order: colors.length,
      });
      setAdding(false);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add color');
    }
  };

  const updateField = async (id: string, patch: Partial<BrandColor>) => {
    setError(null);
    try {
      await apiClient.patch(`/company-resources/colors/${id}`, patch);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update color');
    }
  };

  const deleteColor = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await apiClient.delete(`/company-resources/colors/${id}`);
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete color');
    }
  };

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Pantone-mapped brand swatches. The proposal renderer can pick which hex to use as the navy/red accents.
        </p>
        <button
          type="button"
          onClick={startAdd}
          disabled={adding}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add color
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {adding && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 flex items-center gap-3">
              <input
                type="color"
                value={draft.hex}
                onChange={(e) => setDraft({ ...draft, hex: e.target.value })}
                aria-label="Color swatch"
                className="h-10 w-10 rounded cursor-pointer"
              />
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Name (e.g., Tischler Navy)"
                className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
              <input
                value={draft.hex}
                onChange={(e) => setDraft({ ...draft, hex: e.target.value })}
                placeholder="#RRGGBB"
                className="w-24 px-2.5 py-1.5 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
              <input
                value={draft.pantone}
                onChange={(e) => setDraft({ ...draft, pantone: e.target.value })}
                placeholder="PMS 281C"
                className="w-28 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                className="w-32 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              >
                <option value="">No role</option>
                <option value="primary">Primary</option>
                <option value="accent">Accent</option>
                <option value="text">Text</option>
                <option value="muted">Muted</option>
                <option value="danger">Danger</option>
              </select>
              <button
                type="button"
                onClick={saveNew}
                disabled={!draft.name.trim()}
                className="rounded-md bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelAdd}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}

          {colors.length === 0 && !adding ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
              No brand colors yet. Add the navy and red used in your letterhead so templates can reuse them.
            </div>
          ) : (
            colors.map((color) => (
              <ColorRow
                key={color.id}
                color={color}
                onUpdate={(patch) => updateField(color.id, patch)}
                onDelete={() => deleteColor(color.id, color.name)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ColorRow({
  color,
  onUpdate,
  onDelete,
}: {
  color: BrandColor;
  onUpdate: (patch: Partial<BrandColor>) => void;
  onDelete: () => void;
}) {
  const [hex, setHex] = useState(color.hex);
  useEffect(() => setHex(color.hex), [color.hex]);

  const commitHex = () => {
    if (hex === color.hex) return;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setHex(color.hex);
      return;
    }
    onUpdate({ hex: hex.toLowerCase() });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 flex items-center gap-3">
      <input
        type="color"
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        onBlur={commitHex}
        aria-label={`${color.name} swatch`}
        className="h-10 w-10 rounded cursor-pointer flex-shrink-0"
      />
      <input
        defaultValue={color.name}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next && next !== color.name) onUpdate({ name: next });
        }}
        className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-transparent rounded-md hover:border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
      />
      <input
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        onBlur={commitHex}
        className="w-24 px-2.5 py-1.5 text-sm font-mono border border-transparent rounded-md hover:border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
      />
      <input
        defaultValue={color.pantone ?? ''}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next !== (color.pantone ?? '')) onUpdate({ pantone: next || null });
        }}
        placeholder="Pantone"
        className="w-28 px-2.5 py-1.5 text-sm border border-transparent rounded-md hover:border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
      />
      <select
        defaultValue={color.role ?? ''}
        onChange={(e) => onUpdate({ role: e.target.value || null })}
        className="w-32 px-2.5 py-1.5 text-sm border border-transparent rounded-md bg-white hover:border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
      >
        <option value="">No role</option>
        <option value="primary">Primary</option>
        <option value="accent">Accent</option>
        <option value="text">Text</option>
        <option value="muted">Muted</option>
        <option value="danger">Danger</option>
      </select>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${color.name}`}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
