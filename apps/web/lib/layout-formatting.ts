import type { FormattingRule, PageLayout } from './schema';
import { evaluateVisibility, type RecordData, type VisibilityContext } from './field-visibility';

/**
 * Effective rules list: prefers top-level `formattingRules`, then `extensions.formattingRules`.
 */
export function getLayoutFormattingRules(layout: PageLayout | null | undefined): FormattingRule[] {
  if (!layout) return [];
  if (Array.isArray(layout.formattingRules) && layout.formattingRules.length > 0) {
    return normalizeFormattingRules(layout.formattingRules);
  }
  const fromExt = layout.extensions?.formattingRules;
  if (Array.isArray(fromExt) && fromExt.length > 0) {
    return normalizeFormattingRules(fromExt as FormattingRule[]);
  }
  return [];
}

/**
 * Drop legacy string-`when` rules; coerce partial API payloads into evaluable rules.
 */
function normalizeFormattingRules(rules: FormattingRule[]): FormattingRule[] {
  return rules.filter((r) => r && typeof r === 'object' && Array.isArray(r.when));
}

/**
 * First active rule matching target with truthy `when` wins (ascending `order`).
 */
export function getFormattingEffectsForField(
  layout: PageLayout | null | undefined,
  fieldApiName: string,
  data: RecordData,
  context?: VisibilityContext
): FormattingRule['effects'] | null {
  const rules = getLayoutFormattingRules(layout)
    .filter((r) => r.active !== false)
    .filter((r) => r.target.kind === 'field' && r.target.fieldApiName === fieldApiName)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const rule of rules) {
    if (evaluateVisibility(rule.when, data, context)) {
      return rule.effects;
    }
  }
  return null;
}

export function getFormattingEffectsForSection(
  layout: PageLayout | null | undefined,
  sectionId: string,
  data: RecordData,
  context?: VisibilityContext
): FormattingRule['effects'] | null {
  const rules = getLayoutFormattingRules(layout)
    .filter((r) => r.active !== false)
    .filter((r) => r.target.kind === 'section' && r.target.sectionId === sectionId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const rule of rules) {
    if (evaluateVisibility(rule.when, data, context)) {
      return rule.effects;
    }
  }
  return null;
}

export function getFormattingEffectsForPanel(
  layout: PageLayout | null | undefined,
  panelId: string,
  data: RecordData,
  context?: VisibilityContext
): FormattingRule['effects'] | null {
  const rules = getLayoutFormattingRules(layout)
    .filter((r) => r.active !== false)
    .filter((r) => r.target.kind === 'panel' && r.target.panelId === panelId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const rule of rules) {
    if (evaluateVisibility(rule.when, data, context)) {
      return rule.effects;
    }
  }
  return null;
}

export function getFormattingEffectsForRegion(
  layout: PageLayout | null | undefined,
  regionId: string,
  data: RecordData,
  context?: VisibilityContext
): FormattingRule['effects'] | null {
  const rules = getLayoutFormattingRules(layout)
    .filter((r) => r.active !== false)
    .filter((r) => r.target.kind === 'region' && r.target.regionId === regionId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const rule of rules) {
    if (evaluateVisibility(rule.when, data, context)) {
      return rule.effects;
    }
  }
  return null;
}
