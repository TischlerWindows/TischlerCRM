import type {
  FieldHighlightToken,
  FormattingRule,
  FormattingRuleTarget,
} from '@/lib/schema';

export type TargetKind = FormattingRuleTarget['kind'];

export interface RegionTargetOption {
  regionId: string;
  label: string;
}

export interface PanelTargetOption {
  panelId: string;
  label: string;
}

export interface FieldTargetOption {
  panelId: string;
  fieldApiName: string;
  label: string;
}

export interface TabTargetOption {
  tabId: string;
  label: string;
}

export interface TargetOptions {
  fieldTargets: FieldTargetOption[];
  panelTargets: PanelTargetOption[];
  regionTargets: RegionTargetOption[];
  tabTargets: TabTargetOption[];
}

export type BadgeToken = NonNullable<FormattingRule['effects']['badge']>;
