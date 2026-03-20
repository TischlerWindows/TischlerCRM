import type { LabelColorToken, PageFieldPresentation } from './schema';

export const LABEL_COLOR_TOKEN_CLASSES: Record<LabelColorToken, string> = {
  default: 'text-gray-900',
  brand: 'text-blue-900',
  muted: 'text-gray-500',
  danger: 'text-red-700',
  success: 'text-emerald-700',
};

export function labelPresentationClassName(p?: PageFieldPresentation): string {
  const colorKey = p?.labelColorToken ?? 'default';
  const color =
    LABEL_COLOR_TOKEN_CLASSES[colorKey] ?? LABEL_COLOR_TOKEN_CLASSES.default;
  const weight = p?.labelBold ? 'font-semibold' : 'font-medium';
  return `${color} ${weight}`.trim();
}

export function fieldHighlightWrapperClass(
  token?: 'none' | 'subtle' | 'attention' | 'positive' | 'critical'
): string {
  switch (token) {
    case 'subtle':
      return 'bg-slate-50 border border-slate-200 rounded-md';
    case 'attention':
      return 'bg-amber-50 border border-amber-200 rounded-md';
    case 'positive':
      return 'bg-emerald-50 border border-emerald-200 rounded-md';
    case 'critical':
      return 'bg-red-50 border border-red-200 rounded-md';
    default:
      return '';
  }
}

export function badgePillClass(
  badge?: 'success' | 'warning' | 'destructive'
): string {
  switch (badge) {
    case 'success':
      return 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800';
    case 'warning':
      return 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900';
    case 'destructive':
      return 'inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800';
    default:
      return '';
  }
}
