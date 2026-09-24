'use client'

/**
 * Master Contact Sheet widget — a printable project contact directory
 * (Job Location, House Manager, Client Representative, Job Superintendent,
 * Client/Owner, Contractor, Architect, Designer). Name/Phone/E-mail for the
 * three role-based sections (Client/Owner, Contractor, Architect) and the
 * two Job Location address fields are auto-filled from the Project's linked
 * Property/TeamMember records, but stay fully overridable — a saved value
 * always wins over the computed default; only an unset (null/undefined)
 * value gets the auto-filled suggestion. Every other field (House Manager,
 * Client Representative, Job Superintendent, Designer, and the secondary
 * fields on the pulled sections) has no data source and is plain manual
 * entry.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BookUser, FileText, Loader2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'
import { apiClient } from '@/lib/api-client'
import { getRecordName } from '../shared/recordName'

type FieldType = 'text' | 'phone' | 'email' | 'checkbox'

interface FieldSpec {
  key: string
  label: string
  type: FieldType
  /** Has an auto-filled default computed from a linked record (still overridable). */
  computed?: boolean
}

interface Section {
  title: string
  subtitle?: string
  fields: FieldSpec[]
}

const SECTIONS: Section[] = [
  {
    title: 'Job Location',
    subtitle: 'Pulled from Property',
    fields: [
      { key: 'jobLocationDevelopment', label: 'Development', type: 'text' },
      { key: 'jobLocationSiteTrailerPhone', label: 'Site Trailer Ph.', type: 'phone' },
      { key: 'jobLocationAddress', label: 'Address', type: 'text', computed: true },
      { key: 'jobLocationCityStateZip', label: 'City, State, Zip', type: 'text', computed: true },
    ],
  },
  {
    title: 'House Manager',
    subtitle: 'TBD',
    fields: [
      { key: 'houseManagerName', label: 'Name', type: 'text' },
      { key: 'houseManagerPhone', label: 'Phone', type: 'phone' },
      { key: 'houseManagerMobile', label: 'Mobile', type: 'phone' },
      { key: 'houseManagerFax', label: 'Fax', type: 'phone' },
      { key: 'houseManagerEmail', label: 'E-mail', type: 'email' },
    ],
  },
  {
    title: 'Client Representative',
    subtitle: 'TBD',
    fields: [
      { key: 'clientRepName', label: 'Name', type: 'text' },
      { key: 'clientRepPhone', label: 'Phone', type: 'phone' },
      { key: 'clientRepFax', label: 'Fax', type: 'phone' },
      { key: 'clientRepMobile', label: 'Mobile', type: 'phone' },
      { key: 'clientRepEmail', label: 'E-mail', type: 'email' },
    ],
  },
  {
    title: 'Job Superintendent',
    subtitle: 'TBD',
    fields: [
      { key: 'jobSuperintendentName', label: 'Name', type: 'text' },
      { key: 'jobSuperintendentPhone', label: 'Phone', type: 'phone' },
      { key: 'jobSuperintendentMobile', label: 'Mobile', type: 'phone' },
      { key: 'jobSuperintendentFax', label: 'Fax', type: 'phone' },
      { key: 'jobSuperintendentEmail', label: 'E-mail', type: 'email' },
    ],
  },
  {
    title: 'Client / Owner',
    subtitle: 'Pulled from Homeowner',
    fields: [
      { key: 'clientOwnerContractHolder', label: 'Contract Holder?', type: 'checkbox', computed: true },
      { key: 'clientOwnerName', label: 'Name', type: 'text', computed: true },
      { key: 'clientOwnerAddress', label: 'Address', type: 'text' },
      { key: 'clientOwnerPhone', label: 'Phone', type: 'phone', computed: true },
      { key: 'clientOwnerMobile', label: 'Mobile', type: 'phone' },
      { key: 'clientOwnerFax', label: 'Fax', type: 'phone' },
      { key: 'clientOwnerEmail', label: 'E-mail', type: 'email', computed: true },
      { key: 'clientOwnerAddress2', label: '2nd Address', type: 'text' },
      { key: 'clientOwnerOther', label: 'Other', type: 'text' },
    ],
  },
  {
    title: 'Contractor',
    subtitle: 'Pulled from General Contractor',
    fields: [
      { key: 'contractorContractHolder', label: 'Contract Holder?', type: 'checkbox', computed: true },
      { key: 'contractorName', label: 'Name', type: 'text', computed: true },
      { key: 'contractorTitle', label: 'Title', type: 'text' },
      { key: 'contractorCompany', label: 'Company', type: 'text' },
      { key: 'contractorPhone', label: 'Phone', type: 'phone', computed: true },
      { key: 'contractorMobile', label: 'Mobile', type: 'phone' },
      { key: 'contractorFax', label: 'Fax', type: 'phone' },
      { key: 'contractorEmail', label: 'E-mail', type: 'email', computed: true },
      { key: 'contractorAddress', label: 'Address', type: 'text' },
    ],
  },
  {
    title: 'Architect',
    subtitle: 'Pulled from Architect / Designer',
    fields: [
      { key: 'architectName', label: 'Name', type: 'text', computed: true },
      { key: 'architectTitle', label: 'Title', type: 'text' },
      { key: 'architectCompany', label: 'Company', type: 'text' },
      { key: 'architectPhone', label: 'Phone', type: 'phone', computed: true },
      { key: 'architectMobile', label: 'Mobile', type: 'phone' },
      { key: 'architectFax', label: 'Fax', type: 'phone' },
      { key: 'architectEmail', label: 'E-mail', type: 'email', computed: true },
      { key: 'architectAddress', label: 'Address', type: 'text' },
      { key: 'architectOther', label: 'Other', type: 'text' },
    ],
  },
  {
    title: 'Designer',
    subtitle: 'TBD',
    fields: [
      { key: 'designerName', label: 'Name', type: 'text' },
      { key: 'designerTitle', label: 'Title', type: 'text' },
      { key: 'designerCompany', label: 'Company', type: 'text' },
      { key: 'designerPhone', label: 'Phone', type: 'phone' },
      { key: 'designerMobile', label: 'Mobile', type: 'phone' },
      { key: 'designerFax', label: 'Fax', type: 'phone' },
      { key: 'designerEmail', label: 'E-mail', type: 'email' },
      { key: 'designerAddress', label: 'Address', type: 'text' },
      { key: 'designerOther', label: 'Other', type: 'text' },
    ],
  },
]

const ALL_FIELDS: FieldSpec[] = SECTIONS.flatMap((s) => s.fields)

/** role -> which section's computed defaults it feeds. */
const ROLE_TO_PREFIX: Record<string, string> = {
  'Homeowner': 'clientOwner',
  'General Contractor': 'contractor',
  'Architect / Designer': 'architect',
}

function getField(data: Record<string, unknown> | undefined, key: string): unknown {
  if (!data) return undefined
  if (data[key] !== undefined) return data[key]
  for (const k of Object.keys(data)) {
    if (k.replace(/^[A-Za-z]+__/, '') === key) return data[k]
  }
  return undefined
}

export default function MasterContactSheetWidget({ record, object }: WidgetProps) {
  const projectId = record?.id ? String(record.id) : undefined
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [computedValues, setComputedValues] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const computed: Record<string, unknown> = {}

        const propertyId = getField(record, 'property')
        if (propertyId) {
          const property = await recordsService.getRecord('Property', String(propertyId))
          if (property) {
            const address = getField(property.data, 'address')
            const city = getField(property.data, 'city')
            const state = getField(property.data, 'state')
            const zip = getField(property.data, 'zipCode')
            if (address) computed.jobLocationAddress = address
            const cityStateZip = [city, state].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '')
            if (cityStateZip.trim()) computed.jobLocationCityStateZip = cityStateZip.trim()
          }
        }

        if (projectId) {
          const teamMembers = await recordsService.getRecords('TeamMember', { filter: { project: projectId } })
          for (const [role, prefix] of Object.entries(ROLE_TO_PREFIX)) {
            const match = teamMembers.find((tm) => getField(tm.data, 'role') === role)
            if (!match) continue
            computed[`${prefix}ContractHolder`] = !!getField(match.data, 'contractHolder')
            const contactId = getField(match.data, 'contact')
            const accountId = getField(match.data, 'account')
            let linked: Record<string, unknown> | undefined
            if (contactId) linked = (await recordsService.getRecord('Contact', String(contactId)))?.data
            else if (accountId) linked = (await recordsService.getRecord('Account', String(accountId)))?.data
            if (linked) {
              const name = getRecordName(linked)
              if (name) computed[`${prefix}Name`] = name
              const phone = getField(linked, 'phone')
              if (phone) computed[`${prefix}Phone`] = phone
              const email = getField(linked, 'email')
              if (email) computed[`${prefix}Email`] = email
            }
          }
        }

        if (cancelled) return
        setComputedValues(computed)
        // Only seed `values` with genuinely SAVED data (never with a computed
        // guess) — that's what lets onBlur tell "never touched, still showing
        // the auto-filled suggestion" apart from "user actually typed
        // something", so merely clicking into and back out of a field never
        // silently saves the suggestion as if the user had confirmed it.
        const initial: Record<string, unknown> = {}
        for (const field of ALL_FIELDS) {
          const raw = getField(record, field.key)
          if (raw !== undefined && raw !== null) initial[field.key] = raw
        }
        setValues(initial)
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Master Contact Sheet data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const projectName = useMemo(() => (record ? getRecordName(record as Record<string, unknown>) : 'Project'), [record])

  /** The saved value if the user has one, else the computed suggestion. */
  const effectiveValue = (key: string): unknown => (values[key] !== undefined ? values[key] : computedValues[key])

  if (object?.apiName && object.apiName !== 'Project') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The Master Contact Sheet widget can only be placed on the Project object&rsquo;s layout.
      </div>
    )
  }

  const handleFieldCommit = async (key: string, value: unknown) => {
    if (!projectId) return
    setSavingKey(key)
    setError(null)
    try {
      await recordsService.updateRecord('Project', projectId, { data: { [key]: value } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save change')
    } finally {
      setSavingKey(null)
    }
  }

  const handleGeneratePdf = async () => {
    if (generatingPdf) return
    const previewWindow = window.open('', '_blank')
    setGeneratingPdf(true)
    setError(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const token = apiClient.getToken()
      const response = await fetch(`${apiBase}/master-contact-sheet-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectName,
          sections: SECTIONS.map((s) => ({
            title: s.title,
            fields: s.fields.map((f) => ({ label: f.label, type: f.type, value: effectiveValue(f.key) })),
          })),
        }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(detail.error || `Failed to render PDF (${response.status})`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = url
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = 'Master_Contact_Sheet.pdf'
        link.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err: unknown) {
      previewWindow?.close()
      setError(err instanceof Error ? err.message : 'Failed to generate Master Contact Sheet PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <BookUser className="h-5 w-5 text-brand-navy" />
          <div>
            <h3 className="text-sm font-bold text-brand-navy">Master Contact Sheet</h3>
            <p className="text-xs text-gray-500">Auto-filled fields stay editable — a saved value always wins.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleGeneratePdf()}
          disabled={generatingPdf}
          className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50"
        >
          {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          {generatingPdf ? 'Preparing PDF…' : 'Generate Master Contact Sheet'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-brand-navy" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {SECTIONS.map((section) => (
            <div key={section.title} className="overflow-hidden rounded-lg border border-gray-200">
              <div className="flex items-center justify-between bg-brand-navy px-3 py-1.5">
                <h4 className="text-xs font-bold text-white">{section.title}</h4>
                {section.subtitle && <span className="text-[10px] text-white/70">{section.subtitle}</span>}
              </div>
              <div className="divide-y divide-gray-100">
                {section.fields.map((field) => {
                  const isAutoFilled = !!field.computed && values[field.key] === undefined && computedValues[field.key] !== undefined
                  if (field.type === 'checkbox') {
                    return (
                      <label key={field.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                        <span className="font-medium text-gray-600">{field.label}</span>
                        <input
                          type="checkbox"
                          checked={!!effectiveValue(field.key)}
                          onChange={(e) => {
                            setValues((prev) => ({ ...prev, [field.key]: e.target.checked }))
                            void handleFieldCommit(field.key, e.target.checked)
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
                        />
                      </label>
                    )
                  }
                  const displayValue = effectiveValue(field.key)
                  return (
                    <div key={field.key} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="w-28 shrink-0 font-medium text-gray-600">{field.label}</span>
                      <input
                        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        value={typeof displayValue === 'string' || typeof displayValue === 'number' ? String(displayValue) : ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        onBlur={(e) => { if (values[field.key] !== undefined) void handleFieldCommit(field.key, e.target.value) }}
                        disabled={savingKey === field.key}
                        className={`w-full rounded border px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy ${isAutoFilled ? 'border-gray-200 italic text-gray-400' : 'border-brand-navy/30 text-gray-900'}`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
