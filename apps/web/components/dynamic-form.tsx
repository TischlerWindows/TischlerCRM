/**
 * Thin re-export shim.
 *
 * The actual DynamicForm implementation now lives in `./form/dynamic-form.tsx`
 * and its sub-modules (`field-input`, `form-validation`, `lookup-search`,
 * `address-field`, `picklist-fields`).
 *
 * This file is kept so that existing imports like
 *   import DynamicForm from '@/components/dynamic-form'
 * continue to work without modification.
 */
export { default } from './form/dynamic-form';
export type { DynamicFormProps } from './form/dynamic-form';
