/**
 * Master Contact Sheet — data model + resolution for the "Generate Master
 * Contact Sheet" button on the Project record page (record-actions.tsx).
 * Not a widget — just a button that reads the Project's own fields (most
 * are plain manual entry) plus a few auto-filled-but-overridable ones
 * pulled from the linked Property and role-tagged TeamMember records, then
 * posts the result to the PDFKit renderer at POST /master-contact-sheet-pdf/render.
 */
import { recordsService } from './records-service'
import { getRecordName } from '@/widgets/internal/shared/recordName'

export type ContactSheetFieldType = 'text' | 'phone' | 'email' | 'checkbox'

export interface ContactSheetFieldSpec {
  key: string
  label: string
  type: ContactSheetFieldType
}

export interface ContactSheetSectionSpec {
  title: string
  fields: ContactSheetFieldSpec[]
}

export interface ContactSheetField {
  label: string
  type: ContactSheetFieldType
  value: unknown
}

export interface ContactSheetSection {
  title: string
  fields: ContactSheetField[]
}

export const CONTACT_SHEET_SECTIONS: ContactSheetSectionSpec[] = [
  {
    title: 'Job Location',
    fields: [
      { key: 'jobLocationDevelopment', label: 'Development', type: 'text' },
      { key: 'jobLocationSiteTrailerPhone', label: 'Site Trailer Ph.', type: 'phone' },
      { key: 'jobLocationAddress', label: 'Address', type: 'text' },
      { key: 'jobLocationCityStateZip', label: 'City, State, Zip', type: 'text' },
    ],
  },
  {
    title: 'House Manager',
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
    fields: [
      { key: 'clientOwnerContractHolder', label: 'Contract Holder?', type: 'checkbox' },
      { key: 'clientOwnerName', label: 'Name', type: 'text' },
      { key: 'clientOwnerAddress', label: 'Address', type: 'text' },
      { key: 'clientOwnerPhone', label: 'Phone', type: 'phone' },
      { key: 'clientOwnerMobile', label: 'Mobile', type: 'phone' },
      { key: 'clientOwnerFax', label: 'Fax', type: 'phone' },
      { key: 'clientOwnerEmail', label: 'E-mail', type: 'email' },
      { key: 'clientOwnerAddress2', label: '2nd Address', type: 'text' },
      { key: 'clientOwnerOther', label: 'Other', type: 'text' },
    ],
  },
  {
    title: 'Contractor',
    fields: [
      { key: 'contractorContractHolder', label: 'Contract Holder?', type: 'checkbox' },
      { key: 'contractorName', label: 'Name', type: 'text' },
      { key: 'contractorTitle', label: 'Title', type: 'text' },
      { key: 'contractorCompany', label: 'Company', type: 'text' },
      { key: 'contractorPhone', label: 'Phone', type: 'phone' },
      { key: 'contractorMobile', label: 'Mobile', type: 'phone' },
      { key: 'contractorFax', label: 'Fax', type: 'phone' },
      { key: 'contractorEmail', label: 'E-mail', type: 'email' },
      { key: 'contractorAddress', label: 'Address', type: 'text' },
    ],
  },
  {
    title: 'Architect',
    fields: [
      { key: 'architectName', label: 'Name', type: 'text' },
      { key: 'architectTitle', label: 'Title', type: 'text' },
      { key: 'architectCompany', label: 'Company', type: 'text' },
      { key: 'architectPhone', label: 'Phone', type: 'phone' },
      { key: 'architectMobile', label: 'Mobile', type: 'phone' },
      { key: 'architectFax', label: 'Fax', type: 'phone' },
      { key: 'architectEmail', label: 'E-mail', type: 'email' },
      { key: 'architectAddress', label: 'Address', type: 'text' },
      { key: 'architectOther', label: 'Other', type: 'text' },
    ],
  },
  {
    title: 'Designer',
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

/** Builds the PDF payload's sections: each field's value is the Project's
 * own saved value if set, else an auto-filled suggestion resolved from the
 * linked Property/TeamMember records (never persisted — just for this PDF). */
export async function buildMasterContactSheetSections(record: Record<string, unknown>): Promise<ContactSheetSection[]> {
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

  const projectId = record?.id ? String(record.id) : undefined
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

  return CONTACT_SHEET_SECTIONS.map((section) => ({
    title: section.title,
    fields: section.fields.map((field) => {
      const raw = getField(record, field.key)
      const value = raw !== undefined && raw !== null && raw !== '' ? raw : computed[field.key]
      return { label: field.label, type: field.type, value }
    }),
  }))
}
