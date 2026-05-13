'use client';

import { useEffect, useMemo } from 'react';
import type { ProposalAssemblyResult, SpecPresetData } from '@crm/proposal-assembly';
import {
  parsePageSelector,
  isSelectorError,
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

  const { pdfData, sections } = result;
  const constantPresets = sections.CONSTANT ?? [];
  const closingConstant = constantPresets.filter(isClosingConstant);
  const introConstant = constantPresets.filter((p) => !closingConstant.some((c) => c.id === p.id));
  const specPresets = sections.SPECIFICATION ?? [];
  const optionPresets = sections.OPTION ?? [];
  const exclusionPresets = sections.EXCLUSION ?? [];
  const installationPresets = sections.INSTALLATION ?? [];

  const pricingRows: Array<[string, string]> = [];
  if (pdfData.hasEuroWindows) pricingRows.push(['Euro Windows', pdfData.euroWindowsPrice]);
  if (pdfData.hasDoubleHung) pricingRows.push(['Double Hung Windows', pdfData.doubleHungPrice]);
  if (pdfData.hasEuroDoors) pricingRows.push(['Euro Doors', pdfData.euroDoorsPrice]);

  const addOnRows: Array<[string, string]> = [];
  if (pdfData.hasWindowScreens) addOnRows.push([`Window Screens (${pdfData.windowScreensQty})`, pdfData.windowScreensPrice]);
  if (pdfData.hasDoorScreenSash) addOnRows.push([`Door Screen Sash (${pdfData.doorScreenSashQty})`, pdfData.doorScreenSashPrice]);
  if (pdfData.hasEntryDoor) addOnRows.push([`Entry Door (${pdfData.entryDoorQty})`, pdfData.entryDoorPrice]);
  if (pdfData.hasJambExtensions) addOnRows.push(['Jamb Extensions', pdfData.jambExtensionsPrice]);
  if (pdfData.hasMagneticContacts) addOnRows.push([`Magnetic Alarm Contacts (${pdfData.magneticContactQty})`, pdfData.magneticContactPrice]);
  if (pdfData.hasFinalFinish) addOnRows.push(['Final Finish', pdfData.finalFinishPrice]);

  const hasAnyOptions = optionPresets.length > 0 || addOnRows.length > 0;

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
        {/* Letterhead — when the template has a first-page logo rule we
            render it at the rule's alignment + size. Otherwise we fall
            back to the legacy hard-coded wordmark layout. */}
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
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <img
              src="/tces-logo.png"
              alt=""
              className="h-12 w-12 flex-shrink-0 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="flex-1">
              <div
                className="text-[18pt] font-bold tracking-wide"
                style={{ color: NAVY, fontFamily: FONT_FAMILIES.title }}
              >
                TISCHLER UND SOHN
              </div>
              <div
                className="text-[8pt] mt-0.5"
                style={{ color: '#505050', fontFamily: FONT_FAMILIES.subtitle }}
              >
                European Wood Windows &amp; Doors
              </div>
            </div>
          </div>
        )}
        <div className="mt-3 border-t-2" style={{ borderColor: RED }} />

        {/* Intro CONSTANT presets — date, addressee, salutation come from the user's editable
            constant blocks; the PDFKit renderer in apps/api mirrors this. */}
        {introConstant.length > 0 && (
          <div className="mt-6 space-y-3">
            {introConstant.map((preset) => (
              <div key={preset.id}>
                {blockWrap(
                  preset.id,
                  <SafeRichHtml className="text-[10pt] leading-[1.5] p-1" html={preset.body ?? ''} />,
                )}
              </div>
            ))}
          </div>
        )}

        {/* Numbered SPECIFICATIONS */}
        {specPresets.length > 0 && (
          <div className="mt-5 space-y-2">
            {specPresets.map((preset, i) => (
              <div key={preset.id}>
                {blockWrap(
                  preset.id,
                  <div className="p-1">
                    <div className="text-[9pt] font-bold" style={{ color: NAVY }}>
                      <span className="inline-block w-7">({i + 1})</span>
                      <span>{preset.title}</span>
                    </div>
                    {preset.body && (
                      <SafeRichHtml
                        className="ml-6 mt-0.5 text-[9pt] leading-[1.55]"
                        html={preset.body}
                      />
                    )}
                  </div>,
                )}
              </div>
            ))}
          </div>
        )}

        {/* PRICING section */}
        {(pricingRows.length > 0 || pdfData.grandTotal) && (
          <div className="mt-6">
            <div className="border-t border-gray-300" />
            <div className="mt-2 text-[11pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>PRICING</div>
            <div className="mt-2 space-y-1">
              {pricingRows.map(([label, price]) => (
                <div key={label} className="flex justify-between text-[10pt] px-1">
                  <span>{label}</span>
                  <span>{price}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-gray-300" />
            <div className="mt-2 flex justify-between text-[12pt] font-bold px-1" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>
              <span>BASE BID PRICE</span>
              <span>{pdfData.grandTotal}</span>
            </div>
            <div className="mt-1 border-t border-gray-300" />
          </div>
        )}

        {/* ADDITIONS OR DEDUCTIONS */}
        {hasAnyOptions && (
          <div className="mt-6">
            <div className="text-[11pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>
              ADDITIONS OR DEDUCTIONS TO OUR BASE BID
            </div>
            {addOnRows.length > 0 && (
              <div className="mt-2 space-y-1">
                {addOnRows.map(([label, price]) => (
                  <div key={label} className="flex justify-between text-[10pt] px-1">
                    <span>•&nbsp;&nbsp;{label}</span>
                    <span>{price}</span>
                  </div>
                ))}
              </div>
            )}
            {optionPresets.length > 0 && (
              <div className="mt-3 space-y-3">
                {optionPresets.map((preset) => (
                  <div key={preset.id}>
                    {blockWrap(
                      preset.id,
                      <div className="px-1 py-0.5">
                        <div className="text-[9pt] font-bold" style={{ color: NAVY }}>{preset.title}</div>
                        {preset.body && (
                          <SafeRichHtml className="mt-0.5 text-[9pt] leading-[1.55]" html={preset.body} />
                        )}
                      </div>,
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXCLUSIONS */}
        {exclusionPresets.length > 0 && (
          <div className="mt-6">
            <div className="border-t border-gray-300" />
            <div className="mt-2 text-[11pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>
              Our Base Bid does not include:
            </div>
            <div className="mt-2 space-y-2">
              {exclusionPresets.map((preset) => (
                <div key={preset.id}>
                  {blockWrap(
                    preset.id,
                    <div className="px-1">
                      <div className="text-[9pt] font-bold">•&nbsp;&nbsp;{preset.title}</div>
                      {preset.body && preset.body.trim() && (
                        <SafeRichHtml className="ml-4 mt-0.5 text-[9pt] leading-[1.55]" html={preset.body} />
                      )}
                    </div>,
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLOSING + SIGNATURE */}
        <div className="mt-6">
          <div className="border-t border-gray-300" />
          {closingConstant.length > 0 && (
            <div className="mt-3 space-y-3">
              {closingConstant.map((preset) => (
                <div key={preset.id}>
                  {blockWrap(
                    preset.id,
                    <SafeRichHtml className="text-[10pt] leading-[1.5] p-1" html={preset.body ?? ''} />,
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 text-[10pt]">Sincerely,</div>
          {fonts.signature && pdfData.salesman ? (
            <>
              <div
                className="mt-6 text-[24pt] leading-none"
                style={{ color: NAVY, fontFamily: FONT_FAMILIES.signature }}
              >
                {pdfData.salesman}
              </div>
              <div className="mt-1 text-[9pt]" style={{ color: '#505050' }}>
                {pdfData.salesman}
              </div>
            </>
          ) : (
            <>
              <div
                className="mt-6 text-[10pt] font-bold"
                style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}
              >
                Tischler und Sohn
              </div>
              {pdfData.salesman && (
                <div className="text-[9pt]" style={{ color: '#505050' }}>
                  {pdfData.salesman}
                </div>
              )}
            </>
          )}
          {pdfData.estimator && pdfData.estimator !== pdfData.salesman && (
            <div className="text-[9pt]" style={{ color: '#505050' }}>Estimator: {pdfData.estimator}</div>
          )}
        </div>

        {/* INSTALLATION page (conditional) */}
        {pdfData.hasInstallation && (
          <div className="mt-10 pt-6 border-t-2 border-dashed border-gray-300">
            <div className="flex items-center gap-3">
              <img
                src="/tces-logo.png"
                alt=""
                className="h-8 w-8 flex-shrink-0 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div
                className="text-[14pt] font-bold tracking-wide"
                style={{ color: NAVY, fontFamily: FONT_FAMILIES.title }}
              >
                TISCHLER UND SOHN
              </div>
            </div>
            <div className="mt-2 border-t-2" style={{ borderColor: RED }} />
            <div className="mt-5 text-[12pt] font-bold" style={{ color: NAVY, fontFamily: FONT_FAMILIES.heading }}>INSTALLATION</div>
            <div className="mt-2 flex justify-between text-[10pt] px-1">
              <span>Installation Cost:</span>
              <span className="font-bold">{pdfData.installationPrice}</span>
            </div>
            <div className="mt-3 border-t border-gray-300" />
            {installationPresets.length > 0 && (
              <div className="mt-3 space-y-3">
                {installationPresets.map((preset) => (
                  <div key={preset.id}>
                    {blockWrap(
                      preset.id,
                      <div className="px-1">
                        <div className="text-[9pt] font-bold" style={{ color: NAVY }}>{preset.title}</div>
                        {preset.body && preset.body.trim() && (
                          <SafeRichHtml className="ml-3 mt-0.5 text-[9pt] leading-[1.55]" html={preset.body} />
                        )}
                      </div>,
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-3 border-t border-gray-200 flex justify-between text-[7pt]" style={{ color: '#808080' }}>
          <span className="flex-1 text-center">Tischler und Sohn &nbsp;|&nbsp; Confidential</span>
          <span>Page 1</span>
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
