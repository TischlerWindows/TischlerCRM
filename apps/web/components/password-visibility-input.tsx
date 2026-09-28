'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordVisibilityInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  toggleLabel: string;
};

export function PasswordVisibilityInput({ toggleLabel, className = '', ...props }: PasswordVisibilityInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={`${visible ? 'Hide' : 'Show'} ${toggleLabel}`}
        aria-pressed={visible}
        title={`${visible ? 'Hide' : 'Show'} ${toggleLabel}`}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-brand-navy"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}