jest.mock('next/dynamic', () => (fn: () => Promise<any>) => fn)

import { getExternalRegistration, getInternalRegistrationByType } from '@/lib/widgets/registry-loader'
import { enabledWidgetIds } from '@/lib/use-widget-settings'

describe('widget enablement', () => {
  it('shows registered internal widgets omitted from the API but honors explicit disables', () => {
    const ids = enabledWidgetIds([
      { widgetId: 'cad-index-list', enabled: false },
      { widgetId: 'dropbox-browser', kind: 'external', enabled: true },
    ])
    expect(ids.has('factory-order-spec')).toBe(true)
    expect(ids.has('installation-material')).toBe(true)
    expect(ids.has('transmittal')).toBe(true)
    expect(ids.has('cad-index-list')).toBe(false)
    expect(ids.has('dropbox-browser')).toBe(true)
    expect(ids.has('demo-widget')).toBe(false)
  })
})

describe('getExternalRegistration', () => {
  it('returns the registration for a known external widget ID', () => {
    const reg = getExternalRegistration('demo-widget')
    expect(reg).toBeDefined()
    expect(reg?.manifest.id).toBe('demo-widget')
    expect(reg?.Component).toBeDefined()
  })

  it('returns undefined for an unknown ID', () => {
    expect(getExternalRegistration('nonexistent')).toBeUndefined()
  })
})

describe('getInternalRegistrationByType', () => {
  it.each([
    ['Spacer'],
    ['ActivityFeed'],
    ['HeaderHighlights'],
    ['FileFolder'],
    ['RelatedList'],
    ['Transmittal'],
    ['InstallationMaterial'],
  ])('returns a registration for type %s', (type) => {
    const reg = getInternalRegistrationByType(type)
    expect(reg).toBeDefined()
    expect(reg?.widgetConfigType).toBe(type)
    expect(reg?.Component).toBeDefined()
  })

  it('returns undefined for an unknown type', () => {
    expect(getInternalRegistrationByType('Nonexistent')).toBeUndefined()
  })

  it('Spacer registration has transformConfig that maps minHeightPx to height', () => {
    const reg = getInternalRegistrationByType('Spacer')
    expect(reg?.transformConfig).toBeDefined()
    const result = reg!.transformConfig!({ minHeightPx: 64 })
    expect(result).toEqual({ height: 64 })
  })

  it('Spacer transformConfig uses default 32 when minHeightPx is missing', () => {
    const reg = getInternalRegistrationByType('Spacer')
    const result = reg!.transformConfig!({})
    expect(result).toEqual({ height: 32 })
  })

  it('FileFolder registration has transformConfig that maps folderId to path', () => {
    const reg = getInternalRegistrationByType('FileFolder')
    expect(reg?.transformConfig).toBeDefined()
    const result = reg!.transformConfig!({ folderId: 'folder-abc' })
    expect(result).toEqual({ path: 'folder-abc' })
  })

  it('FileFolder transformConfig uses default empty string when folderId is missing', () => {
    const reg = getInternalRegistrationByType('FileFolder')
    const result = reg!.transformConfig!({})
    expect(result).toEqual({ path: '' })
  })
})
