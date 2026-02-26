'use client';

import { FieldDef, PageField } from '@/lib/schema';
import { evaluateVisibility, RecordData } from '@/lib/field-visibility';
import { ReactNode } from 'react';

interface ConditionalFieldWrapperProps {
  field: FieldDef;
  pageField: PageField;
  recordData: RecordData;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper component that conditionally renders a field based on visibility rules
 */
export default function ConditionalFieldWrapper({
  field,
  recordData,
  children,
  className = '',
}: ConditionalFieldWrapperProps) {
  const isVisible = evaluateVisibility(field.visibleIf, recordData);

  if (!isVisible) {
    return null; // Field is not visible
  }

  return <div className={className}>{children}</div>;
}

/**
 * Hook to check if a field should be visible
 */
export function useFieldVisibility(field: FieldDef, recordData: RecordData): boolean {
  return evaluateVisibility(field.visibleIf, recordData);
}

/**
 * Filter fields by visibility
 */
export function filterVisibleFields(
  fields: (FieldDef & { pageField?: PageField })[],
  recordData: RecordData
) {
  return fields.filter(field => evaluateVisibility(field.visibleIf, recordData));
}
