import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
export function formatFieldValue(value: any, fieldType?: string): string {
  // Handle null or undefined
  if (value === null || value === undefined) {
    return '-';
  }

  // Handle objects (check before arrays since arrays are objects)
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Handle Address objects
    if (fieldType === 'Address' || (value.street || value.city || value.state || value.postalCode || value.country)) {
      const addressParts = [
        value.street,
        value.city,
        value.state,
        value.postalCode,
        value.country
      ].filter(Boolean);
      return addressParts.length > 0 ? addressParts.join(', ') : '-';
    }
    
    // Handle Geolocation objects
    if (fieldType === 'Geolocation' || (value.latitude || value.longitude)) {
      if (value.latitude && value.longitude) {
        return `${value.latitude}, ${value.longitude}`;
      }
      return '-';
    }
    
    // For other objects, convert to JSON string
    return JSON.stringify(value);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || '-';
  }

  // Handle primitives
  return String(value);
}