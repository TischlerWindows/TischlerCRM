import type {
  ConditionExpr,
  FormattingRule,
  FormattingRuleTarget,
  FieldHighlightToken,
  LayoutTab,
  LayoutRegion,
  LayoutPanel,
  PanelField,
  LayoutWidget,
  RegionStyle,
  PanelStyle,
  LabelStyle,
  ValueStyle,
  TemplatePanelDef,
  TemplateRegionDef,
  TemplateTabDef,
  CustomLayoutTemplate,
} from '@/lib/schema';

export type {
  ConditionExpr,
  FormattingRule,
  FormattingRuleTarget,
  FieldHighlightToken,
  LayoutTab,
  LayoutRegion,
  LayoutPanel,
  PanelField,
  LayoutWidget,
  RegionStyle,
  PanelStyle,
  LabelStyle,
  ValueStyle,
  TemplatePanelDef,
  TemplateRegionDef,
  TemplateTabDef,
  CustomLayoutTemplate,
};

export interface EditorPageLayout {
  id: string;
  name: string;
  objectApi: string;
  active: boolean;
  isDefault: boolean;
  roles: string[];
  tabs: LayoutTab[];
  formattingRules: FormattingRule[];
}

export type SelectedElement =
  | { type: 'region'; id: string }
  | { type: 'panel'; id: string }
  | { type: 'field'; id: string; panelId: string }
  | { type: 'widget'; id: string }
  | null;
