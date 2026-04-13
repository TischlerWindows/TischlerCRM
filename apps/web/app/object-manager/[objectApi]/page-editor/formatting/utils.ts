import type {
  FieldDef,
  FieldHighlightToken,
  FormattingRule,
  FormattingRuleTarget,
} from '@/lib/schema';
import type {
  BadgeToken,
  FieldTargetOption,
  PanelTargetOption,
  RegionTargetOption,
  TabTargetOption,
  TargetKind,
  TargetOptions,
} from './types';

export function normalizeRulesFromInput(rules: FormattingRule[]): FormattingRule[] {
  return [...rules]
    .sort((a, b) => a.order - b.order)
    .map((rule, index) => ({
      ...rule,
      order: index,
      when: Array.isArray(rule.when) ? [...rule.when] : [],
      effects: { ...rule.effects },
    }));
}

export function reindexRulesPreserveOrder(rules: FormattingRule[]): FormattingRule[] {
  return rules.map((rule, index) => ({
    ...rule,
    order: index,
    when: Array.isArray(rule.when) ? [...rule.when] : [],
    effects: { ...rule.effects },
  }));
}

export function isTargetKind(value: string): value is TargetKind {
  return value === 'field' || value === 'panel' || value === 'region' || value === 'tab';
}

export function isBadgeToken(value: string): value is BadgeToken {
  return value === 'success' || value === 'warning' || value === 'destructive';
}

export function isHighlightToken(value: string): value is FieldHighlightToken {
  return (
    value === 'none' ||
    value === 'subtle' ||
    value === 'attention' ||
    value === 'positive' ||
    value === 'critical'
  );
}

export function isTargetValid(target: FormattingRuleTarget, options: TargetOptions): boolean {
  if (target.kind === 'field') {
    return options.fieldTargets.some(
      (option) =>
        option.panelId === target.panelId && option.fieldApiName === target.fieldApiName,
    );
  }
  if (target.kind === 'panel') {
    return options.panelTargets.some((option) => option.panelId === target.panelId);
  }
  if (target.kind === 'tab') {
    return options.tabTargets.some((option) => option.tabId === target.tabId);
  }
  return options.regionTargets.some((option) => option.regionId === target.regionId);
}

export function toFieldSelectValue(target: Pick<FieldTargetOption, 'panelId' | 'fieldApiName'>): string {
  return `${target.panelId}::${target.fieldApiName}`;
}

export function toFieldTarget(value: string): Pick<FieldTargetOption, 'panelId' | 'fieldApiName'> | null {
  const [panelId, fieldApiName] = value.split('::');
  if (!panelId || !fieldApiName) return null;
  return { panelId, fieldApiName };
}

export function resolveDefaultTarget(
  fieldTargets: FieldTargetOption[],
  panelTargets: PanelTargetOption[],
  regionTargets: RegionTargetOption[],
  tabTargets?: TabTargetOption[],
): FormattingRuleTarget {
  const firstField = fieldTargets[0];
  if (firstField) {
    return {
      kind: 'field',
      fieldApiName: firstField.fieldApiName,
      panelId: firstField.panelId,
    };
  }
  const firstPanel = panelTargets[0];
  if (firstPanel) {
    return {
      kind: 'panel',
      panelId: firstPanel.panelId,
    };
  }
  const firstRegion = regionTargets[0];
  if (firstRegion) {
    return {
      kind: 'region',
      regionId: firstRegion.regionId,
    };
  }
  const firstTab = tabTargets?.[0];
  if (firstTab) {
    return {
      kind: 'tab',
      tabId: firstTab.tabId,
    };
  }
  return {
    kind: 'region',
    regionId: '',
  };
}

export function buildTargetForKind(
  kind: TargetKind,
  current: FormattingRuleTarget,
  fieldTargets: FieldTargetOption[],
  panelTargets: PanelTargetOption[],
  regionTargets: RegionTargetOption[],
  tabTargets?: TabTargetOption[],
): FormattingRuleTarget {
  if (kind === 'field') {
    if (current.kind === 'field') return current;
    const first = fieldTargets[0];
    return {
      kind: 'field',
      fieldApiName: first?.fieldApiName ?? '',
      panelId: first?.panelId ?? '',
    };
  }
  if (kind === 'panel') {
    if (current.kind === 'panel') return current;
    const first = panelTargets[0];
    return {
      kind: 'panel',
      panelId: first?.panelId ?? '',
    };
  }
  if (kind === 'tab') {
    if (current.kind === 'tab') return current;
    const first = tabTargets?.[0];
    return {
      kind: 'tab',
      tabId: first?.tabId ?? '',
    };
  }
  if (current.kind === 'region') return current;
  const first = regionTargets[0];
  return {
    kind: 'region',
    regionId: first?.regionId ?? '',
  };
}

export function summarizeTarget(
  target: FormattingRuleTarget,
  fieldTargets: FieldTargetOption[],
  panelTargets: PanelTargetOption[],
  regionTargets: RegionTargetOption[],
  tabTargets?: TabTargetOption[],
): string {
  if (target.kind === 'field') {
    const match = fieldTargets.find(
      (option) =>
        option.panelId === target.panelId && option.fieldApiName === target.fieldApiName,
    );
    return match
      ? `Field: ${match.label}`
      : `Field: ${target.fieldApiName || 'Unknown'} (${target.panelId || 'no panel'})`;
  }
  if (target.kind === 'panel') {
    const match = panelTargets.find((option) => option.panelId === target.panelId);
    return match ? `Panel: ${match.label}` : `Panel: ${target.panelId || 'Unknown'}`;
  }
  if (target.kind === 'tab') {
    const match = tabTargets?.find((option) => option.tabId === target.tabId);
    return match ? `Tab: ${match.label}` : `Tab: ${target.tabId || 'Unknown'}`;
  }
  const match = regionTargets.find((option) => option.regionId === target.regionId);
  return match ? `Region: ${match.label}` : `Region: ${target.regionId || 'Unknown'}`;
}

export function buildFieldLabelMap(fields: FieldDef[]): Map<string, string> {
  return new Map(fields.map((field) => [field.apiName, field.label]));
}
