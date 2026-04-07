'use client'
import { SchemaField } from './types'

interface SchemaRendererProps {
  schema: SchemaField[]
  config: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  objectOptions?: Array<{ value: string; label: string }>  // for object-select
}

export function SchemaRenderer({ schema, config, onChange, objectOptions = [] }: SchemaRendererProps) {
  return (
    <div className="space-y-3">
      {schema.map((field, i) => {
        if (field.type === 'divider') {
          return <hr key={i} className="border-gray-100" />
        }
        if (field.type === 'heading') {
          return (
            <p key={i} className="text-[10px] font-bold uppercase tracking-widest text-brand-gray pt-1">
              {field.label}
            </p>
          )
        }

        const value = config[field.key] ?? field.default ?? ''
        const base = 'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark placeholder:text-gray-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none transition'

        return (
          <div key={field.key}>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>

            {field.type === 'text' && (
              <input type="text" className={base} value={value as string}
                placeholder={field.placeholder}
                onChange={e => onChange(field.key, e.target.value)} />
            )}
            {field.type === 'url' && (
              <input type="url" className={base} value={value as string}
                placeholder={field.placeholder}
                onChange={e => onChange(field.key, e.target.value)} />
            )}
            {field.type === 'textarea' && (
              <textarea className={`${base} resize-none h-16`} value={value as string}
                placeholder={field.placeholder}
                onChange={e => onChange(field.key, e.target.value)} />
            )}
            {field.type === 'merge-text' && (
              <div className="relative">
                <input type="text" className={`${base} pr-7`} value={value as string}
                  placeholder={field.placeholder}
                  onChange={e => onChange(field.key, e.target.value)} />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-navy text-xs font-bold"
                  title="Insert field token"
                  onClick={() => {/* TODO: open field picker popover */}}
                >{'{}'}</button>
              </div>
            )}
            {field.type === 'number' && (
              <input type="number" className={base} value={value as number}
                min={field.min} max={field.max}
                onChange={e => onChange(field.key, Number(e.target.value))} />
            )}
            {field.type === 'boolean' && (
              <button
                role="switch"
                aria-checked={!!value}
                onClick={() => onChange(field.key, !value)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </button>
            )}
            {field.type === 'color' && (
              <div className="flex items-center gap-2">
                <input type="color" value={value as string}
                  onChange={e => onChange(field.key, e.target.value)}
                  className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5" />
                <span className="text-xs font-mono text-brand-dark">{value as string}</span>
              </div>
            )}
            {field.type === 'select' && (
              <select className={base} value={value as string}
                onChange={e => onChange(field.key, e.target.value)}>
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {field.type === 'button-group' && (
              <div className="flex gap-1">
                {field.options?.map(opt => (
                  <button key={opt.value}
                    onClick={() => onChange(field.key, opt.value)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all border ${
                      value === opt.value
                        ? 'bg-[#ede9f5] border-brand-navy text-brand-navy font-semibold'
                        : 'bg-white border-gray-200 text-brand-gray hover:border-gray-300'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
            )}
            {field.type === 'object-select' && (
              <select className={base} value={value as string}
                onChange={e => onChange(field.key, e.target.value)}>
                <option value="">— Select object —</option>
                {objectOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {field.type === 'json' && (
              <textarea className={`${base} resize-none h-24 font-mono text-[11px]`}
                value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                onChange={e => {
                  try { onChange(field.key, JSON.parse(e.target.value)) }
                  catch { onChange(field.key, e.target.value) }
                }} />
            )}

            {field.helpText && (
              <p className="text-[10px] text-gray-400 mt-0.5">{field.helpText}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
