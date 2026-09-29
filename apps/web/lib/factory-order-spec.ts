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
  manualOverrides: string[]
}

export interface FactoryOrderDefaults {
  from?: string
  products?: string[]
  rollScreen?: string
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
    manualOverrides: Array.isArray(data.manualOverrides)
      ? data.manualOverrides.filter((value): value is string => typeof value === 'string')
      : [],
  }
}

export function applyFactoryOrderDefaults(spec: FactoryOrderSpec, defaults: FactoryOrderDefaults): FactoryOrderSpec {
  const overridden = new Set(spec.manualOverrides)
  const next: FactoryOrderSpec = {
    ...spec,
    products: [...spec.products],
    specifications: { ...spec.specifications },
  }
  if (!overridden.has('from') && !next.from.trim() && defaults.from) next.from = defaults.from
  if (!overridden.has('products') && next.products.length === 0 && defaults.products?.length) {
    next.products = defaults.products.filter((product): product is string =>
      PRODUCT_OPTIONS.some((option) => option === product))
  }
  if (!overridden.has('rollScreen') && !next.specifications['19']?.specification.trim() && defaults.rollScreen) {
    next.specifications['19'] = { ...next.specifications['19'], specification: defaults.rollScreen }
  }
  return next
}

export function refreshFactoryOrderDefaults(spec: FactoryOrderSpec, defaults: FactoryOrderDefaults): FactoryOrderSpec {
  return {
    ...spec,
    from: defaults.from ?? '',
    products: defaults.products?.filter((product): product is string =>
      PRODUCT_OPTIONS.some((option) => option === product)) ?? [],
    specifications: {
      ...spec.specifications,
      '19': { ...spec.specifications['19'], specification: defaults.rollScreen ?? '' },
    },
    manualOverrides: spec.manualOverrides.filter((key) =>
      key !== 'from' && key !== 'products' && key !== 'rollScreen'),
  }
}

const normalizedFieldName = (key: string) => key
  .replace(/^[A-Za-z]+__/, '')
  .replace(/__c$/i, '')
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase()

export function readProjectField(record: Record<string, unknown>, apiName: string): unknown {
  const target = normalizedFieldName(apiName)
  const source = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : record
  const key = Object.keys(source).find((candidate) => normalizedFieldName(candidate) === target)
  return key ? source[key] : undefined
}

export function readLookupId(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  const lookup = value as Record<string, unknown>
  const id = lookup.lookup ?? lookup.id ?? lookup.value
  return typeof id === 'string' ? id : ''
}

export function factoryOrderDefaultsFromProject(record: Record<string, unknown>, managerName = ''): FactoryOrderDefaults {
  const rawProduct = readProjectField(record, 'product_specification')
  const productValues = Array.isArray(rawProduct) ? rawProduct : String(rawProduct ?? '').split(/[;,]/)
  const normalizeProduct = (value: unknown) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
  const products = PRODUCT_OPTIONS.filter((option) =>
    productValues.some((value) => normalizeProduct(value).includes(normalizeProduct(option))))
  const rawRollScreens = readProjectField(record, 'Insect_Roll_Screens__c')
  const rollScreensEnabled = rawRollScreens === true || ['yes', 'y', 'true', '1'].includes(String(rawRollScreens ?? '').trim().toLowerCase())
  return {
    from: managerName || undefined,
    products,
    rollScreen: rollScreensEnabled ? 'Yes' : undefined,
  }
}