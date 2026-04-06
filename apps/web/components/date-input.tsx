'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function MiniCalendar({
  selectedIso,
  onSelect,
  onClose,
}: {
  selectedIso: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const parsed = selectedIso ? selectedIso.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  const initYear = parsed ? parseInt(parsed[1]) : today.getFullYear();
  const initMonth = parsed ? parseInt(parsed[2]) - 1 : today.getMonth();

  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const dayCount = daysInMonth(viewYear, viewMonth);
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dayCount; d++) cells.push(d);

  const handleSelect = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSelect(iso);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-[280px] select-none"
    >
      {/* Month / Year header */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(day)}
              className={cn(
                'h-8 w-full rounded-md text-sm transition-colors',
                isSelected
                  ? 'bg-blue-600 text-white font-semibold'
                  : isToday
                    ? 'bg-blue-50 text-blue-700 font-medium hover:bg-blue-100'
                    : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-center">
        <button
          type="button"
          onClick={() => { handleSelect(today.getDate()); setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Today
        </button>
      </div>
    </div>
  );
}

/** Masked date input: displays MM/DD/YYYY, stores as YYYY-MM-DD ISO */
export function DateInput({ value, onChange, disabled, className, id }: {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const isoToDisplay = (iso: string) => {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
  };
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const [showCal, setShowCal] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setDisplay(isoToDisplay(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d]/g, '');
    if (raw.length > 8) raw = raw.slice(0, 8);
    let formatted = '';
    for (let i = 0; i < raw.length; i++) {
      if (i === 2 || i === 4) formatted += '/';
      formatted += raw[i];
    }
    setDisplay(formatted);
    if (formatted.length === 10) {
      const m = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        const iso = `${m[3]}-${m[1]}-${m[2]}`;
        prevValue.current = iso;
        onChange(iso);
      }
    } else if (formatted === '') {
      prevValue.current = '';
      onChange('');
    }
  };

  const handleCalSelect = useCallback((iso: string) => {
    prevValue.current = iso;
    setDisplay(isoToDisplay(iso));
    onChange(iso);
  }, [onChange]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={display}
        onChange={handleChange}
        disabled={disabled}
        placeholder="MM/DD/YYYY"
        maxLength={10}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      />
      <button
        type="button"
        onClick={() => !disabled && setShowCal(!showCal)}
        disabled={disabled}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Calendar className="w-4 h-4" />
      </button>
      {showCal && (
        <MiniCalendar
          selectedIso={value}
          onSelect={handleCalSelect}
          onClose={() => setShowCal(false)}
        />
      )}
    </div>
  );
}
