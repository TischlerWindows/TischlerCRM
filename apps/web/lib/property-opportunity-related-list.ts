import type { LayoutWidget, OrgSchema, RelatedListConfig } from './schema'

const OPPORTUNITY_COLUMNS = ['opportunityNumber', 'opportunityName', 'stage', 'closeDate']

function isRelatedList(widget: LayoutWidget): widget is LayoutWidget & { config: RelatedListConfig } {
  return widget.widgetType === 'RelatedList'
    && !!widget.config
    && typeof widget.config === 'object'
}

function targetsOpportunity(widget: LayoutWidget): boolean {
  if (!isRelatedList(widget)) return false
  return widget.config.objectApiName?.toLowerCase() === 'opportunity'
    || widget.config.relatedObjectApiName?.toLowerCase() === 'opportunity'
}

function createOpportunityRelatedList(order: number, id: string): LayoutWidget {
  return {
    id,
    widgetType: 'RelatedList',
    order,
    config: {
      type: 'RelatedList',
      objectApiName: 'Opportunity',
      relatedObjectApiName: 'Opportunity',
      linkField: 'property',
      relationshipFieldApiName: 'property',
      label: 'Associated Opportunities',
      columns: OPPORTUNITY_COLUMNS,
      displayColumns: OPPORTUNITY_COLUMNS,
      rowLimit: 10,
      showNewButton: false,
    },
  }
}

function nextWidgetOrder(widgets: LayoutWidget[]): number {
  return widgets.reduce((max, widget) => Math.max(max, widget.order), -1) + 1
}

export function ensurePropertyOpportunityRelatedLists(schema: OrgSchema): OrgSchema {
  const property = schema.objects.find((object) => object.apiName === 'Property')
  if (!property?.pageLayouts?.length) return schema

  let schemaChanged = false
  for (const layout of property.pageLayouts) {
    const regions = layout.tabs.flatMap((tab) => tab.regions)
    let hasOpportunityList = false
    for (const region of regions) {
      const widgetGroups = [region.widgets, ...region.panels.map((panel) => panel.widgets ?? [])]
      for (const widgets of widgetGroups) {
        for (let index = 0; index < widgets.length; index += 1) {
          const widget = widgets[index]
          if (!widget || !targetsOpportunity(widget) || !isRelatedList(widget)) continue
          hasOpportunityList = true
          const config = widget.config
          const nextConfig: RelatedListConfig = {
            ...config,
            type: 'RelatedList',
            objectApiName: 'Opportunity',
            relatedObjectApiName: 'Opportunity',
            linkField: 'property',
            relationshipFieldApiName: 'property',
            label: 'Associated Opportunities',
            columns: config.columns?.length ? config.columns : OPPORTUNITY_COLUMNS,
            displayColumns: config.displayColumns?.length ? config.displayColumns : OPPORTUNITY_COLUMNS,
          }
          if (JSON.stringify(config) !== JSON.stringify(nextConfig)) {
            widgets[index] = { ...widget, config: nextConfig }
            schemaChanged = true
          }
        }
      }
    }

    if (hasOpportunityList || regions.length === 0) continue

    const relatedListRegion = regions.find((region) =>
      region.widgets.some(isRelatedList)
      || region.panels.some((panel) => (panel.widgets ?? []).some(isRelatedList)),
    ) ?? regions[0]!
    const relatedListPanel = relatedListRegion.panels.find((panel) =>
      (panel.widgets ?? []).some(isRelatedList),
    )

    if (relatedListRegion.widgets.some(isRelatedList)) {
      relatedListRegion.widgets.push(createOpportunityRelatedList(
        nextWidgetOrder(relatedListRegion.widgets),
        `property-opportunities-${layout.id}`,
      ))
    } else if (relatedListPanel) {
      const widgets = relatedListPanel.widgets ?? []
      relatedListPanel.widgets = [
        ...widgets,
        createOpportunityRelatedList(nextWidgetOrder(widgets), `property-opportunities-${layout.id}`),
      ]
    } else {
      relatedListRegion.widgets.push(createOpportunityRelatedList(
        nextWidgetOrder(relatedListRegion.widgets),
        `property-opportunities-${layout.id}`,
      ))
    }
    schemaChanged = true
  }

  if (!schemaChanged) return schema
  return {
    ...schema,
    objects: schema.objects.map((object) => object.apiName === 'Property'
      ? { ...object, pageLayouts: property.pageLayouts }
      : object),
    updatedAt: new Date().toISOString(),
  }
}
