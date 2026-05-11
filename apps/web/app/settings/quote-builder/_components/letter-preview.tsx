'use client';

import type { ProposalAssemblyResult } from '@/lib/proposal-assembly';

const SECTION_ORDER = ['CONSTANT', 'SPECIFICATION', 'OPTION', 'EXCLUSION', 'INSTALLATION'] as const;

const SECTION_LABELS: Record<string, string> = {
  CONSTANT: 'General',
  SPECIFICATION: 'Specifications',
  OPTION: 'Options',
  EXCLUSION: 'Exclusions',
  INSTALLATION: 'Installation',
};

interface Props {
  result: ProposalAssemblyResult | null;
  error: string | null;
  selectedPresetId: string | null;
  onSelectBlock: (id: string) => void;
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
          <p className="text-xs text-gray-300 mt-1">The letter preview will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Letterhead mock */}
      <div className="mx-auto max-w-[640px] my-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-gray-100">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Proposal Preview</div>
          <div className="text-lg font-semibold text-[#1e3a5f]">
            {result.pdfData.projectName || 'Project Name'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {result.pdfData.companyName && <span>{result.pdfData.companyName} — </span>}
            {result.pdfData.address || 'Address'}
          </div>
        </div>

        {/* Salutation */}
        <div className="px-8 pt-5 pb-2">
          <p className="text-sm text-gray-700">
            Dear {result.pdfData.contactSalutation} {result.pdfData.contactLastName || 'Customer'},
          </p>
        </div>

        {/* Sections */}
        <div className="px-8 pb-8 space-y-5">
          {SECTION_ORDER.map((section) => {
            const blocks = result.sections[section];
            if (!blocks || blocks.length === 0) return null;

            return (
              <div key={section}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 border-b border-gray-100 pb-1">
                  {SECTION_LABELS[section]}
                </div>
                {blocks.map((block, idx) => {
                  const isEditing = block.id === selectedPresetId;
                  return (
                    <div
                      key={`${block.id}-${idx}`}
                      onClick={() => onSelectBlock(block.id)}
                      className={`py-2 px-3 -mx-3 rounded cursor-pointer transition-colors ${
                        isEditing
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-gray-800 mb-0.5">{block.title}</div>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{block.body}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="mx-8 mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-[10px] font-bold text-amber-800 mb-1">Warnings</div>
            <ul className="space-y-0.5">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-[11px] text-amber-700">• {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
