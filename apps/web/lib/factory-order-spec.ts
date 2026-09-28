export const SPEC_ITEMS = [
  'Type of wood', 'Split wood species', 'Interior color', 'Exterior color',
  'Type of glazing', 'Solutia (PVB) stamp', 'Breather tubes', 'Spacer bar color',
  'Exterior silicone color', 'Interior silicone', 'Paintable interior silicone',
  'Thermally insulated threshold', 'Swing door wood sub-sill color',
  'Folding door sub-sill color', 'HST Door sub-sill color',
  'Window screen type and color', 'Cut astragal on French casements for fixed screens',
  'Door screen type and mesh', 'Roll screen', 'Roll shade Box',
  'Spiders / Contacts', 'Steel reinforcement approved',
] as const

export const HARDWARE_ITEMS = [
  { group: 'Swing Doors', item: 'Screwed-in hinges' },
  { group: 'Swing Doors', item: 'Butt hinges' },
  { group: 'Swing Doors', item: 'Finial option' },
  { group: 'Casements', item: 'Screwed-in hinges' },
  { group: 'Casements', item: 'Butt hinges' },
  { group: 'Casements', item: 'Standard concealed hinges' },
  { group: 'Casements', item: 'Bodyguard concealed hinges' },
  { group: 'Casements', item: 'Finial option' },
  { group: 'Casements', item: 'Handles' },
  { group: 'Casements', item: 'Rainguard Color' },
  { group: 'Casements', item: 'Casement stays' },
  { group: 'Casements', item: 'Crank finish' },
  { group: 'SH / DH', item: 'Sash stop' },
  { group: 'SH / DH', item: 'Sash lock' },
  { group: 'SH / DH', item: 'Sash lift' },
  { group: 'SH / DH', item: 'Chain' },
  { group: 'SH / DH', item: 'Pulley' },
  { group: 'SH / DH', item: 'Vent lock' },
  { group: 'HST / Folding Doors', item: 'Track color' },
  { group: 'HST / Folding Doors', item: 'Handle finish' },
  { group: 'Rough hardware materials', item: 'Windows' },
  { group: 'Rough hardware materials', item: 'Swing doors' },
  { group: 'Rough hardware materials', item: 'HST gears' },
  { group: 'Rough hardware materials', item: 'HST meeting locks' },
  { group: 'Swing Screens', item: 'Hinges' },
  { group: 'Swing Screens', item: 'Latch set' },
  { group: 'Swing Screens', item: 'Flush bolts' },
  { group: 'Sliding Screens', item: 'Edge pull' },
  { group: 'Sliding Screens', item: 'Pull grip' },
] as const

export const PRODUCT_OPTIONS = ['Standard', 'Dade County', 'Coastal', 'FPA-Certified'] as const

export interface FactoryOrderSpec {
  re: string
  project: string
  to: string
  from: string
  products: string[]
  approvedDrawings: string
  onHoldItems: string
  specifications: Record<string, { specification: string; remarks: string }>
  hardware: Record<string, { suppliedBy: string; finishType: string }>
  jobsiteAddress: string
  destinationPort: string
  shippingWeek: string
  additionalRemarks: string
  signatureName: string
  signatureTitle: string
}

export const hardwareKey = (group: string, item: string) => `${group}:${item}`

export function parseFactoryOrderSpec(raw: unknown): FactoryOrderSpec {
  let data: Record<string, unknown> = {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
  } catch { /* Treat malformed settings as an empty spec. */ }

  const text = (value: unknown) => typeof value === 'string' ? value : ''
  const map = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
  const specs = map(data.specifications)
  const hardware = map(data.hardware)

  return {
    re: text(data.re), project: text(data.project), to: text(data.to), from: text(data.from),
    products: Array.isArray(data.products)
      ? data.products.filter((product): product is string => PRODUCT_OPTIONS.some((option) => option === product))
      : [],
    approvedDrawings: text(data.approvedDrawings), onHoldItems: text(data.onHoldItems),
    specifications: Object.fromEntries(SPEC_ITEMS.map((_, index) => {
      const row = map(specs[String(index + 1)])
      return [String(index + 1), { specification: text(row.specification), remarks: text(row.remarks) }]
    })),
    hardware: Object.fromEntries(HARDWARE_ITEMS.map(({ group, item }) => {
      const key = hardwareKey(group, item)
      const row = map(hardware[key])
      return [key, { suppliedBy: text(row.suppliedBy), finishType: text(row.finishType) }]
    })),
    jobsiteAddress: text(data.jobsiteAddress), destinationPort: text(data.destinationPort),
    shippingWeek: text(data.shippingWeek), additionalRemarks: text(data.additionalRemarks),
    signatureName: data.signatureName === undefined ? 'Michel Marclay' : text(data.signatureName),
    signatureTitle: data.signatureTitle === undefined ? 'Project Manager' : text(data.signatureTitle),
  }
}