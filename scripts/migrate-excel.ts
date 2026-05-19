/**
 * migrate-excel.ts
 * One-time migration of Dr. Strange - Time-off 2026.xlsx into Supabase.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/migrate-excel.ts "<path-to-xlsx>"
 *
 * Reads:
 *   - Sheet "Centific Employee FTE"  → rows 3–67, cols 3–367 (skip 368–426 legacy)
 *   - Sheet "Freelancer - Annotator" → date headers row 7 col 6+, roster from col E = "Availability"
 *   - Sheet "Project Management WA"  → work abroad log
 */

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── Absence code → hours (FTE sheet) ─────────────────────────────────────────
// Source: availability-agent skill, references/absence_codes.md
const FTE_CODE_TO_HOURS: Record<string, number> = {
  '':          8, 'NO': 8, 'WA': 8,
  'PTO': 0, '4PTO': 4, 'PTO4': 4,
  'BH': 0, 'SL': 0, 'UL': 0, 'DA': 0,
  'Paternity': 0, 'Doctor': 0, 'Other time off': 0,
}

const FTE_CODE_TO_STATUS: Record<string, string> = {
  '':          'AVAILABLE', 'NO': 'NO', 'WA': 'WA',
  'PTO': 'PTO', '4PTO': 'PTO', 'PTO4': 'PTO',
  'BH': 'BH', 'SL': 'SL', 'UL': 'UL', 'DA': 'OTHER',
  'Paternity': 'PATERNITY', 'Doctor': 'DH', 'Other time off': 'OTHER',
}

function normaliseFteCode(raw: unknown): { status: string; hours: number; notes: string } {
  if (raw == null) return { status: 'AVAILABLE', hours: 8, notes: '' }
  const s = String(raw).trim()

  // Dynamic partial-PTO: e.g. "6PTO", "PTO4", "4h PTO"
  const partialMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:h\s*)?PTO$|^PTO\s*(\d+(?:\.\d+)?)(?:\s*h)?$/i)
  if (partialMatch) {
    const hrs = parseFloat(partialMatch[1] ?? partialMatch[2])
    return { status: 'PTO', hours: hrs, notes: s }
  }

  // SL with duration: "SL (~1)", "SL (2h)", "SL ~ 1.75"
  if (s.startsWith('SL')) return { status: 'SL', hours: 0, notes: s }
  // DH variants
  if (s.toLowerCase().includes('doctor') || s.startsWith('DH')) return { status: 'DH', hours: 0, notes: s }
  if (s.toLowerCase().includes('sick'))  return { status: 'SL', hours: 0, notes: s }

  const known = FTE_CODE_TO_STATUS[s]
  if (known) return { status: known, hours: FTE_CODE_TO_HOURS[s] ?? 0, notes: '' }

  // Unknown code → conservative fallback
  return { status: 'OTHER', hours: 0, notes: s }
}

// ── Excel serial date → YYYY-MM-DD ───────────────────────────────────────────
function excelDateToISO(serial: number): string {
  const d = XLSX.SSF.parse_date_code(serial)
  return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00Z').getUTCDay()
  return d === 0 || d === 6
}

// ── FTE locale row ranges (from skill/references/fte_structure.md) ────────────
const FTE_LOCALE_RANGES: Array<{ locale: string; rowStart: number; rowEnd: number; isManager?: boolean }> = [
  { locale: 'de_DE', rowStart: 3,  rowEnd: 12 },
  { locale: 'en_GB', rowStart: 15, rowEnd: 26 },
  { locale: 'fr_FR', rowStart: 29, rowEnd: 40 },
  { locale: 'nl_NL', rowStart: 43, rowEnd: 55 },
  { locale: 'de_DE', rowStart: 56, rowEnd: 67, isManager: true }, // manager rows
]

async function main() {
  const filePath = process.argv[2]
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('Usage: npx ts-node scripts/migrate-excel.ts "<path-to-xlsx>"')
    process.exit(1)
  }

  console.log(`\n📂 Reading: ${filePath}`)
  const wb = XLSX.readFile(filePath, { cellDates: false, raw: true })

  let imported = 0
  let flagged  = 0
  const errors: string[] = []

  // ── 1. Create import batch record ─────────────────────────────────────────
  const batchRes = await supabase
    .from('import_batches')
    .insert({
      source_file:  path.basename(filePath),
      source_sheet: 'Centific Employee FTE + Freelancer - Annotator + Project Management WA',
      imported_by:  'u1',  // Admin User — update if needed
      notes:        'Initial migration from Excel',
    })
    .select()
    .single()

  if (batchRes.error) {
    console.error('Failed to create import batch:', batchRes.error.message)
    process.exit(1)
  }
  const batchId = batchRes.data.id
  console.log(`✅ Import batch: ${batchId}`)

  // ── 2. Parse FTE sheet ────────────────────────────────────────────────────
  console.log('\n📋 Parsing Centific Employee FTE…')
  const fteSheet = wb.Sheets['Centific Employee FTE']
  if (!fteSheet) { console.error('Sheet not found: Centific Employee FTE'); process.exit(1) }

  const fteData = XLSX.utils.sheet_to_json<unknown[]>(fteSheet, { header: 1, raw: true }) as unknown[][]

  // Row 0 (Excel row 1) = headers: col 0=Name, col 1=PTO balance (ignore), col 2+ = dates
  const headerRow = fteData[0] as unknown[]
  // Build date map: colIndex → ISO date string (only cols 2–366, skip 367+ legacy)
  const fteDateMap: Record<number, string> = {}
  for (let c = 2; c <= 366 && c < headerRow.length; c++) {
    const h = headerRow[c]
    if (typeof h === 'number' && h > 40000) {
      fteDateMap[c] = excelDateToISO(h)
    } else if (typeof h === 'string' && h.trim()) {
      // Try parsing as date string
      const parsed = new Date(h.trim())
      if (!isNaN(parsed.getTime())) {
        fteDateMap[c] = parsed.toISOString().slice(0, 10)
      }
    }
  }

  const fteDates = Object.values(fteDateMap).filter(d => !isWeekend(d))
  console.log(`   Found ${Object.keys(fteDateMap).length} date columns, ${fteDates.length} weekdays`)

  // Process each locale range
  for (const range of FTE_LOCALE_RANGES) {
    for (let r = range.rowStart - 1; r <= range.rowEnd - 1; r++) {
      const row = fteData[r] as unknown[]
      if (!row) continue
      const name = String(row[0] ?? '').trim()
      if (!name) continue

      // Find or create user by name
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('name', name)
        .maybeSingle()

      let userId = existingUser?.id
      if (!userId) {
        // Create placeholder user
        const newId = `fte-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
        const { error: uErr } = await supabase.from('users').insert({
          id: newId, name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@import.placeholder`,
          role: 'freelancer',
          locale: range.locale,
          employee_type: range.isManager ? 'PM' : 'FTE',
          is_manager: range.isManager ?? false,
          is_active: true,
          password_hash: '$2b$10$placeholder_no_login',
        })
        if (uErr) { errors.push(`User create failed for ${name}: ${uErr.message}`); continue }
        userId = newId
        console.log(`   + Created placeholder user: ${name}`)
      }

      // Insert availability for each date
      const rows: Record<string, unknown>[] = []
      for (const [colStr, dateStr] of Object.entries(fteDateMap)) {
        const col = parseInt(colStr)
        const cellVal = row[col]
        const { status, hours, notes } = normaliseFteCode(cellVal)

        rows.push({
          user_id:             userId,
          date:                dateStr,
          status,
          availability_hours:  [0,2,4,6,8,10,12].includes(hours) ? hours : null,
          locale:              range.locale,
          submitted_by:        'u1',
          import_batch_id:     batchId,
          notes,
          flagged_for_review:  !FTE_CODE_TO_STATUS[String(cellVal ?? '').trim()] && cellVal != null,
          flag_reason:         !FTE_CODE_TO_STATUS[String(cellVal ?? '').trim()] && cellVal != null
                               ? `Unknown code: ${cellVal}` : null,
        })
      }

      // Batch upsert in chunks of 100
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100)
        const { error } = await supabase
          .from('availability_submissions')
          .upsert(chunk, { onConflict: 'user_id,date' })
        if (error) errors.push(`FTE upsert error (${name}): ${error.message}`)
        else {
          imported += chunk.length
          flagged  += chunk.filter(r => r.flagged_for_review).length
        }
      }
    }
  }

  // ── 3. Parse Freelancer sheet ─────────────────────────────────────────────
  console.log('\n📋 Parsing Freelancer - Annotator…')
  const flSheet = wb.Sheets['Freelancer - Annotator']
  if (!flSheet) { console.error('Sheet not found: Freelancer - Annotator'); process.exit(1) }

  const flData = XLSX.utils.sheet_to_json<unknown[]>(flSheet, { header: 1, raw: true }) as unknown[][]

  // Date headers: row 7 (index 6), col 5 (index 5) onwards
  const flHeaderRow = flData[6] as unknown[]
  const flDateMap: Record<number, string> = {}
  for (let c = 5; c < flHeaderRow.length; c++) {
    const h = flHeaderRow[c]
    if (typeof h === 'number' && h > 40000) {
      flDateMap[c] = excelDateToISO(h)
    }
  }
  console.log(`   Found ${Object.keys(flDateMap).length} date columns`)

  // FL section header rows to skip (from skill)
  const FL_SKIP_ROWS = new Set([33, 66, 77, 102].map(r => r - 1))  // 0-indexed

  // Scan col E (index 4) for "Availability" to find person rows
  // Each person: row A = Availability, row B = Estimated start time
  let flRow = 7  // 0-indexed, skip header rows
  const flPersons: Array<{ name: string; locale: string; availRow: number; startRow: number }> = []

  while (flRow < flData.length - 1) {
    if (FL_SKIP_ROWS.has(flRow)) { flRow++; continue }
    const row = flData[flRow] as unknown[]
    const instruction = String(row[4] ?? '').trim()

    if (instruction === 'Availability') {
      const name   = String(row[0] ?? '').trim()
      const locale = String(row[1] ?? '').trim()
      if (name) {
        flPersons.push({ name, locale: normaliseLocale(locale), availRow: flRow, startRow: flRow + 1 })
      }
      flRow += 2  // skip both rows
    } else {
      flRow++
    }
  }
  console.log(`   Found ${flPersons.length} freelancers`)

  for (const person of flPersons) {
    const availRow = flData[person.availRow] as unknown[]
    const startRow = flData[person.startRow] as unknown[]

    // Find or create user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .ilike('name', person.name)
      .maybeSingle()

    let userId = existingUser?.id
    if (!userId) {
      const newId = `fl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      const { error: uErr } = await supabase.from('users').insert({
        id: newId, name: person.name,
        email: `${person.name.toLowerCase().replace(/\s+/g, '.')}@import.placeholder`,
        role: 'freelancer',
        locale: person.locale,
        employee_type: 'FREELANCER',
        is_manager: false,
        is_active: true,
        password_hash: '$2b$10$placeholder_no_login',
        flagged_for_review: true,
      })
      if (uErr) { errors.push(`FL user create failed for ${person.name}: ${uErr.message}`); continue }
      userId = newId
    }

    const rows: Record<string, unknown>[] = []
    for (const [colStr, dateStr] of Object.entries(flDateMap)) {
      const col = parseInt(colStr)
      const cellVal = availRow[col]
      const startVal = String(startRow?.[col] ?? '').trim()

      // blank = undeclared (skip — don't import, prevents false "missing" flags)
      if (cellVal == null || cellVal === '') continue

      let status = 'AVAILABLE'
      let hours: number | null = null
      let notes = ''
      const isFlagged = false

      if (typeof cellVal === 'number') {
        hours  = cellVal
        status = cellVal === 0 ? 'NO' : 'AVAILABLE'
      } else {
        const sv = String(cellVal).trim().toUpperCase()
        if (sv === 'SL' || sv === 'UL') { status = sv; hours = 0 }
        else if (sv === 'NO')           { status = 'NO'; hours = 0 }
        else if (sv.includes('WORKING ABROAD')) { status = 'WA'; hours = 8 }
        else { status = 'OTHER'; notes = String(cellVal) }
      }

      // Normalise hours to allowed values
      if (hours !== null && ![0,2,4,6,8,10,12].includes(hours)) {
        hours = Math.round(hours / 2) * 2 as 0|2|4|6|8|10|12
      }

      const startCet = startVal.match(/(\d{1,2}):(\d{2})/)
        ? startVal.match(/(\d{1,2}):(\d{2})/)![0]
        : null

      rows.push({
        user_id:             userId,
        date:                dateStr,
        status,
        availability_hours:  hours,
        estimated_start_cet: startCet,
        locale:              person.locale,
        submitted_by:        'u1',
        import_batch_id:     batchId,
        notes,
        flagged_for_review:  isFlagged,
        flag_reason:         null,
      })
    }

    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100)
      const { error } = await supabase
        .from('availability_submissions')
        .upsert(chunk, { onConflict: 'user_id,date' })
      if (error) errors.push(`FL upsert error (${person.name}): ${error.message}`)
      else {
        imported += chunk.length
        flagged  += chunk.filter(r => r.flagged_for_review).length
      }
    }
  }

  // ── 4. Parse Work Abroad sheet ────────────────────────────────────────────
  console.log('\n📋 Parsing Project Management WA…')
  const waSheet = wb.Sheets['Project Management WA']
  if (waSheet) {
    const waData = XLSX.utils.sheet_to_json<Record<string, unknown>>(waSheet)
    for (const row of waData) {
      const name    = String(row['Name'] ?? '').trim()
      const origin  = String(row['Origin Country'] ?? '').trim()
      const dest    = String(row['Destination Country'] ?? '').trim()
      if (!name || !origin || !dest) continue

      const rawFrom = row['Date From']
      const rawTo   = row['Date To']
      const dateFrom = typeof rawFrom === 'number' ? excelDateToISO(rawFrom) : String(rawFrom).slice(0,10)
      const dateTo   = typeof rawTo   === 'number' ? excelDateToISO(rawTo)   : String(rawTo).slice(0,10)

      const { data: user } = await supabase.from('users').select('id').ilike('name', name).maybeSingle()
      if (!user) { errors.push(`WA: user not found for ${name}`); continue }

      const { error } = await supabase.from('work_abroad_requests').insert({
        user_id:             user.id,
        origin_country:      origin,
        destination_country: dest,
        date_from:           dateFrom,
        date_to:             dateTo,
        submitted_by:        'u1',
      })
      if (error) errors.push(`WA insert error (${name}): ${error.message}`)
      else console.log(`   + WA: ${name} ${origin} → ${dest} (${dateFrom}–${dateTo})`)
    }
  }

  // ── 5. Update batch totals ────────────────────────────────────────────────
  await supabase
    .from('import_batches')
    .update({ row_count: imported, flagged_count: flagged })
    .eq('id', batchId)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Imported:  ${imported} rows`)
  console.log(`⚠️  Flagged:   ${flagged} rows (check availability_submissions WHERE flagged_for_review = TRUE)`)
  if (errors.length > 0) {
    console.log(`❌ Errors:    ${errors.length}`)
    errors.forEach(e => console.log(`   - ${e}`))
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

function normaliseLocale(raw: string): string {
  const map: Record<string, string> = {
    'dk_DK': 'da_DK', 'da_dk': 'da_DK',
    'no_NO': 'nb_NO', 'nb_no': 'nb_NO',
    'nl_nl': 'nl_NL', 'de_de': 'de_DE',
    'fr_fr': 'fr_FR', 'en_gb': 'en_GB',
    'sv_se': 'sv_SE', 'fi_fi': 'fi_FI',
  }
  return map[raw.trim()] ?? raw.trim()
}

main().catch(e => { console.error(e); process.exit(1) })
