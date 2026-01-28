'use client';

import React, { forwardRef } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void;
}

const Select = forwardRef<HTMLSelectElement, React.HTMLAttributes<HTMLSelectElement>>(
  (props, ref) => {
    return (
      <select
        ref={ref}
        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        {...(props as any)}
      >
        {props.children}
      </select>
    );
  }
);
Select.displayName = 'Select';

const SelectTrigger = forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
  ({ children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left flex items-center justify-between"
        {...(props as any)}
      >
        {children}
        <span className="ml-2">▼</span>
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  return <span className="text-gray-500">{placeholder || 'Select...'}</span>;
};

const SelectContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md"
      {...(props as any)}
    >
      {children}
    </div>
  );
};

const SelectItem = forwardRef<HTMLOptionElement, React.OptionHTMLAttributes<HTMLOptionElement>>(
  ({ children, ...props }, ref) => {
    return (
      <option ref={ref} {...(props as any)}>
        {children}
      </option>
    );
  }
);
SelectItem.displayName = 'SelectItem';

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
