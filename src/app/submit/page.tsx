'use client'

import { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CheckCircle2, Minus, Plus, LogOut,
  ClipboardList, PenLine, Pencil, Trash2, X, Upload, FileText, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SessionUser } from '@/lib/auth'

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCALES = ['en_GB', 'de_DE', 'nl_NL', 'fr_FR', 'da_DK', 'nb_NO'] as const
type Locale = (typeof LOCALES)[number]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailySubmissionRow {
  id: string
  userId: string
  userName: string
  userLocale: string | null
  date: string
  locale: string
  productionHours: number
  hasNonProduction: boolean
  totalNonProductionHours: number
  npHours2pass: number
  npHoursPhi: number
  npHoursIAA: number
  npHoursTraining: number
  npHoursReview: number
  npHoursWaiting: number
  npHoursMeetings: number
  npHoursIT: number
  npHoursOther: number
  otherWorkingRemarks: string
  productionComments: string
  totalWorkingHours: number
  remarks: string
  miscCost: number | null
  invoiceUrls: string[]
  submittedAt: string
}

interface UserSummary {
  id: string
  name: string
  role: string
  locale: string | null
  employeeType: string | null
  workflow: string | null
}

interface SuccessData {
  date: string
  locale: string
  productionHours: number
  totalNonProductionHours: number
  totalWorkingHours: number
  remarks: string
  forName?: string
}

// ─── NumInput ─────────────────────────────────────────────────────────────────
// Compact +/- number input. Step defaults to 0.5.

interface NumInputProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

function NumInput({ value, onChange, min = 0, max = 24, step = 0.5, disabled = false }: NumInputProps) {
  function decrement() {
    const next = round1(value - step)
    if (next >= min) onChange(next)
  }
  function increment() {
    const next = round1(value + step)
    if (next <= max) onChange(next)
  }
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value)
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, round1(v))))
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || value <= min}
        className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        disabled={disabled}
        className="w-20 text-center px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 tabular-nums"
      />
      <button
        type="button"
        onClick={increment}
        disabled={disabled || value >= max}
        className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── TotalHoursDisplay ────────────────────────────────────────────────────────

function TotalHoursDisplay({ total }: { total: number }) {
  const REF_HOURS = 8
  const pct = Math.min((total / REF_HOURS) * 100, 100)
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-800 tabular-nums">
          {total % 1 === 0 ? `${total}.0` : total}
        </span>
        <span className="text-base text-slate-500">h total</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400">Auto-calculated: Production + Other-Working</p>
    </div>
  )
}

// ─── FileUpload ───────────────────────────────────────────────────────────────

const ALLOWED_ACCEPT = [
  '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf',
  'image/*', 'video/*', 'audio/*',
].join(',')

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

interface FileUploadProps {
  files: File[]
  onChange: (files: File[]) => void
}

function FileUpload({ files, onChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return
    const arr = Array.from(newFiles)
    const combined = [...files, ...arr].slice(0, 5)
    onChange(combined)
  }

  function removeFile(i: number) {
    onChange(files.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          dragging ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50',
        )}
      >
        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-medium">Click to upload or drag & drop</p>
        <p className="text-xs text-slate-400 mt-0.5">Word, Excel, PPT, PDF, Image, Video, Audio · up to 5 files · 10 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_ACCEPT}
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-slate-400 shrink-0">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── SuccessCard ──────────────────────────────────────────────────────────────

function SuccessCard({ data, onAnother }: { data: SuccessData; onAnother: () => void }) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-4">
      <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
      <div>
        <p className="font-semibold text-green-800 text-lg">Hours submitted successfully</p>
        {data.forName && (
          <p className="text-sm text-green-600 mt-0.5">Submitted for {data.forName}</p>
        )}
        <div className="text-sm text-green-700 mt-2 space-y-0.5">
          <p>{fmtDate(data.date)} · {data.locale}</p>
          <p>Production: {data.productionHours}h · Other-Working: {data.totalNonProductionHours}h · Total: {data.totalWorkingHours}h</p>
          {data.remarks && (
            <p className="text-xs text-green-600 mt-1 italic line-clamp-2">"{data.remarks}"</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onAnother}
        className="px-4 py-2 text-sm font-medium bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
      >
        Submit another day
      </button>
    </div>
  )
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4', className)}>
      {children}
    </div>
  )
}

function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── HoursForm ────────────────────────────────────────────────────────────────

interface HoursFormProps {
  session: SessionUser
  /** When set (admin mode), submits on behalf of this user */
  forUser?: { id: string; name: string; locale: string | null }
}

function HoursForm({ session, forUser }: HoursFormProps) {
  const effectiveLocale = forUser?.locale ?? session.locale ?? 'en_GB'
  const isFreelancer = session.role === 'freelancer'

  // Form state
  const [date,                    setDate]                    = useState(todayISO())
  const [locale,                  setLocale]                  = useState<string>(effectiveLocale)
  const [productionHours,         setProductionHours]         = useState(0)
  const [hasNonProduction,        setHasNonProduction]        = useState<boolean | null>(null)
  const [totalNonProductionHours, setTotalNonProductionHours] = useState(0)
  const [npHours2pass,            setNpHours2pass]            = useState(0)
  const [npHoursPhi,              setNpHoursPhi]              = useState(0)
  const [npHoursIAA,              setNpHoursIAA]              = useState(0)
  const [npHoursTraining,         setNpHoursTraining]         = useState(0)
  const [npHoursReview,           setNpHoursReview]           = useState(0)
  const [npHoursWaiting,          setNpHoursWaiting]          = useState(0)
  const [npHoursMeetings,         setNpHoursMeetings]         = useState(0)
  const [npHoursIT,               setNpHoursIT]               = useState(0)
  const [otherWorkingRemarks,     setOtherWorkingRemarks]     = useState('')
  const [productionComments,      setProductionComments]      = useState('')
  const [remarks,                 setRemarks]                 = useState('')
  const [miscCost,                setMiscCost]                = useState<string>('')
  const [invoiceFiles,            setInvoiceFiles]            = useState<File[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState<SuccessData | null>(null)

  // Derived
  const npSubtotal = round1(
    npHours2pass + npHoursPhi + npHoursIAA + npHoursTraining + npHoursReview +
    npHoursWaiting + npHoursMeetings + npHoursIT
  )
  const npMatch           = Math.abs(npSubtotal - totalNonProductionHours) < 0.001
  const totalWorkingHours = round1(productionHours + (hasNonProduction ? totalNonProductionHours : 0))

  // Sync locale when forUser changes
  useEffect(() => {
    setLocale(forUser?.locale ?? session.locale ?? 'en_GB')
  }, [forUser, session.locale])

  function resetForm() {
    setDate(todayISO())
    setLocale(forUser?.locale ?? session.locale ?? 'en_GB')
    setProductionHours(0)
    setHasNonProduction(null)
    setTotalNonProductionHours(0)
    setNpHours2pass(0)
    setNpHoursPhi(0)
    setNpHoursIAA(0)
    setNpHoursTraining(0)
    setNpHoursReview(0)
    setNpHoursWaiting(0)
    setNpHoursMeetings(0)
    setNpHoursIT(0)
    setOtherWorkingRemarks('')
    setProductionComments('')
    setRemarks('')
    setMiscCost('')
    setInvoiceFiles([])
    setError('')
    setSuccess(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    // Validate
    const errs: string[] = []

    if (!date) errs.push('Date is required.')
    if (hasNonProduction === null) errs.push('Please answer whether you have other-working hours.')

    if (!productionComments.trim()) errs.push('Production hours comments are required.')

    if (hasNonProduction) {
      if (totalNonProductionHours <= 0) errs.push('Total other-working hours must be > 0.')
      if (!npMatch) errs.push(`Sub-category breakdown (${npSubtotal}h) must equal declared total (${totalNonProductionHours}h).`)
      if (!otherWorkingRemarks.trim()) errs.push('Other-working hours remarks are required.')
    }

    if (!remarks.trim()) errs.push('Remarks are required.')

    const parsedMiscCost = miscCost !== '' ? parseFloat(miscCost) : null
    if (parsedMiscCost !== null && (isNaN(parsedMiscCost) || parsedMiscCost < 0)) {
      errs.push('Miscellaneous cost must be a valid non-negative number.')
    }

    if (errs.length > 0) {
      setError(errs.join(' '))
      return
    }

    setSubmitting(true)

    try {
      // Step 1: Upload files if any
      let invoiceUrls: string[] = []
      if (invoiceFiles.length > 0) {
        const fd = new FormData()
        invoiceFiles.forEach(f => fd.append('files', f))
        const uploadRes = await fetch('/api/daily-submissions/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({}))
          setError((uploadData as { error?: string }).error ?? 'File upload failed.')
          setSubmitting(false)
          return
        }
        const uploadData = await uploadRes.json() as { urls: string[] }
        invoiceUrls = uploadData.urls
      }

      // Step 2: Submit form data
      const effectiveNP = hasNonProduction ? totalNonProductionHours : 0
      const body: Record<string, unknown> = {
        date,
        locale,
        productionHours,
        hasNonProduction:         !!hasNonProduction,
        totalNonProductionHours:  effectiveNP,
        npHours2pass:     hasNonProduction ? npHours2pass    : 0,
        npHoursPhi:       hasNonProduction ? npHoursPhi      : 0,
        npHoursIAA:       hasNonProduction ? npHoursIAA      : 0,
        npHoursTraining:  hasNonProduction ? npHoursTraining : 0,
        npHoursReview:    hasNonProduction ? npHoursReview   : 0,
        npHoursWaiting:   hasNonProduction ? npHoursWaiting  : 0,
        npHoursMeetings:  hasNonProduction ? npHoursMeetings : 0,
        npHoursIT:        hasNonProduction ? npHoursIT       : 0,
        npHoursOther:     0,
        otherWorkingRemarks: hasNonProduction ? otherWorkingRemarks.trim() : '',
        productionComments: productionComments.trim(),
        totalWorkingHours: round1(productionHours + effectiveNP),
        remarks: remarks.trim(),
        miscCost: parsedMiscCost,
        invoiceUrls,
      }

      if (forUser) {
        body.userId     = forUser.id
        body.userName   = forUser.name
        body.userLocale = forUser.locale
      }

      const res = await fetch('/api/daily-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const d = data as { error?: string; details?: string[] }
        setError(d.details?.join(' ') ?? d.error ?? 'Submission failed. Please try again.')
        setSubmitting(false)
        return
      }

      setSuccess({
        date,
        locale,
        productionHours,
        totalNonProductionHours: effectiveNP,
        totalWorkingHours: round1(productionHours + effectiveNP),
        remarks: remarks.trim(),
        forName: forUser?.name,
      })
    } catch {
      setError('An unexpected error occurred. Please try again.')
    }

    setSubmitting(false)
  }

  if (success) return <SuccessCard data={success} onAnother={resetForm} />

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Q1 Name */}
      <SectionCard>
        <FieldLabel label="1. Name" />
        <p className="text-sm font-medium text-slate-800">
          {forUser ? forUser.name : session.name}
        </p>
        {isFreelancer && <p className="text-[11px] text-slate-400 mt-0.5">From your account</p>}
      </SectionCard>

      {/* Q2 Locale */}
      <SectionCard>
        <FieldLabel label="2. Locale" />
        {isFreelancer ? (
          <p className="text-sm font-medium text-slate-800">{locale}</p>
        ) : (
          <select
            value={locale}
            onChange={e => setLocale(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 bg-white"
          >
            {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </SectionCard>

      {/* Q3 Date */}
      <SectionCard>
        <FieldLabel label="3. Date" required />
        <input
          type="date"
          required
          value={date}
          max={todayISO()}
          onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800"
        />
      </SectionCard>

      {/* Q4 Production Hours */}
      <SectionCard>
        <FieldLabel
          label="4. Production Hours"
          hint="Transcription / Scribing"
          required
        />
        <NumInput value={productionHours} onChange={setProductionHours} min={0} step={0.5} />
        <div className="mt-3">
          <FieldLabel
            label="Production Hours Comments"
            hint="Describe where your production hours were invested today"
            required
          />
          <textarea
            value={productionComments}
            onChange={e => setProductionComments(e.target.value)}
            placeholder="e.g. 4h on workset NL-DMO-batch-a, 3.5h on workset NL-DMO-batch-b…"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300 resize-none"
          />
        </div>
      </SectionCard>

      {/* Q5 Other-Working toggle */}
      <SectionCard>
        <FieldLabel
          label="5. Any other-working hours today?"
          hint="Training, meetings, PHI, IAA, waiting for worksets, admin"
          required
        />
        <div className="flex gap-3 mt-1">
          {([true, false] as const).map(val => (
            <button
              key={String(val)}
              type="button"
              onClick={() => setHasNonProduction(val)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all',
                hasNonProduction === val
                  ? val
                    ? 'bg-brand-500 border-brand-500 text-white'
                    : 'bg-slate-700 border-slate-700 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
              )}
            >
              {val ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Q6-Q15 Other-Working breakdown (conditional) */}
      {hasNonProduction === true && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Other-Working Hours Breakdown</p>

          {/* Q6 Total OW hours */}
          <div>
            <FieldLabel
              label="6. Total Other-Working Hours"
              required
            />
            <NumInput
              value={totalNonProductionHours}
              onChange={setTotalNonProductionHours}
              min={0}
              step={0.5}
            />
            <div className={cn(
              'mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              npMatch ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
            )}>
              {!npMatch && <AlertCircle className="w-3.5 h-3.5" />}
              Sub-categories: {npSubtotal} / {totalNonProductionHours} h
              {npMatch && ' ✓'}
            </div>
          </div>

          {/* Q7 2Pass */}
          <div>
            <FieldLabel label="7. 2Pass Hours" hint="Enter 0 if not applicable" />
            <NumInput value={npHours2pass} onChange={setNpHours2pass} min={0} step={0.5} />
          </div>

          {/* Q8 PHI */}
          <div>
            <FieldLabel label="8. PHI Hours" hint="Enter 0 if not applicable" />
            <NumInput value={npHoursPhi} onChange={setNpHoursPhi} min={0} step={0.5} />
          </div>

          {/* Q9 IAA */}
          <div>
            <FieldLabel label="9. IAA Hours" hint="Enter 0 if not applicable" />
            <NumInput value={npHoursIAA} onChange={setNpHoursIAA} min={0} step={0.5} />
          </div>

          {/* Q10 Training */}
          <div>
            <FieldLabel label="10. Training / Evaluation Hours" hint="Enter 0 if not applicable" />
            <NumInput value={npHoursTraining} onChange={setNpHoursTraining} min={0} step={0.5} />
          </div>

          {/* Q11 Review */}
          <div>
            <FieldLabel label="11. Review Hours" hint="Enter 0 if not applicable" />
            <NumInput value={npHoursReview} onChange={setNpHoursReview} min={0} step={0.5} />
          </div>

          {/* Q12 Waiting for Worksets */}
          <div>
            <FieldLabel label="12. Waiting for Worksets" hint="Enter 0 if not applicable" />
            <NumInput value={npHoursWaiting} onChange={setNpHoursWaiting} min={0} step={0.5} />
          </div>

          {/* Q13 Meetings */}
          <div>
            <FieldLabel label="13. Meetings" hint="Enter 0 if not applicable" />
            <NumInput value={npHoursMeetings} onChange={setNpHoursMeetings} min={0} step={0.5} />
          </div>

          {/* Q14 IT/NEAT Issues */}
          <div>
            <FieldLabel label="14. IT / NEAT Issues" hint="Enter 0 if not applicable" />
            <NumInput value={npHoursIT} onChange={setNpHoursIT} min={0} step={0.5} />
          </div>

          {/* Q15 Other-Working Hours Remarks */}
          <div>
            <FieldLabel label="15. Other-Working Hours Remarks" hint="Describe the breakdown of other-working hours" required />
            <textarea
              value={otherWorkingRemarks}
              onChange={e => setOtherWorkingRemarks(e.target.value)}
              placeholder="e.g. 1h waiting for workset assignment, 0.5h team sync…"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300 resize-none bg-white"
            />
          </div>
        </div>
      )}

      {/* Total Working Hours — auto-calculated display */}
      <SectionCard>
        <FieldLabel label="16. Total Working Hours" hint="Auto-calculated" />
        <TotalHoursDisplay total={totalWorkingHours} />
      </SectionCard>

      {/* Remarks */}
      <SectionCard>
        <FieldLabel
          label="17. Remarks"
          hint="Required. Describe your work session or any issues."
          required
        />
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Describe your work session, any issues, or hour breakdown…"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300 resize-none"
        />
      </SectionCard>

      {/* Misc Cost */}
      <SectionCard>
        <FieldLabel
          label="18. Miscellaneous Cost (USD)"
          hint="Optional. Enter any out-of-pocket cost for reimbursement."
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={miscCost}
          onChange={e => setMiscCost(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 placeholder:text-slate-300"
        />
      </SectionCard>

      {/* Invoice Upload */}
      <SectionCard>
        <FieldLabel
          label="19. Invoice / Receipt Upload"
          hint="Optional. Up to 5 files, 10 MB each."
        />
        <FileUpload files={invoiceFiles} onChange={setInvoiceFiles} />
      </SectionCard>

      {error && (
        <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting
          ? (invoiceFiles.length > 0 ? 'Uploading & submitting…' : 'Submitting…')
          : forUser
            ? `Submit hours for ${forUser.name}`
            : 'Submit hours'
        }
      </button>
    </form>
  )
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ sub, onSaved, onClose }: {
  sub: DailySubmissionRow
  onSaved: () => void
  onClose: () => void
}) {
  const [date,                    setDate]                    = useState(sub.date)
  const [locale,                  setLocale]                  = useState(sub.locale)
  const [productionHours,         setProductionHours]         = useState(sub.productionHours)
  const [hasNonProduction,        setHasNonProduction]        = useState(sub.hasNonProduction)
  const [totalNonProductionHours, setTotalNonProductionHours] = useState(sub.totalNonProductionHours)
  const [npHours2pass,            setNpHours2pass]            = useState(sub.npHours2pass)
  const [npHoursPhi,              setNpHoursPhi]              = useState(sub.npHoursPhi)
  const [npHoursIAA,              setNpHoursIAA]              = useState(sub.npHoursIAA ?? 0)
  const [npHoursTraining,         setNpHoursTraining]         = useState(sub.npHoursTraining)
  const [npHoursReview,           setNpHoursReview]           = useState(sub.npHoursReview)
  const [npHoursWaiting,          setNpHoursWaiting]          = useState(sub.npHoursWaiting ?? 0)
  const [npHoursMeetings,         setNpHoursMeetings]         = useState(sub.npHoursMeetings ?? 0)
  const [npHoursIT,               setNpHoursIT]               = useState(sub.npHoursIT ?? 0)
  const [otherWorkingRemarks,     setOtherWorkingRemarks]     = useState(sub.otherWorkingRemarks ?? '')
  const [productionComments,      setProductionComments]      = useState(sub.productionComments ?? '')
  const [remarks,                 setRemarks]                 = useState(sub.remarks)
  const [miscCost,                setMiscCost]                = useState(sub.miscCost !== null ? String(sub.miscCost) : '')
  const [saving,                  setSaving]                  = useState(false)
  const [error,                   setError]                   = useState('')

  const npSubtotal = round1(
    npHours2pass + npHoursPhi + npHoursIAA + npHoursTraining + npHoursReview +
    npHoursWaiting + npHoursMeetings + npHoursIT
  )
  const npMatch           = Math.abs(npSubtotal - totalNonProductionHours) < 0.001
  const totalWorkingHours = round1(productionHours + (hasNonProduction ? totalNonProductionHours : 0))

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const parsedMiscCost = miscCost !== '' ? parseFloat(miscCost) : null

    const res = await fetch(`/api/daily-submissions?id=${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, locale,
        productionHours,
        hasNonProduction,
        totalNonProductionHours: hasNonProduction ? totalNonProductionHours : 0,
        npHours2pass:     hasNonProduction ? npHours2pass    : 0,
        npHoursPhi:       hasNonProduction ? npHoursPhi      : 0,
        npHoursIAA:       hasNonProduction ? npHoursIAA      : 0,
        npHoursTraining:  hasNonProduction ? npHoursTraining : 0,
        npHoursReview:    hasNonProduction ? npHoursReview   : 0,
        npHoursWaiting:   hasNonProduction ? npHoursWaiting  : 0,
        npHoursMeetings:  hasNonProduction ? npHoursMeetings : 0,
        npHoursIT:        hasNonProduction ? npHoursIT       : 0,
        npHoursOther:     0,
        otherWorkingRemarks: hasNonProduction ? otherWorkingRemarks.trim() : '',
        productionComments: productionComments.trim(),
        totalWorkingHours,
        remarks,
        miscCost: parsedMiscCost,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Failed to save')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Edit submission</h2>
            <p className="text-xs text-slate-400 mt-0.5">{sub.userName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <FieldLabel label="Date" required />
            <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div>
            <FieldLabel label="Locale" />
            <select value={locale} onChange={e => setLocale(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
              {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <FieldLabel label="Production Hours" hint="Transcription / Scribing" />
            <NumInput value={productionHours} onChange={setProductionHours} min={0} step={0.5} />
            <div className="mt-2">
              <FieldLabel label="Production Hours Comments" hint="Where were production hours invested?" required />
              <textarea
                value={productionComments}
                onChange={e => setProductionComments(e.target.value)}
                rows={2}
                placeholder="e.g. 4h on workset NL-DMO-batch-a…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none text-slate-800 placeholder:text-slate-300"
              />
            </div>
          </div>

          <div>
            <FieldLabel label="Any other-working hours?" />
            <div className="flex gap-2 mt-1">
              {([true, false] as const).map(val => (
                <button key={String(val)} type="button" onClick={() => setHasNonProduction(val)}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                    hasNonProduction === val
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')}>
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {hasNonProduction && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Other-Working Hours</p>
              <div>
                <FieldLabel label="Total Other-Working Hours" />
                <NumInput value={totalNonProductionHours} onChange={setTotalNonProductionHours} min={0} step={0.5} />
                <div className={cn('mt-1 text-xs px-2 py-0.5 rounded-full inline-block',
                  npMatch ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                  Sub-total: {npSubtotal} / {totalNonProductionHours} h
                </div>
              </div>
              {[
                ['2Pass',              npHours2pass,    setNpHours2pass   ] as const,
                ['PHI',               npHoursPhi,      setNpHoursPhi     ] as const,
                ['IAA',               npHoursIAA,      setNpHoursIAA     ] as const,
                ['Training',          npHoursTraining, setNpHoursTraining] as const,
                ['Review',            npHoursReview,   setNpHoursReview  ] as const,
                ['Waiting for Worksets', npHoursWaiting, setNpHoursWaiting] as const,
                ['Meetings',          npHoursMeetings, setNpHoursMeetings] as const,
                ['IT / NEAT Issues',  npHoursIT,       setNpHoursIT      ] as const,
              ].map(([label, val, setter]) => (
                <div key={label}>
                  <FieldLabel label={label} />
                  <NumInput value={val} onChange={setter} min={0} step={0.5} />
                </div>
              ))}
              <div>
                <FieldLabel label="Other-Working Hours Remarks" />
                <textarea
                  value={otherWorkingRemarks}
                  onChange={e => setOtherWorkingRemarks(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none bg-white" />
              </div>
            </div>
          )}

          <div>
            <FieldLabel label="Total Working Hours" hint="Auto-calculated" />
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{totalWorkingHours}h</p>
          </div>

          <div>
            <FieldLabel label="Remarks" required />
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>

          <div>
            <FieldLabel label="Misc Cost (USD)" />
            <input type="number" min="0" step="0.01" value={miscCost}
              onChange={e => setMiscCost(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-brand-500 text-white rounded-lg py-2 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── SubmissionsPanel ─────────────────────────────────────────────────────────

function SubmissionsPanel() {
  const [from,      setFrom]      = useState(daysAgo(7))
  const [to,        setTo]        = useState(todayISO())
  const [subs,      setSubs]      = useState<DailySubmissionRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [editSub,   setEditSub]   = useState<DailySubmissionRow | null>(null)
  const [deleteSub, setDeleteSub] = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  const fetchSubs = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/daily-submissions?from=${from}&to=${to}`)
    const data = await res.json() as DailySubmissionRow[]
    setSubs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { void fetchSubs() }, [fetchSubs])

  async function handleDelete(id: string) {
    setDeleting(true)
    await fetch(`/api/daily-submissions?id=${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteSub(null)
    void fetchSubs()
  }

  const totals = subs.reduce(
    (acc, s) => ({
      prod:  round1(acc.prod  + s.productionHours),
      np:    round1(acc.np    + s.totalNonProductionHours),
      total: round1(acc.total + s.totalWorkingHours),
    }),
    { prod: 0, np: 0, total: 0 }
  )

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button onClick={() => void fetchSubs()}
            className="px-4 py-1.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors">
            Apply
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <p className="text-xs text-slate-500">
          {subs.length} submission{subs.length !== 1 ? 's' : ''} ·
          Production: {totals.prod}h · Other-Working: {totals.np}h · Total: {totals.total}h
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Locale</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Prod h</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">OW h</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total h</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Remarks</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : subs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">No submissions in this range</td>
                </tr>
              ) : subs.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{s.userName}</p>
                    {s.userLocale && <p className="text-[11px] text-slate-400">{s.userLocale}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmtDate(s.date)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{s.locale}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{s.productionHours}h</td>
                  <td className="px-4 py-3 text-slate-600">{s.totalNonProductionHours}h</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{s.totalWorkingHours}h</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate text-xs">{s.remarks || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditSub(s)} title="Edit"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteSub(s.id)} title="Delete"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editSub && (
        <EditModal
          sub={editSub}
          onSaved={() => { setEditSub(null); void fetchSubs() }}
          onClose={() => setEditSub(null)}
        />
      )}

      {deleteSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Delete submission?</h3>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => void handleDelete(deleteSub)} disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setDeleteSub(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AdminView ────────────────────────────────────────────────────────────────

function AdminView({ session }: { session: SessionUser }) {
  const [activeTab, setActiveTab] = useState<'form' | 'submissions'>('form')
  const [users,     setUsers]     = useState<UserSummary[]>([])
  const [forUserId, setForUserId] = useState('')

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then((data: UserSummary[]) => {
        if (!Array.isArray(data)) return
        const freelancers = data.filter(u => u.role === 'freelancer' || u.employeeType === 'FREELANCER')
        setUsers(freelancers)
        if (freelancers.length > 0) setForUserId(freelancers[0].id)
      })
      .catch(() => {/* ignore */})
  }, [])

  const selectedUser = users.find(u => u.id === forUserId)
  const forUser = selectedUser
    ? { id: selectedUser.id, name: selectedUser.name, locale: selectedUser.locale }
    : undefined

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('form')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'form'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <PenLine className="w-4 h-4" />
          Form
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'submissions'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <ClipboardList className="w-4 h-4" />
          Submissions
        </button>
      </div>

      {activeTab === 'form' ? (
        <div className="space-y-4">
          {/* User selector */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
              Submit for
            </label>
            {users.length === 0 ? (
              <p className="text-sm text-amber-600">Loading freelancers…</p>
            ) : (
              <select value={forUserId} onChange={e => setForUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-slate-800">
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.locale ? ` (${u.locale})` : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-amber-600 mt-1.5">You are submitting hours on behalf of this freelancer</p>
          </div>

          {forUser && (
            <HoursForm
              key={forUser.id}
              session={session}
              forUser={forUser}
            />
          )}
        </div>
      ) : (
        <SubmissionsPanel />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubmitPage() {
  const router = useRouter()
  const [user,        setUser]        = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (!res.ok) return null
        return res.json()
      })
      .then((data: { user: SessionUser } | null) => {
        if (!data) return
        const u: SessionUser = data.user
        if (u.role !== 'freelancer' && u.role !== 'admin') {
          router.push('/')
          return
        }
        setUser(u)
      })
      .catch(() => router.push('/login'))
      .finally(() => setAuthLoading(false))
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!user) return null

  const isAdmin = user.role === 'admin'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">DS</span>
          </div>
          <span className="font-semibold text-slate-800 text-sm">Dr. Strange Portal</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-slate-500">
              {user.name}
              {isAdmin && (
                <span className="ml-1.5 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">
                  Admin
                </span>
              )}
            </span>
          )}
          <button type="button" onClick={() => void handleLogout()}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={cn('mx-auto px-4 py-8', isAdmin ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">
            {isAdmin ? 'Hours Submissions' : 'Log your hours'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? 'Submit and manage freelancer daily hour logs'
              : 'Record your daily work session — complete all questions'
            }
          </p>
        </div>

        {isAdmin ? (
          <AdminView session={user} />
        ) : (
          <HoursForm session={user} />
        )}
      </main>
    </div>
  )
}
