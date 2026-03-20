'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';

export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
}

interface Prediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressAutocompleteProps {
  onAddressSelected: (address: ParsedAddress) => void;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
}

export default function AddressAutocomplete({
  onAddressSelected,
  disabled = false,
  placeholder = 'Search for an address...',
  value,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value ?? '');

  // Sync external value into the input when it changes (e.g. on record load)
  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  }, [value]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionTokenRef = useRef(crypto.randomUUID());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.placesAutocomplete(input, sessionTokenRef.current);
      setPredictions(result.predictions);
      setIsOpen(result.predictions.length > 0);
    } catch (err: any) {
      if (err.message?.includes('not configured')) {
        setError('Google Maps integration is not configured. Ask an admin to set it up in Settings.');
      } else {
        setError('Unable to search addresses. Please try again.');
      }
      setPredictions([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(value), 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    setQuery(prediction.description);
    setIsOpen(false);
    setPredictions([]);
    setLoadingDetails(true);
    setError(null);

    try {
      const result = await apiClient.placeDetails(prediction.place_id, sessionTokenRef.current);
      onAddressSelected(result.address);
      sessionTokenRef.current = crypto.randomUUID();
    } catch {
      setError('Failed to load address details. Please try again.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          {loading || loadingDetails ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loadingDetails}
          className="pl-9 pr-3"
        />
      </div>

      {error && (
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <ul className="max-h-60 overflow-y-auto py-1">
            {predictions.map((p) => (
              <li key={p.place_id}>
                <button
                  type="button"
                  onClick={() => handleSelect(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-start gap-2.5 transition-colors"
                >
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {p.structured_formatting.main_text}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {p.structured_formatting.secondary_text}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50">
            <span className="text-[10px] text-gray-400">Powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
}
