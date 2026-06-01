'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'

interface MultiSelectProps {
  label: string
  value: string[]
  onChange: (next: string[]) => void
  options: string[]
  /** Optional placeholder when nothing is selected. Defaults to `All ${label}`. */
  emptyLabel?: string
  /** Optional display labels for option values, e.g. { Freelancer: 'Contractor' }. */
  optionLabels?: Record<string, string>
}

/**
 * Lightweight multi-select dropdown. No external dependencies.
 * Selected items appear as small pills in the trigger; the dropdown is a
 * checkbox list with a search box for long option sets.
 */
export function MultiSelect({ label, value, onChange, options, emptyLabel, optionLabels }: MultiSelectProps) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Click-outside closer
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const displayLabel = (opt: string) => optionLabels?.[opt] ?? opt

  const filtered = search.trim()
    ? options.filter(o => displayLabel(o).toLowerCase().includes(search.toLowerCase()))
    : options

  function toggle(opt: string) {
    onChange(
      value.includes(opt)
        ? value.filter(v => v !== opt)
        : [...value, opt]
    )
  }

  const summary = value.length === 0
    ? (emptyLabel ?? `All ${label}`)
    : value.length === 1
      ? displayLabel(value[0])
      : `${value.length} ${label}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`min-w-[140px] flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
          value.length > 0
            ? 'border-blue-300 bg-blue-50 text-blue-800'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        }`}
      >
        <span className="truncate">{summary}</span>
        {value.length > 0 ? (
          <X
            className="w-3.5 h-3.5 ml-auto opacity-60 hover:opacity-100"
            onClick={e => { e.stopPropagation(); onChange([]) }}
          />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-60" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white rounded-lg border border-slate-200 shadow-lg max-h-72 overflow-hidden flex flex-col">
          {/* Search */}
          {options.length > 6 && (
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                type="text"
                placeholder={`Search ${label.toLowerCase()}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-xs rounded border border-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Header row */}
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-500 border-b border-slate-100">
            <span>{value.length} selected</span>
            {value.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No matches</p>
            ) : (
              filtered.map(opt => {
                const selected = value.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-slate-50 ${
                      selected ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                    }`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate">{displayLabel(opt)}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
