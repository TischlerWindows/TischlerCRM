'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

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

  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    prevValue.current = iso;
    setDisplay(isoToDisplay(iso));
    onChange(iso);
  };

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
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      />
      <input
        type="date"
        value={value || ''}
        onChange={handleCalendarChange}
        disabled={disabled}
        className="absolute right-0 top-0 h-full w-10 opacity-0 cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
}
