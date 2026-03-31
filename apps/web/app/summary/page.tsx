'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  FileSpreadsheet,
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
  Printer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSetting, setSetting } from '@/lib/preferences';
import { usePermissions } from '@/lib/permissions-context';
import { AlertCircle } from 'lucide-react';
import { recordsService } from '@/lib/records-service';

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

// Searchable dropdown cell component for Type columns
const CellDropdown = ({ rowId, field, value, onChange, options }: { 
  rowId: string; 
  field: string; 
  value: string; 
  onChange: (value: string) => void;
  options: string[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adjustHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    adjustHeight(textareaRef.current);
  }, [value]);

  useEffect(() => {
    // Reset highlighted index when filtered options change, or set to 0 when dropdown opens
    if (isOpen && filteredOptions.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [searchTerm, isOpen]);

  useEffect(() => {
    // Scroll highlighted item into view
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
    setTimeout(() => adjustHeight(textareaRef.current), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If dropdown is not open, allow normal navigation
    if (!isOpen || filteredOptions.length === 0) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Navigate to next cell
        const currentCell = e.currentTarget.closest('td');
        if (!currentCell) return;
        
        const currentRow = currentCell.closest('tr');
        if (!currentRow) return;
        
        const cellsInRow = Array.from(currentRow.querySelectorAll('td'));
        const currentIndex = cellsInRow.indexOf(currentCell as HTMLTableCellElement);
        
        // Look for next editable cell in current row
        for (let i = currentIndex + 1; i < cellsInRow.length; i++) {
          const textarea = cellsInRow[i].querySelector('textarea');
          if (textarea) {
            textarea.focus();
            return;
          }
        }
        
        // No more editable cells in current row, move to next row
        const nextRow = currentRow.nextElementSibling as HTMLTableRowElement;
        if (nextRow) {
          const firstEditableCell = nextRow.querySelector('textarea') as HTMLTextAreaElement;
          if (firstEditableCell) {
            firstEditableCell.focus();
          }
        }
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
        break;
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 200);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={searchTerm || value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        className="w-full px-1 py-0.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none overflow-hidden"
        style={{ minHeight: '20px' }}
        rows={1}
        placeholder="Type to search..."
      />
      {isOpen && filteredOptions.length > 0 && (
        <div ref={dropdownRef} className="absolute z-50 w-64 max-h-60 overflow-y-auto bg-white border border-gray-300 shadow-lg rounded mt-1">
          {filteredOptions.map((option, index) => (
            <div
              key={option}
              onClick={() => handleSelectOption(option)}
              className={`px-2 py-1 text-xs cursor-pointer whitespace-normal break-words ${
                index === highlightedIndex ? 'bg-[#e8eaf6] text-brand-dark' : 'hover:bg-[#f0f1fa]'
              }`}
            >
              {option}
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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // If onEnterKey callback provided, call it and return
      if (onEnterKey) {
        // Capture the current element before async operation
        const currentElement = e.currentTarget;
        onEnterKey();
        // Focus first cell of new row after a short delay
        setTimeout(() => {
          const currentRow = currentElement.closest('tr');
          if (!currentRow) return;
          
          const tbody = currentRow.closest('tbody');
          if (!tbody) return;
          
          // Get the last row (newly added)
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const lastRow = rows[rows.length - 1];
          if (lastRow) {
            const firstEditableCell = lastRow.querySelector('textarea') as HTMLTextAreaElement;
            if (firstEditableCell) {
              firstEditableCell.focus();
            }
          }
        }, 50);
        return;
      }
      
      // Find current cell
      const currentCell = e.currentTarget.closest('td');
      if (!currentCell) return;
      
      const currentRow = currentCell.closest('tr');
      if (!currentRow) return;
      
      // Get all cells in current row
      const cellsInRow = Array.from(currentRow.querySelectorAll('td'));
      const currentIndex = cellsInRow.indexOf(currentCell as HTMLTableCellElement);
      
      // Look for next editable cell in current row
      for (let i = currentIndex + 1; i < cellsInRow.length; i++) {
        const textarea = cellsInRow[i].querySelector('textarea');
        if (textarea) {
          textarea.focus();
          return;
        }
      }
      
      // No more editable cells in current row, move to next row
      const nextRow = currentRow.nextElementSibling as HTMLTableRowElement;
      if (nextRow) {
        const firstEditableCell = nextRow.querySelector('textarea') as HTMLTextAreaElement;
        if (firstEditableCell) {
          firstEditableCell.focus();
        }
      }
    }
    
    // Move to previous cell on Backspace when current cell is empty
    if (e.key === 'Backspace' && value === '') {
      e.preventDefault();
      
      // Find current cell
      const currentCell = e.currentTarget.closest('td');
      if (!currentCell) return;
      
      const currentRow = currentCell.closest('tr');
      if (!currentRow) return;
      
      // Get all cells in current row
      const cellsInRow = Array.from(currentRow.querySelectorAll('td'));
      const currentIndex = cellsInRow.indexOf(currentCell as HTMLTableCellElement);
      
      // Look for previous editable cell in current row
      for (let i = currentIndex - 1; i >= 0; i--) {
        const textarea = cellsInRow[i].querySelector('textarea');
        if (textarea) {
          textarea.focus();
          return;
        }
      }
      
      // No more editable cells in current row, move to previous row
      const prevRow = currentRow.previousElementSibling as HTMLTableRowElement;
      if (prevRow) {
        // Find all textareas in previous row
        const textareas = prevRow.querySelectorAll('textarea');
        if (textareas.length > 0) {
          // Focus the last editable cell
          const lastEditableCell = textareas[textareas.length - 1] as HTMLTextAreaElement;
          lastEditableCell.focus();
        }
      }
    }
  };

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      maxLength={400}
      rows={1}
      className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy resize-none overflow-hidden"
      style={{ height: 'auto', minHeight: '24px' }}
      onInput={(e) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
      }}
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

interface Summary {
  id: string;
  name: string;
  salesman: string;
  opportunityNumber: string;
  linkedOpportunityId?: string;
  jobType: string;
  estimator: string;
  date: string;
  address: string;
  quoteType: 'first' | 'requote' | '';
  requoteDescription: string;
  rows: SummaryRow[];
  doorRows: DoorRow[];
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
  product: string;
  productType: string;
  productTypeOptions: string[];
  woodType: string;
  finish: string;
  glassType: string;
  muntinType: string;
  spacerBars: string;
  spacerBarColors: string;
  projectContains: string[];
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
  const [activePage, setActivePage] = useState<1 | 2>(1);
  // Opportunity picker state
  const [showOpportunityPicker, setShowOpportunityPicker] = useState(false);
  const [opportunityRecords, setOpportunityRecords] = useState<any[]>([]);
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

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
    if (!opportunityId) return;
    const opportunityName = searchParams.get('opportunityName') || '';
    const opportunityNumber = searchParams.get('opportunityNumber') || '';
    // Clear query params so refreshing doesn't re-create
    router.replace('/summary');
    createNewSummary({ opportunityId, opportunityName, opportunityNumber });
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

  const handleOpportunitySelected = (record: any) => {
    setShowOpportunityPicker(false);
    createNewSummary({
      opportunityId: record.id,
      opportunityName: record.opportunityName || record.Opportunity__opportunityName || '',
      opportunityNumber: record.opportunityNumber || record.Opportunity__opportunityNumber || '',
    });
  };

  const createNewSummary = (opts?: { opportunityId?: string; opportunityName?: string; opportunityNumber?: string }) => {
    const newSummary: Summary = {
      id: Date.now().toString(),
      name: opts?.opportunityName || '',
      salesman: '',
      opportunityNumber: opts?.opportunityNumber || '',
      linkedOpportunityId: opts?.opportunityId || undefined,
      jobType: '',
      estimator: '',
      date: '',
      address: '',
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
      product: '',
      productType: '',
      productTypeOptions: [],
      woodType: '',
      finish: '',
      glassType: '',
      muntinType: '',
      spacerBars: '',
      spacerBarColors: '',
      projectContains: [],
      createdBy: 'Development User',
      createdAt: new Date().toISOString(),
      lastModifiedBy: 'Development User',
      lastModifiedAt: new Date().toISOString()
    };
    setEditingSummary(newSummary);
    setShowNewSummary(true);
  };

  const handleDeleteSummary = (id: string) => {
    if (confirm('Are you sure you want to delete this summary?')) {
      const updatedSummaries = summaries.filter(s => s.id !== id);
      setSummaries(updatedSummaries);
      setSetting('summaries', updatedSummaries);
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
    setShowNewSummary(false);
    setEditingSummary(null);
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
    
    setEditingSummary({
      ...editingSummary,
      rows: [...editingSummary.rows, newRow]
    });
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
    
    const rowIndex = editingSummary.rows.findIndex(r => r.id === rowId);
    const newRows = [...editingSummary.rows];
    newRows.splice(rowIndex + 1, 0, newRow);
    
    setEditingSummary({
      ...editingSummary,
      rows: newRows
    });
  };

  const handleDeleteRow = (rowId: string) => {
    if (!editingSummary) return;
    
    setEditingSummary({
      ...editingSummary,
      rows: editingSummary.rows.filter(r => r.id !== rowId)
    });
  };

  const updateRow = (rowId: string, field: keyof SummaryRow, value: string) => {
    if (!editingSummary) return;
    
    setEditingSummary({
      ...editingSummary,
      rows: editingSummary.rows.map(r => {
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
      })
    });
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
    
    setEditingSummary({
      ...editingSummary,
      doorRows: [...editingSummary.doorRows, newRow]
    });
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
    
    const rowIndex = editingSummary.doorRows.findIndex(r => r.id === rowId);
    const newRows = [...editingSummary.doorRows];
    newRows.splice(rowIndex + 1, 0, newRow);
    
    setEditingSummary({
      ...editingSummary,
      doorRows: newRows
    });
  };

  const handleDeleteDoorRow = (rowId: string) => {
    if (!editingSummary) return;
    
    setEditingSummary({
      ...editingSummary,
      doorRows: editingSummary.doorRows.filter(r => r.id !== rowId)
    });
  };

  const updateDoorRow = (rowId: string, field: keyof DoorRow, value: string) => {
    if (!editingSummary) return;
    
    setEditingSummary({
      ...editingSummary,
      doorRows: editingSummary.doorRows.map(r => {
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
      })
    });
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
            font-size: 8px;
            page-break-inside: auto;
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
            padding: 4px 2px;
            text-align: left;
          }
          
          th {
            background-color: #f3f4f6 !important;
            font-weight: 600;
            position: sticky;
            top: 0;
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
      <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
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
                              setEditingSummary(summary);
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
                                      setEditingSummary(summary);
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[95vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center print:hidden">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Summary</h2>
                <p className="text-sm text-gray-600 mt-1">Fill in the summary data</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print PDF
                </button>
                <button
                  onClick={() => {
                    setShowNewSummary(false);
                    setEditingSummary(null);
                    setActivePage(1);
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
                  onClick={() => setActivePage(1)}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activePage === 1
                      ? 'border-brand-navy text-brand-navy'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Page 1 — Data Entry
                </button>
                <button
                  onClick={() => setActivePage(2)}
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
                            {editingSummary.date ? new Date(editingSummary.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
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
                    </div>
                  </div>

                  {/* Product Specifications */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                      <h3 className="text-lg font-semibold text-gray-900">Product Specifications</h3>
                      <p className="text-sm text-gray-500 mt-1">Product details for this project</p>
                    </div>
                    <div className="p-6 space-y-5">
                      {/* Row 1: Product (auto-filled) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                        <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                          {editingSummary.jobType || '—'}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Auto-filled from Job Type on Page 1</p>
                      </div>

                      {/* Row 2: Product Type + Dependent Options */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                        <select
                          value={editingSummary.productType || ''}
                          onChange={(e) => setEditingSummary({ ...editingSummary, productType: e.target.value, productTypeOptions: [] })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                        >
                          <option value="">Select product type...</option>
                          <option value="Double Hung Windows">Double Hung Windows</option>
                          <option value="Inswing Windows">Inswing Windows</option>
                          <option value="Flush Outswing Windows">Flush Outswing Windows</option>
                          <option value="Swing Doors">Swing Doors</option>
                          <option value="Lift Rolling Door">Lift Rolling Door</option>
                        </select>
                      </div>

                      {editingSummary.productType && (() => {
                        const optionsMap: Record<string, string[]> = {
                          'Double Hung Windows': [
                            '59 mm Sash',
                            '66 mm Sash',
                            '72 mm Sash',
                            'Concealed Balance',
                            'Weight and Chain Balance',
                          ],
                          'Inswing Windows': [
                            'Concealed Corrosion Resistant',
                          ],
                          'Flush Outswing Windows': [
                            'Corrosion Resistant Rough Hardware',
                            'Hinge Finials',
                          ],
                          'Swing Doors': [
                            'Siegenia Rough Hardware',
                            'KFV Rough Hardware',
                            'Hinge Finials',
                            'Bronze Threshold',
                          ],
                          'Lift Rolling Door': [
                            'Standard Hardware',
                            'Stainless Steel Hardware',
                          ],
                        };
                        const options = optionsMap[editingSummary.productType] || [];
                        const selected = editingSummary.productTypeOptions || [];

                        const toggle = (opt: string) => {
                          const next = selected.includes(opt)
                            ? selected.filter(o => o !== opt)
                            : [...selected, opt];
                          setEditingSummary({ ...editingSummary, productTypeOptions: next });
                        };

                        return (
                          <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {editingSummary.productType} Options
                            </label>
                            <div className="space-y-2">
                              {options.map(opt => (
                                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selected.includes(opt)}
                                    onChange={() => toggle(opt)}
                                    className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
                                  />
                                  <span className="text-sm text-gray-700">{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Row 3: Wood Type + Finish */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Wood Type</label>
                          <select
                            value={editingSummary.woodType || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, woodType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select wood type...</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Finish</label>
                          <select
                            value={editingSummary.finish || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, finish: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select finish...</option>
                            <option value="200">Same finish inside and outside (paint/paint or stain/stain) 200</option>
                            <option value="510">Partial Split Finish (stain or painted exterior/clear or white dip interior) 510</option>
                            <option value="610">Stain Exterior/Clear dip interior (Clear dip is considered &quot;no finish&quot;) 610</option>
                            <option value="500">Split paint finish &amp; paint exterior Stain Interior 500</option>
                            <option value="600">Split stain finish (Different stain colors inside and outside) 600</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 3: Glass Type + Muntin Type */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Glass Type</label>
                          <select
                            value={editingSummary.glassType || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, glassType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select glass type...</option>
                            {['1','2','2.1','3','4','5','6','7','7.1','7.2','8','9','10','11','12','13','14','15','17','18','22','22.1','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40'].map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Muntin Type</label>
                          <select
                            value={editingSummary.muntinType || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, muntinType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select muntin type...</option>
                            <option value="SDL">SDL</option>
                            <option value="TDL">TDL</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 4: Spacer Bars + Spacer Bar Colors */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Spacer Bars</label>
                          <select
                            value={editingSummary.spacerBars || ''}
                            onChange={(e) => setEditingSummary({ ...editingSummary, spacerBars: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40 text-sm bg-white"
                          >
                            <option value="">Select spacer bars...</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
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
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
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

                  {/* Aggregate Summary Tables — side by side */}
                  {(() => {
                    const sumField = (rows: (SummaryRow | DoorRow)[], field: string) =>
                      rows.reduce((acc, row) => acc + (parseFloat((row as any)[field]) || 0), 0);

                    const euroWindowQty = sumField(editingSummary.rows, 'qty');
                    const euroWindowFields = sumField(editingSummary.rows, 'fieldsTotal');
                    const euroWindowSqFt = sumField(editingSummary.rows, 'sqFeetTotal');
                    const euroWindowNet = sumField(editingSummary.rows, 'netEuroTotal');

                    const doorQty = sumField(editingSummary.doorRows, 'qty');
                    const doorFields = sumField(editingSummary.doorRows, 'fieldsTotal');
                    const doorSqFt = sumField(editingSummary.doorRows, 'sqFeetTotal');
                    const doorNet = sumField(editingSummary.doorRows, 'netEuroTotal');

                    const fmt = (v: number) => v ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
                    const fmtInt = (v: number) => v ? v.toLocaleString('en-US') : '—';

                    const totalQty = euroWindowQty + doorQty;
                    const totalFields = euroWindowFields + doorFields;
                    const totalSqFt = euroWindowSqFt + doorSqFt;
                    const totalNet = euroWindowNet + doorNet;

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

                    const ewCalc = calcRow(euroWindowNet, qtot?.euroWindows);
                    const dhCalc = calcRow(0, qtot?.doubleHung);
                    const edCalc = calcRow(doorNet, qtot?.euroDoors);
                    const gtCalc = {
                      full: ewCalc.full + dhCalc.full + edCalc.full,
                      disc: ewCalc.disc + dhCalc.disc + edCalc.disc,
                      final: ewCalc.final + dhCalc.final + edCalc.final,
                      finalAdj: ewCalc.finalAdj + dhCalc.finalAdj + edCalc.finalAdj,
                    };

                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mt-6">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                          <h3 className="text-lg font-semibold text-gray-900">Quote Totals</h3>
                          <p className="text-sm text-gray-500 mt-1">Aggregated from the data entry sheet</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
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
                                <td className="px-4 py-3 font-medium text-gray-900">Euro Windows</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(euroWindowQty)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(euroWindowFields)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmt(euroWindowSqFt)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{euroWindowNet ? `€${fmt(euroWindowNet)}` : '—'}</td>
                                {['full','pct','final','finalAdj'].map(f => (
                                  <td key={`ew-${f}`} className="px-1 py-1">
                                    <input type="text" value={(editingSummary.quoteTotals?.euroWindows as any)?.[f] || ''} onChange={(e) => setEditingSummary({...editingSummary, quoteTotals: {...(editingSummary.quoteTotals || {euroWindows:{full:'',pct:'',final:'',finalAdj:''},doubleHung:{full:'',pct:'',final:'',finalAdj:''},euroDoors:{full:'',pct:'',final:'',finalAdj:''}}), euroWindows: {...(editingSummary.quoteTotals?.euroWindows || {full:'',pct:'',final:'',finalAdj:''}), [f]: e.target.value}}})} className="w-full px-2 py-1.5 text-right text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40" placeholder="—" />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right text-gray-700 border-l-4 border-blue-300 bg-blue-50/30">{ewCalc.full ? `€${fmt(ewCalc.full)}` : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-blue-50/30">{ewCalc.disc ? `€${fmt(ewCalc.disc)}` : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-green-50/30">{ewCalc.final ? fmt(ewCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-purple-50/30">{ewCalc.finalAdj ? fmt(ewCalc.finalAdj) : '—'}</td>
                              </tr>
                              {/* Double Hung */}
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">Double Hung</td>
                                <td className="px-4 py-3 text-right text-gray-400">—</td>
                                <td className="px-4 py-3 text-right text-gray-400">—</td>
                                <td className="px-4 py-3 text-right text-gray-400">—</td>
                                <td className="px-4 py-3 text-right text-gray-400">—</td>
                                {['full','pct','final','finalAdj'].map(f => (
                                  <td key={`dh-${f}`} className="px-1 py-1">
                                    <input type="text" value={(editingSummary.quoteTotals?.doubleHung as any)?.[f] || ''} onChange={(e) => setEditingSummary({...editingSummary, quoteTotals: {...(editingSummary.quoteTotals || {euroWindows:{full:'',pct:'',final:'',finalAdj:''},doubleHung:{full:'',pct:'',final:'',finalAdj:''},euroDoors:{full:'',pct:'',final:'',finalAdj:''}}), doubleHung: {...(editingSummary.quoteTotals?.doubleHung || {full:'',pct:'',final:'',finalAdj:''}), [f]: e.target.value}}})} className="w-full px-2 py-1.5 text-right text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40" placeholder="—" />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right text-gray-400 border-l-4 border-blue-300 bg-blue-50/30">{dhCalc.full ? `€${fmt(dhCalc.full)}` : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-400 bg-blue-50/30">{dhCalc.disc ? `€${fmt(dhCalc.disc)}` : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-400 bg-green-50/30">{dhCalc.final ? fmt(dhCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-400 bg-purple-50/30">{dhCalc.finalAdj ? fmt(dhCalc.finalAdj) : '—'}</td>
                              </tr>
                              {/* Euro Doors */}
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">Euro Doors</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(doorQty)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtInt(doorFields)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmt(doorSqFt)}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{doorNet ? `€${fmt(doorNet)}` : '—'}</td>
                                {['full','pct','final','finalAdj'].map(f => (
                                  <td key={`ed-${f}`} className="px-1 py-1">
                                    <input type="text" value={(editingSummary.quoteTotals?.euroDoors as any)?.[f] || ''} onChange={(e) => setEditingSummary({...editingSummary, quoteTotals: {...(editingSummary.quoteTotals || {euroWindows:{full:'',pct:'',final:'',finalAdj:''},doubleHung:{full:'',pct:'',final:'',finalAdj:''},euroDoors:{full:'',pct:'',final:'',finalAdj:''}}), euroDoors: {...(editingSummary.quoteTotals?.euroDoors || {full:'',pct:'',final:'',finalAdj:''}), [f]: e.target.value}}})} className="w-full px-2 py-1.5 text-right text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40" placeholder="—" />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right text-gray-700 border-l-4 border-blue-300 bg-blue-50/30">{edCalc.full ? `€${fmt(edCalc.full)}` : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-blue-50/30">{edCalc.disc ? `€${fmt(edCalc.disc)}` : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-green-50/30">{edCalc.final ? fmt(edCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-700 bg-purple-50/30">{edCalc.finalAdj ? fmt(edCalc.finalAdj) : '—'}</td>
                              </tr>
                              {/* Grand Total */}
                              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                                <td className="px-4 py-3 text-gray-900">Grand Total</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmtInt(totalQty)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmtInt(totalFields)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmt(totalSqFt)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{totalNet ? `€${fmt(totalNet)}` : '—'}</td>
                                {['full','pct','final','finalAdj'].map(f => {
                                  const qt = editingSummary.quoteTotals;
                                  const sum = (parseFloat(qt?.euroWindows?.[f as keyof typeof qt.euroWindows] || '0') || 0) + (parseFloat(qt?.doubleHung?.[f as keyof typeof qt.doubleHung] || '0') || 0) + (parseFloat(qt?.euroDoors?.[f as keyof typeof qt.euroDoors] || '0') || 0);
                                  return <td key={`gt-${f}`} className="px-4 py-3 text-right text-gray-900">{sum ? fmt(sum) : '—'}</td>;
                                })}
                                <td className="px-4 py-3 text-right text-gray-900 border-l-4 border-blue-300 bg-blue-50/60">{gtCalc.full ? `€${fmt(gtCalc.full)}` : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-blue-50/60">{gtCalc.disc ? `€${fmt(gtCalc.disc)}` : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-green-50/60">{gtCalc.final ? fmt(gtCalc.final) : '—'}</td>
                                <td className="px-4 py-3 text-right text-gray-900 bg-purple-50/60">{gtCalc.finalAdj ? fmt(gtCalc.finalAdj) : '—'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
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
                  <input
                    type="date"
                    value={editingSummary.date}
                    onChange={(e) => setEditingSummary({ ...editingSummary, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-navy/40"
                  />
                </div>
              </div>

              {/* Main Table */}
              <div className="border rounded-lg overflow-hidden print-section">
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
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      {/* Spanning header row */}
                      <tr>
                        <th className="px-0.5 py-1 bg-gray-100 border-r border-gray-300" colSpan={22 + (showType3 ? 2 : 0) + (showType4 ? 2 : 0)}></th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Magnetic Contact</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Shade Boxes with No Trim</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Shade Boxes with Trim</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Final Finish</th>
                        <th className="px-0.5 py-1"></th>
                      </tr>
                      {/* Main header row */}
                      <tr>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-20">TuS-Position</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-40">Arch-Position</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-24">Width (MM)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-24">Height (MM)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-24">Width (Ft & In)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-24">Height (Ft & In)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-20">Sq Feet (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-20">Sq Feet (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Operable Sashes (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Operable Sashes (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-32">Type</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-32">Type 2</th>
                        {showType3 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>}
                        {showType3 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-32">Type 3</th>}
                        {showType4 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>}
                        {showType4 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-32">Type 4</th>}
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-40">Special Remarks</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-20">Fields (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-20">Fields (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16"># Site Mullions (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16"># Site Mullions (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-24">NET € (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-24">NET € (Total)</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-green-600 bg-green-50 border-l border-green-300 w-24">Per Unit</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-green-600 bg-green-50 border-r border-green-300 w-24">Per Position</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-orange-600 bg-orange-50 border-l border-orange-300 w-24">Per Unit</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-orange-600 bg-orange-50 border-r border-orange-300 w-24">Per Position</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-l border-[#b8bfe8] w-24">Per Unit</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-r border-[#b8bfe8] w-24">Per Position</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-l border-blue-300 w-24">Per Unit</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-r border-blue-300 w-24">Per Position</th>
                        <th className="px-0.5 py-1"></th>
                        <th className="px-0.5 py-1 text-center text-xs font-medium text-gray-700 bg-gray-50 border-l-2 border-gray-400 w-20" style={{minWidth: '80px'}}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {editingSummary.rows.map((row) => (
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
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="qty3" value={row.qty3} onChange={(v) => updateRow(row.id, 'qty3', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellDropdown rowId={row.id} field="type2" value={row.type2} onChange={(v) => updateRow(row.id, 'type2', v)} options={WINDOW_TYPES} />
                          </td>
                          {showType3 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellInput rowId={row.id} field="qty4" value={row.qty4} onChange={(v) => updateRow(row.id, 'qty4', v)} />
                            </td>
                          )}
                          {showType3 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellDropdown rowId={row.id} field="type3" value={row.type3} onChange={(v) => updateRow(row.id, 'type3', v)} options={WINDOW_TYPES} />
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
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.magneticContactUnit} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.magneticContactPosition} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.shadeBoxesNoSideTrimUnit} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.shadeBoxesNoSideTrimPosition} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.shadeBoxesWithSideTrimUnit} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.shadeBoxesWithSideTrimPosition} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.finalFinishUnit} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.finalFinishPosition} />
                          </td>
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
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      {/* Spanning header row */}
                      <tr>
                        <th className="px-0.5 py-1 bg-gray-100 border-r border-gray-300" colSpan={22 + (showType3 ? 2 : 0) + (showType4 ? 2 : 0)}></th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Magnetic Contact</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Shade Boxes with No Trim</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Shade Boxes with Trim</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300" colSpan={2}>Final Finish</th>
                        <th className="px-0.5 py-1"></th>
                      </tr>
                      {/* Main header row */}
                      <tr>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-20">TuS-Position</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-40">Arch-Position</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-24">Width (MM)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-24">Height (MM)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-24">Width (Ft & In)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-24">Height (Ft & In)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-20">Sq Feet (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 w-20">Sq Feet (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Operable Sashes (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Operable Sashes (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-32">Type</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-32">Type 2</th>
                        {showType3 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>}
                        {showType3 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-32">Type 3</th>}
                        {showType4 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16">Qty</th>}
                        {showType4 && <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-32">Type 4</th>}
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-40">Special Remarks</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-20">Fields (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-20">Fields (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16"># Site Mullions (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-16"># Site Mullions (Total)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-24">NET € (Each)</th>
                        <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 bg-red-100 w-24">NET € (Total)</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-green-600 bg-green-50 border-l border-green-300 w-24">Per Unit</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-green-600 bg-green-50 border-r border-green-300 w-24">Per Position</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-orange-600 bg-orange-50 border-l border-orange-300 w-24">Per Unit</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-orange-600 bg-orange-50 border-r border-orange-300 w-24">Per Position</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-l border-[#b8bfe8] w-24">Per Unit</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-r border-[#b8bfe8] w-24">Per Position</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-l border-blue-300 w-24">Per Unit</th>
                        <th className="px-0.5 py-1 text-center text-xs font-semibold text-brand-navy bg-[#f0f1fa] border-r border-blue-300 w-24">Per Position</th>
                        <th className="px-0.5 py-1"></th>
                        <th className="px-0.5 py-1 text-center text-xs font-medium text-gray-700 bg-gray-50 border-l-2 border-gray-400 w-20" style={{minWidth: '80px'}}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {editingSummary.doorRows.map((row) => (
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
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellInput rowId={row.id} field="qty3" value={row.qty3} onChange={(v) => updateDoorRow(row.id, 'qty3', v)} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <CellDropdown rowId={row.id} field="type2" value={row.type2} onChange={(v) => updateDoorRow(row.id, 'type2', v)} options={DOOR_TYPES} />
                          </td>
                          {showType3 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellInput rowId={row.id} field="qty4" value={row.qty4} onChange={(v) => updateDoorRow(row.id, 'qty4', v)} />
                            </td>
                          )}
                          {showType3 && (
                            <td className="px-0.5 py-1 align-top">
                              <CellDropdown rowId={row.id} field="type3" value={row.type3} onChange={(v) => updateDoorRow(row.id, 'type3', v)} options={DOOR_TYPES} />
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
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.magneticContactUnit} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.magneticContactPosition} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.shadeBoxesNoSideTrimUnit} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.shadeBoxesNoSideTrimPosition} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.shadeBoxesWithSideTrimUnit} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.shadeBoxesWithSideTrimPosition} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.finalFinishUnit} />
                          </td>
                          <td className="px-0.5 py-1 align-top">
                            <ReadOnlyCellInput value={row.finalFinishPosition} />
                          </td>
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
                  setShowNewSummary(false);
                  setEditingSummary(null);
                  setActivePage(1);
                }}
                className="px-6 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                {activePage === 1 && (
                  <button
                    onClick={() => setActivePage(2)}
                    className="px-6 py-2 text-sm border border-brand-navy text-brand-navy rounded-lg hover:bg-brand-navy/5 transition-colors"
                  >
                    Next: Page 2 →
                  </button>
                )}
                {activePage === 2 && (
                  <button
                    onClick={() => setActivePage(1)}
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
    )}
    </>
  );
}


















































