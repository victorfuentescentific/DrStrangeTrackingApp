/**
 * import-from-excel.ts
 * One-time import of user account data from the Dr. Strange credentials Excel
 * into the Supabase `users` table.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/import-from-excel.ts
 *
 * Prerequisites:
 *   - Run scripts/migration-user-fields.sql in Supabase SQL editor first.
 *   - .env.local must contain SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *   - Excel file path is hard-coded below (EXCEL_PATH) — change if needed.
 */

import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

// ── Config ────────────────────────────────────────────────────────────────────
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const EXCEL_PATH =
  process.argv[2] ??
  'C:\\Users\\v-victorfu\\Downloads\\Dr. Strange - Account credentials (2).xlsx'

const SHEET_NAME   = 'Main Tracker'
const DEFAULT_PASS = 'Welcome2025!'

// Locale codes that appear as row headers (section dividers) — skip these rows
const LOCALE_HEADER_NAMES = new Set([
  'fi_FI', 'no_NO', 'nb_NO', 'dk_DK', 'da_DK', 'sv_SE',
  'de_DE', 'en_GB', 'fr_FR', 'nl_NL',
])

// Management role designations in col 4 → locale should become null
const MANAGEMENT_ROLES = new Set(['GPM', 'SPM', 'PC', 'PM'])

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract plain string from a cell value that may be a hyperlink object. */
function cellText(value: ExcelJS.CellValue): string | null {
  if (value == null) return null
  // ExcelJS hyperlink cells have { text, hyperlink } shape
  if (typeof value === 'object' && 'text' in (value as object)) {
    return String((value as { text: unknown }).text).trim() || null
  }
  if (typeof value === 'object' && 'richText' in (value as object)) {
    return (value as { richText: Array<{ text: string }> }).richText
      .map(r => r.text)
      .join('')
      .trim() || null
  }
  const s = String(value).trim()
  return s || null
}

/** Convert a cell value that may be a JS Date, Excel serial, or ISO string to YYYY-MM-DD. */
function cellDate(value: ExcelJS.CellValue): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number') {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Math.round((value - 25569) * 86400 * 1000))
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return null
}

/** Normalise locale codes. Returns null for management designations. */
function normaliseLocale(raw: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (MANAGEMENT_ROLES.has(s)) return null
  const map: Record<string, string> = {
    dk_DK: 'da_DK',
    no_NO: 'nb_NO',
  }
  return map[s] ?? s
}

/** Map empType + roleDesignation → { role, employee_type }. */
function mapRole(
  empType: string | null,
  roleDesignation: string | null,
): { role: string; employee_type: string } | null {
  // Language Lead wins regardless of emp type
  if (roleDesignation === 'Language Lead') {
    return { role: 'lead', employee_type: empType ?? '' }
  }
  if (empType === 'FTE') return { role: 'fte', employee_type: 'FTE' }
  if (empType === 'SME') return { role: 'fte', employee_type: 'FTE' }
  if (empType === 'Freelancer') return { role: 'freelancer', employee_type: 'FREELANCER' }
  // Management (null locale) — caller must handle (don't change role)
  return null
}

/** Normalise a string: trim + empty-string → null. */
function ns(v: string | null | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  return s || null
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  console.log(`\nReading: ${EXCEL_PATH}`)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(EXCEL_PATH)

  const sheet = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0]
  if (!sheet) {
    console.error(`❌  Sheet "${SHEET_NAME}" not found`)
    process.exit(1)
  }
  console.log(`Sheet: "${sheet.name}"  (${sheet.rowCount} rows)\n`)

  // Pre-hash the default password once
  const passwordHash = await bcrypt.hash(DEFAULT_PASS, 10)

  let updated  = 0
  let created  = 0
  let skipped  = 0
  const errors: string[] = []

  // Fetch all existing users once for fast in-memory lookup
  const { data: allUsers, error: fetchErr } = await supabase
    .from('users')
    .select('id, name, email, emp_id, role')
  if (fetchErr) {
    console.error('❌  Failed to fetch users:', fetchErr.message)
    process.exit(1)
  }

  // Build lookup maps
  const byEmpId   = new Map<string, typeof allUsers[0]>()
  const byEmail   = new Map<string, typeof allUsers[0]>()
  const byName    = new Map<string, typeof allUsers[0]>()
  for (const u of allUsers ?? []) {
    if (u.emp_id)  byEmpId.set(u.emp_id.trim().toLowerCase(), u)
    if (u.email)   byEmail.set(u.email.trim().toLowerCase(), u)
    if (u.name)    byName.set(u.name.trim().toLowerCase(), u)
  }

  // ── Collect rows synchronously, then process async ───────────────────────
  type ParsedRow = { rowNumber: number; data: Record<string, unknown>; isNew: boolean; existingId?: string }
  const parsedRows: ParsedRow[] = []

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return

    const c = (n: number): ExcelJS.CellValue => row.getCell(n).value

    const rawName    = cellText(c(2))
    const rawLocale  = cellText(c(3))
    const roleDesig  = cellText(c(4))   // col 4: role designation

    // ── Skip rules ────────────────────────────────────────────────────────
    if (!rawName) { skipped++; return }

    // Section header repeats: locale column literally says "Locale"
    if (rawLocale === 'Locale') { skipped++; return }

    // Row is a locale-code label row (e.g. name cell contains "fi_FI")
    if (LOCALE_HEADER_NAMES.has(rawName)) { skipped++; return }

    // Team summary rows: name contains " team ("
    if (rawName.toLowerCase().includes(' team (')) { skipped++; return }

    // ── Parse all fields ──────────────────────────────────────────────────
    const isManagement = rawLocale ? MANAGEMENT_ROLES.has(rawLocale.trim()) : false
    const locale       = normaliseLocale(rawLocale)

    const identityCheckDate = cellDate(c(5))
    const overallStatus     = ns(cellText(c(6)))
    const workflowRaw       = ns(cellText(c(7)))
    const msAccountStatus   = ns(cellText(c(8)))
    const remarks           = ns(cellText(c(9)))
    // col 10: secondary role designation (unused for role mapping but stored)
    const roleDesig2        = ns(cellText(c(10)))
    const billableRaw       = ns(cellText(c(11)))
    const empType           = ns(cellText(c(12)))   // FTE / Freelancer / SME
    const startDateRaw      = cellDate(c(13))
    const batch             = ns(cellText(c(14)))
    const personalEmail     = ns(cellText(c(15)))
    const centificEmail     = ns(cellText(c(16)))   // maps to `email`
    const bgcRequestDate    = cellDate(c(17))
    const bgcStatus         = ns(cellText(c(18)))
    const shippingAddress   = ns(cellText(c(19)))
    const phoneStatus       = ns(cellText(c(20)))
    const laptopStatus      = ns(cellText(c(21)))
    const phone             = ns(cellText(c(22)))
    const oneFormaId        = ns(cellText(c(23)))
    const empIdRaw          = ns(cellText(c(24)))
    const vMicrosoftEmail   = ns(cellText(c(25)))
    const msId              = ns(cellText(c(26)))
    const offboardedRaw     = ns(cellText(c(46)))

    // Clean emp_id: "N/A" or blank → null
    const empId = empIdRaw && empIdRaw.toUpperCase() !== 'N/A' ? empIdRaw : null

    // is_active: col 46 "Y" means offboarded → inactive
    const isActive = offboardedRaw?.toUpperCase() === 'Y' ? false : true

    // Workflow: map to known values or keep as-is
    const workflow =
      workflowRaw === 'N/A' ? null : workflowRaw?.toLowerCase() ?? null

    // billable: "Yes" / "Y" / "TRUE" → true, "No" / "N" / "FALSE" → false, else null
    let billable: boolean | null = null
    if (billableRaw) {
      const b = billableRaw.toUpperCase()
      if (b === 'YES' || b === 'Y' || b === 'TRUE') billable = true
      else if (b === 'NO' || b === 'N' || b === 'FALSE') billable = false
    }

    // role_designation: prefer col 4, fall back to col 10
    const roleDesignation = ns(roleDesig) ?? roleDesig2

    // App role mapping
    const roleMapping = mapRole(empType, ns(roleDesig))

    // ── Lookup existing user ──────────────────────────────────────────────
    let existingUser: (typeof allUsers)[0] | undefined

    if (empId) {
      existingUser = byEmpId.get(empId.toLowerCase())
    }
    if (!existingUser && centificEmail) {
      existingUser = byEmail.get(centificEmail.toLowerCase())
    }
    if (!existingUser) {
      existingUser = byName.get(rawName.trim().toLowerCase())
    }

    // Fields to write on both update and insert
    const sharedFields: Record<string, unknown> = {
      name:                rawName.trim(),
      email:               centificEmail,
      workflow,
      locale,
      is_active:           isActive,
      emp_id:              empId,
      v_microsoft_email:   vMicrosoftEmail,
      ms_id:               msId,
      one_forma_id:        oneFormaId,
      personal_email:      personalEmail,
      phone,
      shipping_address:    shippingAddress,
      start_date:          startDateRaw,
      batch,
      centific_type:       empType,
      role_designation:    roleDesignation,
      billable,
      overall_status:      overallStatus,
      ms_account_status:   msAccountStatus,
      phone_status:        phoneStatus,
      laptop_status:       laptopStatus,
      bgc_request_date:    bgcRequestDate,
      bgc_status:          bgcStatus,
      identity_check_date: identityCheckDate,
      remarks,
    }

    // Conditionally add role / employee_type (management rows: don't touch role)
    if (!isManagement && roleMapping) {
      sharedFields.role          = roleMapping.role
      sharedFields.employee_type = roleMapping.employee_type
    }

    // Remove null values for update (don't overwrite good data with null)
    // But for insert we want all fields
    const updateFields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(sharedFields)) {
      if (v !== null && v !== undefined) updateFields[k] = v
    }

    if (existingUser) {
      parsedRows.push({ rowNumber, data: updateFields, isNew: false, existingId: existingUser.id })
    } else {
      const insertPayload: Record<string, unknown> = {
        id:            randomUUID(),
        password_hash: passwordHash,
        ...sharedFields,
      }
      if (!isManagement && roleMapping) {
        insertPayload.role          = roleMapping.role
        insertPayload.employee_type = roleMapping.employee_type
      } else if (!insertPayload.role) {
        insertPayload.role = 'freelancer'
      }
      parsedRows.push({ rowNumber, data: insertPayload, isNew: true })
    }
  })

  // ── Execute DB operations sequentially (avoids connection flooding) ───────
  for (const pr of parsedRows) {
    if (pr.isNew) {
      const { error } = await supabase.from('users').insert(pr.data)
      if (error) errors.push(`Row ${pr.rowNumber} insert failed (${pr.data.name}): ${error.message}`)
      else created++
    } else {
      const { error } = await supabase.from('users').update(pr.data).eq('id', pr.existingId!)
      if (error) errors.push(`Row ${pr.rowNumber} update failed (${pr.data.name}): ${error.message}`)
      else updated++
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅  Updated  ${updated} users`)
  console.log(`✅  Created  ${created} new users`)
  console.log(`⚠️   Skipped  ${skipped} rows (headers / empty / section labels)`)
  if (errors.length > 0) {
    console.log(`❌  Errors:  ${errors.length}`)
    errors.forEach(e => console.log(`   - ${e}`))
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
