import type { OrgSchema } from '../schema'
import { ensurePropertyOpportunityRelatedLists } from '../property-opportunity-related-list'

function makeSchema(config: Record<string, unknown> = {}): OrgSchema {
  return {
    objects: [{
      apiName: 'Property',
      pageLayouts: [{
        id: 'property-layout',
        name: 'Property Layout',
        tabs: [{
          id: 'details',
          label: 'Details',
          order: 0,
          regions: [{
            id: 'related',
            label: 'Related',
            gridColumn: 1,
            gridColumnSpan: 12,
            gridRow: 1,
            gridRowSpan: 1,
            style: {},
            panels: [],
            widgets: [{
              id: 'projects',
              widgetType: 'RelatedList',
              order: 0,
              config: {
                type: 'RelatedList',
                objectApiName: 'Project',
                relatedObjectApiName: 'Project',
                linkField: 'property',
                relationshipFieldApiName: 'property',
                label: 'Associated Projects',
                ...config,
              } as never,
            }],
          }],
        }],
      }],
      fields: [],
      recordTypes: [],
      validationRules: [],
    }],
  } as unknown as OrgSchema
}

describe('Property Opportunity related-list migration', () => {
  it('adds an Opportunity list beside existing Property related lists', () => {
    const migrated = ensurePropertyOpportunityRelatedLists(makeSchema())
    const widgets = migrated.objects[0]?.pageLayouts[0]?.tabs[0]?.regions[0]?.widgets ?? []

    expect(widgets).toHaveLength(2)
    expect(widgets[0]?.config).toMatchObject({ label: 'Associated Projects', objectApiName: 'Project' })
    expect(widgets[1]?.config).toMatchObject({
      type: 'RelatedList',
      label: 'Associated Opportunities',
      objectApiName: 'Opportunity',
      relatedObjectApiName: 'Opportunity',
      linkField: 'property',
      relationshipFieldApiName: 'property',
      columns: ['opportunityNumber', 'opportunityName', 'stage', 'closeDate'],
    })
  })

  it('normalizes every Opportunity list using PropertyId and does not add a duplicate', () => {
    const migrated = ensurePropertyOpportunityRelatedLists(makeSchema({
      objectApiName: 'Opportunity',
      relatedObjectApiName: 'Opportunity',
      linkField: 'PropertyId',
      label: 'Old label',
    }))
    const widgets = migrated.objects[0]?.pageLayouts[0]?.tabs[0]?.regions[0]?.widgets ?? []

    expect(widgets).toHaveLength(1)
    expect(widgets[0]?.config).toMatchObject({
      label: 'Associated Opportunities',
      objectApiName: 'Opportunity',
      linkField: 'property',
      relationshipFieldApiName: 'property',
    })
    expect(ensurePropertyOpportunityRelatedLists(migrated)).toBe(migrated)
  })

  it('normalizes every Opportunity list in the Property layout', () => {
    const schema = makeSchema({
      objectApiName: 'Opportunity',
      relatedObjectApiName: 'Opportunity',
      linkField: 'PropertyId',
    })
    const region = schema.objects[0]!.pageLayouts[0]!.tabs[0]!.regions[0]!
    region.widgets.push({
      ...region.widgets[0]!,
      id: 'second-opportunity-list',
      order: 1,
      config: { ...region.widgets[0]!.config, linkField: 'PropertyId' },
    })

    const migrated = ensurePropertyOpportunityRelatedLists(schema)
    const widgets = migrated.objects[0]?.pageLayouts[0]?.tabs[0]?.regions[0]?.widgets ?? []

    expect(widgets).toHaveLength(2)
    expect(widgets.every((widget) => widget.config.linkField === 'property')).toBe(true)
  })

  it('leaves the schema unchanged when there is no Property layout', () => {
    const schema = { objects: [{ apiName: 'Property', pageLayouts: [] }] } as unknown as OrgSchema
    expect(ensurePropertyOpportunityRelatedLists(schema)).toBe(schema)
  })
})