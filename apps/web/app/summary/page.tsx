'use client';

import { useEffect, useState, useRef, createContext, useContext } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getOptionsForType } from '@/lib/product-type-options';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2,
  Clock,
  User,
  Star,
  List,
  ChevronUp,
  ChevronDown,
  X,
  Eye,
  Save,
  Printer,
  MapPin,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSetting, setSetting } from '@/lib/preferences';
import { usePermissions } from '@/lib/permissions-context';
import { AlertCircle } from 'lucide-react';
import { Package, ScrollText } from 'lucide-react';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import { DateInput } from '@/components/date-input';
import { useSchemaStore } from '@/lib/schema-store';

// Convert millimeters to feet and inches with fractions
const mmToFeetInches = (mm: string): string => {
  const mmValue = parseFloat(mm);
  if (isNaN(mmValue) || mmValue === 0) return '';
  
  // Calculate base feet
  const baseFt = Math.floor(mmValue / 304.8);
  
  // Calculate decimal inches
  const decIn = mmValue / 25.4 - baseFt * 12;
  
  // Extract whole inches
  const wholeIn = Math.floor(decIn);
  
  // Calculate fraction part
  const frac = decIn - wholeIn;
  const sixteenth = Math.round(frac * 16);
  
  // Adjust for rounding to 16/16
  const adjWholeIn0 = wholeIn + (sixteenth === 16 ? 1 : 0);
  const fracIndex = sixteenth === 16 ? 0 : sixteenth;
  
  // Handle carry-over from inches to feet
  const carryFt = Math.floor(adjWholeIn0 / 12);
  const adjWholeIn = adjWholeIn0 % 12;
  const finalFt = baseFt + carryFt;
  
  // Format fraction text
  const fractions = [
    "", "1/16", "1/8", "3/16", "1/4", "5/16", "3/8", "7/16", "1/2",
    "9/16", "5/8", "11/16", "3/4", "13/16", "7/8", "15/16"
  ];
  const fracTxt = fractions[fracIndex] || "";
  
  // Build inch text
  const inchText = adjWholeIn + (fracTxt ? " " + fracTxt : "");
  
  // Return formatted string
  return `${finalFt}'${inchText}"`;
};

// Convert feet/inches string back to decimal feet
const feetInchesToDecimalFeet = (txt: string): number => {
  if (!txt || txt.trim() === '') return 0;
  
  const clean = txt.trim();
  
  // Extract feet (before ')
  const ftMatch = clean.match(/^(\d+)'/);
  const ft = ftMatch ? parseFloat(ftMatch[1]) : 0;
  
  // Extract inches part (between ' and ")
  const inchMatch = clean.match(/'([^"]*)"?/);
  if (!inchMatch) return ft;
  
  const inchesPart = inchMatch[1].trim();
  if (!inchesPart) return ft;
  
  // Split whole inches and fraction
  const parts = inchesPart.split(' ');
  const wholeIn = parts[0] ? parseFloat(parts[0]) : 0;
  const fracTxt = parts[1] || '';
  
  // Convert fraction text to decimal
  const fractionMap: { [key: string]: number } = {
    '1/16': 1/16, '1/8': 1/8, '3/16': 3/16, '1/4': 1/4, '5/16': 5/16,
    '3/8': 3/8, '7/16': 7/16, '1/2': 1/2, '9/16': 9/16, '5/8': 5/8,
    '11/16': 11/16, '3/4': 3/4, '13/16': 13/16, '7/8': 7/8, '15/16': 15/16
  };
  const fracVal = fractionMap[fracTxt] || 0;
  
  // Return decimal feet
  return ft + (wholeIn + fracVal) / 12;
};

// Window type options
const WINDOW_TYPES = [
  'Inswing',
  'Push Outswing',
  'Crank Outswing',
  'Offset Simulated DH (2 Glass Fields)',
  'Simulated DH (1 glass Field and a 44MM)',
  'Direct Glaze',
  'Fixed with Sash',
  'Inswing T & T',
  'Awning',
  'Tilt-in',
  'Pivot',
  'Single Hung Concealed Balance',
  'Double Hung Concealed Balance',
  'Triple Hung Concealed Balance',
  'Single Hung Weight and Chain',
  'Double Hung Weight and Chain',
  'Triple Hung Weight and Chain',
  'Single Hung Cross Cable Balance System',
  'Double Hung Cross Cable Balance System',
  'Triple Hung Cross Cable Balance System',
  'Vent Locks',
  'Inswing French',
  'Inswing T & T French',
  'Outswing French',
  'French Offset Simulated DH (2 Glass Fields)',
  'French Simulated DH (1 glass Field and a 44MM)',
  'Lift and Roll Window',
  'Inswing Folding Window',
  'Outswing Folding Window'
];

// Door type options
const DOOR_TYPES = [
  'Inswing GD',
  'Outswing GD',
  'Outswing Folding',
  'Inswing Folding',
  'L&R D',
  'Pivot',
  'Inswing DD',
  'Outswing DD',
  'Fixed with Sash',
  'Direct Glaze',
  'Inswing House Door',
  'Outswing House Door',
  'Inswing French House Door',
  'Outswing French House Door',
  'Inswing French GD',
  'Outswing French GD',
  'Inswing French DD',
  'Outswing French DD',
  'Convert Pivot to Inswing',
  'Outswing Pivot'
];

/** Returns the valid option set for a given product type string.
 *  Used in both the PDF renderer (to filter stale saved options) and
 *  the editor checkbox UI. */
// ── Cell navigation context for Excel-like keyboard selection ──
interface CellNavCtx {
  activeCellId: string | null;
  editingCellId: string | null;
  setActive: (id: string | null) => void;
  setEditing: (id: string | null) => void;
}
const CellNavContext = createContext<CellNavCtx>({
  activeCellId: null,
  editingCellId: null,
  setActive: () => {},
  setEditing: () => {},
});

// Searchable dropdown cell component for Type columns
const CellDropdown = ({ rowId, field, value, onChange, options }: { 
  rowId: string; 
  field: string; 
  value: string; 
  onChange: (value: string) => void;
  options: string[];
}) => {
  const { activeCellId, editingCellId, setActive, setEditing } = useContext(CellNavContext);
  const cellId = `${rowId}:${field}`;
  const isActive = activeCellId === cellId;
  const isEditing = editingCellId === cellId;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = [
    // Blank entry at top so Enter doesn't auto-select the first real option
    ...(searchTerm === '' ? [''] : []),
    ...options.filter(option =>
      option.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  ];

  const adjustHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      adjustHeight(textareaRef.current);
    }
  }, [value, isEditing]);

  // Open dropdown when editing starts
  useEffect(() => {
    if (isEditing) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSearchTerm('');
    }
  }, [isEditing]);

  useEffect(() => {
    if (isOpen && filteredOptions.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [searchTerm, isOpen]);

  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSearchTerm(e.target.value);
    onChange(e.target.value);
    setIsOpen(true);
    adjustHeight(e.target);
  };

  const handleSelectOption = (option: string) => {
    onChange(option);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    setEditing(null);
    setTimeout(() => adjustHeight(textareaRef.current), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen || filteredOptions.length === 0) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const td = e.currentTarget.closest('td');
        const tr = td?.closest('tr');
        const tbody = tr?.closest('tbody');
        setEditing(null);
        if (td && tr && tbody) {
          const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
          const cells = Array.from(tr.querySelectorAll(':scope > td'));
          const rowIdx = rows.indexOf(tr as HTMLTableRowElement);
          const colIdx = cells.indexOf(td as HTMLTableCellElement);
          for (let c = colIdx + 1; c < cells.length; c++) {
            const cId = (cells[c] as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
            if (cId) { setActive(cId); setEditing(cId); return; }
          }
          if (rowIdx + 1 < rows.length) {
            const nextCells = Array.from((rows[rowIdx + 1] as Element).querySelectorAll(':scope > td'));
            for (const tc of nextCells) {
              const cId = (tc as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
              if (cId) { setActive(cId); setEditing(cId); return; }
            }
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditing(null);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev === -1 ? 0 : (prev < filteredOptions.length - 1 ? prev + 1 : 0)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev === -1 ? 0 : (prev > 0 ? prev - 1 : filteredOptions.length - 1)
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        setEditing(null);
        break;
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
      setEditing(null);
    }, 200);
  };

  // When not editing: show a styled display div
  if (!isEditing) {
    return (
      <div
        data-cell-id={cellId}
        className={cn(
          "w-full px-1 py-0.5 text-xs rounded min-h-[20px] cursor-default whitespace-pre-wrap break-words",
          isActive ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
        )}
        onClick={() => setActive(cellId)}
        onDoubleClick={() => { setActive(cellId); setEditing(cellId); }}
      >
        {value || <span className="text-gray-300 select-none">&nbsp;</span>}
      </div>
    );
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        data-cell-id={cellId}
        value={searchTerm || value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        autoFocus
        className="w-full px-1 py-0.5 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none overflow-hidden"
        style={{ minHeight: '20px' }}
        rows={1}
        placeholder="Type to search..."
      />
      {isOpen && filteredOptions.length > 0 && (
        <div ref={dropdownRef} className="absolute z-50 w-64 max-h-60 overflow-y-auto bg-white border border-gray-300 shadow-lg rounded mt-1">
          {filteredOptions.map((option, index) => (
            <div
              key={option === '' ? '__blank__' : option}
              onClick={() => handleSelectOption(option)}
              className={`px-2 py-1 text-xs cursor-pointer whitespace-normal break-words ${
                index === highlightedIndex ? 'bg-[#e8eaf6] text-brand-dark' : 'hover:bg-[#f0f1fa]'
              }`}
            >
              {option === '' ? <span className="text-gray-300 select-none">&nbsp;</span> : option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Simple cell input component - defined outside to prevent recreation on every render
const CellInput = ({ rowId, field, value, onChange, onEnterKey }: { 
  rowId: string; 
  field: string; 
  value: string; 
  onChange: (value: string) => void;
  onEnterKey?: () => void;
}) => {
  const { activeCellId, editingCellId, setActive, setEditing } = useContext(CellNavContext);
  const cellId = `${rowId}:${field}`;
  const isActive = activeCellId === cellId;
  const isEditing = editingCellId === cellId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize when in edit mode
  useEffect(() => {
    if (isEditing) {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [value, isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(null);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (onEnterKey) {
        const tbody = e.currentTarget.closest('tbody');
        setEditing(null);
        onEnterKey();
        setTimeout(() => {
          if (tbody) {
            const lastRow = tbody.querySelector(':scope > tr:last-child');
            if (lastRow) {
              const firstCellId = lastRow.querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
              if (firstCellId) { setActive(firstCellId); setEditing(firstCellId); }
            }
          }
        }, 50);
        return;
      }

      const td = e.currentTarget.closest('td');
      const tr = td?.closest('tr');
      const tbody = tr?.closest('tbody');
      if (td && tr && tbody) {
        const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
        const cells = Array.from(tr.querySelectorAll(':scope > td'));
        const rowIdx = rows.indexOf(tr as HTMLTableRowElement);
        const colIdx = cells.indexOf(td as HTMLTableCellElement);
        setEditing(null);
        for (let c = colIdx + 1; c < cells.length; c++) {
          const cId = (cells[c] as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
          if (cId) { setActive(cId); setEditing(cId); return; }
        }
        if (rowIdx + 1 < rows.length) {
          const nextCells = Array.from((rows[rowIdx + 1] as Element).querySelectorAll(':scope > td'));
          for (const tc of nextCells) {
            const cId = (tc as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
            if (cId) { setActive(cId); setEditing(cId); return; }
          }
        }
      }
      return;
    }

    // Move to previous cell on Backspace when current cell is empty
    if (e.key === 'Backspace' && value === '') {
      e.preventDefault();
      const td = e.currentTarget.closest('td');
      const tr = td?.closest('tr');
      const tbody = tr?.closest('tbody');
      if (td && tr && tbody) {
        const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
        const cells = Array.from(tr.querySelectorAll(':scope > td'));
        const rowIdx = rows.indexOf(tr as HTMLTableRowElement);
        const colIdx = cells.indexOf(td as HTMLTableCellElement);
        setEditing(null);
        for (let c = colIdx - 1; c >= 0; c--) {
          const cId = (cells[c] as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
          if (cId) { setActive(cId); setEditing(cId); return; }
        }
        if (rowIdx > 0) {
          const prevCells = Array.from((rows[rowIdx - 1] as Element).querySelectorAll(':scope > td'));
          for (let c = prevCells.length - 1; c >= 0; c--) {
            const cId = (prevCells[c] as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
            if (cId) { setActive(cId); setEditing(cId); return; }
          }
        }
      }
    }
  };

  if (!isEditing) {
    return (
      <div
        data-cell-id={cellId}
        className={cn(
          "w-full px-1 py-0.5 text-xs rounded min-h-[24px] cursor-default whitespace-pre-wrap break-words",
          isActive ? "ring-2 ring-blue-500 bg-blue-50" : "border border-gray-300 bg-white"
        )}
        onClick={() => setActive(cellId)}
        onDoubleClick={() => { setActive(cellId); setEditing(cellId); }}
      >
        {value || '\u00A0'}
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      data-cell-id={cellId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => setEditing(null)}
      autoFocus
      maxLength={400}
      rows={1}
      className="w-full px-1 py-0.5 text-xs border border-blue-500 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none overflow-hidden bg-white"
      style={{ height: 'auto', minHeight: '24px' }}
    />
  );
};

// Read-only cell component for auto-calculated fields
const ReadOnlyCellInput = ({ value }: { value: string }) => {
  return (
    <div className="w-full px-1 py-0.5 text-xs border border-gray-200 rounded bg-gray-50 text-gray-600 min-h-[24px] flex items-center">
      {value}
    </div>
  );
};

interface SummaryRow {
  id: string;
  tusPosition: string;
  archPosition: string;
  qty: string;
  widthMM: string;
  heightMM: string;
  widthFtIn: string;
  heightFtIn: string;
  sqFeetEach: string;
  sqFeetTotal: string;
  operableSashesEach: string;
  operableSashesTotal: string;
  qty2: string;
  type: string;
  qty3: string;
  type2: string;
  qty4: string;
  type3: string;
  qty5: string;
  type4: string;
  typeSubOption?: string;
  type2SubOption?: string;
  type3SubOption?: string;
  type4SubOption?: string;
  specialRemarks: string;
  fieldsEach: string;
  fieldsTotal: string;
  siteMullionsEach: string;
  siteMullionsTotal: string;
  netEuroEach: string;
  netEuroTotal: string;
  shadeBoxesNoSideTrimUnit: string;
  shadeBoxesNoSideTrimPosition: string;
  shadeBoxesWithSideTrimUnit: string;
  shadeBoxesWithSideTrimPosition: string;
  magneticContactUnit: string;
  magneticContactPosition: string;
  finalFinishUnit: string;
  finalFinishPosition: string;
}

interface DoorRow {
  id: string;
  tusPosition: string;
  archPosition: string;
  qty: string;
  widthMM: string;
  heightMM: string;
  widthFtIn: string;
  heightFtIn: string;
  sqFeetEach: string;
  sqFeetTotal: string;
  operableSashesEach: string;
  operableSashesTotal: string;
  qty2: string;
  type: string;
  qty3: string;
  type2: string;
  qty4: string;
  type3: string;
  qty5: string;
  type4: string;
  typeSubOption?: string;
  type2SubOption?: string;
  type3SubOption?: string;
  type4SubOption?: string;
  specialRemarks: string;
  fieldsEach: string;
  fieldsTotal: string;
  siteMullionsEach: string;
  siteMullionsTotal: string;
  netEuroEach: string;
  netEuroTotal: string;
  shadeBoxesNoSideTrimUnit: string;
  shadeBoxesNoSideTrimPosition: string;
  shadeBoxesWithSideTrimUnit: string;
  shadeBoxesWithSideTrimPosition: string;
  magneticContactUnit: string;
  magneticContactPosition: string;
  finalFinishUnit: string;
  finalFinishPosition: string;
}

interface SummarySubLocation {
  id: string;
  label: string;
  rows: SummaryRow[];
  doorRows: DoorRow[];
  quoteTotals: {
    euroWindows: { full: string; pct: string; final: string; finalAdj: string };
    doubleHung: { full: string; pct: string; final: string; finalAdj: string };
    euroDoors: { full: string; pct: string; final: string; finalAdj: string };
  };
}

interface Summary {
  id: string;
  name: string;
  salesman: string;
  opportunityNumber: string;
  linkedOpportunityId?: string;
  jobType: string;
  estimator: string;
  plansDated: string;
  contactReceivingQuote: string;
  accountReceivingQuote: string;
  accountShippingAddress: string;
  contactPrimaryPhone: string;
  contactEmail: string;
  contactCellPhone: string;
  date: string;
  address: string;
  quoteType: 'first' | 'requote' | '';
  requoteDescription: string;
  rows: SummaryRow[];
  doorRows: DoorRow[];
  hasMultipleLocations?: boolean;
  subLocations?: SummarySubLocation[];
  shadeBoxesNoSideTrim: {
    totalPerUnit: string;
    totalPerPosition: string;
  };
  shadeBoxesWithSideTrim: {
    totalPerUnit: string;
    totalPerPosition: string;
  };
  magneticContact: {
    totalPerUnit: string;
    totalPerPosition: string;
  };
  quoteTotals: {
    euroWindows: { full: string; pct: string; final: string; finalAdj: string };
    doubleHung: { full: string; pct: string; final: string; finalAdj: string };
    euroDoors: { full: string; pct: string; final: string; finalAdj: string };
  };
  grandTotalAdjustment?: { full: string; pct: string; final: string; finalAdj: string };
  addOns: {
    windowScreens: { qty: string; frameType: string; meshType: string; netEuro: string; full: string; pct: string; final: string; calcFull: string; calcDisc: string; calcFinal: string };
    doorScreenSash: { qty: string; woodFrame: string; meshType: string; netEuro: string; full: string; pct: string; final: string; calcFull: string; calcDisc: string; calcFinal: string };
    entryDoor: { qty: string; netEuro: string; full: string; pct: string; final: string; calcFull: string; calcDisc: string; calcFinal: string };
    jambExtensions: { netEuro: string; full: string; pct: string; final: string; calcFull: string; calcDisc: string; calcFinal: string };
    magneticContact: { qty: string; netEuro: string; full: string; pct: string; final: string; calcFull: string; calcDisc: string; calcFinal: string };
    finalFinish: { netEuro: string; full: string; pct: string; final: string; calcFull: string; calcDisc: string; calcFinal: string };
    installation: { netEuro: string; full: string; pct: string; final: string; calcFull: string; calcDisc: string; calcFinal: string };
  };
  product: string;
  productTypeOptions: Record<string, string[]>;
  woodType: string;
  finish: string;
  glassType: string;
  glassTypeCustom: string;
  hungType: string;
  hungTypeCustom: string;
  finials: string;
  hingeFinishSpecification: string;
  woodTypeCustom: string;
  sdl: string;
  sdlCustom: string;
  tdl: string;
  tdlCustom: string;
  spacerBars: string;
  spacerBarType: string;
  spacerBarColors: string;
  projectContains: string[];
  shippingContainers: string;
  shippingCostPerContainer: string;
  shippingCraneCost: string;
  deliveryNotes: string;
  taxAtFull: string;
  taxAtDiscount: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  isFavorite?: boolean;
}

export default function SummaryPage() {
  const { hasAppPermission } = usePermissions();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Column names for navigation
  const columnFields = [
    'tusPosition', 'archPosition', 'qty', 'widthMM', 'heightMM', 'widthFtIn', 'heightFtIn',
    'sqFeetEach', 'sqFeetTotal', 'operableSashesEach', 'operableSashesTotal',
    'qty2', 'type', 'qty3', 'type2', 'qty4', 'type3', 'qty5', 'type4',
    'specialRemarks', 'fieldsEach', 'fieldsTotal', 'siteMullionsEach', 'siteMullionsTotal',
    'netEuroEach', 'netEuroTotal', 'shadeBoxesNoSideTrimUnit', 'shadeBoxesNoSideTrimPosition',
    'shadeBoxesWithSideTrimUnit', 'shadeBoxesWithSideTrimPosition', 'magneticContactUnit', 'magneticContactPosition'
  ];
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewSummary, setShowNewSummary] = useState(false);
  const [editingSummary, setEditingSummary] = useState<Summary | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<'recent' | 'created-by-me' | 'all' | 'favorites'>('all');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showType3, setShowType3] = useState(false);
  const [showType4, setShowType4] = useState(false);
  const [showMagneticContact, setShowMagneticContact] = useState(false);
  const [showShadeBoxesNoTrim, setShowShadeBoxesNoTrim] = useState(false);
  const [showShadeBoxesWithTrim, setShowShadeBoxesWithTrim] = useState(false);
  const [showFinalFinish, setShowFinalFinish] = useState(false);
  const [activePage, setActivePage] = useState<1 | 2>(1);
  const [activeLocationId, setActiveLocationId] = useState<string>('');
  const [expandedQtRows, setExpandedQtRows] = useState<Record<string, boolean>>({});
  // Excel-like cell selection state
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  // Opportunity picker state
  const [showOpportunityPicker, setShowOpportunityPicker] = useState(false);
  const [opportunityRecords, setOpportunityRecords] = useState<any[]>([]);
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive picklist options from the live Opportunity schema
  const schema = useSchemaStore(s => s.schema);
  const oppFields = schema?.objects?.find(o => o.apiName === 'Opportunity')?.fields ?? [];
  const getOppPicklist = (apiName: string): string[] =>
    oppFields.find(f => f.apiName === apiName)?.picklistValues ?? [];

  // Arrow-key navigation when a cell is selected but not in edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCellId || editingCellId) return;
      const dir = e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down'
        : e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : null;
      if (dir) {
        e.preventDefault();
        const el = document.querySelector(`[data-cell-id="${activeCellId}"]`);
        if (!el) return;
        const td = el.closest('td');
        const tr = td?.closest('tr');
        const tbody = tr?.closest('tbody');
        if (!td || !tr || !tbody) return;
        const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
        const cells = Array.from(tr.querySelectorAll(':scope > td'));
        const rowIdx = rows.indexOf(tr as HTMLTableRowElement);
        const colIdx = cells.indexOf(td as HTMLTableCellElement);
        if (dir === 'right') {
          for (let c = colIdx + 1; c < cells.length; c++) {
            const cId = (cells[c] as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
            if (cId) { setActiveCellId(cId); return; }
          }
        } else if (dir === 'left') {
          for (let c = colIdx - 1; c >= 0; c--) {
            const cId = (cells[c] as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
            if (cId) { setActiveCellId(cId); return; }
          }
        } else if (dir === 'down') {
          for (let r = rowIdx + 1; r < rows.length; r++) {
            const targetCells = Array.from((rows[r] as Element).querySelectorAll(':scope > td'));
            if (colIdx < targetCells.length) {
              const cId = (targetCells[colIdx] as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
              if (cId) { setActiveCellId(cId); return; }
            }
          }
        } else if (dir === 'up') {
          for (let r = rowIdx - 1; r >= 0; r--) {
            const targetCells = Array.from((rows[r] as Element).querySelectorAll(':scope > td'));
            if (colIdx < targetCells.length) {
              const cId = (targetCells[colIdx] as Element).querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
              if (cId) { setActiveCellId(cId); return; }
            }
          }
        }
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        setEditingCellId(activeCellId);
      } else if (e.key === 'Escape') {
        setActiveCellId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeCellId, editingCellId]);

  useEffect(() => {
    (async () => {
      // Load summaries from API
      const storedSummaries = await getSetting<any[]>('summaries');
      if (storedSummaries) {
        setSummaries(storedSummaries);
      }
      setLoading(false);
    })();
  }, []);

  // Auto-create summary from opportunity query params
  useEffect(() => {
    if (loading) return;
    const opportunityId = searchParams.get('fromOpportunity');
    if (opportunityId) {
      const opportunityName = searchParams.get('opportunityName') || '';
      const opportunityNumber = searchParams.get('opportunityNumber') || '';
      // Clear query params so refreshing doesn't re-create
      router.replace('/summary');
      // Fetch the opportunity record to pre-populate fields
      (async () => {
        let oppFields: { woodType?: string; woodTypeCustom?: string; finish?: string; glassType?: string; glassTypeCustom?: string; spacerBars?: string; spacerBarType?: string; spacerBarColors?: string; product?: string; plansDated?: string; contactReceivingQuote?: string; accountReceivingQuote?: string; accountShippingAddress?: string; contactPrimaryPhone?: string; contactEmail?: string; contactCellPhone?: string } = {};
        let address = '';
        try {
          const rec = await recordsService.getRecord('Opportunity', opportunityId);
          if (rec) {
            const d: any = (rec as any).data ?? rec;
            const pick = (bare: string) => d[bare] || d[`Opportunity__${bare}`] || '';
            const resolvePicklistLocal = (apiName: string, value: string) => {
              if (!value) return { val: '', custom: '' };
              const options = getOppPicklist(apiName);
              if (!options.length || options.includes(value)) return { val: value, custom: '' };
              return { val: 'Custom Option', custom: value };
            };
            const glassR = resolvePicklistLocal('Opportunity__glassType', pick('glassType'));
            const woodR = resolvePicklistLocal('Opportunity__woodType', pick('woodType'));
            oppFields = {
              woodType: woodR.val,
              woodTypeCustom: woodR.custom,
              finish: pick('finishSpecifications'),
              glassType: glassR.val,
              glassTypeCustom: glassR.custom,
              spacerBars: pick('spacerBars'),
              spacerBarType: pick('spacer_bar_type'),
              spacerBarColors: pick('spacerBarColors'),
              product: pick('productSpecifications'),
              plansDated: pick('plansDated'),
              finials: pick('finials'),
              hingeFinishSpecification: pick('hingeFinishSpecification'),
            };
            const { quoteRecipientContact, architectDesignerAccount } = await resolveTeamMemberFields(opportunityId);
            oppFields.contactReceivingQuote = quoteRecipientContact.name;
            oppFields.accountReceivingQuote = architectDesignerAccount.name;
            oppFields.accountShippingAddress = architectDesignerAccount.shippingAddress;
            oppFields.contactPrimaryPhone = quoteRecipientContact.primaryPhone;
            oppFields.contactEmail = quoteRecipientContact.email;
            oppFields.contactCellPhone = quoteRecipientContact.cellPhone;
            address = await resolveOppPropertyAddress(d);
          }
        } catch { /* non-fatal */ }
        createNewSummary({ opportunityId, opportunityName, opportunityNumber, address, oppFields });
      })();
      return;
    }
    // Auto-open existing summary for editing (from Summary widget on record page)
    const editId = searchParams.get('editSummary');
    if (editId) {
      const found = summaries.find(s => s.id === editId);
      if (found) {
        router.replace('/summary');
        setEditingSummary(found);
        setShowNewSummary(true);
      }
    }
  }, [loading, searchParams]);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const filteredSummaries = summaries.filter(summary => {
    const matchesSearch = 
      summary.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.salesman?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.jobType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.estimator?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const currentUser = 'Development User';
    let matchesSidebar = true;
    
    switch (sidebarFilter) {
      case 'recent':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchesSidebar = new Date(summary.lastModifiedAt) >= thirtyDaysAgo;
        break;
      case 'created-by-me':
        matchesSidebar = summary.createdBy === currentUser;
        break;
      case 'favorites':
        matchesSidebar = summary.isFavorite === true;
        break;
      case 'all':
      default:
        matchesSidebar = true;
        break;
    }
    
    return matchesSearch && matchesSidebar;
  }).sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = (a as any)[sortColumn];
    const bValue = (b as any)[sortColumn];
    
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
    if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
    
    if (sortColumn.includes('At')) {
      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }
    
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr, undefined, { numeric: true })
      : bStr.localeCompare(aStr, undefined, { numeric: true });
  });

  const openOpportunityPicker = async () => {
    setShowOpportunityPicker(true);
    setOpportunitySearch('');
    setLoadingOpportunities(true);
    try {
      const records = await recordsService.getRecords('Opportunity');
      setOpportunityRecords(records.map(r => ({ id: r.id, ...r.data })));
    } catch (err) {
      console.error('Failed to load opportunities:', err);
      setOpportunityRecords([]);
    } finally {
      setLoadingOpportunities(false);
    }
  };

  // Resolve a human-readable address string from an Opportunity record's data.
  // Strategy:
  //   1. Use the Opportunity__propertyAddress TextArea if already populated.
  //   2. Otherwise fetch the linked Property record and format its address object.
  const resolveOppPropertyAddress = async (data: any): Promise<string> => {
    const textAddr = data?.propertyAddress || data?.['Opportunity__propertyAddress'] || '';
    if (textAddr) return textAddr;

    const propertyId = data?.PropertyId || data?.property || data?.['Opportunity__property'] || data?.['Opportunity__PropertyId'] || '';
    if (!propertyId || typeof propertyId !== 'string') return '';

    try {
      const propRec = await recordsService.getRecord('Property', propertyId);
      if (!propRec) return '';
      const d: any = (propRec as any).data ?? propRec;
      // Check LocationSearch field (address_search) first — this is the newer,
      // Google-Maps-backed field that properties use for address entry.
      // Fall back to the legacy Address field (Property__address / address).
      const raw =
        d?.address_search ||
        d?.['Property__address_search'] ||
        // also scan for any __address_search suffixed key
        (() => {
          const k = Object.keys(d || {}).find(k => k.toLowerCase().endsWith('__address_search'));
          return k ? d[k] : null;
        })() ||
        d?.address ||
        d?.['Property__address'];
      const obj: any =
        raw && typeof raw === 'object'
          ? raw
          : typeof raw === 'string'
          ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
          : null;
      if (obj?.street || obj?.city) {
        const street = obj.street || '';
        const cityLine = [obj.city, [obj.state, obj.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        if (street && cityLine) return `${street}, \n${cityLine}`;
        return street || cityLine;
      }
      // Fall back to separate city/state/zip fields on the property record
      const city = d?.city || d?.['Property__city'] || '';
      const state = d?.state || d?.['Property__state'] || '';
      const zip = d?.zipCode || d?.['Property__zipCode'] || '';
      return [city, state, zip].filter(Boolean).join(', ');
    } catch {
      return '';
    }
  };

  const resolveAccountFields = async (rawVal: any): Promise<{ name: string; shippingAddress: string; primaryPhone: string }> => {
    const empty = { name: '', shippingAddress: '', primaryPhone: '' };
    const accountId = rawVal && typeof rawVal === 'object' ? (rawVal.lookup || '') : (typeof rawVal === 'string' ? rawVal : '');
    if (!accountId) return empty;
    try {
      const accRec = await recordsService.getRecord('Account', accountId);
      if (!accRec) return empty;
      const d: any = (accRec as any).data ?? accRec;
      const pick = (bare: string) => d[bare] || d[`Account__${bare}`] || '';
      const rawAddr = pick('shippingAddress');
      let shippingAddress = '';
      if (rawAddr && typeof rawAddr === 'object') {
        const parts = [rawAddr.street, rawAddr.city, rawAddr.state, rawAddr.postalCode].filter(Boolean);
        shippingAddress = parts.join(', ');
      } else if (typeof rawAddr === 'string') {
        try { const obj = JSON.parse(rawAddr); const parts = [obj.street, obj.city, obj.state, obj.postalCode].filter(Boolean); shippingAddress = parts.join(', '); }
        catch { shippingAddress = rawAddr; }
      }
      const name = pick('accountName') || pick('name') || '';
      return { name: typeof name === 'string' ? name : '', shippingAddress, primaryPhone: pick('primaryPhone') || pick('phone') };
    } catch {
      return empty;
    }
  };

  const resolveContactName = async (rawVal: any): Promise<{ name: string; primaryPhone: string; email: string; cellPhone: string }> => {
    const empty = { name: '', primaryPhone: '', email: '', cellPhone: '' };
    const contactId = rawVal && typeof rawVal === 'object' ? (rawVal.lookup || '') : (typeof rawVal === 'string' ? rawVal : '');
    if (!contactId) return empty;
    try {
      const conRec = await recordsService.getRecord('Contact', contactId);
      if (!conRec) return empty;
      const d: any = (conRec as any).data ?? conRec;
      const pick = (bare: string) => d[bare] || d[`Contact__${bare}`] || '';
      const rawName = pick('name');
      let name = '';
      if (rawName && typeof rawName === 'object') {
        const first = rawName['Contact__name_firstName'] || rawName.firstName || '';
        const last = rawName['Contact__name_lastName'] || rawName.lastName || '';
        name = [first, last].filter(Boolean).join(' ');
      } else if (typeof rawName === 'string' && rawName) {
        name = rawName;
      } else {
        // fallback to firstName + lastName fields
        const first = pick('firstName'); const last = pick('lastName');
        name = [first, last].filter(v => v && v !== 'N/A').join(' ');
      }
      return {
        name,
        primaryPhone: pick('primaryPhone'),
        email: pick('primaryEmail'),
        cellPhone: pick('secondaryPhone'),
      };
    } catch {
      return empty;
    }
  };

  // Fetch TeamMember records for an Opportunity and return the Architect/Designer contact
  // and the Quote Recipient account (both from Connection/TeamMember records).
  const resolveTeamMemberFields = async (
    opportunityId: string,
  ): Promise<{
    quoteRecipientContact: { name: string; primaryPhone: string; email: string; cellPhone: string };
    architectDesignerAccount: { name: string; shippingAddress: string; primaryPhone: string };
  }> => {
    const emptyContact = { name: '', primaryPhone: '', email: '', cellPhone: '' };
    const emptyAccount = { name: '', shippingAddress: '', primaryPhone: '' };
    try {
      // Try both field keys that may store the opportunity reference
      const [batch1, batch2] = await Promise.all([
        apiClient.get<any[]>(`/objects/TeamMember/records?filter[opportunity]=${encodeURIComponent(opportunityId)}&limit=200`).catch(() => []),
        apiClient.get<any[]>(`/objects/TeamMember/records?filter[OpportunityId]=${encodeURIComponent(opportunityId)}&limit=200`).catch(() => []),
      ]);
      const all1: any[] = Array.isArray(batch1) ? batch1 : ((batch1 as any)?.records ?? []);
      const all2: any[] = Array.isArray(batch2) ? batch2 : ((batch2 as any)?.records ?? []);
      // Deduplicate by id
      const seen = new Set<string>();
      const rows: any[] = [];
      for (const r of [...all1, ...all2]) {
        const rid = String(r.id ?? '');
        if (rid && !seen.has(rid)) { seen.add(rid); rows.push(r); }
      }

      const getField = (row: any, bare: string) => {
        const d = row.data ?? row;
        return d[bare] || d[`TeamMember__${bare}`] || '';
      };

      // Find Quote Recipient (quoteRecipient checkbox = true) → contact
      const qrRow = rows.find(r => {
        const val = getField(r, 'quoteRecipient');
        return val === true || val === 'true' || val === 1;
      });

      // Find Architect / Designer (role matches) → account
      const adRow = rows.find(r => {
        const role = (getField(r, 'role') || '').toLowerCase();
        return role.includes('architect') || role.includes('designer');
      });

      // Quote Recipient → contact name/phone
      const qrContactId = qrRow ? (getField(qrRow, 'contact') || '') : '';
      const qrContactFields = qrContactId ? await resolveContactName(qrContactId) : emptyContact;

      // Architect / Designer → account name/address
      const adAccountId = adRow ? (getField(adRow, 'account') || '') : '';
      const adAccountFields = adAccountId ? await resolveAccountFields(adAccountId) : emptyAccount;

      return {
        quoteRecipientContact: qrContactFields,
        architectDesignerAccount: adAccountFields,
      };
    } catch {
      return { quoteRecipientContact: emptyContact, architectDesignerAccount: emptyAccount };
    }
  };

  const handleOpportunitySelected = async (record: any) => {
    setShowOpportunityPicker(false);
    // Helper: try both bare key and prefixed key
    const pick = (bare: string) => record[bare] || record[`Opportunity__${bare}`] || '';
    const address = await resolveOppPropertyAddress(record);
    // Detect custom values: if picked value isn't in the picklist, treat as custom
    const resolvePicklist = (apiName: string, value: string): { val: string; custom: string } => {
      if (!value) return { val: '', custom: '' };
      const options = getOppPicklist(apiName);
      if (!options.length || options.includes(value)) return { val: value, custom: '' };
      return { val: 'Custom Option', custom: value };
    };
    const glassResolved = resolvePicklist('Opportunity__glassType', pick('glassType'));
    const woodResolved = resolvePicklist('Opportunity__woodType', pick('woodType'));
    const oppId = record.id as string;
    const { quoteRecipientContact, architectDesignerAccount } = await resolveTeamMemberFields(oppId);
    createNewSummary({
      opportunityId: record.id,
      opportunityName: record.opportunityName || record.Opportunity__opportunityName || '',
      opportunityNumber: record.opportunityNumber || record.Opportunity__opportunityNumber || '',
      address,
      oppFields: {
        woodType: woodResolved.val,
        woodTypeCustom: woodResolved.custom,
        finish: pick('finishSpecifications'),
        glassType: glassResolved.val,
        glassTypeCustom: glassResolved.custom,
        spacerBars: pick('spacerBars'),
        spacerBarType: pick('spacer_bar_type'),
        spacerBarColors: pick('spacerBarColors'),
        product: pick('productSpecifications'),
        plansDated: pick('plansDated'),
        finials: pick('finials'),
        hingeFinishSpecification: pick('hingeFinishSpecification'),
        contactReceivingQuote: quoteRecipientContact.name,
        accountReceivingQuote: architectDesignerAccount.name,
        accountShippingAddress: architectDesignerAccount.shippingAddress,
        contactPrimaryPhone: quoteRecipientContact.primaryPhone,
        contactEmail: quoteRecipientContact.email,
        contactCellPhone: quoteRecipientContact.cellPhone,
      },
    });
  };

  const createNewSummary = (opts?: { opportunityId?: string; opportunityName?: string; opportunityNumber?: string; address?: string; oppFields?: { woodType?: string; woodTypeCustom?: string; finish?: string; glassType?: string; glassTypeCustom?: string; spacerBars?: string; spacerBarType?: string; spacerBarColors?: string; product?: string; plansDated?: string; finials?: string; hingeFinishSpecification?: string; contactReceivingQuote?: string; accountReceivingQuote?: string; accountShippingAddress?: string; contactPrimaryPhone?: string; contactEmail?: string; contactCellPhone?: string } }) => {
    const newSummary: Summary = {
      id: Date.now().toString(),
      name: opts?.opportunityName || '',
      salesman: '',
      opportunityNumber: opts?.opportunityNumber || '',
      linkedOpportunityId: opts?.opportunityId || undefined,
      jobType: '',
      estimator: '',
      date: '',
      address: opts?.address || '',
      quoteType: '',
      requoteDescription: '',
      rows: [{
        id: Date.now().toString(),
        tusPosition: '',
        archPosition: '',
        qty: '',
        widthMM: '',
        heightMM: '',
        widthFtIn: '',
        heightFtIn: '',
        sqFeetEach: '',
        sqFeetTotal: '',
        operableSashesEach: '',
        operableSashesTotal: '',
        qty2: '',
        type: '',
        qty3: '',
        type2: '',
        qty4: '',
        type3: '',
        qty5: '',
        type4: '',
        specialRemarks: '',
        fieldsEach: '',
        fieldsTotal: '',
        siteMullionsEach: '',
        siteMullionsTotal: '',
        netEuroEach: '',
        netEuroTotal: '',
        shadeBoxesNoSideTrimUnit: '',
        shadeBoxesNoSideTrimPosition: '',
        shadeBoxesWithSideTrimUnit: '',
        shadeBoxesWithSideTrimPosition: '',
        magneticContactUnit: '',
        magneticContactPosition: '',
        finalFinishUnit: '',
        finalFinishPosition: ''
      }],
      doorRows: [{
        id: Date.now().toString() + '-door',
        tusPosition: '',
        archPosition: '',
        qty: '',
        widthMM: '',
        heightMM: '',
        widthFtIn: '',
        heightFtIn: '',
        sqFeetEach: '',
        sqFeetTotal: '',
        operableSashesEach: '',
        operableSashesTotal: '',
        qty2: '',
        type: '',
        qty3: '',
        type2: '',
        qty4: '',
        type3: '',
        qty5: '',
        type4: '',
        specialRemarks: '',
        fieldsEach: '',
        fieldsTotal: '',
        siteMullionsEach: '',
        siteMullionsTotal: '',
        netEuroEach: '',
        netEuroTotal: '',
        shadeBoxesNoSideTrimUnit: '',
        shadeBoxesNoSideTrimPosition: '',
        shadeBoxesWithSideTrimUnit: '',
        shadeBoxesWithSideTrimPosition: '',
        magneticContactUnit: '',
        magneticContactPosition: '',
        finalFinishUnit: '',
        finalFinishPosition: ''
      }],
      shadeBoxesNoSideTrim: {
        totalPerUnit: '',
        totalPerPosition: ''
      },
      shadeBoxesWithSideTrim: {
        totalPerUnit: '',
        totalPerPosition: ''
      },
      magneticContact: {
        totalPerUnit: '',
        totalPerPosition: ''
      },
      quoteTotals: {
        euroWindows: { full: '', pct: '', final: '', finalAdj: '' },
        doubleHung: { full: '', pct: '', final: '', finalAdj: '' },
        euroDoors: { full: '', pct: '', final: '', finalAdj: '' },
      },
      addOns: {
        windowScreens: { qty: '', frameType: '', meshType: '', netEuro: '', full: '', pct: '', final: '', calcFull: '', calcDisc: '', calcFinal: '' },
        doorScreenSash: { qty: '', woodFrame: '', meshType: '', netEuro: '', full: '', pct: '', final: '', calcFull: '', calcDisc: '', calcFinal: '' },
        entryDoor: { qty: '', netEuro: '', full: '', pct: '', final: '', calcFull: '', calcDisc: '', calcFinal: '' },
        jambExtensions: { netEuro: '', full: '', pct: '', final: '', calcFull: '', calcDisc: '', calcFinal: '' },
        magneticContact: { qty: '', netEuro: '', full: '', pct: '', final: '', calcFull: '', calcDisc: '', calcFinal: '' },
        finalFinish: { netEuro: '', full: '', pct: '', final: '', calcFull: '', calcDisc: '', calcFinal: '' },
        installation: { netEuro: '', full: '', pct: '', final: '', calcFull: '', calcDisc: '', calcFinal: '' },
      },
      productTypeOptions: {},
      product: opts?.oppFields?.product || '',
      woodType: opts?.oppFields?.woodType || '',
      woodTypeCustom: opts?.oppFields?.woodTypeCustom || '',
      finish: opts?.oppFields?.finish || '',
      glassType: opts?.oppFields?.glassType || '',
      glassTypeCustom: opts?.oppFields?.glassTypeCustom || '',
      hungType: '#34',
      hungTypeCustom: '',
      finials: opts?.oppFields?.finials || '',
      hingeFinishSpecification: opts?.oppFields?.hingeFinishSpecification || '',
      sdl: '',
      sdlCustom: '',
      tdl: '',
      tdlCustom: '',
      spacerBars: opts?.oppFields?.spacerBars || '',
      spacerBarType: opts?.oppFields?.spacerBarType || '',
      spacerBarColors: opts?.oppFields?.spacerBarColors || '',
      plansDated: opts?.oppFields?.plansDated || '',
      contactReceivingQuote: opts?.oppFields?.contactReceivingQuote || '',
      accountReceivingQuote: opts?.oppFields?.accountReceivingQuote || '',
      accountShippingAddress: opts?.oppFields?.accountShippingAddress || '',
      contactPrimaryPhone: opts?.oppFields?.contactPrimaryPhone || '',
      contactEmail: opts?.oppFields?.contactEmail || '',
      contactCellPhone: opts?.oppFields?.contactCellPhone || '',
      projectContains: [],
      shippingContainers: '',
      shippingCostPerContainer: '',
      shippingCraneCost: '',
      deliveryNotes: '',
      taxAtFull: '',
      taxAtDiscount: '',
      createdBy: 'Development User',
      createdAt: new Date().toISOString(),
      lastModifiedBy: 'Development User',
      lastModifiedAt: new Date().toISOString()
    };
    setEditingSummary(newSummary);
    setShowNewSummary(true);
  };

  // ── Build product log items from a summary's rows/doorRows ──
  const buildProductLogItems = (s: Summary) => {
    const pv = (x: string | undefined) => parseFloat(x || '0') || 0;
    const groupRows = (rows: (SummaryRow | DoorRow)[], category: string) => {
      const acc: Record<string, { qty: number; fields: number; sqFeet: number; netEuro: number }> = {};
      for (const row of rows) {
        const r = row as any;
        const parts = [r.type, r.type2, r.type3, r.type4].filter(Boolean);
        const t = parts.length ? parts.join(' w/ ') : '—';
        if (!acc[t]) acc[t] = { qty: 0, fields: 0, sqFeet: 0, netEuro: 0 };
        acc[t].qty += pv(r.qty);
        acc[t].fields += pv(r.fieldsTotal);
        acc[t].sqFeet += pv(r.sqFeetTotal);
        acc[t].netEuro += pv(r.netEuroTotal);
      }
      return Object.entries(acc)
        .filter(([, v]) => v.qty > 0 || v.netEuro > 0)
        .map(([productType, v]) => ({ category, productType, ...v }));
    };
    const allWinRows: SummaryRow[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap(loc => loc.rows || [])
      : (s.rows || []);
    const allDoorRows: DoorRow[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap(loc => loc.doorRows || [])
      : (s.doorRows || []);
    const hungRows = allWinRows.filter(r => r.type?.toLowerCase().includes('hung'));
    const nonHungRows = allWinRows.filter(r => !r.type?.toLowerCase().includes('hung'));
    return [
      ...groupRows(nonHungRows, 'Euro Windows'),
      ...groupRows(hungRows, 'Double Hung'),
      ...groupRows(allDoorRows, 'Euro Doors'),
    ];
  };

  const handleDeleteSummary = (id: string) => {
    if (confirm('Are you sure you want to delete this summary?')) {
      const updatedSummaries = summaries.filter(s => s.id !== id);
      setSummaries(updatedSummaries);
      setSetting('summaries', updatedSummaries);
      // Remove product log entries for this summary
      apiClient.delete(`/product-log/${id}`).catch(() => {});
    }
  };

  const handleToggleFavorite = (id: string) => {
    const updatedSummaries = summaries.map(s => 
      s.id === id ? { ...s, isFavorite: !s.isFavorite } : s
    );
    setSummaries(updatedSummaries);
    setSetting('summaries', updatedSummaries);
    setOpenDropdown(null);
  };

  // ── Generate Quote Letter PDF (server-side via PDFKit) ──
  const handleGenerateQuotePDF = async (mode: 'download' | 'preview' = 'download') => {
    if (!editingSummary) return;
    const summaryId = editingSummary.id;
    if (!summaryId) {
      alert('This summary has no ID — save it before generating a proposal.');
      return;
    }

    // Open preview window synchronously inside the user-gesture handler, so
    // Safari/Firefox/strict Chrome don't block it after the awaits below.
    const previewWindow = mode === 'preview' ? window.open('', '_blank') : null;

    try {
      let template: { id: string };
      try {
        template = await apiClient.get<{ id: string }>('/quote-templates/default');
      } catch {
        previewWindow?.close();
        alert('No default proposal template found. Please create one in Proposal Builder.');
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = apiClient.getToken();
      const response = await fetch(`${apiBase}/proposal-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ summaryId, templateId: template.id }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(detail.error || `Failed to render proposal PDF (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (mode === 'preview' && previewWindow && !previewWindow.closed) {
        previewWindow.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(editingSummary.name || 'Proposal').replace(/[^A-Za-z0-9_-]+/g, '_')}_Quote.pdf`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      previewWindow?.close();
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to generate quote PDF: ${message}`);
    }
  };

  // ── Generate Quote Summary PDF using jsPDF ──
  const handlePrintPDF = async (mode: 'download' | 'preview' = 'download') => {
    if (!editingSummary) return;
    const s = editingSummary;
    // Open preview window NOW, before any awaits, so the popup isn't blocked
    const previewWindow = mode === 'preview' ? window.open('', '_blank') : null;
    const { jsPDF } = await import('jspdf');

    const fmt = (v: number) => v ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const fmtInt = (v: number) => v ? v.toLocaleString('en-US') : '—';
    const pv = (x: string | undefined) => parseFloat(x || '0') || 0;
    const sumField = (rows: any[], field: string) => rows.reduce((acc: number, r: any) => acc + (parseFloat(r[field]) || 0), 0);
    const val = (v: string | undefined | null) => v || '—';
    const dateStr = s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const plansDatedStr = s.plansDated ? new Date(s.plansDated + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';

    // ── Load logo ──
    let logoDataUrl: string | null = null;
    try {
      const res = await fetch('/tces-logo.png');
      const blob = await res.blob();
      logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* logo optional */ }

    // ── Brand colors ──
    const navy = [30, 58, 95] as const;     // #1e3a5f
    const red = [218, 41, 28] as const;      // Tischler red
    const gray50 = [80, 80, 80] as const;
    const gray80 = [128, 128, 128] as const;
    const grayLine = [200, 200, 200] as const;
    const headerBg = [44, 62, 80] as const;
    const altRow = [248, 249, 250] as const;

    // ── Helpers ──
    const drawHeader = (doc: any, title: string) => {
      const w = doc.internal.pageSize.getWidth();
      // Logo (big red T)
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 15, 5, 14, 14);
      }
      const textX = logoDataUrl ? 32 : 15;
      doc.setFontSize(16);
      doc.setTextColor(...navy);
      doc.setFont('helvetica', 'bold');
      doc.text('TISCHLER UND SOHN', textX, 13);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray80);
      doc.text(title, textX, 20);
      doc.text(`${val(s.name)}  |  ${dateStr}`, w - 15, 14, { align: 'right' });
      doc.text(`${val(s.opportunityNumber)}`, w - 15, 20, { align: 'right' });
      doc.setDrawColor(...red);
      doc.setLineWidth(0.6);
      doc.line(15, 23, w - 15, 23);
    };

    const drawFooter = (doc: any) => {
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...gray80);
      doc.text('Tischler und Sohn  |  Confidential', w / 2, h - 6, { align: 'center' });
      const pageCount = doc.getNumberOfPages();
      doc.text(`Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`, w - 15, h - 6, { align: 'right' });
    };

    // Draws a labeled field pair
    const drawField = (doc: any, x: number, y: number, label: string, value: string, maxW = 55) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...gray80);
      doc.text(label.toUpperCase(), x, y);
      doc.setFontSize(8.5);
      doc.setTextColor(30, 30, 30);
      // Split on explicit newlines first, then word-wrap each segment within maxW
      const segments = val(value).split('\n');
      const lines: string[] = segments.flatMap((seg: string) => doc.splitTextToSize(seg, maxW) as string[]);
      doc.text(lines.slice(0, 3), x, y + 4);
    };

    // Draws a table with auto column widths, header row, and data rows
    const drawTable = (
      doc: any, startY: number, headers: string[],
      colWidths: number[], rows: string[][],
      opts?: { rightAlignFrom?: number; boldCol?: number; highlightLast?: boolean; fitOnPage?: boolean; rowColors?: ([number, number, number] | null)[] }
    ) => {
      const x0 = 15;
      let y = startY;
      const baseRh = 4.5; // base row height per line
      const maxY = doc.internal.pageSize.getHeight() - 14;
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      const headerH = 6;

      // Pre-scan all rows: split text per cell, preserving \n line breaks then wrapping
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      const rowLineData: string[][][] = rows.map((row) =>
        row.map((cell, i) => {
          const segments = (cell || '').split('\n');
          const lines: string[] = segments.flatMap((seg) =>
            doc.splitTextToSize(seg, (colWidths[i] || 10) - 3)
          );
          return lines;
        })
      );
      // Each row gets its own height = max lines in any cell of that row * baseRh
      const rowHeights: number[] = rowLineData.map((row) => {
        const maxL = row.reduce((m, lines) => Math.max(m, lines.length), 1);
        return baseRh * maxL;
      });

      // fitOnPage: if the whole table won't fit on remaining page, start a new page first
      if (opts?.fitOnPage) {
        const tableH = headerH + rowHeights.reduce((a, b) => a + b, 0);
        if (y + tableH > maxY) {
          doc.addPage();
          drawHeader(doc, 'Quote Summary — Data Entry (cont.)');
          y = 28;
        }
      }

      // Header row background
      doc.setFillColor(...headerBg);
      doc.rect(x0, y, totalW, headerH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(255, 255, 255);
      let cx = x0;
      for (let i = 0; i < headers.length; i++) {
        const align = (opts?.rightAlignFrom !== undefined && i >= opts.rightAlignFrom) ? 'right' : 'left';
        const tx = align === 'right' ? cx + (colWidths[i] ?? 0) - 1.5 : cx + 1.5;
        doc.text(headers[i], tx, y + 4, { align });
        cx += colWidths[i] ?? 0;
      }
      y += headerH;

      // Data rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      for (let ri = 0; ri < rows.length; ri++) {
        const rh = rowHeights[ri] ?? baseRh;
        if (y + rh > maxY) {
          doc.addPage();
          drawHeader(doc, 'Quote Summary — Data Entry (cont.)');
          // Restore row font after header changes it
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(50, 50, 50);
          y = 28;
        }

        // Per-row color, alternating, or last-row highlight
        const rowColor = opts?.rowColors?.[ri];
        const isLast = opts?.highlightLast && ri === rows.length - 1;
        if (rowColor) {
          doc.setFillColor(...rowColor);
          doc.rect(x0, y, totalW, rh, 'F');
        } else if (isLast) {
          doc.setFillColor(215, 220, 228);
          doc.rect(x0, y, totalW, rh, 'F');
        } else if (ri % 2 === 1) {
          doc.setFillColor(...altRow);
          doc.rect(x0, y, totalW, rh, 'F');
        }
        if (isLast) doc.setFont('helvetica', 'bold');

        doc.setTextColor(50, 50, 50);
        cx = x0;
        for (let i = 0; i < (rowLineData[ri]?.length ?? 0); i++) {
          const isBoldCol = opts?.boldCol !== undefined && i === opts.boldCol;
          if (isBoldCol) doc.setFont('helvetica', 'bold');
          const align = (opts?.rightAlignFrom !== undefined && i >= opts.rightAlignFrom) ? 'right' : 'left';
          const tx = align === 'right' ? cx + (colWidths[i] ?? 0) - 1.5 : cx + 1.5;
          const lines = rowLineData[ri]?.[i] ?? [];
          lines.forEach((line: string, li: number) => {
            doc.text(line, tx, y + 3 + li * baseRh, { align });
          });
          if (isBoldCol) doc.setFont('helvetica', 'normal');
          cx += colWidths[i] ?? 0;
        }
        if (isLast) doc.setFont('helvetica', 'normal');
        y += rh;
      }
      return y;
    };

    // Section heading
    const drawSectionTitle = (doc: any, y: number, title: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...navy);
      doc.text(title, 15, y);
      doc.setDrawColor(...grayLine);
      doc.setLineWidth(0.3);
      const w = doc.internal.pageSize.getWidth();
      doc.line(15, y + 1.5, w - 15, y + 1.5);
      return y + 6;
    };

    // ════════════════════════════════════════════════
    // PAGE 1: Data Entry (landscape)
    // ════════════════════════════════════════════════
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    drawHeader(doc, 'Quote Summary — Data Entry');

    // Info bar
    let y = 28;
    const infoFields = [
      ['Job Name', s.name], ['Salesman', s.salesman], ['Opportunity #', s.opportunityNumber],
      ['Job Type', s.jobType], ['Estimator', s.estimator], ['Date', dateStr],
    ];
    const infoColW = (pw - 30) / 6;
    for (let i = 0; i < infoFields.length; i++) {
      drawField(doc, 15 + i * infoColW, y, infoFields[i][0], infoFields[i][1], infoColW);
    }
    y += 11;

    // Filter non-empty rows
    const filterRows = (rows: any[]) => rows.filter((r: any) =>
      r.tusPosition || r.archPosition || r.qty || r.widthMM || r.heightMM || r.type || r.type2
    );

    // Data table columns (streamlined — 17 core columns)
    const dtHeaders = [
      'TuS Pos', 'Arch Pos', 'Qty', 'W (MM)', 'H (MM)', 'W (Ft/In)', 'H (Ft/In)',
      'Sq Ft Ea', 'Sq Ft Tot', 'Op.Sash Ea', 'Op.Sash Tot',
      'Type', 'Remarks',
      'Fields Tot', 'Site Mull', '\u20AC/Unit', 'NET \u20AC Tot',
    ];
    const dtColW = [12, 40, 9, 12, 12, 12, 11, 12, 12, 11, 11, 30, 18, 13, 13, 14, 14];
    const buildDtRow = (r: any): string[] => [
      r.tusPosition, r.archPosition, r.qty, r.widthMM, r.heightMM,
      r.widthFtIn, r.heightFtIn, r.sqFeetEach, r.sqFeetTotal,
      r.operableSashesEach, r.operableSashesTotal,
      r.type, r.specialRemarks,
      r.fieldsTotal, r.siteMullionsTotal, r.netEuroEach, r.netEuroTotal,
    ].map(v => v || '');

    const buildTotalRow = (rows: any[]): string[] => {
      const tQtyV = sumField(rows, 'qty');
      const tSqFtV = sumField(rows, 'sqFeetTotal');
      const tOpV = sumField(rows, 'operableSashesTotal');
      const tFieldsV = sumField(rows, 'fieldsTotal');
      const tSiteMullV = sumField(rows, 'siteMullionsTotal');
      const tNetV = sumField(rows, 'netEuroTotal');
      const unitV = tQtyV > 0 ? tNetV / tQtyV : 0;
      return [
        'Total', '', tQtyV ? String(tQtyV) : '', '', '', '', '',
        '', tSqFtV ? fmt(tSqFtV) : '', '', tOpV ? String(tOpV) : '',
        '', '',
        tFieldsV ? String(Math.round(tFieldsV)) : '',
        tSiteMullV ? String(Math.round(tSiteMullV)) : '',
        unitV ? '\u20AC' + fmt(unitV) : '',
        tNetV ? '\u20AC' + fmt(tNetV) : '',
      ];
    };

    // Helper: render windows + doors for a given set of rows
    const drawLocationData = (locWinRows: any[], locDoorRows: any[]): { fWinRows: any[]; fDoorRows: any[] } => {
      const fWinRows = filterRows(locWinRows);
      if (fWinRows.length > 0) {
        y = drawSectionTitle(doc, y, 'Windows');
        const wr = fWinRows.map(buildDtRow);
        wr.push(buildTotalRow(fWinRows));
        y = drawTable(doc, y, dtHeaders, dtColW, wr, { rightAlignFrom: 2, highlightLast: true });
        y += 4;
      }
      const fDoorRows = filterRows(locDoorRows);
      if (fDoorRows.length > 0) {
        const maxY2 = doc.internal.pageSize.getHeight() - 20;
        if (y + 20 > maxY2) { doc.addPage(); drawHeader(doc, 'Quote Summary — Data Entry (cont.)'); y = 28; }
        y = drawSectionTitle(doc, y, 'Doors');
        const dr = fDoorRows.map(buildDtRow);
        dr.push(buildTotalRow(fDoorRows));
        y = drawTable(doc, y, dtHeaders, dtColW, dr, { rightAlignFrom: 2, highlightLast: true });
      }
      // Combined Windows + Doors total (shown whenever both tables have data)
      if (fWinRows.length > 0 && fDoorRows.length > 0) {
        y += 2;
        const combinedRow = buildTotalRow([...fWinRows, ...fDoorRows]);
        combinedRow[0] = 'W + D Total';
        y = drawTable(doc, y, dtHeaders, dtColW, [combinedRow], { rightAlignFrom: 2, highlightLast: true });
      }
      return { fWinRows, fDoorRows };
    };

    if (s.hasMultipleLocations && s.subLocations?.length) {
      const allWinRows: any[] = [];
      const allDoorRows: any[] = [];
      for (let li = 0; li < s.subLocations.length; li++) {
        const loc = s.subLocations[li];
        if (!loc) continue;
        if (li > 0) {
          doc.addPage('a4', 'landscape');
          drawHeader(doc, 'Quote Summary — Data Entry');
          y = 28;
          for (let i = 0; i < infoFields.length; i++) {
            drawField(doc, 15 + i * infoColW, y, infoFields[i][0], infoFields[i][1], infoColW);
          }
          y += 11;
        }
        y = drawSectionTitle(doc, y, loc.label || `Location ${li + 1}`);
        const { fWinRows, fDoorRows } = drawLocationData(loc.rows, loc.doorRows);
        allWinRows.push(...fWinRows);
        allDoorRows.push(...fDoorRows);
      }
      // Grand total after last location
      const grandRows = [...allWinRows, ...allDoorRows];
      if (grandRows.length > 0) {
        y += 6;
        y = drawSectionTitle(doc, y, 'Grand Total — All Locations');
        const grandRow = buildTotalRow(grandRows);
        grandRow[0] = 'Grand Total';
        y = drawTable(doc, y, dtHeaders, dtColW, [grandRow], { rightAlignFrom: 2, highlightLast: true });
      }
    } else {
      drawLocationData(s.rows, s.doorRows);
    }

    // ════════════════════════════════════════════════
    // PAGE 2: Project Summary (portrait)
    // ════════════════════════════════════════════════
    doc.addPage('a4', 'portrait');
    const pw2 = doc.internal.pageSize.getWidth();

    drawHeader(doc, 'Quote Summary — Project Summary');
    y = 28;

    // ── Project Overview ──
    y = drawSectionTitle(doc, y, 'Project Overview');
    const col3W = (pw2 - 30) / 3;
    // Normalize flat addresses (old summaries) to two-line format: street,\ncity, state zip
    const fmtAddr = (addr: string) => {
      if (!addr || addr.includes('\n')) return addr;
      const i = addr.indexOf(', ');
      return i === -1 ? addr : addr.substring(0, i + 2) + '\n' + addr.substring(i + 2);
    };
    drawField(doc, 15, y, 'Date', dateStr, col3W);
    drawField(doc, 15 + col3W, y, 'Opportunity #', val(s.opportunityNumber), col3W);
    drawField(doc, 15 + col3W * 2, y, 'Project Name', val(s.name), col3W);
    y += 10;
    drawField(doc, 15, y, 'Address', fmtAddr(val(s.address)), col3W);
    drawField(doc, 15 + col3W, y, 'Salesman', val(s.salesman), col3W);
    drawField(doc, 15 + col3W * 2, y, 'Estimator', val(s.estimator), col3W);
    y += 14;
    drawField(doc, 15, y, 'Quote Type', s.quoteType === 'first' ? 'First Quote' : s.quoteType === 'requote' ? 'Requote' : '—', col3W);
    drawField(doc, 15 + col3W, y, 'Plans Dated', plansDatedStr, col3W);
    if (s.quoteType === 'requote') {
      y += 10;
      drawField(doc, 15, y, 'Description of Changes', val(s.requoteDescription), col3W * 3);
    }
    y += 10;
    drawField(doc, 15, y, 'Contact Receiving Quote', val(s.contactReceivingQuote), col3W);
    drawField(doc, 15 + col3W, y, 'Account', val(s.accountReceivingQuote), col3W);
    y += 10;
    drawField(doc, 15, y, 'Account Shipping Address', fmtAddr(val(s.accountShippingAddress)), col3W);
    drawField(doc, 15 + col3W, y, 'Contact Primary Phone', val(s.contactPrimaryPhone), col3W);
    drawField(doc, 15 + col3W * 2, y, 'Contact Email', val(s.contactEmail), col3W);
    y += 14;
    drawField(doc, 15, y, 'Contact Cell', val(s.contactCellPhone), col3W);
    y += 12;

    // ── Product Specifications ──
    // Only render fields that have actual values — skip blank ones entirely
    y = drawSectionTitle(doc, y, 'Product Specifications');
    const specFields: [string, string][] = [];
    const addSpec = (label: string, value: string | undefined | null) => {
      const v = (value || '').trim();
      if (v) specFields.push([label, v]);
    };
    addSpec('Product', s.product || s.jobType);
    addSpec('Wood Type', s.woodType === 'Custom Option' ? s.woodTypeCustom : s.woodType);
    addSpec('Finish', s.finish);
    const specWinRows: SummaryRow[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap(l => l.rows)
      : (s.rows || []);
    const specHasHung = specWinRows.some(r => r.type?.toLowerCase?.()?.includes('hung'));
    addSpec('Glass Type', s.glassType === 'Custom Option' ? s.glassTypeCustom : s.glassType);
    if (specHasHung) addSpec('Hung Glass Type', s.hungType === 'Custom Option' ? s.hungTypeCustom : s.hungType);
    addSpec('SDL', s.sdl === 'Custom Option' ? s.sdlCustom : s.sdl);
    addSpec('TDL', s.tdl === 'Custom Option' ? s.tdlCustom : s.tdl);
    addSpec('Spacer Bar Type', s.spacerBarType);
    addSpec('Spacer Bar Colors', s.spacerBarColors);
    addSpec('Finials', s.finials);
    addSpec('Hinge Finish Specification', s.hingeFinishSpecification);
    if ((s.projectContains || []).length > 0) addSpec('Project Contains', s.projectContains!.join(', '));
    for (let i = 0; i < specFields.length; i += 3) {
      for (let j = 0; j < 3 && i + j < specFields.length; j++) {
        const [label, value] = specFields[i + j];
        drawField(doc, 15 + col3W * j, y, label, value, col3W);
      }
      y += 12;
    }
    y += 2;

    // ── Product Type Options ──
    const ptoSaved = Array.isArray(s.productTypeOptions) ? {} : ((s.productTypeOptions as Record<string, string[]>) || {});
    const allTypeFields = ['type', 'type2', 'type3', 'type4'] as const;
    const allPdfWindowRows: SummaryRow[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap(l => l.rows)
      : (s.rows || []);
    const allPdfDoorRows: DoorRow[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap(l => l.doorRows)
      : (s.doorRows || []);
    const allRows = [...allPdfWindowRows, ...allPdfDoorRows];
    const subOptFieldMap: Record<string, string> = {
      type: 'typeSubOption', type2: 'type2SubOption',
      type3: 'type3SubOption', type4: 'type4SubOption',
    };
    const uniqueTypesForPdf = Array.from(new Set(
      allRows.flatMap((r: any) => allTypeFields.map(f => {
        const t = r[f];
        if (!t) return null;
        if (t === 'Fixed with Sash' && r[subOptFieldMap[f]!]) return `Fixed with Sash: ${r[subOptFieldMap[f]!]}`;
        return t;
      }).filter(Boolean))
    )) as string[];
    if (uniqueTypesForPdf.length > 0) {
      y = drawSectionTitle(doc, y, 'Product Type Options');
      const ptoColW = [60, pw2 - 30 - 60];
      const ptoHeaders = ['Product Type', 'Selected Options'];
      const ptoRows = uniqueTypesForPdf.map(typeName => {
        const validOpts = new Set(getOptionsForType(typeName));
        const saved = ptoSaved[typeName];
        const selected = Array.isArray(saved) ? saved.filter((o: string) => validOpts.has(o)) : [];
        return [typeName, selected.length > 0 ? selected.join(', ') : '—'];
      });
      y = drawTable(doc, y, ptoHeaders, ptoColW, ptoRows, { boldCol: 0, fitOnPage: true });
      y += 4;
    }

    // ── Delivery Cost ──
    const deliveryContainers = parseFloat(s.shippingContainers) || 0;
    const deliveryCost = parseFloat(s.shippingCostPerContainer) || 0;
    const deliveryCrane = parseFloat(s.shippingCraneCost) || 0;
    if (deliveryContainers || deliveryCost || deliveryCrane) {
      y = drawSectionTitle(doc, y, 'Delivery Cost');
      const deliveryTotal = deliveryContainers * deliveryCost + deliveryCrane;
      drawField(doc, 15, y, '# of Containers', deliveryContainers ? String(deliveryContainers) : '—', col3W);
      drawField(doc, 15 + col3W, y, 'Cost (per container)', deliveryCost ? String(deliveryCost) : '—', col3W);
      drawField(doc, 15 + col3W * 2, y, 'Additional Premium for Containers/Crane Cost', deliveryCrane ? String(deliveryCrane) : '—', col3W);
      y += 10;
      drawField(doc, 15, y, 'Estimated Delivery Cost', `${deliveryTotal}k`, col3W * 2);
      y += 12;
      if (s.deliveryNotes && s.deliveryNotes.trim()) {
        drawField(doc, 15, y, 'Delivery Notes', s.deliveryNotes.trim(), col3W * 3);
        y += 12;
      }
    }

    // ── Tax Cost ──
    if (s.taxAtFull || s.taxAtDiscount) {
      y = drawSectionTitle(doc, y, 'Tax Cost');
      drawField(doc, 15, y, 'Use Tax @ Full', val(s.taxAtFull), col3W);
      drawField(doc, 15 + col3W, y, 'Use Tax @ Discount', val(s.taxAtDiscount), col3W);
      y += 12;
    }

    // ── Quote Totals ──
    y = drawSectionTitle(doc, y, 'Quote Totals');
    const qtHeaders = ['Category', 'Qty', 'Fields', 'Sq Feet', 'NET \u20AC', 'Full', '%', 'FINAL', 'FINAL W/ ADJ'];
    const qtColW = [30, 12, 12, 18, 22, 20, 20, 20, 22];
    const qtRow = (label: string, qty: number, fields: number, sqFt: number, net: number, cat: any): string[] => [
      label, fmtInt(qty), fmtInt(fields), fmt(sqFt),
      net ? '\u20AC' + fmt(net) : '—',
      cat?.full || '—', cat?.pct || '—', cat?.final || '—', cat?.finalAdj || '—',
    ];

    // Tracks grand totals for aggregation across locations
    let grandEwQty = 0, grandEwFields = 0, grandEwSqFt = 0, grandEwNet = 0;
    let grandDhQty = 0, grandDhFields = 0, grandDhSqFt = 0, grandDhNet = 0;
    let grandDQty  = 0, grandDFields  = 0, grandDSqFt  = 0, grandDNet  = 0;
    const grandQt = {
      euroWindows: { full: 0, pct: 0, final: 0, finalAdj: 0 },
      doubleHung:  { full: 0, pct: 0, final: 0, finalAdj: 0 },
      euroDoors:   { full: 0, pct: 0, final: 0, finalAdj: 0 },
    };

    const renderQtTable = (locWinRows: SummaryRow[], locDoorRows: DoorRow[], locQt: any) => {
      const hungR   = locWinRows.filter((r) => r.type?.toLowerCase().includes('hung'));
      const nonHungR = locWinRows.filter((r) => !r.type?.toLowerCase().includes('hung'));
      const ewQ = sumField(nonHungR, 'qty'),  ewF = sumField(nonHungR, 'fieldsTotal');
      const ewS = sumField(nonHungR, 'sqFeetTotal'), ewN = sumField(nonHungR, 'netEuroTotal');
      const dhQ = sumField(hungR, 'qty'),     dhF = sumField(hungR, 'fieldsTotal');
      const dhS = sumField(hungR, 'sqFeetTotal'),  dhN = sumField(hungR, 'netEuroTotal');
      const dQ  = sumField(locDoorRows, 'qty'), dF = sumField(locDoorRows, 'fieldsTotal');
      const dS  = sumField(locDoorRows, 'sqFeetTotal'), dN = sumField(locDoorRows, 'netEuroTotal');
      // accumulate into grand totals
      grandEwQty += ewQ; grandEwFields += ewF; grandEwSqFt += ewS; grandEwNet += ewN;
      grandDhQty += dhQ; grandDhFields += dhF; grandDhSqFt += dhS; grandDhNet += dhN;
      grandDQty  += dQ;  grandDFields  += dF;  grandDSqFt  += dS;  grandDNet  += dN;
      for (const cat of ['euroWindows', 'doubleHung', 'euroDoors'] as const) {
        for (const f of ['full', 'pct', 'final', 'finalAdj'] as const) {
          (grandQt[cat] as any)[f] += pv((locQt as any)?.[cat]?.[f]);
        }
      }
      return [
        qtRow('Euro Windows', ewQ, ewF, ewS, ewN, locQt?.euroWindows),
        qtRow('Double Hung',  dhQ, dhF, dhS, dhN, locQt?.doubleHung),
        qtRow('Euro Doors',   dQ,  dF,  dS,  dN,  locQt?.euroDoors),
      ];
    };

    if (s.hasMultipleLocations && s.subLocations?.length) {
      for (const loc of s.subLocations) {
        // Sub-heading for location name — keep heading + table together
        const locTableH = 6 + 3 * 4.5 + 8; // header + 3 rows + heading estimate
        if (y + locTableH > doc.internal.pageSize.getHeight() - 14) {
          doc.addPage();
          drawHeader(doc, 'Quote Summary — Data Entry (cont.)');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(50, 50, 50);
          y = 28;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...navy);
        doc.text(loc.label || 'Unnamed Location', 15, y);
        y += 4;
        const locQtRows = renderQtTable(loc.rows, loc.doorRows, loc.quoteTotals);
        y = drawTable(doc, y, qtHeaders, qtColW, locQtRows, { rightAlignFrom: 1, boldCol: 0, fitOnPage: true });
        y += 3;
      }
      // Grand Total table — ensure heading + table stay together
      y += 2;
      const gtTableH = 6 + 4 * 4.5 + 8; // heading + header + 4 data rows
      if (y + gtTableH > doc.internal.pageSize.getHeight() - 14) {
        doc.addPage();
        drawHeader(doc, 'Quote Summary — Data Entry (cont.)');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(50, 50, 50);
        y = 28;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...navy);
      doc.text('Grand Total \u2014 All Locations', 15, y);
      y += 4;
      const tQty = grandEwQty + grandDhQty + grandDQty;
      const tFields = grandEwFields + grandDhFields + grandDFields;
      const tSqFt = grandEwSqFt + grandDhSqFt + grandDSqFt;
      const tNet = grandEwNet + grandDhNet + grandDNet;
      // Use top-level s.quoteTotals for Grand Total financial cols — this is what the Grand Total UI table writes to
      const gtQt = s.quoteTotals || { euroWindows: { full: '', pct: '', final: '', finalAdj: '' }, doubleHung: { full: '', pct: '', final: '', finalAdj: '' }, euroDoors: { full: '', pct: '', final: '', finalAdj: '' } };
      function gtQtSum(f: string) { return pv((gtQt.euroWindows as any)?.[f]) + pv((gtQt.doubleHung as any)?.[f]) + pv((gtQt.euroDoors as any)?.[f]); }
      const gta = s.grandTotalAdjustment;
      const grandRows = [
        qtRow('Euro Windows', grandEwQty, grandEwFields, grandEwSqFt, grandEwNet, gtQt.euroWindows),
        qtRow('Double Hung',  grandDhQty, grandDhFields, grandDhSqFt, grandDhNet, gtQt.doubleHung),
        qtRow('Euro Doors',   grandDQty,  grandDFields,  grandDSqFt,  grandDNet,  gtQt.euroDoors),
        qtRow('Total', tQty, tFields, tSqFt, tNet, {
          full: gtQtSum('full') ? fmt(gtQtSum('full')) : '—',
          pct:  gtQtSum('pct')  ? fmt(gtQtSum('pct'))  : '—',
          final: gtQtSum('final') ? fmt(gtQtSum('final')) : '—',
          finalAdj: gtQtSum('finalAdj') ? fmt(gtQtSum('finalAdj')) : '—',
        }),
        ['Final Adj.', '—', '—', '—', '—', gta?.full || '—', gta?.pct || '—', gta?.final || '—', gta?.finalAdj || '—'],
        qtRow('Grand Total', tQty, tFields, tSqFt, tNet, {
          full:     fmt(gtQtSum('full')     + pv(gta?.full)),
          pct:      fmt(gtQtSum('pct')      + pv(gta?.pct)),
          final:    fmt(gtQtSum('final')    + pv(gta?.final)),
          finalAdj: fmt(gtQtSum('finalAdj') + pv(gta?.finalAdj)),
        }),
      ];
      const grandRowColors: ([number,number,number]|null)[] = [null, null, null, [232,235,240], [255,243,205], null];
      y = drawTable(doc, y, qtHeaders, qtColW, grandRows, { rightAlignFrom: 1, boldCol: 0, highlightLast: true, fitOnPage: true, rowColors: grandRowColors });

      // ── Cost Analysis (multi-location) ──
      const maTotSqFt = tSqFt;
      const maTotFull   = gtQtSum('full');
      const maTotPct    = gtQtSum('pct');
      const maTotFinalV = gtQtSum('final');
      const maGtFull  = maTotFull   + pv(gta?.full);
      const maGtPct   = maTotPct    + pv(gta?.pct);
      const maGtFinal = maTotFinalV + pv(gta?.final);
      const maHidden  = maTotFull * 0.56;
      const caFmtN = (v: number) => v ? Math.round(v).toLocaleString('en-US') : '—';
      const caFmtK = (v: number) => v ? Math.round(v).toLocaleString('en-US') + 'K' : '—';
      const maFields: [string, string][] = [
        ['Full by Sq Foot',    maTotSqFt ? caFmtN(maGtFull  / maTotSqFt) : '—'],
        ['%_ by Sq Foot',      maTotSqFt ? caFmtN(maGtPct   / maTotSqFt) : '—'],
        ['Final by Sq Foot',   maTotSqFt ? caFmtN(maGtFinal / maTotSqFt) : '—'],
        ['Hidden Cost',        maHidden  ? caFmtN(maHidden)               : '—'],
        ['Full Contribution',  caFmtK((maTotFull  - maHidden) / 1000)],
        ['%_ Contribution',   caFmtK((maTotPct   - maHidden) / 1000)],
        ['Final Contribution', caFmtK((maTotFinalV - maHidden) / 1000)],
      ];
      if (maTotFull || maTotPct || maTotFinalV) {
        const caNeeded = 10 + Math.ceil(maFields.length / 3) * 12;
        if (y + 4 + caNeeded > doc.internal.pageSize.getHeight() - 14) {
          doc.addPage('a4', 'portrait');
          drawHeader(doc, 'Quote Summary — Project Summary (cont.)');
          y = 28;
        }
        y = drawSectionTitle(doc, y + 4, 'Cost Analysis');
        const caColW = col3W;
        for (let i = 0; i < maFields.length; i += 3) {
          for (let j = 0; j < 3 && i + j < maFields.length; j++) {
            drawField(doc, 15 + caColW * j, y, maFields[i + j]![0], maFields[i + j]![1], caColW);
          }
          y += 12;
        }
      }
    } else {
      const qt = s.quoteTotals || { euroWindows: { full: '', pct: '', final: '', finalAdj: '' }, doubleHung: { full: '', pct: '', final: '', finalAdj: '' }, euroDoors: { full: '', pct: '', final: '', finalAdj: '' } };
      const baseQtRows = renderQtTable(s.rows, s.doorRows, qt);
      const tQty = grandEwQty + grandDhQty + grandDQty;
      const tFields = grandEwFields + grandDhFields + grandDFields;
      const tSqFt = grandEwSqFt + grandDhSqFt + grandDSqFt;
      const tNet = grandEwNet + grandDhNet + grandDNet;
      function qtSum(f: string) { return pv((qt.euroWindows as any)?.[f]) + pv((qt.doubleHung as any)?.[f]) + pv((qt.euroDoors as any)?.[f]); }
      const gta = s.grandTotalAdjustment;
      const totalRow = qtRow('Total', tQty, tFields, tSqFt, tNet, {
        full: qtSum('full') ? fmt(qtSum('full')) : '—', pct: qtSum('pct') ? fmt(qtSum('pct')) : '—',
        final: qtSum('final') ? fmt(qtSum('final')) : '—', finalAdj: qtSum('finalAdj') ? fmt(qtSum('finalAdj')) : '—',
      });
      const finalAdjRow = ['Final Adj.', '—', '—', '—', '—', gta?.full || '—', gta?.pct || '—', gta?.final || '—', gta?.finalAdj || '—'];
      const grandTotalRow = qtRow('Grand Total', tQty, tFields, tSqFt, tNet, {
        full:     fmt(qtSum('full')     + pv(gta?.full)),
        pct:      fmt(qtSum('pct')      + pv(gta?.pct)),
        final:    fmt(qtSum('final')    + pv(gta?.final)),
        finalAdj: fmt(qtSum('finalAdj') + pv(gta?.finalAdj)),
      });
      const singleRowColors: ([number,number,number]|null)[] = [null, null, null, [232,235,240], [255,243,205], null];
      y = drawTable(doc, y, qtHeaders, qtColW, [...baseQtRows, totalRow, finalAdjRow, grandTotalRow], { rightAlignFrom: 1, boldCol: 0, highlightLast: true, fitOnPage: true, rowColors: singleRowColors });

      // ── Cost Analysis (single-location) ──
      const caTotSqFt  = tSqFt;
      const caTotFull   = qtSum('full');
      const caTotPct    = qtSum('pct');
      const caTotFinalV = qtSum('final');
      const caGtFull  = caTotFull   + pv(gta?.full);
      const caGtPct   = caTotPct    + pv(gta?.pct);
      const caGtFinal = caTotFinalV + pv(gta?.final);
      const caHidden   = caTotFull * 0.56;
      const caFmtN2 = (v: number) => v ? Math.round(v).toLocaleString('en-US') : '—';
      const caFmtK2 = (v: number) => v ? Math.round(v).toLocaleString('en-US') + 'K' : '—';
      const caFields: [string, string][] = [
        ['Full by Sq Foot',    caTotSqFt ? caFmtN2(caGtFull  / caTotSqFt) : '—'],
        ['%_ by Sq Foot',      caTotSqFt ? caFmtN2(caGtPct   / caTotSqFt) : '—'],
        ['Final by Sq Foot',   caTotSqFt ? caFmtN2(caGtFinal / caTotSqFt) : '—'],
        ['Hidden Cost',        caHidden  ? caFmtN2(caHidden)               : '—'],
        ['Full Contribution',  caFmtK2((caTotFull  - caHidden) / 1000)],
        ['%_ Contribution',   caFmtK2((caTotPct   - caHidden) / 1000)],
        ['Final Contribution', caFmtK2((caTotFinalV - caHidden) / 1000)],
      ];
      if (caGtFull || caGtPct || caGtFinal) {
        const caNeeded = 10 + Math.ceil(caFields.length / 3) * 12;
        if (y + 4 + caNeeded > doc.internal.pageSize.getHeight() - 14) {
          doc.addPage('a4', 'portrait');
          drawHeader(doc, 'Quote Summary — Project Summary (cont.)');
          y = 28;
        }
        y = drawSectionTitle(doc, y + 4, 'Cost Analysis');
        const caColW = col3W;
        for (let i = 0; i < caFields.length; i += 3) {
          for (let j = 0; j < 3 && i + j < caFields.length; j++) {
            drawField(doc, 15 + caColW * j, y, caFields[i + j]![0], caFields[i + j]![1], caColW);
          }
          y += 12;
        }
      }
    }
    y += 6;

    // ── Add-On Items ──
    const ao = (s.addOns || {}) as any;
    const aoV = (key: string, field: string) => (ao[key] as any)?.[field] || '—';
    const aoHeaders = ['Item', 'Qty', 'Details', 'NET \u20AC', 'Full', '%', 'Final'];
    const aoColW = [30, 12, 45, 22, 20, 12, 22];
    const aoRows = [
      ['Window Screens', aoV('windowScreens', 'qty'), `Frame: ${aoV('windowScreens', 'frameType')} | Mesh: ${aoV('windowScreens', 'meshType')}`, aoV('windowScreens', 'netEuro'), aoV('windowScreens', 'full'), aoV('windowScreens', 'pct'), aoV('windowScreens', 'final')],
      ['Door Screen Sash', aoV('doorScreenSash', 'qty'), `Wood: ${aoV('doorScreenSash', 'woodFrame')} | Mesh: ${aoV('doorScreenSash', 'meshType')}`, aoV('doorScreenSash', 'netEuro'), aoV('doorScreenSash', 'full'), aoV('doorScreenSash', 'pct'), aoV('doorScreenSash', 'final')],
      ['Entry Door', aoV('entryDoor', 'qty'), '—', aoV('entryDoor', 'netEuro'), aoV('entryDoor', 'full'), aoV('entryDoor', 'pct'), aoV('entryDoor', 'final')],
      ['Jamb Extensions', '—', '—', aoV('jambExtensions', 'netEuro'), aoV('jambExtensions', 'full'), aoV('jambExtensions', 'pct'), aoV('jambExtensions', 'final')],
      ['Magnetic Contact', '—', '—', aoV('magneticContact', 'netEuro'), aoV('magneticContact', 'full'), aoV('magneticContact', 'pct'), aoV('magneticContact', 'final')],
      ['Final Finish', '—', '—', aoV('finalFinish', 'netEuro'), aoV('finalFinish', 'full'), aoV('finalFinish', 'pct'), aoV('finalFinish', 'final')],
      ['Installation', '—', '—', aoV('installation', 'netEuro'), aoV('installation', 'full'), aoV('installation', 'pct'), aoV('installation', 'final')],
    ];

    if (y + 50 > doc.internal.pageSize.getHeight() - 14) { doc.addPage('a4', 'portrait'); drawHeader(doc, 'Quote Summary — Project Summary (cont.)'); y = 28; }
    y = drawSectionTitle(doc, y, 'Add-On Items');
    y = drawTable(doc, y, aoHeaders, aoColW, aoRows, { rightAlignFrom: 3, boldCol: 0, fitOnPage: true });

    // ── Add footers to all pages ──
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc);
    }

    if (mode === 'preview') {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } else {
      doc.save(`Quote_Summary_${(s.name || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    }
  };

  const handleSaveSummary = () => {
    if (!editingSummary) return;
    
    // Validate required fields
    const requiredFields = [
      { field: 'name', label: 'Job Name' },
      { field: 'salesman', label: 'Salesman' },
      { field: 'opportunityNumber', label: 'Opportunity #' },
      { field: 'jobType', label: 'Job Type' },
      { field: 'estimator', label: 'Estimator' },
      { field: 'date', label: 'Date' }
    ];
    
    const missingFields = requiredFields.filter(({ field }) => !editingSummary[field as keyof Summary]);
    
    if (missingFields.length > 0) {
      alert(`Please fill in the following required fields:\n${missingFields.map(f => f.label).join('\n')}`);
      return;
    }
    
    const isNew = !summaries.find(s => s.id === editingSummary.id);
    let updatedSummaries;
    
    if (isNew) {
      updatedSummaries = [editingSummary, ...summaries];
    } else {
      updatedSummaries = summaries.map(s => 
        s.id === editingSummary.id ? editingSummary : s
      );
    }
    
    setSummaries(updatedSummaries);
    setSetting('summaries', updatedSummaries);
    // Sync product log
    const logItems = buildProductLogItems(editingSummary);
    apiClient.post('/product-log/sync', {
      summaryId: editingSummary.id,
      summaryName: editingSummary.name || '',
      opportunityNumber: editingSummary.opportunityNumber || '',
      linkedOpportunityId: editingSummary.linkedOpportunityId || null,
      date: editingSummary.date || undefined,
      items: logItems,
    }).catch(() => {});
    const oppId = editingSummary.linkedOpportunityId;
    setShowNewSummary(false);
    setEditingSummary(null);
    if (oppId) {
      router.push(`/opportunities/${oppId}`);
    }
  };

  const defaultQuoteTotals = () => ({
    euroWindows: { full: '', pct: '', final: '', finalAdj: '' },
    doubleHung: { full: '', pct: '', final: '', finalAdj: '' },
    euroDoors: { full: '', pct: '', final: '', finalAdj: '' },
  });

  const getActiveLocId = (s: Summary) =>
    s.hasMultipleLocations && s.subLocations?.length
      ? (activeLocationId || s.subLocations[0]!.id)
      : '';

  const getActiveRows = (s: Summary): SummaryRow[] => {
    if (s.hasMultipleLocations && s.subLocations?.length) {
      const locId = getActiveLocId(s);
      return s.subLocations.find(l => l.id === locId)?.rows ?? [];
    }
    return s.rows;
  };

  const getActiveDoorRows = (s: Summary): DoorRow[] => {
    if (s.hasMultipleLocations && s.subLocations?.length) {
      const locId = getActiveLocId(s);
      return s.subLocations.find(l => l.id === locId)?.doorRows ?? [];
    }
    return s.doorRows;
  };

  const mutateRows = (s: Summary, fn: (rows: SummaryRow[]) => SummaryRow[]): Summary => {
    if (s.hasMultipleLocations && s.subLocations?.length) {
      const locId = getActiveLocId(s);
      return { ...s, subLocations: s.subLocations.map(l => l.id === locId ? { ...l, rows: fn(l.rows) } : l) };
    }
    return { ...s, rows: fn(s.rows) };
  };

  const mutateDoorRows = (s: Summary, fn: (rows: DoorRow[]) => DoorRow[]): Summary => {
    if (s.hasMultipleLocations && s.subLocations?.length) {
      const locId = getActiveLocId(s);
      return { ...s, subLocations: s.subLocations.map(l => l.id === locId ? { ...l, doorRows: fn(l.doorRows) } : l) };
    }
    return { ...s, doorRows: fn(s.doorRows) };
  };

  const handleAddRow = () => {
    if (!editingSummary) return;
    
    const newRow: SummaryRow = {
      id: Date.now().toString(),
      tusPosition: '',
      archPosition: '',
      qty: '',
      widthMM: '',
      heightMM: '',
      widthFtIn: '',
      heightFtIn: '',
      sqFeetEach: '',
      sqFeetTotal: '',
      operableSashesEach: '',
      operableSashesTotal: '',
      qty2: '',
      type: '',
      qty3: '',
      type2: '',
      qty4: '',
      type3: '',
      qty5: '',
      type4: '',
      specialRemarks: '',
      fieldsEach: '',
      fieldsTotal: '',
      siteMullionsEach: '',
      siteMullionsTotal: '',
      netEuroEach: '',
      netEuroTotal: '',
      shadeBoxesNoSideTrimUnit: '',
      shadeBoxesNoSideTrimPosition: '',
      shadeBoxesWithSideTrimUnit: '',
      shadeBoxesWithSideTrimPosition: '',
      magneticContactUnit: '',
      magneticContactPosition: '',
      finalFinishUnit: '',
      finalFinishPosition: ''
    };
    
    setEditingSummary(mutateRows(editingSummary, rows => [...rows, newRow]));
  };

  const handleAddRowBelow = (rowId: string) => {
    if (!editingSummary) return;
    
    const newRow: SummaryRow = {
      id: Date.now().toString(),
      tusPosition: '',
      archPosition: '',
      qty: '',
      widthMM: '',
      heightMM: '',
      widthFtIn: '',
      heightFtIn: '',
      sqFeetEach: '',
      sqFeetTotal: '',
      operableSashesEach: '',
      operableSashesTotal: '',
      qty2: '',
      type: '',
      qty3: '',
      type2: '',
      qty4: '',
      type3: '',
      qty5: '',
      type4: '',
      specialRemarks: '',
      fieldsEach: '',
      fieldsTotal: '',
      siteMullionsEach: '',
      siteMullionsTotal: '',
      netEuroEach: '',
      netEuroTotal: '',
      shadeBoxesNoSideTrimUnit: '',
      shadeBoxesNoSideTrimPosition: '',
      shadeBoxesWithSideTrimUnit: '',
      shadeBoxesWithSideTrimPosition: '',
      magneticContactUnit: '',
      magneticContactPosition: '',
      finalFinishUnit: '',
      finalFinishPosition: ''
    };
    
    setEditingSummary(mutateRows(editingSummary, rows => {
      const idx = rows.findIndex(r => r.id === rowId);
      const next = [...rows];
      next.splice(idx + 1, 0, newRow);
      return next;
    }));
  };

  const handleDeleteRow = (rowId: string) => {
    if (!editingSummary) return;
    
    setEditingSummary(mutateRows(editingSummary, rows => rows.filter(r => r.id !== rowId)));
  };

  const updateRow = (rowId: string, field: keyof SummaryRow, value: string) => {
    if (!editingSummary) return;
    
    setEditingSummary(mutateRows(editingSummary, rows => rows.map(r => {
        if (r.id !== rowId) return r;
        
        const updatedRow = { ...r, [field]: value };
        
        // Auto-calculate Width (Ft & In) when Width (MM) changes
        if (field === 'widthMM') {
          updatedRow.widthFtIn = mmToFeetInches(value);
          // Recalculate Sq Feet (Each) with new width
          const widthFt = feetInchesToDecimalFeet(updatedRow.widthFtIn);
          const heightFt = feetInchesToDecimalFeet(updatedRow.heightFtIn);
          updatedRow.sqFeetEach = widthFt && heightFt ? (widthFt * heightFt).toFixed(2) : '';
          // Recalculate Sq Feet (Total) with new sqFeetEach
          const sqFeetEach = parseFloat(updatedRow.sqFeetEach);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.sqFeetTotal = sqFeetEach && qty ? (sqFeetEach * qty).toFixed(2) : '';
          
          // Auto-calculate Shade Boxes with No Trim
          const widthMM = parseFloat(value);
          const heightMM = parseFloat(updatedRow.heightMM) || 0;
          if (widthMM) {
            // Constants
            const BE = 100;
            const BF = 0;
            
            // BG: =ROUNDUP(IF(ROUNDUP(E6,-2)<1000,1000/1000*BE6,ROUNDUP(E6,-2)/1000*BE6),0)
            const roundedWidth = Math.ceil(widthMM / 100) * 100;
            const bgCalc = roundedWidth < 1000 ? (1000 * BE / 1000) : (roundedWidth * BE / 1000);
            const bg = Math.ceil(bgCalc);
            
            // BH: =ROUNDUP(IF(ROUNDUP(F6,-2)<1000,1000/1000*BF6,ROUNDUP(F6,-2)/1000*BF6),0)
            const roundedHeight = Math.ceil((heightMM || 0) / 100) * 100;
            const bhCalc = roundedHeight < 1000 ? (1000 / 1000 * BF) : (roundedHeight / 1000 * BF);
            const bh = Math.ceil(bhCalc); // Always 0 since BF=0
            
            // BI: =IF(E6<1000,3,ROUND((E6-2*50)/335,0))
            const bi = widthMM < 1000 ? 3 : Math.round((widthMM - 2 * 50) / 335);
            
            // BJ: =(3+8)*BI6
            const bj = 11 * bi;
            
            // BK: =IF(E6<=1000,72,IF(AND(E6>1000,E6<=2000),102,IF(E6>2000,132)))
            const bk = widthMM <= 1000 ? 72 : (widthMM <= 2000 ? 102 : 132);
            // Final: =ROUNDUP(SUM(BG6+BH6+BJ6+BK6)*1.362161,0)
            updatedRow.shadeBoxesNoSideTrimUnit = Math.ceil((bg + bh + bj + bk) * 1.362161).toString();
            
            // Calculate Per Position
            updatedRow.shadeBoxesNoSideTrimPosition = qty ? 
              Math.ceil(parseFloat(updatedRow.shadeBoxesNoSideTrimUnit) * qty).toString() : '';
          
            // Auto-calculate Shade Boxes with Trim (based on width and height)
            const roundedWidthTrim = Math.ceil(widthMM / 100) * 100;
            const brCalc = roundedWidthTrim < 1000 ? (1000 * 100 / 1000) : (roundedWidthTrim * 100 / 1000);
            const br = Math.ceil(brCalc);
            const roundedHeightTrim = Math.ceil(heightMM / 100) * 100;
            const bsCalc = roundedHeightTrim < 1000 ? (1000 * 260 / 1000) : (roundedHeightTrim * 260 / 1000);
            const bs = Math.ceil(bsCalc);
            const bt = widthMM < 1000 ? 3 : Math.round((widthMM - 2 * 50) / 335);
            const bu = 11 * bt;
            const bv = widthMM <= 1000 ? 132 : (widthMM <= 2000 ? 162 : 192);
            updatedRow.shadeBoxesWithSideTrimUnit = Math.ceil((br + bs + bu + bv) * 1.362161).toString();
            updatedRow.shadeBoxesWithSideTrimPosition = qty ? Math.ceil(parseFloat(updatedRow.shadeBoxesWithSideTrimUnit) * qty).toString() : '';
          
            // Calculate Final Finish: (SqFt * 0.092903) * 50
            const sqFeetEachCalc = parseFloat(updatedRow.sqFeetEach);
            if (sqFeetEachCalc) {
              const finalFinishUnit = (sqFeetEachCalc * 0.092903) * 50;
              updatedRow.finalFinishUnit = Math.round(finalFinishUnit).toString();
              updatedRow.finalFinishPosition = qty ? Math.round(finalFinishUnit * qty).toString() : '';
            } else {
              updatedRow.finalFinishUnit = '';
              updatedRow.finalFinishPosition = '';
            }
          } else {
            updatedRow.shadeBoxesNoSideTrimUnit = '';
            updatedRow.shadeBoxesNoSideTrimPosition = '';
            updatedRow.shadeBoxesWithSideTrimUnit = '';
            updatedRow.shadeBoxesWithSideTrimPosition = '';
            updatedRow.finalFinishUnit = '';
            updatedRow.finalFinishPosition = '';
          }
        }
        // Auto-calculate Height (Ft & In) when Height (MM) changes
        if (field === 'heightMM') {
          updatedRow.heightFtIn = mmToFeetInches(value);
          // Recalculate Sq Feet (Each) with new height
          const widthFt = feetInchesToDecimalFeet(updatedRow.widthFtIn);
          const heightFt = feetInchesToDecimalFeet(updatedRow.heightFtIn);
          updatedRow.sqFeetEach = widthFt && heightFt ? (widthFt * heightFt).toFixed(2) : '';
          // Recalculate Sq Feet (Total) with new sqFeetEach
          const sqFeetEach = parseFloat(updatedRow.sqFeetEach);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.sqFeetTotal = sqFeetEach && qty ? (sqFeetEach * qty).toFixed(2) : '';
          
          // Recalculate Shade Boxes with Trim when height changes
          const heightMM = parseFloat(value);
          const widthMM = parseFloat(updatedRow.widthMM);
          if (widthMM && heightMM) {
            const roundedWidthTrim = Math.ceil(widthMM / 100) * 100;
            const brCalc = roundedWidthTrim < 1000 ? (1000 * 100 / 1000) : (roundedWidthTrim * 100 / 1000);
            const br = Math.ceil(brCalc);
            const roundedHeightTrim = Math.ceil(heightMM / 100) * 100;
            const bsCalc = roundedHeightTrim < 1000 ? (1000 * 260 / 1000) : (roundedHeightTrim * 260 / 1000);
            const bs = Math.ceil(bsCalc);
            const bt = widthMM < 1000 ? 3 : Math.round((widthMM - 2 * 50) / 335);
            const bu = 11 * bt;
            const bv = widthMM <= 1000 ? 132 : (widthMM <= 2000 ? 162 : 192);
            updatedRow.shadeBoxesWithSideTrimUnit = Math.ceil((br + bs + bu + bv) * 1.362161).toString();
            updatedRow.shadeBoxesWithSideTrimPosition = qty ? Math.ceil(parseFloat(updatedRow.shadeBoxesWithSideTrimUnit) * qty).toString() : '';
          
            // Calculate Final Finish: (SqFt * 0.092903) * 50
            const sqFeetEachCalc = parseFloat(updatedRow.sqFeetEach);
            if (sqFeetEachCalc) {
              const finalFinishUnit = (sqFeetEachCalc * 0.092903) * 50;
              updatedRow.finalFinishUnit = Math.round(finalFinishUnit).toString();
              updatedRow.finalFinishPosition = qty ? Math.round(finalFinishUnit * qty).toString() : '';
            }
          }
        }
        
        // Auto-calculate Sq Feet (Total) when Qty changes
        if (field === 'qty') {
          const sqFeetEach = parseFloat(updatedRow.sqFeetEach);
          const qty = parseFloat(value);
          updatedRow.sqFeetTotal = sqFeetEach && qty ? (sqFeetEach * qty).toFixed(2) : '';
          // Also calculate Operable Sashes (Total) - whole number
          const operableSashesEach = parseFloat(updatedRow.operableSashesEach);
          updatedRow.operableSashesTotal = operableSashesEach && qty ? Math.round(operableSashesEach * qty).toString() : '';
          // Also calculate Fields (Total) - whole number
          const fieldsEach = parseFloat(updatedRow.fieldsEach);
          updatedRow.fieldsTotal = fieldsEach && qty ? Math.round(fieldsEach * qty).toString() : '';
          // Also calculate Site Mullions (Total) - whole number
          const siteMullionsEach = parseFloat(updatedRow.siteMullionsEach);
          updatedRow.siteMullionsTotal = siteMullionsEach && qty ? Math.round(siteMullionsEach * qty).toString() : '';
          // Also calculate Net € (Total) - currency format
          const netEuroEach = parseFloat(updatedRow.netEuroEach);
          updatedRow.netEuroTotal = netEuroEach && qty ? (netEuroEach * qty).toFixed(2) : '';
          // Also calculate Magnetic Contact Per Position
          const magneticContactUnit = parseFloat(updatedRow.magneticContactUnit);
          updatedRow.magneticContactPosition = magneticContactUnit && qty ? Math.round(magneticContactUnit * qty).toString() : '';
          // Also calculate Shade Boxes with No Trim Per Position
          const shadeBoxesNoSideTrimUnit = parseFloat(updatedRow.shadeBoxesNoSideTrimUnit);
          updatedRow.shadeBoxesNoSideTrimPosition = shadeBoxesNoSideTrimUnit && qty ?
            Math.ceil(shadeBoxesNoSideTrimUnit * qty).toString() : '';
          // Also calculate Shade Boxes with Trim Per Position
          const shadeBoxesWithSideTrimUnit = parseFloat(updatedRow.shadeBoxesWithSideTrimUnit);
          updatedRow.shadeBoxesWithSideTrimPosition = shadeBoxesWithSideTrimUnit && qty ?
            Math.ceil(shadeBoxesWithSideTrimUnit * qty).toString() : '';
        // Also calculate Final Finish Per Position
          const finalFinishUnit = parseFloat(updatedRow.finalFinishUnit);
          updatedRow.finalFinishPosition = finalFinishUnit && qty ? Math.round(finalFinishUnit * qty).toString() : '';
        }
        
        // Auto-calculate Operable Sashes (Total) when Operable Sashes (Each) changes - whole number
        if (field === 'operableSashesEach') {
          const operableSashesEach = parseFloat(value);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.operableSashesTotal = operableSashesEach && qty ? Math.round(operableSashesEach * qty).toString() : '';
          
          // Auto-calculate Magnetic Contact Per Unit
          const isLiftAndRoll = [
            updatedRow.type,
            updatedRow.type2,
            updatedRow.type3,
            updatedRow.type4
          ].some(t => t === 'Lift and Roll Window' || t === 'L&R D');
          
          updatedRow.magneticContactUnit = operableSashesEach ?
            (operableSashesEach * (isLiftAndRoll ? 96 : 40)).toString() : '';
          
          // Also calculate Magnetic Contact Per Position
          const magneticContactUnit = parseFloat(updatedRow.magneticContactUnit);
          updatedRow.magneticContactPosition = magneticContactUnit && qty ? Math.round(magneticContactUnit * qty).toString() : '';
        }
        
        // Auto-calculate Fields (Total) when Fields (Each) changes - whole number
        if (field === 'fieldsEach') {
          const fieldsEach = parseFloat(value);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.fieldsTotal = fieldsEach && qty ? Math.round(fieldsEach * qty).toString() : '';
        }
        
        // Auto-calculate Net € (Total) when Net € (Each) changes - currency format
        if (field === 'netEuroEach') {
          const netEuroEach = parseFloat(value);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.netEuroTotal = netEuroEach && qty ? (netEuroEach * qty).toFixed(2) : '';
        }
        
        // Auto-calculate Site Mullions (Total) when Site Mullions (Each) changes - whole number
        if (field === 'siteMullionsEach') {
          const siteMullionsEach = parseFloat(value);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.siteMullionsTotal = siteMullionsEach && qty ? Math.round(siteMullionsEach * qty).toString() : '';
        }
        
        // Auto-calculate Magnetic Contact Per Unit when any Type field changes
        if (field === 'type' || field === 'type2' || field === 'type3' || field === 'type4') {
          const isLiftAndRoll = [
            updatedRow.type,
            updatedRow.type2,
            updatedRow.type3,
            updatedRow.type4
          ].some(t => t === 'Lift and Roll Window' || t === 'L&R D');
          
          const operableSashesEach = parseFloat(updatedRow.operableSashesEach);
          updatedRow.magneticContactUnit = operableSashesEach ? 
            (operableSashesEach * (isLiftAndRoll ? 96 : 40)).toString() : '';
        }
        
        return updatedRow;
      })));
  };

  // Doors handlers
  const handleAddDoorRow = () => {
    if (!editingSummary) return;
    
    const newRow: DoorRow = {
      id: Date.now().toString() + '-door',
      tusPosition: '',
      archPosition: '',
      qty: '',
      widthMM: '',
      heightMM: '',
      widthFtIn: '',
      heightFtIn: '',
      sqFeetEach: '',
      sqFeetTotal: '',
      operableSashesEach: '',
      operableSashesTotal: '',
      qty2: '',
      type: '',
      qty3: '',
      type2: '',
      qty4: '',
      type3: '',
      qty5: '',
      type4: '',
      specialRemarks: '',
      fieldsEach: '',
      fieldsTotal: '',
      siteMullionsEach: '',
      siteMullionsTotal: '',
      netEuroEach: '',
      netEuroTotal: '',
      shadeBoxesNoSideTrimUnit: '',
      shadeBoxesNoSideTrimPosition: '',
      shadeBoxesWithSideTrimUnit: '',
      shadeBoxesWithSideTrimPosition: '',
      magneticContactUnit: '',
      magneticContactPosition: '',
      finalFinishUnit: '',
      finalFinishPosition: ''
    };
    
    setEditingSummary(mutateDoorRows(editingSummary, rows => [...rows, newRow]));
  };

  const handleAddDoorRowBelow = (rowId: string) => {
    if (!editingSummary) return;
    
    const newRow: DoorRow = {
      id: Date.now().toString() + '-door',
      tusPosition: '',
      archPosition: '',
      qty: '',
      widthMM: '',
      heightMM: '',
      widthFtIn: '',
      heightFtIn: '',
      sqFeetEach: '',
      sqFeetTotal: '',
      operableSashesEach: '',
      operableSashesTotal: '',
      qty2: '',
      type: '',
      qty3: '',
      type2: '',
      qty4: '',
      type3: '',
      qty5: '',
      type4: '',
      specialRemarks: '',
      fieldsEach: '',
      fieldsTotal: '',
      siteMullionsEach: '',
      siteMullionsTotal: '',
      netEuroEach: '',
      netEuroTotal: '',
      shadeBoxesNoSideTrimUnit: '',
      shadeBoxesNoSideTrimPosition: '',
      shadeBoxesWithSideTrimUnit: '',
      shadeBoxesWithSideTrimPosition: '',
      magneticContactUnit: '',
      magneticContactPosition: '',
      finalFinishUnit: '',
      finalFinishPosition: ''
    };
    
    setEditingSummary(mutateDoorRows(editingSummary, rows => {
      const idx = rows.findIndex(r => r.id === rowId);
      const next = [...rows];
      next.splice(idx + 1, 0, newRow);
      return next;
    }));
  };

  const handleDeleteDoorRow = (rowId: string) => {
    if (!editingSummary) return;
    
    setEditingSummary(mutateDoorRows(editingSummary, rows => rows.filter(r => r.id !== rowId)));
  };

  const updateDoorRow = (rowId: string, field: keyof DoorRow, value: string) => {
    if (!editingSummary) return;
    
    setEditingSummary(mutateDoorRows(editingSummary, rows => rows.map(r => {
        if (r.id !== rowId) return r;
        
        const updatedRow = { ...r, [field]: value };
        
        // Auto-calculate Width (Ft & In) when Width (MM) changes
        if (field === 'widthMM') {
          updatedRow.widthFtIn = mmToFeetInches(value);
          // Recalculate Sq Feet (Each) with new width
          const widthFt = feetInchesToDecimalFeet(updatedRow.widthFtIn);
          const heightFt = feetInchesToDecimalFeet(updatedRow.heightFtIn);
          updatedRow.sqFeetEach = widthFt && heightFt ? (widthFt * heightFt).toFixed(2) : '';
          // Recalculate Sq Feet (Total) with new sqFeetEach
          const sqFeetEach = parseFloat(updatedRow.sqFeetEach);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.sqFeetTotal = sqFeetEach && qty ? (sqFeetEach * qty).toFixed(2) : '';
          
          // Auto-calculate Shade Boxes with No Trim
          const widthMM = parseFloat(value);
          const heightMM = parseFloat(updatedRow.heightMM) || 0;
          if (widthMM) {
            // Constants
            const BE = 100;
            const BF = 0;
            
            // BG: =ROUNDUP(IF(ROUNDUP(E6,-2)<1000,1000/1000*BE6,ROUNDUP(E6,-2)/1000*BE6),0)
            const roundedWidth = Math.ceil(widthMM / 100) * 100;
            const bgCalc = roundedWidth < 1000 ? (1000 * BE / 1000) : (roundedWidth * BE / 1000);
            const bg = Math.ceil(bgCalc);
            
            // BH: =ROUNDUP(IF(ROUNDUP(F6,-2)<1000,1000/1000*BF6,ROUNDUP(F6,-2)/1000*BF6),0)
            const roundedHeight = Math.ceil((heightMM || 0) / 100) * 100;
            const bhCalc = roundedHeight < 1000 ? (1000 / 1000 * BF) : (roundedHeight / 1000 * BF);
            const bh = Math.ceil(bhCalc); // Always 0 since BF=0
            
            // BI: =IF(E6<1000,3,ROUND((E6-2*50)/335,0))
            const bi = widthMM < 1000 ? 3 : Math.round((widthMM - 2 * 50) / 335);
            
            // BJ: =(3+8)*BI6
            const bj = 11 * bi;
            
            // BK: =IF(E6<=1000,72,IF(AND(E6>1000,E6<=2000),102,IF(E6>2000,132)))
            const bk = widthMM <= 1000 ? 72 : (widthMM <= 2000 ? 102 : 132);
            // Final: =ROUNDUP(SUM(BG6+BH6+BJ6+BK6)*1.362161,0)
            updatedRow.shadeBoxesNoSideTrimUnit = Math.ceil((bg + bh + bj + bk) * 1.362161).toString();
            
            // Calculate Per Position
            updatedRow.shadeBoxesNoSideTrimPosition = qty ? 
              Math.ceil(parseFloat(updatedRow.shadeBoxesNoSideTrimUnit) * qty).toString() : '';
          
            // Auto-calculate Shade Boxes with Trim (based on width and height)
            const roundedWidthTrim = Math.ceil(widthMM / 100) * 100;
            const brCalc = roundedWidthTrim < 1000 ? (1000 * 100 / 1000) : (roundedWidthTrim * 100 / 1000);
            const br = Math.ceil(brCalc);
            const roundedHeightTrim = Math.ceil(heightMM / 100) * 100;
            const bsCalc = roundedHeightTrim < 1000 ? (1000 * 260 / 1000) : (roundedHeightTrim * 260 / 1000);
            const bs = Math.ceil(bsCalc);
            const bt = widthMM < 1000 ? 3 : Math.round((widthMM - 2 * 50) / 335);
            const bu = 11 * bt;
            const bv = widthMM <= 1000 ? 132 : (widthMM <= 2000 ? 162 : 192);
            updatedRow.shadeBoxesWithSideTrimUnit = Math.ceil((br + bs + bu + bv) * 1.362161).toString();
            updatedRow.shadeBoxesWithSideTrimPosition = qty ? Math.ceil(parseFloat(updatedRow.shadeBoxesWithSideTrimUnit) * qty).toString() : '';
          
            // Calculate Final Finish: (SqFt * 0.092903) * 50
            const sqFeetEachCalc = parseFloat(updatedRow.sqFeetEach);
            if (sqFeetEachCalc) {
              const finalFinishUnit = (sqFeetEachCalc * 0.092903) * 50;
              updatedRow.finalFinishUnit = Math.round(finalFinishUnit).toString();
              updatedRow.finalFinishPosition = qty ? Math.round(finalFinishUnit * qty).toString() : '';
            } else {
              updatedRow.finalFinishUnit = '';
              updatedRow.finalFinishPosition = '';
            }
          } else {
            updatedRow.shadeBoxesNoSideTrimUnit = '';
            updatedRow.shadeBoxesNoSideTrimPosition = '';
            updatedRow.shadeBoxesWithSideTrimUnit = '';
            updatedRow.shadeBoxesWithSideTrimPosition = '';
          }
        }
        // Auto-calculate Height (Ft & In) when Height (MM) changes
        if (field === 'heightMM') {
          updatedRow.heightFtIn = mmToFeetInches(value);
          // Recalculate Sq Feet (Each) with new height
          const widthFt = feetInchesToDecimalFeet(updatedRow.widthFtIn);
          const heightFt = feetInchesToDecimalFeet(updatedRow.heightFtIn);
          updatedRow.sqFeetEach = widthFt && heightFt ? (widthFt * heightFt).toFixed(2) : '';
          // Recalculate Sq Feet (Total) with new sqFeetEach
          const sqFeetEach = parseFloat(updatedRow.sqFeetEach);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.sqFeetTotal = sqFeetEach && qty ? (sqFeetEach * qty).toFixed(2) : '';
          
          // Recalculate Shade Boxes with Trim when height changes
          const heightMM = parseFloat(value);
          const widthMM = parseFloat(updatedRow.widthMM);
          if (widthMM && heightMM) {
            const roundedWidthTrim = Math.ceil(widthMM / 100) * 100;
            const brCalc = roundedWidthTrim < 1000 ? (1000 * 100 / 1000) : (roundedWidthTrim * 100 / 1000);
            const br = Math.ceil(brCalc);
            const roundedHeightTrim = Math.ceil(heightMM / 100) * 100;
            const bsCalc = roundedHeightTrim < 1000 ? (1000 * 260 / 1000) : (roundedHeightTrim * 260 / 1000);
            const bs = Math.ceil(bsCalc);
            const bt = widthMM < 1000 ? 3 : Math.round((widthMM - 2 * 50) / 335);
            const bu = 11 * bt;
            const bv = widthMM <= 1000 ? 132 : (widthMM <= 2000 ? 162 : 192);
            updatedRow.shadeBoxesWithSideTrimUnit = Math.ceil((br + bs + bu + bv) * 1.362161).toString();
            updatedRow.shadeBoxesWithSideTrimPosition = qty ? Math.ceil(parseFloat(updatedRow.shadeBoxesWithSideTrimUnit) * qty).toString() : '';
          
            // Calculate Final Finish: (SqFt * 0.092903) * 50
            const sqFeetEachCalc = parseFloat(updatedRow.sqFeetEach);
            if (sqFeetEachCalc) {
              const finalFinishUnit = (sqFeetEachCalc * 0.092903) * 50;
              updatedRow.finalFinishUnit = Math.round(finalFinishUnit).toString();
              updatedRow.finalFinishPosition = qty ? Math.round(finalFinishUnit * qty).toString() : '';
            }
          }
        }
        
        // Auto-calculate Sq Feet (Total) when Qty changes
        if (field === 'qty') {
          const sqFeetEach = parseFloat(updatedRow.sqFeetEach);
          const qty = parseFloat(value);
          updatedRow.sqFeetTotal = sqFeetEach && qty ? (sqFeetEach * qty).toFixed(2) : '';
          // Also calculate Operable Sashes (Total) - whole number
          const operableSashesEach = parseFloat(updatedRow.operableSashesEach);
          updatedRow.operableSashesTotal = operableSashesEach && qty ? Math.round(operableSashesEach * qty).toString() : '';
          // Also calculate Fields (Total) - whole number
          const fieldsEach = parseFloat(updatedRow.fieldsEach);
          updatedRow.fieldsTotal = fieldsEach && qty ? Math.round(fieldsEach * qty).toString() : '';
          // Also calculate Site Mullions (Total) - whole number
          const siteMullionsEach = parseFloat(updatedRow.siteMullionsEach);
          updatedRow.siteMullionsTotal = siteMullionsEach && qty ? Math.round(siteMullionsEach * qty).toString() : '';
          // Also calculate Net € (Total) - currency format
          const netEuroEach = parseFloat(updatedRow.netEuroEach);
          updatedRow.netEuroTotal = netEuroEach && qty ? (netEuroEach * qty).toFixed(2) : '';
          // Also calculate Magnetic Contact Per Position
          const magneticContactUnit = parseFloat(updatedRow.magneticContactUnit);
          updatedRow.magneticContactPosition = magneticContactUnit && qty ? Math.round(magneticContactUnit * qty).toString() : '';
          // Also calculate Shade Boxes with No Trim Per Position
          const shadeBoxesNoSideTrimUnit = parseFloat(updatedRow.shadeBoxesNoSideTrimUnit);
          updatedRow.shadeBoxesNoSideTrimPosition = shadeBoxesNoSideTrimUnit && qty ?
            Math.ceil(shadeBoxesNoSideTrimUnit * qty).toString() : '';
          // Also calculate Shade Boxes with Trim Per Position
          const shadeBoxesWithSideTrimUnit = parseFloat(updatedRow.shadeBoxesWithSideTrimUnit);
          updatedRow.shadeBoxesWithSideTrimPosition = shadeBoxesWithSideTrimUnit && qty ?
            Math.ceil(shadeBoxesWithSideTrimUnit * qty).toString() : '';
        // Also calculate Final Finish Per Position
          const finalFinishUnit = parseFloat(updatedRow.finalFinishUnit);
          updatedRow.finalFinishPosition = finalFinishUnit && qty ? Math.round(finalFinishUnit * qty).toString() : '';
        }
        
        // Auto-calculate Operable Sashes (Total) when Operable Sashes (Each) changes - whole number
        if (field === 'operableSashesEach') {
          const operableSashesEach = parseFloat(value);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.operableSashesTotal = operableSashesEach && qty ? Math.round(operableSashesEach * qty).toString() : '';
          
          // Auto-calculate Magnetic Contact Per Unit
          const isLiftAndRoll = [
            updatedRow.type,
            updatedRow.type2,
            updatedRow.type3,
            updatedRow.type4
          ].some(t => t === 'Lift and Roll Window' || t === 'L&R D');
          
          updatedRow.magneticContactUnit = operableSashesEach ?
            (operableSashesEach * (isLiftAndRoll ? 96 : 40)).toString() : '';
          
          // Also calculate Magnetic Contact Per Position
          const magneticContactUnit = parseFloat(updatedRow.magneticContactUnit);
          updatedRow.magneticContactPosition = magneticContactUnit && qty ? Math.round(magneticContactUnit * qty).toString() : '';
        }
        
        // Auto-calculate Fields (Total) when Fields (Each) changes - whole number
        if (field === 'fieldsEach') {
          const fieldsEach = parseFloat(value);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.fieldsTotal = fieldsEach && qty ? Math.round(fieldsEach * qty).toString() : '';
        }
        
        // Auto-calculate Net € (Total) when Net € (Each) changes - currency format
        if (field === 'netEuroEach') {
          const netEuroEach = parseFloat(value);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.netEuroTotal = netEuroEach && qty ? (netEuroEach * qty).toFixed(2) : '';
        }
        
        // Auto-calculate Site Mullions (Total) when Site Mullions (Each) changes - whole number
        if (field === 'siteMullionsEach') {
          const siteMullionsEach = parseFloat(value);
          const qty = parseFloat(updatedRow.qty);
          updatedRow.siteMullionsTotal = siteMullionsEach && qty ? Math.round(siteMullionsEach * qty).toString() : '';
        }
        
        // Auto-calculate Magnetic Contact Per Unit when any Type field changes
        if (field === 'type' || field === 'type2' || field === 'type3' || field === 'type4') {
          const isLiftAndRoll = [
            updatedRow.type,
            updatedRow.type2,
            updatedRow.type3,
            updatedRow.type4
          ].some(t => t === 'Lift and Roll Window' || t === 'L&R D');
          
          const operableSashesEach = parseFloat(updatedRow.operableSashesEach);
          updatedRow.magneticContactUnit = operableSashesEach ? 
            (operableSashesEach * (isLiftAndRoll ? 96 : 40)).toString() : '';
        }
        
        return updatedRow;
      })));
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading summaries...</div>
      </div>
    );
  }

  if (!hasAppPermission('viewSummary')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to view Summary.</p>
          <Link href="/" className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          /* Hide everything except the dialog content */
          body > div:first-child > nav,
          body > div:first-child > div:first-child,
          .fixed.inset-0.bg-black,
          button,
          input[type="checkbox"],
          .print\\:hidden,
          nav,
          aside,
          header,
          .sidebar,
          [class*="sidebar"],
          [class*="w-64"],
          .flex.flex-1 > .w-64 {
            display: none !important;
          }
          
          /* Hide entire page layout except dialog */
          body > div:first-child {
            display: none !important;
          }
          
          /* Show only the dialog */
          .fixed.inset-0:has(.max-w-\\[95vw\\]) {
            display: block !important;
            position: static !important;
            background: white !important;
          }
          
          /* Show only the dialog content */
          .fixed.inset-0 {
            position: static !important;
            background: white !important;
          }
          
          .max-w-\\[95vw\\] {
            max-width: 100% !important;
            max-height: 100% !important;
            box-shadow: none !important;
          }
          
          /* Remove scrolling */
          .overflow-y-auto,
          .overflow-x-auto {
            overflow: visible !important;
            max-height: none !important;
          }
          
          /* Page setup */
          @page {
            size: landscape;
            margin: 0.5in;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          /* Header formatting */
          .print-header {
            text-align: center;
            margin-bottom: 20px;
            page-break-after: avoid;
          }
          
          .print-header h1 {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          
          .print-summary-info {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 15px;
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e5e7eb;
            page-break-after: avoid;
          }
          
          .print-summary-info > div {
            font-size: 11px;
          }
          
          .print-summary-info label {
            font-weight: 600;
            display: block;
            margin-bottom: 4px;
          }
          
          /* Table formatting */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 6.5px;
            page-break-inside: auto;
            table-layout: fixed;
          }
          
          thead {
            display: table-header-group;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          th, td {
            border: 1px solid #d1d5db;
            padding: 2px 1px;
            text-align: left;
            white-space: nowrap;
          }
          
          th {
            background-color: #f3f4f6 !important;
            font-weight: 600;
            white-space: normal;
            word-wrap: break-word;
            line-height: 1.15;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          /* Section breaks */
          .print-section {
            page-break-after: always;
          }
          
          .print-section:last-child {
            page-break-after: auto;
          }
          
          /* Remove padding from containers */
          .p-6, .px-6, .py-6 {
            padding: 0 !important;
          }
          
          .border-b {
            border-bottom: none !important;
          }
          
          /* Ensure checkboxes show their state as text */
          input[type="checkbox"]::after {
            content: attr(checked);
          }
          
          /* Hide dropdown arrows and search placeholders */
          select, textarea, input {
            border: none !important;
            background: transparent !important;
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
          }
          
          textarea {
            resize: none;
            overflow: visible;
            min-height: auto !important;
          }
        }
      `}</style>
      <div className="flex flex-1 overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="hidden md:block md:w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
        <div className="space-y-6">
          {/* Page Header in Sidebar */}
          <div className="pb-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#e8eaf6] rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-brand-navy" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Summary</h1>
            </div>
            <p className="text-sm text-gray-600 ml-13">Manage summary reports and data</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Summary</h3>
            <nav className="space-y-1">
              <button
                onClick={() => setSidebarFilter('recent')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'recent'
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                Recent
              </button>
              <button
                onClick={() => setSidebarFilter('created-by-me')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'created-by-me'
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4" />
                Created by Me
              </button>
              <button
                onClick={() => setSidebarFilter('all')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'all'
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <List className="w-4 h-4" />
                All Summaries
              </button>
              <button
                onClick={() => setSidebarFilter('favorites')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'favorites'
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Star className="w-4 h-4" />
                All Favorites
              </button>
            </nav>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Logs</h3>
            <nav className="space-y-1">
              <Link href="/products" className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-gray-700 hover:bg-gray-100">
                <Package className="w-4 h-4" />
                Product Log
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          {/* Actions */}
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Summary Records</h3>
            <div className="flex gap-3">
              <button
                onClick={openOpportunityPicker}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Summary
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search summaries by job name, salesman, job type, or estimator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 focus:border-transparent"
              />
            </div>
          </div>

          {/* Summaries List */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Job Name</span>
                        {sortColumn === 'name' && (
                          sortDirection === 'asc' 
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Salesman
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Job Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Estimator
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Rows
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('lastModifiedAt')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Last Modified</span>
                        {sortColumn === 'lastModifiedAt' && (
                          sortDirection === 'asc' 
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No summaries found</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {searchTerm ? 'Try adjusting your search' : 'Create your first summary to get started'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.map(summary => (
                      <tr key={summary.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <button
                            onClick={() => {
                              setEditingSummary({ ...summary, hungType: summary.hungType ?? '#34', hungTypeCustom: summary.hungTypeCustom ?? '' });
                              setShowNewSummary(true);
                            }}
                            className="text-brand-navy hover:text-brand-dark font-medium"
                          >
                            {summary.name || 'Untitled Summary'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {summary.salesman || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {summary.jobType || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {summary.estimator || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {summary.rows.length} row{summary.rows.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(summary.lastModifiedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setOpenDropdown(openDropdown === summary.id ? null : summary.id)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <MoreVertical className="w-5 h-5 text-gray-400" />
                            </button>
                            
                            {openDropdown === summary.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={() => setOpenDropdown(null)}
                                />
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                  <button
                                    onClick={() => {
                                      setEditingSummary({ ...summary, hungType: summary.hungType ?? '#34', hungTypeCustom: summary.hungTypeCustom ?? '' });
                                      setShowNewSummary(true);
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleToggleFavorite(summary.id)}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <Star className={cn("w-4 h-4", summary.isFavorite && "fill-yellow-400 text-yellow-400")} />
                                    {summary.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeleteSummary(summary.id);
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleFavorite(summary.id)}
                            className={`${summary.isFavorite ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-500`}
                          >
                            <Star className="w-5 h-5" fill={summary.isFavorite ? 'currentColor' : 'none'} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Opportunity Picker Modal */}
    {showOpportunityPicker && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Select Opportunity</h2>
              <p className="text-sm text-gray-600 mt-1">Choose an Opportunity to link to this Summary</p>
            </div>
            <button
              onClick={() => setShowOpportunityPicker(false)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search opportunities..."
                value={opportunitySearch}
                onChange={(e) => setOpportunitySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 focus:border-transparent text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              {loadingOpportunities ? (
                <div className="p-6 text-center text-gray-500">
                  <div className="animate-spin w-6 h-6 border-2 border-brand-navy border-t-transparent rounded-full mx-auto mb-2" />
                  Loading opportunities...
                </div>
              ) : opportunityRecords.filter(r => {
                if (!opportunitySearch) return true;
                const q = opportunitySearch.toLowerCase();
                const name = (r.opportunityName || r.Opportunity__opportunityName || '').toLowerCase();
                const num = (r.opportunityNumber || r.Opportunity__opportunityNumber || '').toLowerCase();
                return name.includes(q) || num.includes(q);
              }).length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p className="text-sm">No opportunities found</p>
                </div>
              ) : (
                opportunityRecords.filter(r => {
                  if (!opportunitySearch) return true;
                  const q = opportunitySearch.toLowerCase();
                  const name = (r.opportunityName || r.Opportunity__opportunityName || '').toLowerCase();
                  const num = (r.opportunityNumber || r.Opportunity__opportunityNumber || '').toLowerCase();
                  return name.includes(q) || num.includes(q);
                }).map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleOpportunitySelected(r)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      {r.opportunityNumber || r.Opportunity__opportunityNumber || 'No Number'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {r.opportunityName || r.Opportunity__opportunityName || 'Unnamed'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Summary Editor Dialog */}
    {showNewSummary && editingSummary && (
      <CellNavContext.Provider value={{ activeCellId, editingCellId, setActive: setActiveCellId, setEditing: setEditingCellId }}>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[95vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center print:hidden">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Summary</h2>
                <p className="text-sm text-gray-600 mt-1">Fill in the summary data</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerateQuotePDF('preview')}
                  className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-light transition-colors"
                >
                  <ScrollText className="w-4 h-4 mr-2" />
                  Quote Letter
                </button>
                <button
                  onClick={() => handlePrintPDF('preview')}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview PDF
                </button>
                <button
                  onClick={() => handlePrintPDF('download')}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Download PDF
                </button>
                <button
                  onClick={() => {
                    setShowNewSummary(false);
                    setEditingSummary(null);
                    setActivePage(1);
                    if (editingSummary?.linkedOpportunityId) {
                      router.push(`/opportunities/${editingSummary.linkedOpportunityId}`);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Page Tabs */}
            <div className="border-b border-gray-200 px-6 print:hidden">
              <nav className="flex gap-4">
                <button
                  onClick={() => { setActivePage(1); window.scrollTo(0, 0); }}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activePage === 1
                      ? 'border-brand-navy text-brand-navy'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Page 1 — Data Entry
                </button>
                <button
                  onClick={() => { setActivePage(2); window.scrollTo(0, 0); }}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activePage === 2
                      ? 'border-brand-navy text-brand-navy'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Page 2 — Project Summary
                </button>
              </nav>
            </div>
            
            {/* Print Header */}
            <div className="hidden print:block print-header">
              <h1>Quote Summary</h1>
              <div className="text-sm text-gray-600">
                Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* ===== PAGE 2 — Project Summary ===== */}
              {activePage === 2 && (
                <div className="max-w-7xl mx-auto space-y-8">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                      <h3 className="text-lg font-semibold text-gray-900">Project Summary</h3>
                      <p className="text-sm text-gray-500 mt-1">Overview information pulled from the data entry sheet</p>
                    </div>
                    <div className="p-6 space-y-5">
                      {/* Row 1: Date + Opportunity # */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                            {editingSummary.date ? new Date(editingSummary.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Page 1</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity #</label>
                          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                            {editingSummary.opportunityNumber || '—'}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Page 1</p>
                        </div>
                      </div>

                      {/* Row 2: Project Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                        <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                          {editingSummary.name || '—'}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Auto-filled from Job Name on Page 1</p>
                      </div>

                      {/* Row 3: Address */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <input
                          type="text"
                          value={editingSummary.address}
                          onChange={(e) => setEditingSummary({ ...editingSummary, address: e.target.value })}
                          maxLength={500}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                          placeholder="Enter project address"
                        />
                      </div>

                      {/* Row 4: First Quote or Requote */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">First Quote or Requote</label>
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="quoteType"
                              value="first"
                              checked={editingSummary.quoteType === 'first'}
                              onChange={() => setEditingSummary({ ...editingSummary, quoteType: 'first', requoteDescription: '' })}
                              className="w-4 h-4 text-brand-navy focus:ring-brand-navy/40 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">First Quote</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="quoteType"
                              value="requote"
                              checked={editingSummary.quoteType === 'requote'}
                              onChange={() => setEditingSummary({ ...editingSummary, quoteType: 'requote' })}
                              className="w-4 h-4 text-brand-navy focus:ring-brand-navy/40 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Requote</span>
                          </label>
                        </div>
                        {editingSummary.quoteType === 'requote' && (
                          <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description of Changes</label>
                            <textarea
                              value={editingSummary.requoteDescription}
                              onChange={(e) => setEditingSummary({ ...editingSummary, requoteDescription: e.target.value })}
                              rows={3}
                              maxLength={2000}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                              placeholder="Describe what changed from the previous quote..."
                            />
                          </div>
                        )}
                      </div>

                      {/* Row 5: Salesman + Estimator */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Salesman</label>
                          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                            {editingSummary.salesman || '—'}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Page 1</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Estimator</label>
                          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                            {editingSummary.estimator || '—'}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Page 1</p>
                        </div>
                      </div>

                      {/* Row 6: Plans Dated */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Plans Dated</label>
                        <DateInput
                          value={editingSummary.plansDated || ''}
                          onChange={(v) => setEditingSummary({ ...editingSummary, plansDated: v })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                        />
                        <p className="text-xs text-gray-400 mt-1">Auto-filled from Opportunity</p>
                      </div>

                      {/* Row 7: Contact + Account receiving the quote */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Receiving the Quote</label>
                          <input
                            type="text"
                            value={editingSummary.contactReceivingQuote || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, contactReceivingQuote: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="Enter contact"
                          />
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Quote Recipient connection</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                          <input
                            type="text"
                            value={editingSummary.accountReceivingQuote || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, accountReceivingQuote: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="Enter account"
                          />
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Architect / Designer connection</p>
                        </div>
                      </div>

                      {/* Row 8: Account Shipping Address + Contact Phone Fields */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Shipping Address</label>
                          <input
                            type="text"
                            value={editingSummary.accountShippingAddress || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, accountShippingAddress: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="Enter shipping address"
                          />
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Account</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Primary Phone</label>
                          <input
                            type="text"
                            value={editingSummary.contactPrimaryPhone || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, contactPrimaryPhone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="Enter phone"
                          />
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Contact</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                          <input
                            type="text"
                            value={editingSummary.contactEmail || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, contactEmail: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="Enter email"
                          />
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Contact</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Cell</label>
                          <input
                            type="text"
                            value={editingSummary.contactCellPhone || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, contactCellPhone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="Enter cell"
                          />
                          <p className="text-xs text-gray-400 mt-1">Auto-filled from Contact</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Product Specifications */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                      <h3 className="text-lg font-semibold text-gray-900">Product Specifications</h3>
                      <p className="text-sm text-gray-500 mt-1">Product details for this project</p>
                    </div>
                    <div className="p-6 space-y-5">
                      {/* Row 1: Product (auto-filled from Opportunity, editable) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                        <input
                          type="text"
                          value={editingSummary.product || editingSummary.jobType || ''}
                          onChange={(e) => setEditingSummary({ ...editingSummary, product: e.target.value })}
                          placeholder="Enter product..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                        />
                      </div>

                      {/* Row 2: Product Types derived from Page 1 rows */}
                      {(() => {
                        const winRows = editingSummary.hasMultipleLocations && editingSummary.subLocations?.length
                          ? editingSummary.subLocations.flatMap(loc => loc.rows || [])
                          : (editingSummary.rows || []);
                        const doorRows = editingSummary.hasMultipleLocations && editingSummary.subLocations?.length
                          ? editingSummary.subLocations.flatMap(loc => loc.doorRows || [])
                          : (editingSummary.doorRows || []);
                        const allRows = [...winRows, ...doorRows];
                        const typeFields = ['type', 'type2', 'type3', 'type4'] as const;
                        const subOptFieldMapEd: Record<string, string> = {
                          type: 'typeSubOption', type2: 'type2SubOption',
                          type3: 'type3SubOption', type4: 'type4SubOption',
                        };
                        const uniqueTypes = Array.from(new Set(
                          allRows.flatMap(r => typeFields.map(f => {
                            const t = (r as any)[f];
                            if (!t) return null;
                            if (t === 'Fixed with Sash' && (r as any)[subOptFieldMapEd[f]!]) return `Fixed with Sash: ${(r as any)[subOptFieldMapEd[f]!]}`;
                            return t;
                          }).filter(Boolean))
                        )) as string[];

                        // getOptionsForType is defined at module level above DOOR_TYPES

                        const pto = (editingSummary.productTypeOptions || {}) as Record<string, string[]>;

                        const toggleOpt = (typeKey: string, opt: string) => {
                          const validOpts = getOptionsForType(typeKey);
                          const current = (pto[typeKey] || []).filter((o: string) => validOpts.includes(o));
                          const next = current.includes(opt) ? current.filter((o: string) => o !== opt) : [...current, opt];
                          setEditingSummary({ ...editingSummary, productTypeOptions: { ...pto, [typeKey]: next } });
                        };

                        if (uniqueTypes.length === 0) {
                          return (
                            <p className="text-sm text-gray-400 italic">No product types found — add rows to the Windows/Doors tables on Page 1.</p>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">Product Type Options</label>
                            {uniqueTypes.map(typeName => {
                              const opts = getOptionsForType(typeName);
                              const selected = (pto[typeName] || []).filter((o: string) => opts.includes(o));
                              return (
                                <div key={typeName} className="flex items-start gap-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                  <div className="min-w-[200px] text-sm font-medium text-gray-800 pt-0.5">{typeName}</div>
                                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                                    {opts.map(opt => (
                                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selected.includes(opt)}
                                          onChange={() => toggleOpt(typeName, opt)}
                                          className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
                                        />
                                        <span className="text-sm text-gray-700">{opt}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Row 3: Wood Type + Finish */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Wood Type</label>
                          <select
                            value={editingSummary.woodType === 'Custom Option' ? 'Custom Option' : (editingSummary.woodType || '')}
                            onChange={(e) => setEditingSummary({ ...editingSummary, woodType: e.target.value, woodTypeCustom: e.target.value !== 'Custom Option' ? '' : editingSummary.woodTypeCustom })}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white [&>option]:not-italic [&>option]:text-gray-900${editingSummary.woodType === 'Custom Option' ? ' italic text-blue-600' : ''}`}
                          >
                            <option value="">Select wood type...</option>
                            {getOppPicklist('Opportunity__woodType').map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                            <option value="Custom Option">Custom Option</option>
                          </select>
                          {editingSummary.woodType === 'Custom Option' && (
                            <input
                              type="text"
                              autoFocus
                              value={editingSummary.woodTypeCustom || ''}
                              onChange={(e) => setEditingSummary({ ...editingSummary, woodTypeCustom: e.target.value })}
                              placeholder="Enter custom value..."
                              className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 focus:outline-none"
                            />
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Finish</label>
                          <select
                            value={editingSummary.finish || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, finish: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select finish...</option>
                            {getOppPicklist('Opportunity__finishSpecifications').map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Row: Glass Type (+ Hung Glass Type only when hung rows exist) */}
                      {(() => {
                        const uiWinRows = editingSummary.hasMultipleLocations && editingSummary.subLocations?.length
                          ? editingSummary.subLocations.flatMap((loc: any) => loc.rows || [])
                          : (editingSummary.rows || []);
                        const hasHung = uiWinRows.some((r: any) => (r.type || '').toLowerCase().includes('hung'));
                        return (
                          <div className={hasHung ? 'grid grid-cols-2 gap-6' : ''}>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Glass Type</label>
                              <select
                                value={editingSummary.glassType === 'Custom Option' ? 'Custom Option' : (editingSummary.glassType || '')}
                                onChange={(e) => setEditingSummary({ ...editingSummary, glassType: e.target.value, glassTypeCustom: e.target.value !== 'Custom Option' ? '' : editingSummary.glassTypeCustom })}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white [&>option]:not-italic [&>option]:text-gray-900${editingSummary.glassType === 'Custom Option' ? ' italic text-blue-600' : ''}`}
                              >
                                <option value="">Select glass type...</option>
                                {getOppPicklist('Opportunity__glassType').map(v => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                                <option value="Custom Option">Custom Option</option>
                              </select>
                              {editingSummary.glassType === 'Custom Option' && (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingSummary.glassTypeCustom || ''}
                                  onChange={(e) => setEditingSummary({ ...editingSummary, glassTypeCustom: e.target.value })}
                                  placeholder="Enter custom value..."
                                  className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 focus:outline-none"
                                />
                              )}
                            </div>
                            {hasHung && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hung Glass Type</label>
                                <select
                                  value={editingSummary.hungType === 'Custom Option' ? 'Custom Option' : (editingSummary.hungType || '#34')}
                                  onChange={(e) => setEditingSummary({ ...editingSummary, hungType: e.target.value, hungTypeCustom: e.target.value !== 'Custom Option' ? '' : editingSummary.hungTypeCustom })}
                                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white [&>option]:not-italic [&>option]:text-gray-900${editingSummary.hungType === 'Custom Option' ? ' italic text-blue-600' : ''}`}
                                >
                                  <option value="">Select hung glass type...</option>
                                  {getOppPicklist('Opportunity__glassType').map(v => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                  <option value="Custom Option">Custom Option</option>
                                </select>
                                {editingSummary.hungType === 'Custom Option' && (
                                  <input
                                    type="text"
                                    value={editingSummary.hungTypeCustom || ''}
                                    onChange={(e) => setEditingSummary({ ...editingSummary, hungTypeCustom: e.target.value })}
                                    placeholder="Enter custom value..."
                                    className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 focus:outline-none"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Row: Spacer Bar Type + Spacer Bar Colors */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Spacer Bar Type</label>
                          <select
                            value={editingSummary.spacerBarType || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, spacerBarType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select spacer bar type...</option>
                            {getOppPicklist('Opportunity__spacer_bar_type').map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Spacer Bar Colors</label>
                          <select
                            value={editingSummary.spacerBarColors || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, spacerBarColors: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select spacer bar colors...</option>
                            {getOppPicklist('Opportunity__spacerBarColors').map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Row: SDL + TDL */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">SDL</label>
                          <select
                            value={editingSummary.sdl === 'Custom Option' ? 'Custom Option' : (editingSummary.sdl || '')}
                            onChange={(e) => setEditingSummary({ ...editingSummary, sdl: e.target.value, sdlCustom: e.target.value !== 'Custom Option' ? '' : editingSummary.sdlCustom })}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white [&>option]:not-italic [&>option]:text-gray-900${editingSummary.sdl === 'Custom Option' ? ' italic text-blue-600' : ''}`}
                          >
                            <option value="">Select SDL...</option>
                            <option>22MM</option>
                            <option>44MM</option>
                            <option value="Custom Option">Custom Option</option>
                          </select>
                          {editingSummary.sdl === 'Custom Option' && (
                            <input
                              type="text"
                              autoFocus
                              value={editingSummary.sdlCustom || ''}
                              onChange={(e) => setEditingSummary({ ...editingSummary, sdlCustom: e.target.value })}
                              placeholder="Enter custom value..."
                              className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 focus:outline-none"
                            />
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">TDL</label>
                          <select
                            value={editingSummary.tdl === 'Custom Option' ? 'Custom Option' : (editingSummary.tdl || '')}
                            onChange={(e) => setEditingSummary({ ...editingSummary, tdl: e.target.value, tdlCustom: e.target.value !== 'Custom Option' ? '' : editingSummary.tdlCustom })}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white [&>option]:not-italic [&>option]:text-gray-900${editingSummary.tdl === 'Custom Option' ? ' italic text-blue-600' : ''}`}
                          >
                            <option value="">Select TDL...</option>
                            <option>48MM</option>
                            <option>70MM</option>
                            <option>125MM</option>
                            <option value="Custom Option">Custom Option</option>
                          </select>
                          {editingSummary.tdl === 'Custom Option' && (
                            <input
                              type="text"
                              autoFocus
                              value={editingSummary.tdlCustom || ''}
                              onChange={(e) => setEditingSummary({ ...editingSummary, tdlCustom: e.target.value })}
                              placeholder="Enter custom value..."
                              className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 focus:outline-none"
                            />
                          )}
                        </div>
                      </div>

                      {/* Row: Finials + Hinge Finish Specification */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Finials</label>
                          <select
                            value={editingSummary.finials || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, finials: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select...</option>
                            {getOppPicklist('Opportunity__finials').map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hinge Finish Specification</label>
                          <select
                            value={editingSummary.hingeFinishSpecification || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, hingeFinishSpecification: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select...</option>
                            {getOppPicklist('Opportunity__hingeFinishSpecification').map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Row: Project Contains */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Project Contains</label>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {['Sliding Doors', 'Big Units', 'Requires Site Measurements'].map(opt => {
                            const selected = editingSummary.projectContains || [];
                            return (
                              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selected.includes(opt)}
                                  onChange={() => {
                                    const next = selected.includes(opt)
                                      ? selected.filter((o: string) => o !== opt)
                                      : [...selected, opt];
                                    setEditingSummary({ ...editingSummary, projectContains: next });
                                  }}
                                  className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
                                />
                                <span className="text-sm text-gray-700">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Cost */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                      <h3 className="text-lg font-semibold text-gray-900">Delivery Cost</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1"># of Containers</label>
                          <input
                            type="number"
                            min="0"
                            value={editingSummary.shippingContainers || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, shippingContainers: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cost (per container)</label>
                          <input
                            type="number"
                            min="0"
                            value={editingSummary.shippingCostPerContainer || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, shippingCostPerContainer: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Premium for Containers/Crane Cost</label>
                          <input
                            type="number"
                            min="0"
                            value={editingSummary.shippingCraneCost || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, shippingCraneCost: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {(() => {
                        const containers = parseFloat(editingSummary.shippingContainers) || 0;
                        const cost = parseFloat(editingSummary.shippingCostPerContainer) || 0;
                        const crane = parseFloat(editingSummary.shippingCraneCost) || 0;
                        const total = containers * cost + crane;
                        if (!containers && !cost && !crane) return null;
                        return (
                          <div className="mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">Estimated Delivery Cost:</span>
                            <span className="text-lg font-semibold text-gray-900">{total}k</span>
                          </div>
                        );
                      })()}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
                        <textarea
                          rows={3}
                          value={editingSummary.deliveryNotes || ''}
                          onChange={(e) => setEditingSummary({ ...editingSummary, deliveryNotes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm resize-none"
                          placeholder="Any special delivery instructions or notes..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tax Cost */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                      <h3 className="text-lg font-semibold text-gray-900">Tax Cost</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Use Tax @ Full</label>
                          <input
                            type="text"
                            value={editingSummary.taxAtFull || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, taxAtFull: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder=""
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Use Tax @ Discount</label>
                          <input
                            type="text"
                            value={editingSummary.taxAtDiscount || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, taxAtDiscount: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm"
                            placeholder=""
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cost Analysis */}
                  {(() => {
                    const allWR: SummaryRow[] = editingSummary.hasMultipleLocations
                      ? (editingSummary.subLocations ?? []).flatMap(l => l.rows)
                      : editingSummary.rows;
                    const allDR: DoorRow[] = editingSummary.hasMultipleLocations
                      ? (editingSummary.subLocations ?? []).flatMap(l => l.doorRows)
                      : editingSummary.doorRows;
                    const p2 = (v: string | undefined) => parseFloat(v || '0') || 0;
                    const sf = (rows: (SummaryRow | DoorRow)[], field: string) =>
                      rows.reduce((a, r) => a + (parseFloat((r as any)[field]) || 0), 0);
                    const totSqFt = sf(allWR, 'sqFeetTotal') + sf(allDR, 'sqFeetTotal');
                    const qtotSum = (f: 'full'|'pct'|'final'|'finalAdj') => {
                      if (editingSummary.hasMultipleLocations) {
                        return (editingSummary.subLocations ?? []).reduce((a, l) => {
                          const q = l.quoteTotals;
                          return a + p2((q?.euroWindows as any)?.[f]) + p2((q?.doubleHung as any)?.[f]) + p2((q?.euroDoors as any)?.[f]);
                        }, 0);
                      }
                      const q = editingSummary.quoteTotals;
                      return p2((q?.euroWindows as any)?.[f]) + p2((q?.doubleHung as any)?.[f]) + p2((q?.euroDoors as any)?.[f]);
                    };
                    const gta2 = editingSummary.grandTotalAdjustment;
                    const totFull  = qtotSum('full');
                    const totPct   = qtotSum('pct');
                    const totFinal = qtotSum('final');
                    const gtFull  = totFull  + p2(gta2?.full);
                    const gtPct   = totPct   + p2(gta2?.pct);
                    const gtFinal = totFinal + p2(gta2?.final);
                    const hiddenCost = totFull * 0.56;
                    const fmtV = (v: number) => v ? Math.round(v).toLocaleString('en-US') : '—';
                    const fmtK = (v: number) => v ? Math.round(v).toLocaleString('en-US') + 'K' : '—';
                    const rows = [
                      { label: 'Full by Sq Foot',    value: totSqFt ? fmtV(gtFull  / totSqFt) : '—' },
                      { label: '%_ by Sq Foot',      value: totSqFt ? fmtV(gtPct   / totSqFt) : '—' },
                      { label: 'Final by Sq Foot',   value: totSqFt ? fmtV(gtFinal / totSqFt) : '—' },
                      { label: 'Hidden Cost',        value: fmtV(hiddenCost) },
                      { label: 'Full Contribution',  value: fmtK((totFull  - hiddenCost) / 1000) },
                      { label: '%_ Contribution',    value: fmtK((totPct   - hiddenCost) / 1000) },
                      { label: 'Final Contribution', value: fmtK((totFinal - hiddenCost) / 1000) },
                    ];
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                          <h3 className="text-lg font-semibold text-gray-900">Cost Analysis</h3>
                        </div>
                        <div className="p-6 grid grid-cols-3 gap-x-8 gap-y-4">
                          {rows.map(r => (
                            <div key={r.label}>
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{r.label}</div>
                              <div className="text-sm font-semibold text-gray-900">{r.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Aggregate Summary Tables — side by side */}
                  {(() => {
                    const sumField = (rows: (SummaryRow | DoorRow)[], field: string) =>
                      rows.reduce((acc, row) => acc + (parseFloat((row as any)[field]) || 0), 0);

                    // When multi-location, aggregate all locations; otherwise use top-level rows
                    const allWindowRows: SummaryRow[] = editingSummary.hasMultipleLocations
                      ? (editingSummary.subLocations ?? []).flatMap(l => l.rows)
                      : editingSummary.rows;
                    const allDoorRowsP2: DoorRow[] = editingSummary.hasMultipleLocations
                      ? (editingSummary.subLocations ?? []).flatMap(l => l.doorRows)
                      : editingSummary.doorRows;

                    const hungRows = allWindowRows.filter(r => r.type?.toLowerCase().includes('hung'));
                    const nonHungRows = allWindowRows.filter(r => !r.type?.toLowerCase().includes('hung'));

                    const euroWindowQty = sumField(nonHungRows, 'qty');
                    const euroWindowFields = sumField(nonHungRows, 'fieldsTotal');
                    const euroWindowSqFt = sumField(nonHungRows, 'sqFeetTotal');
                    const euroWindowNet = sumField(nonHungRows, 'netEuroTotal');

                    const doubleHungQty = sumField(hungRows, 'qty');
                    const doubleHungFields = sumField(hungRows, 'fieldsTotal');
                    const doubleHungSqFt = sumField(hungRows, 'sqFeetTotal');
                    const doubleHungNet = sumField(hungRows, 'netEuroTotal');

                    const doorQty = sumField(allDoorRowsP2, 'qty');
                    const doorFields = sumField(allDoorRowsP2, 'fieldsTotal');
                    const doorSqFt = sumField(allDoorRowsP2, 'sqFeetTotal');
                    const doorNet = sumField(allDoorRowsP2, 'netEuroTotal');

                    const fmt = (v: number) => v ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
                    const fmtInt = (v: number) => v ? v.toLocaleString('en-US') : '—';

                    const totalQty = euroWindowQty + doubleHungQty + doorQty;
                    const totalFields = euroWindowFields + doubleHungFields + doorFields;
                    const totalSqFt = euroWindowSqFt + doubleHungSqFt + doorSqFt;
                    const totalNet = euroWindowNet + doubleHungNet + doorNet;

                    const qtot = editingSummary.quoteTotals;
                    const p = (s: string | undefined) => parseFloat(s || '0') || 0;

                    // Per-category calculated values: all are input / Net Euro
                    const calcRow = (net: number, cat: { full: string; pct: string; final: string; finalAdj: string } | undefined) => {
                      const full = net ? p(cat?.full) / net : 0;
                      const disc = net ? p(cat?.pct) / net : 0;
                      const final_ = net ? p(cat?.final) / net : 0;
                      const finalAdj = net ? p(cat?.finalAdj) / net : 0;
                      return { full, disc, final: final_, finalAdj };
                    };

                    // When multi-location, aggregate quoteTotals across all subLocations for grand total calcs
                    const aggQt = editingSummary.hasMultipleLocations
                      ? (() => {
                          const locs = editingSummary.subLocations ?? [];
                          const sumCat = (cat: 'euroWindows'|'doubleHung'|'euroDoors', f: 'full'|'pct'|'final'|'finalAdj') =>
                            locs.reduce((a, l) => a + (p((l.quoteTotals as any)?.[cat]?.[f])), 0).toString();
                          return {
                            euroWindows: { full: sumCat('euroWindows','full'), pct: sumCat('euroWindows','pct'), final: sumCat('euroWindows','final'), finalAdj: sumCat('euroWindows','finalAdj') },
                            doubleHung:  { full: sumCat('doubleHung','full'),  pct: sumCat('doubleHung','pct'),  final: sumCat('doubleHung','final'),  finalAdj: sumCat('doubleHung','finalAdj')  },
                            euroDoors:   { full: sumCat('euroDoors','full'),   pct: sumCat('euroDoors','pct'),   final: sumCat('euroDoors','final'),   finalAdj: sumCat('euroDoors','finalAdj')   },
                          };
                        })()
                      : qtot;

                    const ewCalc = calcRow(euroWindowNet, aggQt?.euroWindows);
                    const dhCalc = calcRow(doubleHungNet, aggQt?.doubleHung);
                    const edCalc = calcRow(doorNet, aggQt?.euroDoors);
                    const gtNet = euroWindowNet + doubleHungNet + doorNet;
                    const gtCalc = {
                      full:     gtNet ? (p(aggQt?.euroWindows?.full)     + p(aggQt?.doubleHung?.full)     + p(aggQt?.euroDoors?.full))     / gtNet : 0,
                      disc:     gtNet ? (p(aggQt?.euroWindows?.pct)      + p(aggQt?.doubleHung?.pct)      + p(aggQt?.euroDoors?.pct))      / gtNet : 0,
                      final:    gtNet ? (p(aggQt?.euroWindows?.final)    + p(aggQt?.doubleHung?.final)    + p(aggQt?.euroDoors?.final))    / gtNet : 0,
                      finalAdj: gtNet ? (p(aggQt?.euroWindows?.finalAdj) + p(aggQt?.doubleHung?.finalAdj) + p(aggQt?.euroDoors?.finalAdj)) / gtNet : 0,
                    };

                    // Helper to render a single location's quote totals table
                    const renderQuoteTotalsTable = (
                      locLabel: string | null,
                      locWindowRows: SummaryRow[],
                      locDoorRows: DoorRow[],
                      locQtot: Summary['quoteTotals'],
                      onQtotChange: ((qt: Summary['quoteTotals']) => void) | null
                    ) => {
                      const locHung = locWindowRows.filter(r => r.type?.toLowerCase().includes('hung'));
                      const locNonHung = locWindowRows.filter(r => !r.type?.toLowerCase().includes('hung'));
                      const ewQ = sumField(locNonHung, 'qty'), ewF = sumField(locNonHung, 'fieldsTotal');
                      const ewSq = sumField(locNonHung, 'sqFeetTotal'), ewN = sumField(locNonHung, 'netEuroTotal');
                      const dhQ = sumField(locHung, 'qty'), dhF = sumField(locHung, 'fieldsTotal');
                      const dhSq = sumField(locHung, 'sqFeetTotal'), dhN = sumField(locHung, 'netEuroTotal');
                      const dQ = sumField(locDoorRows, 'qty'), dF = sumField(locDoorRows, 'fieldsTotal');
                      const dSq = sumField(locDoorRows, 'sqFeetTotal'), dN = sumField(locDoorRows, 'netEuroTotal');
                      const totQ = ewQ+dhQ+dQ, totF = ewF+dhF+dF, totSq = ewSq+dhSq+dSq, totN = ewN+dhN+dN;
                      const lEwCalc = calcRow(ewN, locQtot?.euroWindows);
                      const lDhCalc = calcRow(dhN, locQtot?.doubleHung);
                      const lEdCalc = calcRow(dN, locQtot?.euroDoors);
                      const lGtNet = ewN+dhN+dN;
                      const lGtCalc = {
                        full:     lGtNet ? (p(locQtot?.euroWindows?.full)+p(locQtot?.doubleHung?.full)+p(locQtot?.euroDoors?.full))/lGtNet : 0,
                        disc:     lGtNet ? (p(locQtot?.euroWindows?.pct)+p(locQtot?.doubleHung?.pct)+p(locQtot?.euroDoors?.pct))/lGtNet : 0,
                        final:    lGtNet ? (p(locQtot?.euroWindows?.final)+p(locQtot?.doubleHung?.final)+p(locQtot?.euroDoors?.final))/lGtNet : 0,
                        finalAdj: lGtNet ? (p(locQtot?.euroWindows?.finalAdj)+p(locQtot?.doubleHung?.finalAdj)+p(locQtot?.euroDoors?.finalAdj))/lGtNet : 0,
                      };
                      const editable = onQtotChange !== null;
                      const setLocQt = (cat: 'euroWindows'|'doubleHung'|'euroDoors', f: string, val: string) => {
                        if (!onQtotChange) return;
                        const base = locQtot ?? defaultQuoteTotals();
                        onQtotChange({ ...base, [cat]: { ...(base as any)[cat], [f]: val } });
                      };
                      const inputCell = (cat: 'euroWindows'|'doubleHung'|'euroDoors', f: string) => editable
                        ? <td className="px-1 py-1"><input type="text" value={(locQtot as any)?.[cat]?.[f] || ''} onChange={e => setLocQt(cat, f, e.target.value)} className="w-full px-2 py-1.5 text-right text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40" placeholder="—" /></td>
                        : <td className="px-4 py-3 text-right text-gray-400">—</td>;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {locLabel ? `Quote Totals — Location ${locLabel}` : 'Quote Totals'}
                            </h3>
                            {!locLabel && <p className="text-sm text-gray-500">Aggregated from the data entry sheet</p>}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                              <colgroup>
                                <col style={{ width: '11%' }} /><col style={{ width: '5%' }} /><col style={{ width: '7%' }} />
                                <col style={{ width: '7%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8%' }} />
                                <col style={{ width: '7%' }} /><col style={{ width: '8%' }} /><col style={{ width: '9%' }} />
                                <col style={{ width: '7%' }} /><col style={{ width: '7%' }} /><col style={{ width: '8%' }} /><col style={{ width: '7%' }} />
                              </colgroup>
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Fields</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Sq Feet</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">NET €</th>
                                  <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Full</th>
                                  <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">%__</th>
                                  <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">FINAL</th>
                                  <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">FINAL W/ ADJ.</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider border-l-4 border-blue-300 bg-blue-50/60">Full</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider bg-blue-50/60">Disc</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-50/60">Final</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-purple-700 uppercase tracking-wider bg-purple-50/60">Final W/ Adj</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                <tr className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">Euro Windows</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmtInt(ewQ)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmtInt(ewF)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmt(ewSq)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{ewN ? `€${fmt(ewN)}` : '—'}</td>
                                  {inputCell('euroWindows','full')}{inputCell('euroWindows','pct')}{inputCell('euroWindows','final')}{inputCell('euroWindows','finalAdj')}
                                  <td className="px-4 py-3 text-right text-gray-700 border-l-4 border-blue-300 bg-blue-50/30">{lEwCalc.full ? fmt(lEwCalc.full) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 bg-blue-50/30">{lEwCalc.disc ? fmt(lEwCalc.disc) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 bg-green-50/30">{lEwCalc.final ? fmt(lEwCalc.final) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 bg-purple-50/30">{lEwCalc.finalAdj ? fmt(lEwCalc.finalAdj) : '—'}</td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">Double Hung</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmtInt(dhQ)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmtInt(dhF)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmt(dhSq)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{dhN ? `€${fmt(dhN)}` : '—'}</td>
                                  {inputCell('doubleHung','full')}{inputCell('doubleHung','pct')}{inputCell('doubleHung','final')}{inputCell('doubleHung','finalAdj')}
                                  <td className="px-4 py-3 text-right text-gray-400 border-l-4 border-blue-300 bg-blue-50/30">{lDhCalc.full ? fmt(lDhCalc.full) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-400 bg-blue-50/30">{lDhCalc.disc ? fmt(lDhCalc.disc) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-400 bg-green-50/30">{lDhCalc.final ? fmt(lDhCalc.final) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-400 bg-purple-50/30">{lDhCalc.finalAdj ? fmt(lDhCalc.finalAdj) : '—'}</td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">Euro Doors</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmtInt(dQ)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmtInt(dF)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmt(dSq)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{dN ? `€${fmt(dN)}` : '—'}</td>
                                  {inputCell('euroDoors','full')}{inputCell('euroDoors','pct')}{inputCell('euroDoors','final')}{inputCell('euroDoors','finalAdj')}
                                  <td className="px-4 py-3 text-right text-gray-700 border-l-4 border-blue-300 bg-blue-50/30">{lEdCalc.full ? fmt(lEdCalc.full) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 bg-blue-50/30">{lEdCalc.disc ? fmt(lEdCalc.disc) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 bg-green-50/30">{lEdCalc.final ? fmt(lEdCalc.final) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 bg-purple-50/30">{lEdCalc.finalAdj ? fmt(lEdCalc.finalAdj) : '—'}</td>
                                </tr>
                                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                                  <td className="px-4 py-3 text-gray-900">Total</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{fmtInt(totQ)}</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{fmtInt(totF)}</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{fmt(totSq)}</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{totN ? `€${fmt(totN)}` : '—'}</td>
                                  {(['full','pct','final','finalAdj'] as const).map(f => {
                                    const s = (p((locQtot?.euroWindows as any)?.[f])||0)+(p((locQtot?.doubleHung as any)?.[f])||0)+(p((locQtot?.euroDoors as any)?.[f])||0);
                                    return <td key={f} className="px-4 py-3 text-right text-gray-900">{s ? `$${fmt(s)}` : '—'}</td>;
                                  })}
                                  <td className="px-4 py-3 text-right text-gray-900 border-l-4 border-blue-300 bg-blue-50/60">{lGtCalc.full ? fmt(lGtCalc.full) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-900 bg-blue-50/60">{lGtCalc.disc ? fmt(lGtCalc.disc) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-900 bg-green-50/60">{lGtCalc.final ? fmt(lGtCalc.final) : '—'}</td>
                                  <td className="px-4 py-3 text-right text-gray-900 bg-purple-50/60">{lGtCalc.finalAdj ? fmt(lGtCalc.finalAdj) : '—'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                      {/* Per-location tables when multi-location */}
                      {editingSummary.hasMultipleLocations && (editingSummary.subLocations ?? []).map(loc => renderQuoteTotalsTable(
                        loc.label,
                        loc.rows,
                        loc.doorRows,
                        loc.quoteTotals,
                        (qt) => setEditingSummary({ ...editingSummary, subLocations: editingSummary.subLocations!.map(l => l.id === loc.id ? { ...l, quoteTotals: qt } : l) })
                      ))}
                      {/* Grand total (or the only table in single-location mode) */}
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                          <h3 className="text-lg font-semibold text-gray-900">{editingSummary.hasMultipleLocations ? 'Grand Total — All Locations' : 'Quote Totals'}</h3>
                          <p className="text-sm text-gray-500 mt-1">Aggregated from the data entry sheet</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                            <colgroup>
                              <col style={{ width: '11%' }} />
                              <col style={{ width: '5%' }} />
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '9%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '9%' }} />
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '7%' }} />
                            </colgroup>
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                {/* Quote Totals headers */}
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Fields</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Sq Feet</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">NET €</th>
                                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Full</th>
                                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">%__</th>
                                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">FINAL</th>
                                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">FINAL W/ ADJ.</th>
                                {/* Calculated Totals headers — separated by thick border */}
                                <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider border-l-4 border-blue-300 bg-blue-50/60">Full</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider bg-blue-50/60">Disc</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-50/60">Final</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-purple-700 uppercase tracking-wider bg-purple-50/60">Final W/ Adj</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {/* Euro Windows */}
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-gray-900">Euro Windows</span>
                                    <button onClick={() => setExpandedQtRows(p => ({ ...p, euroWindows: !p['euroWindows'] }))} className="shrink-0 text-xs px-2 py-0.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 bg-white">{expandedQtRows['euroWindows'] ? '▾ Hide' : '▸ Breakdown'}</button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(euroWindowQty)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(euroWindowFields)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmt(euroWindowSqFt)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{euroWindowNet ? `€${fmt(euroWindowNet)}` : '—'}</td>
                                {['full','pct','final','finalAdj'].map(f => (
                                  <td key={`ew-${f}`} className="px-1 py-1">
                                    <input type="text" value={(editingSummary.quoteTotals?.euroWindows as any)?.[f] || ''} onChange={(e) => setEditingSummary({...editingSummary, quoteTotals: {...(editingSummary.quoteTotals || {euroWindows:{full:'',pct:'',final:'',finalAdj:''},doubleHung:{full:'',pct:'',final:'',finalAdj:''},euroDoors:{full:'',pct:'',final:'',finalAdj:''}}), euroWindows: {...(editingSummary.quoteTotals?.euroWindows || {full:'',pct:'',final:'',finalAdj:''}), [f]: e.target.value}}})} className="w-full px-2 py-1.5 text-right text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40" placeholder="—" />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right text-gray-700 border-l-4 border-blue-300 bg-blue-50/30">{ewCalc.full ? fmt(ewCalc.full) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-blue-50/30">{ewCalc.disc ? fmt(ewCalc.disc) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-green-50/30">{ewCalc.final ? fmt(ewCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-purple-50/30">{ewCalc.finalAdj ? fmt(ewCalc.finalAdj) : '—'}</td>
                              </tr>
                              {expandedQtRows['euroWindows'] && (() => {
                                const grouped = Object.entries(
                                  nonHungRows.reduce((acc: Record<string, {qty:number,fields:number,sqFt:number,net:number}>, row) => {
                                    const parts = [(row as any).type, (row as any).type2, (row as any).type3, (row as any).type4].filter(Boolean);
                                    const t = parts.length ? parts.join(' w/ ') : '—';
                                    if (!acc[t]) acc[t] = {qty:0,fields:0,sqFt:0,net:0};
                                    acc[t].qty += parseFloat((row as any).qty) || 0;
                                    acc[t].fields += parseFloat((row as any).fieldsTotal) || 0;
                                    acc[t].sqFt += parseFloat((row as any).sqFeetTotal) || 0;
                                    acc[t].net += parseFloat((row as any).netEuroTotal) || 0;
                                    return acc;
                                  }, {})
                                );
                                if (!grouped.length) return null;
                                return (<>
                                  <tr className="bg-indigo-50/60 border-y border-indigo-200">
                                    <td className="pl-8 pr-2 py-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wide">↳ Type</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Qty</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Fields</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Sq Ft</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">NET €</td>
                                    <td colSpan={8}></td>
                                  </tr>
                                  {grouped.map(([type, vals]) => (
                                    <tr key={type} className="bg-indigo-50/20 border-b border-indigo-100">
                                      <td className="pl-8 pr-2 py-1.5 text-xs text-gray-700">{type}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmtInt(vals.qty)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmtInt(vals.fields)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmt(vals.sqFt)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{vals.net ? `€${fmt(vals.net)}` : '—'}</td>
                                      <td colSpan={8}></td>
                                    </tr>
                                  ))}
                                </>);
                              })()}
                              {/* Double Hung */}
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-gray-900">Double Hung</span>
                                    <button onClick={() => setExpandedQtRows(p => ({ ...p, doubleHung: !p['doubleHung'] }))} className="shrink-0 text-xs px-2 py-0.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 bg-white">{expandedQtRows['doubleHung'] ? '▾ Hide' : '▸ Breakdown'}</button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(doubleHungQty)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(doubleHungFields)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmt(doubleHungSqFt)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{doubleHungNet ? `€${fmt(doubleHungNet)}` : '—'}</td>
                                {['full','pct','final','finalAdj'].map(f => (
                                  <td key={`dh-${f}`} className="px-1 py-1">
                                    <input type="text" value={(editingSummary.quoteTotals?.doubleHung as any)?.[f] || ''} onChange={(e) => setEditingSummary({...editingSummary, quoteTotals: {...(editingSummary.quoteTotals || {euroWindows:{full:'',pct:'',final:'',finalAdj:''},doubleHung:{full:'',pct:'',final:'',finalAdj:''},euroDoors:{full:'',pct:'',final:'',finalAdj:''}}), doubleHung: {...(editingSummary.quoteTotals?.doubleHung || {full:'',pct:'',final:'',finalAdj:''}), [f]: e.target.value}}})} className="w-full px-2 py-1.5 text-right text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40" placeholder="—" />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right text-gray-400 border-l-4 border-blue-300 bg-blue-50/30">{dhCalc.full ? fmt(dhCalc.full) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-400 bg-blue-50/30">{dhCalc.disc ? fmt(dhCalc.disc) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-400 bg-green-50/30">{dhCalc.final ? fmt(dhCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-400 bg-purple-50/30">{dhCalc.finalAdj ? fmt(dhCalc.finalAdj) : '—'}</td>
                              </tr>
                              {expandedQtRows['doubleHung'] && (() => {
                                const grouped = Object.entries(
                                  hungRows.reduce((acc: Record<string, {qty:number,fields:number,sqFt:number,net:number}>, row) => {
                                    const parts = [(row as any).type, (row as any).type2, (row as any).type3, (row as any).type4].filter(Boolean);
                                    const t = parts.length ? parts.join(' w/ ') : '—';
                                    if (!acc[t]) acc[t] = {qty:0,fields:0,sqFt:0,net:0};
                                    acc[t].qty += parseFloat((row as any).qty) || 0;
                                    acc[t].fields += parseFloat((row as any).fieldsTotal) || 0;
                                    acc[t].sqFt += parseFloat((row as any).sqFeetTotal) || 0;
                                    acc[t].net += parseFloat((row as any).netEuroTotal) || 0;
                                    return acc;
                                  }, {})
                                );
                                if (!grouped.length) return null;
                                return (<>
                                  <tr className="bg-indigo-50/60 border-y border-indigo-200">
                                    <td className="pl-8 pr-2 py-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wide">↳ Type</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Qty</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Fields</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Sq Ft</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">NET €</td>
                                    <td colSpan={8}></td>
                                  </tr>
                                  {grouped.map(([type, vals]) => (
                                    <tr key={type} className="bg-indigo-50/20 border-b border-indigo-100">
                                      <td className="pl-8 pr-2 py-1.5 text-xs text-gray-700">{type}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmtInt(vals.qty)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmtInt(vals.fields)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmt(vals.sqFt)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{vals.net ? `€${fmt(vals.net)}` : '—'}</td>
                                      <td colSpan={8}></td>
                                    </tr>
                                  ))}
                                </>);
                              })()}
                              {/* Euro Doors */}
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-gray-900">Euro Doors</span>
                                    <button onClick={() => setExpandedQtRows(p => ({ ...p, euroDoors: !p['euroDoors'] }))} className="shrink-0 text-xs px-2 py-0.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 bg-white">{expandedQtRows['euroDoors'] ? '▾ Hide' : '▸ Breakdown'}</button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(doorQty)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(doorFields)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmt(doorSqFt)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{doorNet ? `€${fmt(doorNet)}` : '—'}</td>
                                {['full','pct','final','finalAdj'].map(f => (
                                  <td key={`ed-${f}`} className="px-1 py-1">
                                    <input type="text" value={(editingSummary.quoteTotals?.euroDoors as any)?.[f] || ''} onChange={(e) => setEditingSummary({...editingSummary, quoteTotals: {...(editingSummary.quoteTotals || {euroWindows:{full:'',pct:'',final:'',finalAdj:''},doubleHung:{full:'',pct:'',final:'',finalAdj:''},euroDoors:{full:'',pct:'',final:'',finalAdj:''}}), euroDoors: {...(editingSummary.quoteTotals?.euroDoors || {full:'',pct:'',final:'',finalAdj:''}), [f]: e.target.value}}})} className="w-full px-2 py-1.5 text-right text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40" placeholder="—" />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right text-gray-700 border-l-4 border-blue-300 bg-blue-50/30">{edCalc.full ? fmt(edCalc.full) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-blue-50/30">{edCalc.disc ? fmt(edCalc.disc) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-green-50/30">{edCalc.final ? fmt(edCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-purple-50/30">{edCalc.finalAdj ? fmt(edCalc.finalAdj) : '—'}</td>
                              </tr>
                              {expandedQtRows['euroDoors'] && (() => {
                                const grouped = Object.entries(
                                  allDoorRowsP2.reduce((acc: Record<string, {qty:number,fields:number,sqFt:number,net:number}>, row) => {
                                    const parts = [(row as any).type, (row as any).type2, (row as any).type3, (row as any).type4].filter(Boolean);
                                    const t = parts.length ? parts.join(' w/ ') : '—';
                                    if (!acc[t]) acc[t] = {qty:0,fields:0,sqFt:0,net:0};
                                    acc[t].qty += parseFloat((row as any).qty) || 0;
                                    acc[t].fields += parseFloat((row as any).fieldsTotal) || 0;
                                    acc[t].sqFt += parseFloat((row as any).sqFeetTotal) || 0;
                                    acc[t].net += parseFloat((row as any).netEuroTotal) || 0;
                                    return acc;
                                  }, {})
                                );
                                if (!grouped.length) return null;
                                return (<>
                                  <tr className="bg-indigo-50/60 border-y border-indigo-200">
                                    <td className="pl-8 pr-2 py-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wide">↳ Type</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Qty</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Fields</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">Sq Ft</td>
                                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-500 text-right">NET €</td>
                                    <td colSpan={8}></td>
                                  </tr>
                                  {grouped.map(([type, vals]) => (
                                    <tr key={type} className="bg-indigo-50/20 border-b border-indigo-100">
                                      <td className="pl-8 pr-2 py-1.5 text-xs text-gray-700">{type}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmtInt(vals.qty)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmtInt(vals.fields)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{fmt(vals.sqFt)}</td>
                                      <td className="px-4 py-1.5 text-right text-xs text-gray-600">{vals.net ? `€${fmt(vals.net)}` : '—'}</td>
                                      <td colSpan={8}></td>
                                    </tr>
                                  ))}
                                </>);
                              })()}
                              {/* Total (sum of EW+DH+ED before adjustment) */}
                              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                                <td className="px-4 py-3 text-gray-900">Total</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmtInt(totalQty)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmtInt(totalFields)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmt(totalSqFt)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{totalNet ? `€${fmt(totalNet)}` : '—'}</td>
                                {['full','pct','final','finalAdj'].map(f => {
                                  const sumQt = editingSummary.hasMultipleLocations
                                    ? (editingSummary.subLocations ?? []).reduce((acc, l) => {
                                        const qt = l.quoteTotals;
                                        return acc + (parseFloat((qt?.euroWindows as any)?.[f]||'0')||0) + (parseFloat((qt?.doubleHung as any)?.[f]||'0')||0) + (parseFloat((qt?.euroDoors as any)?.[f]||'0')||0);
                                      }, 0)
                                    : (() => { const qt = editingSummary.quoteTotals; return (parseFloat((qt?.euroWindows as any)?.[f]||'0')||0)+(parseFloat((qt?.doubleHung as any)?.[f]||'0')||0)+(parseFloat((qt?.euroDoors as any)?.[f]||'0')||0); })();
                                  return <td key={`tot-${f}`} className="px-4 py-3 text-right text-gray-900">{sumQt ? `$${fmt(sumQt)}` : '—'}</td>;
                                })}
                                <td className="px-4 py-3 text-right text-gray-900 border-l-4 border-blue-300 bg-blue-50/60">{gtCalc.full ? fmt(gtCalc.full) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-blue-50/60">{gtCalc.disc ? fmt(gtCalc.disc) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-green-50/60">{gtCalc.final ? fmt(gtCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-purple-50/60">{gtCalc.finalAdj ? fmt(gtCalc.finalAdj) : '—'}</td>
                              </tr>
                              {/* Final Adjustment */}
                              <tr className="hover:bg-amber-50 border-t border-amber-200">
                                <td className="px-4 py-3 font-medium text-amber-800">Final Adjustment</td>
                                <td className="px-4 py-3 text-right text-gray-400">—</td>
                                <td className="px-4 py-3 text-right text-gray-400">—</td>
                                <td className="px-4 py-3 text-right text-gray-400">—</td>
                                <td className="px-4 py-3 text-right text-gray-400">—</td>
                                {(['full','pct','final','finalAdj'] as const).map(f => (
                                  <td key={`adj-${f}`} className="px-1 py-1">
                                    <input type="text" value={(editingSummary.grandTotalAdjustment as any)?.[f] || ''} onChange={(e) => setEditingSummary({ ...editingSummary, grandTotalAdjustment: { full: '', pct: '', final: '', finalAdj: '', ...(editingSummary.grandTotalAdjustment || {}), [f]: e.target.value } })} className="w-full px-2 py-1.5 text-right text-sm border border-amber-300 rounded focus:ring-1 focus:ring-amber-400 bg-amber-50/40" placeholder="—" />
                                  </td>
                                ))}
                                <td className="px-4 py-3 border-l-4 border-blue-300 bg-blue-50/30" />
                                <td className="px-4 py-3 bg-blue-50/30" />
                                <td className="px-4 py-3 bg-green-50/30" />
                                <td className="px-4 py-3 bg-purple-50/30" />
                              </tr>
                              {/* Grand Total */}
                              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                                <td className="px-4 py-3 text-gray-900">Grand Total</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmtInt(totalQty)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmtInt(totalFields)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmt(totalSqFt)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{totalNet ? `€${fmt(totalNet)}` : '—'}</td>
                                {['full','pct','final','finalAdj'].map(f => {
                                  const adj = parseFloat((editingSummary.grandTotalAdjustment as any)?.[f] || '0') || 0;
                                  // When multi-location, sum across all subLocations; otherwise use top-level quoteTotals
                                  const sumQt = (editingSummary.hasMultipleLocations
                                    ? (editingSummary.subLocations ?? []).reduce((acc, l) => {
                                        const qt = l.quoteTotals;
                                        return acc + (parseFloat((qt?.euroWindows as any)?.[f]||'0')||0) + (parseFloat((qt?.doubleHung as any)?.[f]||'0')||0) + (parseFloat((qt?.euroDoors as any)?.[f]||'0')||0);
                                      }, 0)
                                    : (() => { const qt = editingSummary.quoteTotals; return (parseFloat((qt?.euroWindows as any)?.[f]||'0')||0)+(parseFloat((qt?.doubleHung as any)?.[f]||'0')||0)+(parseFloat((qt?.euroDoors as any)?.[f]||'0')||0); })()) + adj;
                                  return <td key={`gt-${f}`} className="px-4 py-3 text-right text-gray-900">{sumQt ? `$${fmt(sumQt)}` : '—'}</td>;
                                })}
                                <td className="px-4 py-3 text-right text-gray-900 border-l-4 border-blue-300 bg-blue-50/60">{gtCalc.full ? fmt(gtCalc.full) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-blue-50/60">{gtCalc.disc ? fmt(gtCalc.disc) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-green-50/60">{gtCalc.final ? fmt(gtCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-purple-50/60">{gtCalc.finalAdj ? fmt(gtCalc.finalAdj) : '—'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* ── Add-On Items ── */}
                      {(() => {
                        const ao = editingSummary.addOns || {} as any;
                        const defaultAo = { qty: '', frameType: '', woodFrame: '', meshType: '', netEuro: '', full: '', pct: '', final: '', calcFull: '', calcDisc: '', calcFinal: '' };
                        const getAo = (key: string) => ({ ...defaultAo, ...(ao as any)[key] });
                        const aoKeys = ['windowScreens', 'doorScreenSash', 'entryDoor', 'jambExtensions', 'magneticContact', 'finalFinish', 'installation'];
                        const aoSum = (field: string) => aoKeys.reduce((acc, k) => acc + (parseFloat(getAo(k)[field]) || 0), 0);
                        const fmtAo = (v: number) => v ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
                        const calcAo = (key: string) => {
                          const a = getAo(key);
                          const net = parseFloat(a.netEuro) || 0;
                          return {
                            full:  net ? (parseFloat(a.full)  || 0) / net : 0,
                            disc:  net ? (parseFloat(a.pct)   || 0) / net : 0,
                            final: net ? (parseFloat(a.final) || 0) / net : 0,
                          };
                        };
                        const aoCalcDisplay = (key: string, field: 'full' | 'disc' | 'final') => {
                          const v = calcAo(key)[field];
                          return <div className="w-full px-2 py-1.5 text-right text-sm text-gray-700">{v ? fmtAo(v) : '—'}</div>;
                        };
                        const setAo = (key: string, field: string, value: string) => {
                          setEditingSummary({
                            ...editingSummary,
                            addOns: {
                              ...ao,
                              windowScreens: ao.windowScreens || defaultAo,
                              doorScreenSash: ao.doorScreenSash || defaultAo,
                              entryDoor: ao.entryDoor || defaultAo,
                              jambExtensions: ao.jambExtensions || defaultAo,
                              magneticContact: ao.magneticContact || defaultAo,
                              finalFinish: ao.finalFinish || defaultAo,
                              installation: ao.installation || defaultAo,
                              [key]: { ...getAo(key), [field]: value },
                            },
                          });
                        };

                        const inp = (key: string, field: string, placeholder?: string) => (
                          <input type="text" value={getAo(key)[field] || ''} onChange={(e) => setAo(key, field, e.target.value)} className="w-full px-2 py-1.5 text-right text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40" placeholder={placeholder || '—'} />
                        );

                        const inpLeft = (key: string, field: string, placeholder?: string) => (
                          <input type="text" value={getAo(key)[field] || ''} onChange={(e) => setAo(key, field, e.target.value)} className="w-full px-2 py-1.5 text-left text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40" placeholder={placeholder || '—'} />
                        );

                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                              <h3 className="text-lg font-semibold text-gray-900">Add-On Items</h3>
                              <p className="text-sm text-gray-500 mt-1">Additional line items below the quote totals</p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                                <colgroup>
                                  <col style={{ width: '11%' }} />
                                  <col style={{ width: '5%' }} />
                                  <col style={{ width: '7%' }} />
                                  <col style={{ width: '7%' }} />
                                  <col style={{ width: '9%' }} />
                                  <col style={{ width: '8%' }} />
                                  <col style={{ width: '7%' }} />
                                  <col style={{ width: '8%' }} />
                                  <col style={{ width: '9%' }} />
                                  <col style={{ width: '7%' }} />
                                  <col style={{ width: '7%' }} />
                                  <col style={{ width: '8%' }} />
                                  <col style={{ width: '7%' }} />
                                </colgroup>
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" colSpan={2}>Details</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">NET €</th>
                                    <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Full</th>
                                    <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">%__</th>
                                    <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">FINAL</th>
                                    <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider border-l-4 border-blue-300 bg-blue-50/60">Full</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider bg-blue-50/60">Disc</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-50/60">Final</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-purple-700 uppercase tracking-wider bg-purple-50/60"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {/* Window Screens */}
                                  <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">Window Screens</td>
                                    <td className="px-1 py-1">{inp('windowScreens', 'qty', 'Qty')}</td>
                                    <td className="px-1 py-1">{inpLeft('windowScreens', 'frameType', 'Frame Type')}</td>
                                    <td className="px-1 py-1">{inpLeft('windowScreens', 'meshType', 'Mesh Type')}</td>
                                    <td className="px-1 py-1">{inp('windowScreens', 'netEuro')}</td>
                                    <td className="px-1 py-1">{inp('windowScreens', 'full')}</td>
                                    <td className="px-1 py-1">{inp('windowScreens', 'pct')}</td>
                                    <td className="px-1 py-1">{inp('windowScreens', 'final')}</td>
                                    <td className="px-1 py-1"></td>
                                    <td className="px-1 py-1 border-l-4 border-blue-300 bg-blue-50/30">{aoCalcDisplay('windowScreens', 'full')}</td>
                                    <td className="px-1 py-1 bg-blue-50/30">{aoCalcDisplay('windowScreens', 'disc')}</td>
                                    <td className="px-1 py-1 bg-green-50/30">{aoCalcDisplay('windowScreens', 'final')}</td>
                                    <td className="px-1 py-1 bg-purple-50/30"></td>
                                  </tr>
                                  {/* Door Screen Sash */}
                                  <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">Door Screen Sash</td>
                                    <td className="px-1 py-1">{inp('doorScreenSash', 'qty', 'Qty')}</td>
                                    <td className="px-1 py-1">{inpLeft('doorScreenSash', 'woodFrame', 'Wood Frame')}</td>
                                    <td className="px-1 py-1">{inpLeft('doorScreenSash', 'meshType', 'Mesh Type')}</td>
                                    <td className="px-1 py-1">{inp('doorScreenSash', 'netEuro')}</td>
                                    <td className="px-1 py-1">{inp('doorScreenSash', 'full')}</td>
                                    <td className="px-1 py-1">{inp('doorScreenSash', 'pct')}</td>
                                    <td className="px-1 py-1">{inp('doorScreenSash', 'final')}</td>
                                    <td className="px-1 py-1"></td>
                                    <td className="px-1 py-1 border-l-4 border-blue-300 bg-blue-50/30">{aoCalcDisplay('doorScreenSash', 'full')}</td>
                                    <td className="px-1 py-1 bg-blue-50/30">{aoCalcDisplay('doorScreenSash', 'disc')}</td>
                                    <td className="px-1 py-1 bg-green-50/30">{aoCalcDisplay('doorScreenSash', 'final')}</td>
                                    <td className="px-1 py-1 bg-purple-50/30"></td>
                                  </tr>
                                  {/* Entry Door */}
                                  <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">Entry Door</td>
                                    <td className="px-1 py-1">{inp('entryDoor', 'qty', 'Qty')}</td>
                                    <td className="px-1 py-1" colSpan={2}></td>
                                    <td className="px-1 py-1">{inp('entryDoor', 'netEuro')}</td>
                                    <td className="px-1 py-1">{inp('entryDoor', 'full')}</td>
                                    <td className="px-1 py-1">{inp('entryDoor', 'pct')}</td>
                                    <td className="px-1 py-1">{inp('entryDoor', 'final')}</td>
                                    <td className="px-1 py-1"></td>
                                    <td className="px-1 py-1 border-l-4 border-blue-300 bg-blue-50/30">{aoCalcDisplay('entryDoor', 'full')}</td>
                                    <td className="px-1 py-1 bg-blue-50/30">{aoCalcDisplay('entryDoor', 'disc')}</td>
                                    <td className="px-1 py-1 bg-green-50/30">{aoCalcDisplay('entryDoor', 'final')}</td>
                                    <td className="px-1 py-1 bg-purple-50/30"></td>
                                  </tr>
                                  {/* Jamb Extensions */}
                                  <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">Jamb Extensions</td>
                                    <td className="px-4 py-2"></td>
                                    <td className="px-1 py-1" colSpan={2}></td>
                                    <td className="px-1 py-1">{inp('jambExtensions', 'netEuro')}</td>
                                    <td className="px-1 py-1">{inp('jambExtensions', 'full')}</td>
                                    <td className="px-1 py-1">{inp('jambExtensions', 'pct')}</td>
                                    <td className="px-1 py-1">{inp('jambExtensions', 'final')}</td>
                                    <td className="px-1 py-1"></td>
                                    <td className="px-1 py-1 border-l-4 border-blue-300 bg-blue-50/30">{aoCalcDisplay('jambExtensions', 'full')}</td>
                                    <td className="px-1 py-1 bg-blue-50/30">{aoCalcDisplay('jambExtensions', 'disc')}</td>
                                    <td className="px-1 py-1 bg-green-50/30">{aoCalcDisplay('jambExtensions', 'final')}</td>
                                    <td className="px-1 py-1 bg-purple-50/30"></td>
                                  </tr>
                                  {/* Magnetic Contact */}
                                  <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">Magnetic Contact</td>
                                    <td className="px-1 py-1">{inp('magneticContact', 'qty', 'Qty')}</td>
                                    <td className="px-1 py-1" colSpan={2}></td>
                                    <td className="px-1 py-1">{inp('magneticContact', 'netEuro')}</td>
                                    <td className="px-1 py-1">{inp('magneticContact', 'full')}</td>
                                    <td className="px-1 py-1">{inp('magneticContact', 'pct')}</td>
                                    <td className="px-1 py-1">{inp('magneticContact', 'final')}</td>
                                    <td className="px-1 py-1"></td>
                                    <td className="px-1 py-1 border-l-4 border-blue-300 bg-blue-50/30">{aoCalcDisplay('magneticContact', 'full')}</td>
                                    <td className="px-1 py-1 bg-blue-50/30">{aoCalcDisplay('magneticContact', 'disc')}</td>
                                    <td className="px-1 py-1 bg-green-50/30">{aoCalcDisplay('magneticContact', 'final')}</td>
                                    <td className="px-1 py-1 bg-purple-50/30"></td>
                                  </tr>
                                  {/* Final Finish */}
                                  <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">Final Finish</td>
                                    <td className="px-4 py-2"></td>
                                    <td className="px-1 py-1" colSpan={2}></td>
                                    <td className="px-1 py-1">{inp('finalFinish', 'netEuro')}</td>
                                    <td className="px-1 py-1">{inp('finalFinish', 'full')}</td>
                                    <td className="px-1 py-1">{inp('finalFinish', 'pct')}</td>
                                    <td className="px-1 py-1">{inp('finalFinish', 'final')}</td>
                                    <td className="px-1 py-1"></td>
                                    <td className="px-1 py-1 border-l-4 border-blue-300 bg-blue-50/30">{aoCalcDisplay('finalFinish', 'full')}</td>
                                    <td className="px-1 py-1 bg-blue-50/30">{aoCalcDisplay('finalFinish', 'disc')}</td>
                                    <td className="px-1 py-1 bg-green-50/30">{aoCalcDisplay('finalFinish', 'final')}</td>
                                    <td className="px-1 py-1 bg-purple-50/30"></td>
                                  </tr>
                                  {/* Installation */}
                                  <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">Installation</td>
                                    <td className="px-4 py-2"></td>
                                    <td className="px-1 py-1" colSpan={2}></td>
                                    <td className="px-1 py-1">{inp('installation', 'netEuro')}</td>
                                    <td className="px-1 py-1">{inp('installation', 'full')}</td>
                                    <td className="px-1 py-1">{inp('installation', 'pct')}</td>
                                    <td className="px-1 py-1">{inp('installation', 'final')}</td>
                                    <td className="px-1 py-1"></td>
                                    <td className="px-1 py-1 border-l-4 border-blue-300 bg-blue-50/30">{aoCalcDisplay('installation', 'full')}</td>
                                    <td className="px-1 py-1 bg-blue-50/30">{aoCalcDisplay('installation', 'disc')}</td>
                                    <td className="px-1 py-1 bg-green-50/30">{aoCalcDisplay('installation', 'final')}</td>
                                    <td className="px-1 py-1 bg-purple-50/30"></td>
                                  </tr>
                                  {/* Total row */}
                                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                                    <td className="px-4 py-3 text-gray-900">Total</td>
                                    <td className="px-4 py-3 text-right text-gray-900">{fmtAo(aoSum('qty'))}</td>
                                    <td colSpan={2}></td>
                                    <td className="px-4 py-3 text-right text-gray-900">{fmtAo(aoSum('netEuro'))}</td>
                                    <td className="px-4 py-3 text-right text-gray-900">{fmtAo(aoSum('full'))}</td>
                                    <td className="px-4 py-3 text-right text-gray-900">{fmtAo(aoSum('pct'))}</td>
                                    <td className="px-4 py-3 text-right text-gray-900">{fmtAo(aoSum('final'))}</td>
                                    <td></td>
                                    <td className="px-4 py-3 text-right text-gray-900 border-l-4 border-blue-300 bg-blue-50/60">{(() => { const n=aoSum('netEuro'); return n ? fmtAo(aoSum('full')/n) : '—'; })()}</td>
                                    <td className="px-4 py-3 text-right text-gray-900 bg-blue-50/60">{(() => { const n=aoSum('netEuro'); return n ? fmtAo(aoSum('pct')/n) : '—'; })()}</td>
                                    <td className="px-4 py-3 text-right text-gray-900 bg-green-50/60">{(() => { const n=aoSum('netEuro'); return n ? fmtAo(aoSum('final')/n) : '—'; })()}</td>
                                    <td className="bg-purple-50/60"></td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </>);
                  })()}
                </div>
              )}

              {/* ===== PAGE 1 — Data Entry (existing content) ===== */}
              {activePage === 1 && (<>
              {/* Basic Info */}
              <div className="grid grid-cols-6 gap-3 print-summary-info">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingSummary.name}
                    onChange={(e) => setEditingSummary({ ...editingSummary, name: e.target.value })}
                    maxLength={400}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40"
                    placeholder="Enter job name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Salesman <span className="text-red-500">*</span></label>
                  <select
                    value={editingSummary.salesman}
                    onChange={(e) => setEditingSummary({ ...editingSummary, salesman: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40"
                  >
                    <option value="">Select salesman</option>
                    <option value="Andy">Andy</option>
                    <option value="Tim">Tim</option>
                    <option value="Ralph">Ralph</option>
                    <option value="Jim">Jim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Opportunity # <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingSummary.opportunityNumber}
                    onChange={(e) => setEditingSummary({ ...editingSummary, opportunityNumber: e.target.value })}
                    maxLength={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40"
                    placeholder="Enter opportunity #"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Type <span className="text-red-500">*</span></label>
                  <select
                    value={editingSummary.jobType}
                    onChange={(e) => setEditingSummary({ ...editingSummary, jobType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40"
                  >
                    <option value="">Select job type</option>
                    <option value="Premium">Premium</option>
                    <option value="Coastal">Coastal</option>
                    <option value="Dade County">Dade County</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimator <span className="text-red-500">*</span></label>
                  <select
                    value={editingSummary.estimator}
                    onChange={(e) => setEditingSummary({ ...editingSummary, estimator: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40"
                  >
                    <option value="">Select estimator</option>
                    <option value="Julian">Julian</option>
                    <option value="Nancy">Nancy</option>
                    <option value="Krystyna">Krystyna</option>
                    <option value="Estafania">Estafania</option>
                    <option value="Marianna">Marianna</option>
                    <option value="Michael">Michael</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date <span className="text-red-500">*</span></label>
                  <DateInput
                    value={editingSummary.date}
                    onChange={(iso) => setEditingSummary({ ...editingSummary, date: iso })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40"
                  />
                </div>
              </div>

              {/* Multiple Locations Toggle + Sub-tabs */}
              <div className="flex flex-wrap items-center gap-3 mt-4 print:hidden">
                <button
                  onClick={() => {
                    if (!editingSummary.hasMultipleLocations) {
                      const firstLoc: SummarySubLocation = {
                        id: Date.now().toString(),
                        label: '',
                        rows: editingSummary.rows,
                        doorRows: editingSummary.doorRows,
                        quoteTotals: editingSummary.quoteTotals ?? defaultQuoteTotals(),
                      };
                      setEditingSummary({ ...editingSummary, hasMultipleLocations: true, subLocations: [firstLoc], rows: [], doorRows: [] });
                      setActiveLocationId(firstLoc.id);
                    } else {
                      const allRows = (editingSummary.subLocations ?? []).flatMap(l => l.rows);
                      const allDoorRows = (editingSummary.subLocations ?? []).flatMap(l => l.doorRows);
                      setEditingSummary({ ...editingSummary, hasMultipleLocations: false, subLocations: [], rows: allRows, doorRows: allDoorRows });
                      setActiveLocationId('');
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    editingSummary.hasMultipleLocations
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  Job Has Multiple Locations
                </button>
              </div>

              {editingSummary.hasMultipleLocations && editingSummary.subLocations && (
                <div className="flex flex-wrap items-center gap-2 mt-3 print:hidden">
                  <span className="text-xs font-medium text-gray-500">Location:</span>
                  {editingSummary.subLocations.map(loc => {
                    const isActive = (activeLocationId || editingSummary.subLocations![0]!.id) === loc.id;
                    return (
                      <div key={loc.id} className="flex items-center">
                        <input
                          value={loc.label}
                          onChange={(e) => setEditingSummary({
                            ...editingSummary,
                            subLocations: editingSummary.subLocations!.map(l =>
                              l.id === loc.id ? { ...l, label: e.target.value } : l
                            ),
                          })}
                          onFocus={() => setActiveLocationId(loc.id)}
                          placeholder="Location name"
                          className={`px-3 py-1.5 text-sm font-medium border transition-colors w-36 ${
                            editingSummary.subLocations!.length > 1 ? 'rounded-l-lg' : 'rounded-lg'
                          } ${
                            isActive
                              ? 'bg-brand-navy text-white border-brand-navy placeholder-white/50 outline-none'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 outline-none focus:border-brand-navy'
                          }`}
                        />
                        {editingSummary.subLocations!.length > 1 && (
                          <button
                            onClick={() => {
                              const remaining = editingSummary.subLocations!.filter(l => l.id !== loc.id);
                              setEditingSummary({ ...editingSummary, subLocations: remaining });
                              if (isActive) setActiveLocationId(remaining[0]?.id ?? '');
                            }}
                            className={`px-1.5 py-1.5 text-xs border-y border-r rounded-r-lg transition-colors ${
                              isActive
                                ? 'bg-brand-navy text-white border-brand-navy hover:bg-red-600 hover:border-red-600'
                                : 'bg-white text-gray-400 border-gray-300 hover:bg-red-50 hover:text-red-600'
                            }`}
                          >×</button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => {
                      const nextLabel = '';
                      const newLoc: SummarySubLocation = {
                        id: Date.now().toString(),
                        label: nextLabel,
                        rows: [],
                        doorRows: [],
                        quoteTotals: defaultQuoteTotals(),
                      };
                      setEditingSummary({ ...editingSummary, subLocations: [...editingSummary.subLocations!, newLoc] });
                      setActiveLocationId(newLoc.id);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-brand-navy border border-brand-navy rounded-lg hover:bg-brand-navy/5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Location
                  </button>
                </div>
              )}

              {/* Main Table */}
              <div className="border rounded-lg overflow-hidden print-section mt-4">
                <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Windows</h3>
                  <div className="flex items-center gap-4 print:hidden">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showType3}
                        onChange={(e) => setShowType3(e.target.checked)}
                        className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy/40"
                      />
                      Type 3
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showType4}
                        onChange={(e) => setShowType4(e.target.checked)}
                        className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy/40"
                      />
                      Type 4
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showMagneticContact}
                        onChange={(e) => setShowMagneticContact(e.target.checked)}
                        className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy/40"
                      />
                      Mag. Contact
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showShadeBoxesNoTrim}
                        onChange={(e) => setShowShadeBoxesNoTrim(e.target.checked)}
                        className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy/40"
                      />
                      No Trim
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showShadeBoxesWithTrim}
                        onChange={(e) => setShowShadeBoxesWithTrim(e.target.checked)}
                        className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy/40"
                      />
                      With Trim
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showFinalFinish}
                        onChange={(e) => setShowFinalFinish(e.target.checked)}
                        className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy/40"
                      />
                      Final Finish
                    </label>
                    <button
                      onClick={handleAddRow}
                      className="inline-flex items-center px-3 py-1.5 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Row
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[800px] overflow-y-auto pb-64">
                  <table className="text-sm">
                    <thead className="bg-gray-100">
                      {/* Spanning header row */}
                      <tr>
                        <th className="px-0.5 py-1 bg-gray-100 border-r border-gray-300" colSpan={22 + (showType3 ? 2 : 0) + (showType4 ? 2 : 0)}></th>
                        {showMagneticContact && <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Magnetic Contact</th>}
                        {showShadeBoxesNoTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Shade Boxes with No Trim</th>}
                        {showShadeBoxesWithTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Shade Boxes with Trim</th>}
                        {showFinalFinish && <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Final Finish</th>}
                        <th className="px-0.5 py-1"></th>
                      </tr>
                      {/* Main header row */}
                      <tr>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'100px'}}>TuS-Position</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'170px'}}>Arch-Position</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'70px'}}>Width (MM)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'70px'}}>Height (MM)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'75px'}}>Width (Ft &amp; In)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'75px'}}>Height (Ft &amp; In)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'65px'}}>Sq Feet (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'65px'}}>Sq Feet (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}>Operable Sashes (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}>Operable Sashes (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Type</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Type 2</th>
                        {showType3 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>}
                        {showType3 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Type 3</th>}
                        {showType4 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>}
                        {showType4 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Type 4</th>}
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Special Remarks</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}>Fields (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}>Fields (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}># Site Mullions (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}># Site Mullions (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'75px'}}>NET € (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'75px'}}>NET € (Total)</th>
                        {showMagneticContact && <th className="px-0.5 py-1 text-center text-xs font-semibold text-green-600 bg-green-50 border-l border-green-300" style={{minWidth:'100px'}}>Per Unit</th>}
                        {showMagneticContact && <th className="px-0.5 py-1 text-center text-xs font-semibold text-green-600 bg-green-50 border-r border-green-300" style={{minWidth:'100px'}}>Per Position</th>}
                        {showShadeBoxesNoTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-orange-600 bg-orange-50 border-l border-orange-300" style={{minWidth:'100px'}}>Per Unit</th>}
                        {showShadeBoxesNoTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-orange-600 bg-orange-50 border-r border-orange-300" style={{minWidth:'100px'}}>Per Position</th>}
                        {showShadeBoxesWithTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-l border-[#b8bfe8]" style={{minWidth:'100px'}}>Per Unit</th>}
                        {showShadeBoxesWithTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-r border-[#b8bfe8]" style={{minWidth:'100px'}}>Per Position</th>}
                        {showFinalFinish && <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-l border-blue-300" style={{minWidth:'100px'}}>Per Unit</th>}
                        {showFinalFinish && <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-r border-blue-300" style={{minWidth:'100px'}}>Per Position</th>}
                        <th className="px-0.5 py-1"></th>
                        <th className="px-0.5 py-1 text-center text-xs font-medium text-gray-700 bg-gray-50 border-l-2 border-gray-400" style={{minWidth:'80px'}}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getActiveRows(editingSummary).map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="tusPosition" value={row.tusPosition} onChange={(v) => updateRow(row.id, 'tusPosition', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="archPosition" value={row.archPosition} onChange={(v) => updateRow(row.id, 'archPosition', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="qty" value={row.qty} onChange={(v) => updateRow(row.id, 'qty', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="widthMM" value={row.widthMM} onChange={(v) => updateRow(row.id, 'widthMM', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="heightMM" value={row.heightMM} onChange={(v) => updateRow(row.id, 'heightMM', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.widthFtIn} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.heightFtIn} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.sqFeetEach} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.sqFeetTotal} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="operableSashesEach" value={row.operableSashesEach} onChange={(v) => updateRow(row.id, 'operableSashesEach', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.operableSashesTotal} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="qty2" value={row.qty2} onChange={(v) => updateRow(row.id, 'qty2', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellDropdown rowId={row.id} field="type" value={row.type} onChange={(v) => updateRow(row.id, 'type', v)} options={WINDOW_TYPES} />
                            {row.type === 'Fixed with Sash' && (
                              <CellDropdown rowId={row.id} field="typeSubOption" value={row.typeSubOption || ''} onChange={(v) => updateRow(row.id, 'typeSubOption', v)} options={WINDOW_TYPES} />
                            )}
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="qty3" value={row.qty3} onChange={(v) => updateRow(row.id, 'qty3', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellDropdown rowId={row.id} field="type2" value={row.type2} onChange={(v) => updateRow(row.id, 'type2', v)} options={WINDOW_TYPES} />
                            {row.type2 === 'Fixed with Sash' && (
                              <CellDropdown rowId={row.id} field="type2SubOption" value={row.type2SubOption || ''} onChange={(v) => updateRow(row.id, 'type2SubOption', v)} options={WINDOW_TYPES} />
                            )}
                          </td>
                          {showType3 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellInput rowId={row.id} field="qty4" value={row.qty4} onChange={(v) => updateRow(row.id, 'qty4', v)} />
                            </td>
                          )}
                          {showType3 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellDropdown rowId={row.id} field="type3" value={row.type3} onChange={(v) => updateRow(row.id, 'type3', v)} options={WINDOW_TYPES} />
                              {row.type3 === 'Fixed with Sash' && (
                                <CellDropdown rowId={row.id} field="type3SubOption" value={row.type3SubOption || ''} onChange={(v) => updateRow(row.id, 'type3SubOption', v)} options={WINDOW_TYPES} />
                              )}
                            </td>
                          )}
                          {showType4 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellInput rowId={row.id} field="qty5" value={row.qty5} onChange={(v) => updateRow(row.id, 'qty5', v)} />
                            </td>
                          )}
                          {showType4 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellDropdown rowId={row.id} field="type4" value={row.type4} onChange={(v) => updateRow(row.id, 'type4', v)} options={WINDOW_TYPES} />
                              {row.type4 === 'Fixed with Sash' && (
                                <CellDropdown rowId={row.id} field="type4SubOption" value={row.type4SubOption || ''} onChange={(v) => updateRow(row.id, 'type4SubOption', v)} options={WINDOW_TYPES} />
                              )}
                            </td>
                          )}
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="specialRemarks" value={row.specialRemarks} onChange={(v) => updateRow(row.id, 'specialRemarks', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="fieldsEach" value={row.fieldsEach} onChange={(v) => updateRow(row.id, 'fieldsEach', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.fieldsTotal} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="siteMullionsEach" value={row.siteMullionsEach} onChange={(v) => updateRow(row.id, 'siteMullionsEach', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.siteMullionsTotal} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="netEuroEach" value={row.netEuroEach} onChange={(v) => updateRow(row.id, 'netEuroEach', v)} onEnterKey={handleAddRow} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.netEuroTotal ? `€${parseFloat(row.netEuroTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''} />
                          </td>
                          {showMagneticContact && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.magneticContactUnit} /></td>}
                          {showMagneticContact && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.magneticContactPosition} /></td>}
                          {showShadeBoxesNoTrim && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.shadeBoxesNoSideTrimUnit} /></td>}
                          {showShadeBoxesNoTrim && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.shadeBoxesNoSideTrimPosition} /></td>}
                          {showShadeBoxesWithTrim && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.shadeBoxesWithSideTrimUnit} /></td>}
                          {showShadeBoxesWithTrim && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.shadeBoxesWithSideTrimPosition} /></td>}
                          {showFinalFinish && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.finalFinishUnit} /></td>}
                          {showFinalFinish && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.finalFinishPosition} /></td>}
                          <td className="px-0.5 py-1"></td>
                          <td className="px-0.5 py-1">
                            <div className="flex gap-1 justify-end mr-2">
                              <button
                                onClick={() => handleAddRowBelow(row.id)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Add row below"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Delete row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Doors Table */}
              <div className="border rounded-lg overflow-hidden mt-6 print-section">
                <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Doors</h3>
                  <div className="flex items-center gap-4 print:hidden">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showType3}
                        onChange={(e) => setShowType3(e.target.checked)}
                      />
                      Type 3
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showType4}
                        onChange={(e) => setShowType4(e.target.checked)}
                      />
                      Type 4
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showMagneticContact}
                        onChange={(e) => setShowMagneticContact(e.target.checked)}
                      />
                      Mag. Contact
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showShadeBoxesNoTrim}
                        onChange={(e) => setShowShadeBoxesNoTrim(e.target.checked)}
                      />
                      No Trim
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showShadeBoxesWithTrim}
                        onChange={(e) => setShowShadeBoxesWithTrim(e.target.checked)}
                      />
                      With Trim
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={showFinalFinish}
                        onChange={(e) => setShowFinalFinish(e.target.checked)}
                      />
                      Final Finish
                    </label>
                    <button
                      onClick={handleAddDoorRow}
                      className="inline-flex items-center px-3 py-1.5 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Row
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[800px] overflow-y-auto pb-64">
                  <table className="text-sm">
                    <thead className="bg-gray-100">
                      {/* Spanning header row */}
                      <tr>
                        <th className="px-0.5 py-1 bg-gray-100 border-r border-gray-300" colSpan={22 + (showType3 ? 2 : 0) + (showType4 ? 2 : 0)}></th>
                        {showMagneticContact && <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Magnetic Contact</th>}
                        {showShadeBoxesNoTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Shade Boxes with No Trim</th>}
                        {showShadeBoxesWithTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Shade Boxes with Trim</th>}
                        {showFinalFinish && <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Final Finish</th>}
                        <th className="px-0.5 py-1"></th>
                      </tr>
                      {/* Main header row */}
                      <tr>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'100px'}}>TuS-Position</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'170px'}}>Arch-Position</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'70px'}}>Width (MM)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'70px'}}>Height (MM)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'75px'}}>Width (Ft &amp; In)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'75px'}}>Height (Ft &amp; In)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'65px'}}>Sq Feet (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700" style={{minWidth:'65px'}}>Sq Feet (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}>Operable Sashes (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}>Operable Sashes (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Type</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Type 2</th>
                        {showType3 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>}
                        {showType3 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Type 3</th>}
                        {showType4 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'58px'}}>Qty</th>}
                        {showType4 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Type 4</th>}
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'200px'}}>Special Remarks</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}>Fields (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}>Fields (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}># Site Mullions (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'65px'}}># Site Mullions (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'75px'}}>NET € (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100" style={{minWidth:'75px'}}>NET € (Total)</th>
                        {showMagneticContact && <th className="px-0.5 py-1 text-center text-xs font-semibold text-green-600 bg-green-50 border-l border-green-300" style={{minWidth:'100px'}}>Per Unit</th>}
                        {showMagneticContact && <th className="px-0.5 py-1 text-center text-xs font-semibold text-green-600 bg-green-50 border-r border-green-300" style={{minWidth:'100px'}}>Per Position</th>}
                        {showShadeBoxesNoTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-orange-600 bg-orange-50 border-l border-orange-300" style={{minWidth:'100px'}}>Per Unit</th>}
                        {showShadeBoxesNoTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-orange-600 bg-orange-50 border-r border-orange-300" style={{minWidth:'100px'}}>Per Position</th>}
                        {showShadeBoxesWithTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-l border-[#b8bfe8]" style={{minWidth:'100px'}}>Per Unit</th>}
                        {showShadeBoxesWithTrim && <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-r border-[#b8bfe8]" style={{minWidth:'100px'}}>Per Position</th>}
                        {showFinalFinish && <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-l border-blue-300" style={{minWidth:'100px'}}>Per Unit</th>}
                        {showFinalFinish && <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-r border-blue-300" style={{minWidth:'100px'}}>Per Position</th>}
                        <th className="px-0.5 py-1"></th>
                        <th className="px-0.5 py-1 text-center text-xs font-medium text-gray-700 bg-gray-50 border-l-2 border-gray-400" style={{minWidth:'80px'}}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getActiveDoorRows(editingSummary).map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="tusPosition" value={row.tusPosition} onChange={(v) => updateDoorRow(row.id, 'tusPosition', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="archPosition" value={row.archPosition} onChange={(v) => updateDoorRow(row.id, 'archPosition', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="qty" value={row.qty} onChange={(v) => updateDoorRow(row.id, 'qty', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="widthMM" value={row.widthMM} onChange={(v) => updateDoorRow(row.id, 'widthMM', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="heightMM" value={row.heightMM} onChange={(v) => updateDoorRow(row.id, 'heightMM', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.widthFtIn} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.heightFtIn} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.sqFeetEach} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.sqFeetTotal} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="operableSashesEach" value={row.operableSashesEach} onChange={(v) => updateDoorRow(row.id, 'operableSashesEach', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.operableSashesTotal} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="qty2" value={row.qty2} onChange={(v) => updateDoorRow(row.id, 'qty2', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellDropdown rowId={row.id} field="type" value={row.type} onChange={(v) => updateDoorRow(row.id, 'type', v)} options={DOOR_TYPES} />
                            {row.type === 'Fixed with Sash' && (
                              <CellDropdown rowId={row.id} field="typeSubOption" value={row.typeSubOption || ''} onChange={(v) => updateDoorRow(row.id, 'typeSubOption', v)} options={DOOR_TYPES} />
                            )}
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="qty3" value={row.qty3} onChange={(v) => updateDoorRow(row.id, 'qty3', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellDropdown rowId={row.id} field="type2" value={row.type2} onChange={(v) => updateDoorRow(row.id, 'type2', v)} options={DOOR_TYPES} />
                            {row.type2 === 'Fixed with Sash' && (
                              <CellDropdown rowId={row.id} field="type2SubOption" value={row.type2SubOption || ''} onChange={(v) => updateDoorRow(row.id, 'type2SubOption', v)} options={DOOR_TYPES} />
                            )}
                          </td>
                          {showType3 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellInput rowId={row.id} field="qty4" value={row.qty4} onChange={(v) => updateDoorRow(row.id, 'qty4', v)} />
                            </td>
                          )}
                          {showType3 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellDropdown rowId={row.id} field="type3" value={row.type3} onChange={(v) => updateDoorRow(row.id, 'type3', v)} options={DOOR_TYPES} />
                              {row.type3 === 'Fixed with Sash' && (
                                <CellDropdown rowId={row.id} field="type3SubOption" value={row.type3SubOption || ''} onChange={(v) => updateDoorRow(row.id, 'type3SubOption', v)} options={DOOR_TYPES} />
                              )}
                            </td>
                          )}
                          {showType4 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellInput rowId={row.id} field="qty5" value={row.qty5} onChange={(v) => updateDoorRow(row.id, 'qty5', v)} />
                            </td>
                          )}
                          {showType4 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellDropdown rowId={row.id} field="type4" value={row.type4} onChange={(v) => updateDoorRow(row.id, 'type4', v)} options={DOOR_TYPES} />
                              {row.type4 === 'Fixed with Sash' && (
                                <CellDropdown rowId={row.id} field="type4SubOption" value={row.type4SubOption || ''} onChange={(v) => updateDoorRow(row.id, 'type4SubOption', v)} options={DOOR_TYPES} />
                              )}
                            </td>
                          )}
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="specialRemarks" value={row.specialRemarks} onChange={(v) => updateDoorRow(row.id, 'specialRemarks', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="fieldsEach" value={row.fieldsEach} onChange={(v) => updateDoorRow(row.id, 'fieldsEach', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.fieldsTotal} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="siteMullionsEach" value={row.siteMullionsEach} onChange={(v) => updateDoorRow(row.id, 'siteMullionsEach', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.siteMullionsTotal} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="netEuroEach" value={row.netEuroEach} onChange={(v) => updateDoorRow(row.id, 'netEuroEach', v)} onEnterKey={handleAddDoorRow} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.netEuroTotal ? `€${parseFloat(row.netEuroTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''} />
                          </td>
                          {showMagneticContact && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.magneticContactUnit} /></td>}
                          {showMagneticContact && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.magneticContactPosition} /></td>}
                          {showShadeBoxesNoTrim && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.shadeBoxesNoSideTrimUnit} /></td>}
                          {showShadeBoxesNoTrim && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.shadeBoxesNoSideTrimPosition} /></td>}
                          {showShadeBoxesWithTrim && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.shadeBoxesWithSideTrimUnit} /></td>}
                          {showShadeBoxesWithTrim && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.shadeBoxesWithSideTrimPosition} /></td>}
                          {showFinalFinish && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.finalFinishUnit} /></td>}
                          {showFinalFinish && <td className="px-0.5 py-1 align-top"><ReadOnlyCellInput value={row.finalFinishPosition} /></td>}
                          <td className="px-0.5 py-1"></td>
                          <td className="px-0.5 py-1">
                            <div className="flex gap-1 justify-end mr-2">
                              <button
                                onClick={() => handleAddDoorRowBelow(row.id)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Add row below"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDoorRow(row.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Delete row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            
              </>)}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between items-center print:hidden">
              <button
                onClick={() => {
                  const oppId = editingSummary?.linkedOpportunityId;
                  setShowNewSummary(false);
                  setEditingSummary(null);
                  setActivePage(1);
                  if (oppId) {
                    router.push(`/opportunities/${oppId}`);
                  }
                }}
                className="px-6 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                {activePage === 1 && (
                  <button
                    onClick={() => { setActivePage(2); window.scrollTo(0, 0); }}
                    className="px-6 py-2 text-sm border border-brand-navy text-brand-navy rounded-lg hover:bg-brand-navy/5 transition-colors"
                  >
                    Next: Page 2 →
                  </button>
                )}
                {activePage === 2 && (
                  <button
                    onClick={() => { setActivePage(1); window.scrollTo(0, 0); }}
                    className="px-6 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    ← Back to Page 1
                  </button>
                )}
                <button
                  onClick={handleSaveSummary}
                  className="inline-flex items-center px-6 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Summary
                </button>
              </div>
            </div>
        </div>
      </div>
      </CellNavContext.Provider>
    )}
    </>
  );
}


















































