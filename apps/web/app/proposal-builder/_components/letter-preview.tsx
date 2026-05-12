'use client';

import type { ProposalAssemblyResult, SpecPresetData } from '@crm/proposal-assembly';

interface Props {
  result: ProposalAssemblyResult | null;
  error: string | null;
  selectedPresetId: string | null;
  onSelectBlock: (id: string) => void;
}

// Tischler brand colors — match the PDF constants (quote-pdf-renderer.ts:82-87).
const NAVY = '#1e3a5f';
const RED = '#da291c';

function isClosingConstant(preset: SpecPresetData): boolean {
  return /closing|signature|sincerely/i.test(preset.title);
}

export function LetterPreview({ result, error, selectedPresetId, onSelectBlock }: Props) {
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
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          color: '#1e1e1e',
        }}
      >
        {/* Letterhead */}
        <div className="flex items-center gap-4">
          <img
            src="/tces-logo.png"
            alt=""
            className="h-12 w-12 flex-shrink-0 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex-1">
            <div className="text-[18pt] font-bold tracking-wide" style={{ color: NAVY }}>
              TISCHLER UND SOHN
            </div>
            <div className="text-[8pt] mt-0.5" style={{ color: '#505050' }}>
              European Wood Windows &amp; Doors
            </div>
          </div>
        </div>
        <div className="mt-3 border-t-2" style={{ borderColor: RED }} />

        {/* Intro CONSTANT presets — date, addressee, salutation come from the user's editable
            constant blocks; we do not hardcode them here (matches quote-pdf-renderer.ts). */}
        {introConstant.length > 0 && (
          <div className="mt-6 space-y-3">
            {introConstant.map((preset) => (
              <div key={preset.id}>
                {blockWrap(
                  preset.id,
                  <p className="text-[10pt] leading-[1.5] whitespace-pre-wrap p-1">{preset.body}</p>,
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
                      <span className="inline-block w-6">{i + 1}.</span>
                      <span>{preset.title}</span>
                    </div>
                    {preset.body && (
                      <p className="ml-6 mt-0.5 text-[9pt] leading-[1.55] whitespace-pre-wrap">
                        {preset.body}
                      </p>
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
            <div className="mt-2 text-[11pt] font-bold" style={{ color: NAVY }}>PRICING</div>
            <div className="mt-2 space-y-1">
              {pricingRows.map(([label, price]) => (
                <div key={label} className="flex justify-between text-[10pt] px-1">
                  <span>{label}</span>
                  <span>{price}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-gray-300" />
            <div className="mt-2 flex justify-between text-[12pt] font-bold px-1" style={{ color: NAVY }}>
              <span>BASE BID PRICE</span>
              <span>{pdfData.grandTotal}</span>
            </div>
            <div className="mt-1 border-t border-gray-300" />
          </div>
        )}

        {/* ADDITIONS OR DEDUCTIONS */}
        {hasAnyOptions && (
          <div className="mt-6">
            <div className="text-[11pt] font-bold" style={{ color: NAVY }}>
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
                          <p className="mt-0.5 text-[9pt] leading-[1.55] whitespace-pre-wrap">{preset.body}</p>
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
            <div className="mt-2 text-[11pt] font-bold" style={{ color: NAVY }}>
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
                        <p className="ml-4 mt-0.5 text-[9pt] leading-[1.55] whitespace-pre-wrap">{preset.body}</p>
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
                    <p className="text-[10pt] leading-[1.5] whitespace-pre-wrap p-1">{preset.body}</p>,
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 text-[10pt]">Sincerely,</div>
          <div className="mt-6 text-[10pt] font-bold" style={{ color: NAVY }}>Tischler und Sohn</div>
          {pdfData.salesman && <div className="text-[9pt]" style={{ color: '#505050' }}>{pdfData.salesman}</div>}
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
              <div className="text-[14pt] font-bold tracking-wide" style={{ color: NAVY }}>
                TISCHLER UND SOHN
              </div>
            </div>
            <div className="mt-2 border-t-2" style={{ borderColor: RED }} />
            <div className="mt-5 text-[12pt] font-bold" style={{ color: NAVY }}>INSTALLATION</div>
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
                          <p className="ml-3 mt-0.5 text-[9pt] leading-[1.55] whitespace-pre-wrap">{preset.body}</p>
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
