'use client';

import { useEffect, useMemo } from 'react';
import type { ProposalAssemblyResult, OrderedBlock, SpecPresetData } from '@crm/proposal-assembly';
import {
  parsePageSelector,
  isSelectorError,
  inferBlockType,
  type BlockType,
  type LetterheadConfig,
  type PricingTableConfig,
  type BaseBidLineConfig,
  type AdditionsTableConfig,
  type ExclusionsHeaderConfig,
  type ClosingSignatureConfig,
  type InstallationHeaderConfig,
  type FooterConfig,
  type PageLogoRule,
} from '@crm/types';
import { SafeRichHtml } from './safe-rich-html';

// Tischler brand colors — match the PDFKit renderer in apps/api/src/lib/proposal-pdf/renderer.ts.
const NAVY = '#1e3a5f';
const RED = '#da291c';

// ── Brand font integration ─────────────────────────────────────────
//
// The PDF renderer registers up to 5 brand fonts (title, subtitle, heading,
// body, signature) via PDFKit. The HTML preview here mirrors that by
// injecting @font-face rules that point at the same /company-resources/
// fonts/:id/bytes endpoint. Each role gets a stable family name so the
// rest of this component can reference it by CSS string regardless of
// which BrandFont id is wired to that role for the active template.

export interface BrandFontRef {
  id: string;
  fileFormat: string; // 'ttf' | 'otf'
  updatedAt: string;
}

export interface BrandFontMap {
  title: BrandFontRef | null;
  subtitle: BrandFontRef | null;
  heading: BrandFontRef | null;
  body: BrandFontRef | null;
  signature: BrandFontRef | null;
}

export function emptyBrandFonts(): BrandFontMap {
  return {
    title: null,
    subtitle: null,
    heading: null,
    body: null,
    signature: null,
  };
}

const FONT_FAMILIES = {
  title: '"proposal-title", "Helvetica Neue", Helvetica, Arial, sans-serif',
  subtitle: '"proposal-subtitle", "Helvetica Neue", Helvetica, Arial, sans-serif',
  heading: '"proposal-heading", "Helvetica Neue", Helvetica, Arial, sans-serif',
  body: '"proposal-body", "Helvetica Neue", Helvetica, Arial, sans-serif',
  signature: '"proposal-signature", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

const apiBase = (): string =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function fontFormat(fileFormat: string): string {
  return fileFormat.toLowerCase() === 'otf' ? 'opentype' : 'truetype';
}

function buildFontFaceCSS(brandFonts: BrandFontMap): string {
  const blocks: string[] = [];
  const role = (key: keyof BrandFontMap, family: string) => {
    const ref = brandFonts[key];
    if (!ref) return;
    const url = `${apiBase()}/company-resources/fonts/${ref.id}/bytes?v=${encodeURIComponent(ref.updatedAt)}`;
    blocks.push(
      `@font-face { font-family: "${family}"; src: url("${url}") format("${fontFormat(
        ref.fileFormat,
      )}"); font-display: swap; }`,
    );
  };
  role('title', 'proposal-title');
  role('subtitle', 'proposal-subtitle');
  role('heading', 'proposal-heading');
  role('body', 'proposal-body');
  role('signature', 'proposal-signature');
  return blocks.join('\n');
}

interface Props {
  result: ProposalAssemblyResult | null;
  error: string | null;
  selectedPresetId: string | null;
  onSelectBlock: (id: string) => void;
  brandFonts?: BrandFontMap;
  pageLogos?: PageLogoRule[];
}

function isClosingConstant(preset: SpecPresetData): boolean {
  return /closing|signature|sincerely/i.test(preset.title);
}

/**
 * The HTML preview is single-page, so it can only meaningfully show one
 * logo. Pick the first rule that matches page 1 — that's any rule whose
 * selector is "first" or "all". Falls back to the hardcoded /tces-logo.png
 * + text wordmark when no rule matches.
 */
function resolveFirstPageLogo(rules: PageLogoRule[]): PageLogoRule | null {
  const candidates = rules
    .filter((r) => {
      const parsed = parsePageSelector(r.pageSelector);
      if (isSelectorError(parsed)) return false;
      return parsed.kind === 'first' || parsed.kind === 'all';
    })
    .sort((a, b) => a.order - b.order);
  return candidates[0] ?? null;
}

export function LetterPreview({
  result,
  error,
  selectedPresetId,
  onSelectBlock,
  brandFonts,
  pageLogos,
}: Props) {
  const fonts = brandFonts ?? emptyBrandFonts();
  const fontFaceCSS = useMemo(() => buildFontFaceCSS(fonts), [fonts]);
  const firstPageLogo = useMemo(
    () => resolveFirstPageLogo(pageLogos ?? []),
    [pageLogos],
  );

  // Inject @font-face rules for the active template's brand fonts. The
  // <style> element is keyed so the browser sees a different node when the
  // CSS body changes (e.g. switching templates) and re-evaluates the
  // font-face descriptors.
  useEffect(() => {
    if (!fontFaceCSS) return;
    const style = document.createElement('style');
    style.setAttribute('data-proposal-fonts', 'preview');
    style.textContent = fontFaceCSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [fontFaceCSS]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 max-w-md">
          Preview error: {error}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-gray-400">Select a summary to preview</p>
          <p className="text-xs text-gray-300 mt-1">The proposal will appear here</p>
        </div>
      </div>
    );
  }

  const { pdfData, orderedBlocks } = result;

  // Footer override: applied by FOOTER blocks. We render only the LAST
  // footer override in document order (matches the PDF post-pass behavior).
  let footerOverride: FooterConfig | null = null;
  for (const ob of orderedBlocks) {
    const type = (ob.preset.blockType as BlockType | null) ?? inferBlockType(ob.preset.section, ob.preset.title);
    if (type === 'FOOTER') footerOverride = (ob.preset.config ?? {}) as FooterConfig;
  }

  // Wrapper that makes a block clickable and highlights when selected.
  const blockWrap = (id: string, children: React.ReactNode) => {
    const isSelected = id === selectedPresetId;
    return (
      <div
        onClick={() => onSelectBlock(id)}
        className={`cursor-pointer rounded-sm transition-colors ${
          isSelected
            ? 'outline outline-1 outline-offset-2 bg-blue-50/40'
            : 'hover:bg-gray-50'
        }`}
        style={isSelected ? { outlineColor: `${NAVY}66` } : undefined}
      >
        {children}
      </div>
    );
  };

  // Specification counter — increments only for SPECIFICATION_ITEM blocks
  // so they get (1)(2)(3) prefixes in document order.
  let specCounter = 0;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100">
      {/* Paper-like proposal container */}
      <div
        className="mx-auto my-6 bg-white shadow-md border border-gray-200"
        style={{
          width: 'min(816px, calc(100% - 32px))',
          padding: '64px 76px',
          fontFamily: FONT_FAMILIES.body,
          color: '#1e1e1e',
        }}
      >
        {orderedBlocks.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-sm">This template has no blocks yet.</p>
            <p className="text-xs mt-1">
              Open the block list and pick a block type from the + New menu,
              or seed the standard layout.
            </p>
          </div>
        ) : (
          orderedBlocks.map((ob, idx) => {
            const blockType = (ob.preset.blockType as BlockType | null) ?? inferBlockType(ob.preset.section, ob.preset.title);
            if (blockType === 'SPECIFICATION_ITEM') {
              specCounter += 1;
            }
            return (
              <BlockPreview
                key={`${ob.preset.id}-${idx}`}
                ordered={ob}
                blockType={blockType}
                specNumber={blockType === 'SPECIFICATION_ITEM' ? specCounter : undefined}
                firstPageLogo={blockType === 'LETTERHEAD' ? firstPageLogo : null}
                isSelected={ob.preset.id === selectedPresetId}
                onSelect={onSelectBlock}
                pdfData={pdfData}
                fonts={fonts}
              />
            );
          })
        )}

        {/* Footer — mirrors the PDF post-pass. Uses any FOOTER block's
            override or falls back to the brand default. */}
        <div
          className="mt-10 pt-3 border-t border-gray-200 flex justify-between text-[7pt]"
          style={{ color: '#808080' }}
        >
          <span className="flex-1 text-center">
            {footerOverride?.text ?? 'Tischler und Sohn  |  Confidential'}
          </span>
          {!footerOverride?.hidePageNumbers && <span>Page 1</span>}
        </div>
      </div>

      {/* Warnings — kept outside the paper container */}
      {result.warnings.length > 0 && (
        <div className="mx-auto mb-6 max-w-[816px] rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-[10px] font-bold text-amber-800 mb-1">Warnings</div>
          <ul className="space-y-0.5">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-[11px] text-amber-700">• {w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Per-block preview component
// ─────────────────────────────────────────────────────────────────────

interface BlockPreviewProps {
  ordered: OrderedBlock;
  blockType: BlockType;
  specNumber?: number;
  firstPageLogo: PageLogoRule | null;
  isSelected: boolean;
  onSelect: (id: string) => void;
  pdfData: ProposalAssemblyResult['pdfData'];
  fonts: BrandFontMap;
}

function BlockPreview({
  ordered,
  blockType,
  specNumber,
  firstPageLogo,
  isSelected,
  onSelect,
  pdfData,
  fonts,
}: BlockPreviewProps) {
  const preset = ordered.preset;
  const config = (preset.config ?? {}) as Record<string, unknown>;
  const hideTitle = !!config.hideTitle;

  const wrap = (children: React.ReactNode) => (
    <div
      onClick={() => onSelect(preset.id)}
      className={`cursor-pointer rounded-sm transition-colors ${
        isSelected ? 'outline outline-1 outline-offset-2 bg-blue-50/40' : 'hover:bg-gray-50'
      }`}
      style={isSelected ? { outlineColor: `${NAVY}66` } : undefined}
    >
      {children}
    </div>
  );

  switch (blockType) {
    case 'LETTERHEAD':
      return wrap(<LetterheadPreview config={config as LetterheadConfig} firstPageLogo={firstPageLogo} />);
    case 'FREE_TEXT':
      return wrap(
        <div className="mt-4">
          {!hideTitle && preset.title && preset.title.trim() && (
            <div className="text-[10pt] font-bold mb-1" style={{ color: NAVY }}>{preset.title}</div>
          )}
          {preset.body && (
            <SafeRichHtml className="text-[10pt] leading-[1.5] p-1" html={preset.body} />
          )}
        </div>,
      );
    case 'SPECIFICATION_ITEM':
      return wrap(
        <div className="mt-3 p-1">
          <div className="text-[10pt] font-bold" style={{ color: NAVY }}>
            <span className="inline-block w-7">({specNumber ?? 1})</span>
            {!hideTitle && <span>{preset.title}</span>}
          </div>
          {preset.body && (
            <SafeRichHtml className="ml-7 mt-0.5 text-[10pt] leading-[1.55]" html={preset.body} />
          )}
        </div>,
      );
    case 'OPTION_ITEM':
      return wrap(
        <div className="mt-3 px-1 py-0.5">
          {!hideTitle && <div className="text-[10pt] font-bold" style={{ color: NAVY }}>{preset.title}</div>}
          {preset.body && (
            <SafeRichHtml className="mt-0.5 text-[10pt] leading-[1.55]" html={preset.body} />
          )}
        </div>,
      );
    case 'EXCLUSION_ITEM':
      return wrap(
        <div className="mt-2 px-1">
          {!hideTitle && <div className="text-[10pt] font-bold">•&nbsp;&nbsp;{preset.title}</div>}
          {preset.body && preset.body.trim() && (
            <SafeRichHtml className="ml-4 mt-0.5 text-[10pt] leading-[1.55]" html={preset.body} />
          )}
        </div>,
      );
    case 'INSTALLATION_ITEM':
      return wrap(
        <div className="mt-3 px-1">
          {!hideTitle && <div className="text-[10pt] font-bold" style={{ color: NAVY }}>{preset.title}</div>}
          {preset.body && preset.body.trim() && (
            <SafeRichHtml className="ml-3 mt-0.5 text-[10pt] leading-[1.55]" html={preset.body} />
          )}
        </div>,
      );
    case 'PRICING_TABLE':
      return wrap(<PricingTablePreview config={config as PricingTableConfig} pdfData={pdfData} />);
    case 'BASE_BID_LINE':
      return wrap(<BaseBidLinePreview config={config as BaseBidLineConfig} pdfData={pdfData} />);
    case 'ADDITIONS_TABLE':
      return wrap(<AdditionsTablePreview config={config as AdditionsTableConfig} pdfData={pdfData} />);
    case 'EXCLUSIONS_HEADER':
      return wrap(<ExclusionsHeaderPreview config={config as ExclusionsHeaderConfig} />);
    case 'CLOSING_SIGNATURE':
      return wrap(<ClosingSignaturePreview config={config as ClosingSignatureConfig} pdfData={pdfData} fonts={fonts} />);
    case 'PAGE_BREAK':
      return wrap(
        <div className="my-6 border-t-2 border-dashed border-gray-300">
          <div className="text-[8px] text-gray-400 uppercase tracking-widest text-center -mt-2 bg-white inline-block px-2">
            Page break
          </div>
        </div>,
      );
    case 'INSTALLATION_HEADER':
      return wrap(<InstallationHeaderPreview config={config as InstallationHeaderConfig} pdfData={pdfData} />);
    case 'FOOTER':
      // Rendered at the bottom of the paper, not inline.
      return null;
    default:
      return null;
  }
}

function LetterheadPreview({
  config,
  firstPageLogo,
}: {
  config: LetterheadConfig;
  firstPageLogo: PageLogoRule | null;
}) {
  const wordmark = config.wordmarkText ?? 'TISCHLER UND SOHN';
  const tagline = config.taglineText ?? 'European Wood Windows & Doors';
  const showRule = config.showRule !== false;
  return (
    <div className="mt-2">
      {firstPageLogo ? (
        <div
          className={`flex items-center ${
            firstPageLogo.alignment === 'center'
              ? 'justify-center'
              : firstPageLogo.alignment === 'right'
                ? 'justify-end'
                : 'justify-start'
          }`}
        >
          <img
            src={`${apiBase()}/company-resources/logos/${firstPageLogo.logoId}/bytes`}
            alt=""
            style={{
              maxWidth: `${firstPageLogo.maxWidthPt}pt`,
              maxHeight: `${firstPageLogo.maxHeightPt}pt`,
              objectFit: 'contain',
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      ) : (
        <div>
          <div className="text-[18pt] font-bold tracking-wide" style={{ color: NAVY, fontFamily: FONT_FAMILIES.title }}>
            {wordmark}
          </div>
          <div className="text-[8pt] mt-0.5" style={{ color: '#505050', fontFamily: FONT_FAMILIES.subtitle }}>
            {tagline}
          </div>
        </div>
      )}
      {showRule && <div className="mt-3 border-t-2" style={{ borderColor: RED }} />}
    </div>
  );
}

function PricingTablePreview({
  config,
  pdfData,
}: {
  config: PricingTableConfig;
  pdfData: ProposalAssemblyResult['pdfData'];
}) {
  const heading = config.heading ?? 'PRICING';
  const rowLabels = config.rowLabels ?? {};
  const hide = config.hide ?? {};
  const rows: Array<[string, string]> = [];
  if (pdfData.hasEuroWindows && !hide.euroWindows) {
    rows.push([rowLabels.euroWindows ?? 'Euro Windows', pdfData.euroWindowsPrice]);
  }
  if (pdfData.hasDoubleHung && !hide.doubleHung) {
    rows.push([rowLabels.doubleHung ?? 'Double Hung Windows', pdfData.doubleHungPrice]);
  }
  if (pdfData.hasEuroDoors && !hide.euroDoors) {
    rows.push([rowLabels.euroDoors ?? 'Euro Doors', pdfData.euroDoorsPrice]);
  }
  return (
    <div className="mt-6">
      <div className="border-t border-gray-300" />
      <div className="mt-2 text-[11pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>
        {heading}
      </div>
      <div className="mt-2 space-y-1">
        {rows.map(([label, price]) => (
          <div key={label} className="flex justify-between text-[10pt] px-1">
            <span>{label}</span>
            <span>{price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BaseBidLinePreview({
  config,
  pdfData,
}: {
  config: BaseBidLineConfig;
  pdfData: ProposalAssemblyResult['pdfData'];
}) {
  const label = config.label ?? 'BASE BID PRICE';
  return (
    <div className="mt-3">
      <div className="border-t border-gray-300" />
      <div
        className="mt-2 flex justify-between text-[12pt] font-bold px-1"
        style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}
      >
        <span>{label}</span>
        <span>{pdfData.grandTotal}</span>
      </div>
      <div className="mt-1 border-t border-gray-300" />
    </div>
  );
}

function AdditionsTablePreview({
  config,
  pdfData,
}: {
  config: AdditionsTableConfig;
  pdfData: ProposalAssemblyResult['pdfData'];
}) {
  const heading = config.heading ?? 'ADDITIONS OR DEDUCTIONS TO OUR BASE BID';
  const rowLabels = config.rowLabels ?? {};
  const hide = config.hide ?? {};
  const rows: Array<[string, string]> = [];
  if (pdfData.hasWindowScreens && !hide.windowScreens) {
    rows.push([rowLabels.windowScreens ?? `Window Screens (${pdfData.windowScreensQty})`, pdfData.windowScreensPrice]);
  }
  if (pdfData.hasDoorScreenSash && !hide.doorScreenSash) {
    rows.push([rowLabels.doorScreenSash ?? `Door Screen Sash (${pdfData.doorScreenSashQty})`, pdfData.doorScreenSashPrice]);
  }
  if (pdfData.hasEntryDoor && !hide.entryDoor) {
    rows.push([rowLabels.entryDoor ?? `Entry Door (${pdfData.entryDoorQty})`, pdfData.entryDoorPrice]);
  }
  if (pdfData.hasJambExtensions && !hide.jambExtensions) {
    rows.push([rowLabels.jambExtensions ?? 'Jamb Extensions', pdfData.jambExtensionsPrice]);
  }
  if (pdfData.hasMagneticContacts && !hide.magneticContacts) {
    rows.push([rowLabels.magneticContacts ?? `Magnetic Alarm Contacts (${pdfData.magneticContactQty})`, pdfData.magneticContactPrice]);
  }
  if (pdfData.hasFinalFinish && !hide.finalFinish) {
    rows.push([rowLabels.finalFinish ?? 'Final Finish', pdfData.finalFinishPrice]);
  }
  return (
    <div className="mt-6">
      <div className="text-[11pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>
        {heading}
      </div>
      <div className="mt-2 space-y-1">
        {rows.map(([label, price]) => (
          <div key={label} className="flex justify-between text-[10pt] px-1">
            <span>•&nbsp;&nbsp;{label}</span>
            <span>{price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExclusionsHeaderPreview({ config }: { config: ExclusionsHeaderConfig }) {
  const heading = config.heading ?? 'Our Base Bid does not include:';
  return (
    <div className="mt-6">
      <div className="border-t border-gray-300" />
      <div className="mt-2 text-[11pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>
        {heading}
      </div>
    </div>
  );
}

function ClosingSignaturePreview({
  config,
  pdfData,
  fonts,
}: {
  config: ClosingSignatureConfig;
  pdfData: ProposalAssemblyResult['pdfData'];
  fonts: BrandFontMap;
}) {
  const closingText = config.closingText ?? 'Sincerely,';
  const companyLine = config.companyLine ?? 'Tischler und Sohn';
  const useSignatureFont = config.useSignatureFont !== false;
  const showEstimator = config.showEstimator !== false;
  return (
    <div className="mt-6">
      <div className="border-t border-gray-300" />
      <div className="mt-3 text-[10pt]">{closingText}</div>
      {useSignatureFont && fonts.signature && pdfData.salesman ? (
        <>
          <div className="mt-6 text-[24pt] leading-none" style={{ color: NAVY, fontFamily: FONT_FAMILIES.signature }}>
            {pdfData.salesman}
          </div>
          <div className="mt-1 text-[9pt]" style={{ color: '#505050' }}>
            {pdfData.salesman}
          </div>
        </>
      ) : (
        <>
          <div className="mt-6 text-[10pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>
            {companyLine}
          </div>
          {pdfData.salesman && (
            <div className="text-[9pt]" style={{ color: '#505050' }}>{pdfData.salesman}</div>
          )}
        </>
      )}
      {showEstimator && pdfData.estimator && pdfData.estimator !== pdfData.salesman && (
        <div className="text-[9pt]" style={{ color: '#505050' }}>Estimator: {pdfData.estimator}</div>
      )}
    </div>
  );
}

function InstallationHeaderPreview({
  config,
  pdfData,
}: {
  config: InstallationHeaderConfig;
  pdfData: ProposalAssemblyResult['pdfData'];
}) {
  const heading = config.heading ?? 'INSTALLATION';
  const costLabel = config.costLabel ?? 'Installation Cost:';
  return (
    <div className="mt-6">
      <div className="text-[12pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>
        {heading}
      </div>
      <div className="mt-2 flex justify-between text-[10pt] px-1">
        <span>{costLabel}</span>
        <span className="font-bold">{pdfData.installationPrice}</span>
      </div>
      <div className="mt-3 border-t border-gray-300" />
    </div>
  );
}
