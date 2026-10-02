export const INSTALLATION_MATERIAL_TEMPLATES = ['ACQ', 'Non-ACQ', 'US Supplied Inst.'] as const
export const INSTALLATION_METHODS = ['Installation by TuS', 'Installation by Others', 'Dade County installation'] as const
export const MATERIAL_SOURCES = ['Tischler Fensterwerk', 'CT Warehouse', 'Other', 'FL Warehouse'] as const
export const INSTALLATION_MATERIAL_ROW_COUNT = 44

export interface InstallationMaterialRow {
  qty: string
  units: string
  description: string
  screwSize: string
  unitPrice: string
}

export interface InstallationMaterial {
  template: typeof INSTALLATION_MATERIAL_TEMPLATES[number]
  date: string
  factory: string
  project: string
  location: string
  projectManager: string
  attn: string
  installationBy: string[]
  orderedFrom: string[]
  rows: InstallationMaterialRow[]
  signature: string
  signatureDate: string
}

export interface InstallationMaterialWorkbook {
  version: 1
  activeTemplate: typeof INSTALLATION_MATERIAL_TEMPLATES[number]
  sheets: Record<typeof INSTALLATION_MATERIAL_TEMPLATES[number], InstallationMaterial>
}

function emptyRow(): InstallationMaterialRow {
  return { qty: '', units: '', description: '', screwSize: '', unitPrice: '' }
}

export function parseInstallationMaterial(raw: unknown, projectName = ''): InstallationMaterial {
  let data: Record<string, unknown> = {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
  } catch { /* Invalid stored data starts as a blank form. */ }
  const text = (value: unknown) => typeof value === 'string' ? value : ''
  const selected = (value: unknown, options: readonly string[]) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && options.includes(item))
    : []
  const orderedFromValues = Array.isArray(data.orderedFrom)
    ? data.orderedFrom.map(value => value === 'Korn' ? 'Tischler Fensterwerk' : value)
    : data.orderedFrom
  const rows = Array.isArray(data.rows) ? data.rows.slice(0, 100).map((row: unknown) => {
    const item = row && typeof row === 'object' ? row as Record<string, unknown> : {}
    return {
      qty: text(item.qty), units: text(item.units), description: text(item.description),
      screwSize: text(item.screwSize), unitPrice: text(item.unitPrice),
    }
  }) : []

  return {
    template: INSTALLATION_MATERIAL_TEMPLATES.includes(data.template as typeof INSTALLATION_MATERIAL_TEMPLATES[number])
      ? data.template as typeof INSTALLATION_MATERIAL_TEMPLATES[number] : INSTALLATION_MATERIAL_TEMPLATES[0],
    date: text(data.date), factory: text(data.factory), project: text(data.project) || projectName,
    location: text(data.location), projectManager: text(data.projectManager), attn: text(data.attn),
    installationBy: selected(data.installationBy, INSTALLATION_METHODS),
    orderedFrom: selected(orderedFromValues, MATERIAL_SOURCES),
    rows: rows.length ? rows : Array.from({ length: INSTALLATION_MATERIAL_ROW_COUNT }, emptyRow),
    signature: text(data.signature), signatureDate: text(data.signatureDate),
  }
}

export function parseInstallationMaterialWorkbook(raw: unknown, projectName = ''): InstallationMaterialWorkbook {
  let data: Record<string, unknown> = {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
  } catch { /* Invalid stored data starts with three blank sheets. */ }

  const rawSheets = data.sheets && typeof data.sheets === 'object' && !Array.isArray(data.sheets)
    ? data.sheets as Record<string, unknown>
    : null

  let sheets = Object.fromEntries(INSTALLATION_MATERIAL_TEMPLATES.map(template => [
    template,
    parseInstallationMaterial(rawSheets?.[template] ?? { template }, projectName),
  ])) as InstallationMaterialWorkbook['sheets']

  if (!rawSheets) {
    const legacy = parseInstallationMaterial(data, projectName)
    sheets = { ...sheets, [legacy.template]: legacy }
  }

  const requestedActive = rawSheets && INSTALLATION_MATERIAL_TEMPLATES.includes(data.activeTemplate as typeof INSTALLATION_MATERIAL_TEMPLATES[number])
    ? data.activeTemplate as typeof INSTALLATION_MATERIAL_TEMPLATES[number]
    : !rawSheets
      ? parseInstallationMaterial(data, projectName).template
      : INSTALLATION_MATERIAL_TEMPLATES[0]

  return { version: 1, activeTemplate: requestedActive, sheets }
}

export function calculateMaterialTotal(row: InstallationMaterialRow): number {
  const quantity = Number(row.qty.replace(/,/g, '')) || 0
  const unitPrice = Number(row.unitPrice.replace(/[$,€\s]/g, '')) || 0
  return quantity * unitPrice
}

export function formatMaterialTotal(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}