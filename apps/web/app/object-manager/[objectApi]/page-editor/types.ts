import type {
  ConditionExpr,
  FormattingRule,
  FormattingRuleTarget,
  FieldHighlightToken,
  LayoutTab,
  LayoutSection,
  LayoutPanel,
  PanelField,
  LayoutWidget,
  RegionStyle,
  PanelStyle,
  LabelStyle,
  ValueStyle,
  TemplatePanelDef,
  TemplateSectionDef,
  TemplateTabDef,
  CustomLayoutTemplate,
} from '@/lib/schema';

export type {
  ConditionExpr,
  FormattingRule,
  FormattingRuleTarget,
  FieldHighlightToken,
  LayoutTab,
  LayoutSection,
  LayoutPanel,
  PanelField,
  LayoutWidget,
  RegionStyle,
  PanelStyle,
  LabelStyle,
  ValueStyle,
  TemplatePanelDef,
  TemplateSectionDef,
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
