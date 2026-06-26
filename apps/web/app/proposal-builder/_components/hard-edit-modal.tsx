'use client';

import { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import type { ProposalAssemblyResult } from '@crm/proposal-assembly';
import { inferBlockType, type BlockType } from '@crm/types';

interface Props {
  result: ProposalAssemblyResult;
  onClose: () => void;
}

const NAVY = '#1e3a5f';

/**
 * Build an editable HTML string from the assembled proposal blocks.
 * Structural/data-heavy blocks (pricing tables, letterhead) show a placeholder.
 * All text content blocks render their title + resolved body.
 */
function buildEditableHtml(result: ProposalAssemblyResult): string {
  const { orderedBlocks, pdfData } = result;
  let specCounter = 0;
  const parts: string[] = [];

  for (const ob of orderedBlocks) {
    const blockType =
      (ob.preset.blockType as BlockType | null) ??
      inferBlockType(ob.preset.section, ob.preset.title);
    const config = (ob.preset.config ?? {}) as Record<string, unknown>;
    const hideTitle = !!config.hideTitle;
    const title = ob.preset.title ?? '';
    const body = ob.preset.body ?? '';

    switch (blockType) {
      case 'LETTERHEAD':
        parts.push(
          `<div style="margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid ${NAVY}">` +
          `<div style="font-size:18pt;font-weight:bold;color:${NAVY};letter-spacing:0.04em">${pdfData.projectName || 'TISCHLER UND SOHN'}</div>` +
          `</div>`,
        );
        break;

      case 'TITLE_BLOCK':
        parts.push(
          `<div style="text-align:center;margin:16px 0;padding:10px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd">` +
          (!hideTitle && title
            ? `<div style="font-size:13pt;font-weight:bold;color:${NAVY};text-transform:uppercase;letter-spacing:0.04em">${title}</div>`
            : '') +
          (body ? `<div style="font-size:10pt;line-height:1.5;margin-top:4px">${body}</div>` : '') +
          `</div>`,
        );
        break;

      case 'FREE_TEXT':
        parts.push(
          `<div style="margin-top:14px">` +
          (!hideTitle && title
            ? `<div style="font-size:10pt;font-weight:bold;color:${NAVY};margin-bottom:3px">${title}</div>`
            : '') +
          (body ? `<div style="font-size:10pt;line-height:1.5">${body}</div>` : '') +
          `</div>`,
        );
        break;

      case 'SPECIFICATION_ITEM': {
        specCounter += 1;
        const num = specCounter;
        if (hideTitle) {
          parts.push(
            `<div style="margin-top:10px;font-size:10pt;line-height:1.55">` +
            `<span style="font-weight:bold;color:${NAVY};margin-right:6px">(${num})</span>${body}` +
            `</div>`,
          );
        } else {
          parts.push(
            `<div style="margin-top:10px;font-size:10pt">` +
            `<div style="font-weight:bold;color:${NAVY}"><span style="display:inline-block;min-width:28px">(${num})</span>${title}</div>` +
            (body ? `<div style="padding-left:28px;line-height:1.55">${body}</div>` : '') +
            `</div>`,
          );
        }
        break;
      }

      case 'OPTION_ITEM':
        parts.push(
          `<div style="margin-top:10px;font-size:10pt">` +
          (!hideTitle && title
            ? `<div style="font-weight:bold;color:${NAVY}">${title}</div>`
            : '') +
          (body ? `<div style="line-height:1.55">${body}</div>` : '') +
          `</div>`,
        );
        break;

      case 'EXCLUSION_ITEM':
        parts.push(
          `<div style="margin-top:6px;font-size:10pt">` +
          (!hideTitle && title
            ? `<div style="font-weight:bold">&bull;&nbsp;&nbsp;${title}</div>`
            : '') +
          (body ? `<div style="padding-left:16px;line-height:1.55">${body}</div>` : '') +
          `</div>`,
        );
        break;

      case 'INSTALLATION_ITEM':
        parts.push(
          `<div style="margin-top:10px;font-size:10pt">` +
          (!hideTitle && title
            ? `<div style="font-weight:bold;color:${NAVY}">${title}</div>`
            : '') +
          (body ? `<div style="padding-left:12px;line-height:1.55">${body}</div>` : '') +
          `</div>`,
        );
        break;

      case 'EXCLUSIONS_HEADER':
      case 'INSTALLATION_HEADER':
        parts.push(
          `<div style="margin-top:18px;padding-bottom:4px;border-bottom:1px solid #ccc">` +
          (title
            ? `<div style="font-size:11pt;font-weight:bold;color:${NAVY}">${title}</div>`
            : '') +
          (body ? `<div style="font-size:10pt;margin-top:4px">${body}</div>` : '') +
          `</div>`,
        );
        break;

      case 'CLOSING_SIGNATURE':
        parts.push(
          `<div style="margin-top:32px;font-size:10pt">` +
          (body ? `<div style="line-height:1.6">${body}</div>` : '') +
          (title ? `<div style="margin-top:36px;font-size:9pt;color:#666">${title}</div>` : '') +
          `</div>`,
        );
        break;

      case 'PRICING_TABLE':
      case 'BASE_BID_LINE':
      case 'ADDITIONS_TABLE':
        parts.push(
          `<div style="margin-top:14px;padding:10px;border:1px dashed #bbb;background:#f8f8f8;text-align:center;font-size:9pt;color:#888">` +
          `[Pricing / Totals block]` +
          `</div>`,
        );
        break;

      case 'PAGE_BREAK':
        parts.push(`<hr style="margin:20px 0;border:none;border-top:2px dashed #ccc">`);
        break;

      case 'FOOTER':
        // Footers are not rendered inline in hard-edit
        break;

      default:
        if (title || body) {
          parts.push(
            `<div style="margin-top:10px;font-size:10pt">` +
            (!hideTitle && title
              ? `<div style="font-weight:bold;color:${NAVY}">${title}</div>`
              : '') +
            (body ? `<div style="line-height:1.5">${body}</div>` : '') +
            `</div>`,
          );
        }
        break;
    }
  }

  return parts.join('\n');
}

export function HardEditModal({ result, onClose }: Props) {
  const editRef = useRef<HTMLDivElement>(null);

  // Seed the contentEditable with the assembled HTML on mount.
  // We use a ref assignment (not dangerouslySetInnerHTML) to avoid React
  // reconciliation overwriting user edits on re-renders.
  useEffect(() => {
    if (editRef.current) {
      editRef.current.innerHTML = buildEditableHtml(result);
    }
    // Only seed once on mount — intentionally no result dep so edits aren't wiped
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => {
    const content = editRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head>` +
      `<meta charset="utf-8"><title>Proposal</title>` +
      `<style>` +
      `body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e1e1e;margin:0;padding:60px 76px;font-size:10pt;line-height:1.5}` +
      `@media print{body{padding:40px 56px}}` +
      `ul,ol{margin:4px 0;padding-left:20px}li{margin-bottom:2px}` +
      `strong,b{font-weight:600}` +
      `</style>` +
      `</head><body>${content}</body></html>`,
    );
    win.document.close();
    win.focus();
    // Slight delay so fonts/images can load before the print dialog opens
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" role="dialog" aria-modal aria-label="Hard Edit Proposal">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 bg-[#1e3a5f] px-5 py-3 text-white">
        <span className="text-sm font-semibold">Hard Edit</span>
        <span className="ml-1 text-xs text-white/50">
          Click any text to edit. Changes here do not affect the template.
        </span>
        <div className="flex-1" />
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save as PDF
        </button>
        <button
          onClick={onClose}
          aria-label="Close hard edit"
          className="ml-1 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Editable document */}
      <div className="flex-1 overflow-y-auto bg-gray-100 px-4 py-6">
        <div
          className="mx-auto border border-gray-200 bg-white shadow-md"
          style={{ width: 'min(816px, 100%)', minHeight: '1024px', padding: '64px 76px' }}
        >
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            className="min-h-full outline-none"
            style={{ fontSize: '10pt', lineHeight: '1.5', color: '#1e1e1e' }}
          />
        </div>
      </div>
    </div>
  );
}
