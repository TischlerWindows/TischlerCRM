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
  PageLayout,
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
  PageLayout,
};

export type SelectedElement =
  | { type: 'region'; id: string }
  | { type: 'panel'; id: string }
  | { type: 'field'; id: string; panelId: string }
  | { type: 'widget'; id: string }
  | null;
