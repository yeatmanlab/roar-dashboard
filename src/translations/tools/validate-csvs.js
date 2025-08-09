#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

const consolidatedRoot = path.join('src', 'translations', 'consolidated')

function listCsvFiles() {
  const roots = [consolidatedRoot, path.join(consolidatedRoot, 'components')]
  const files = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const entry of fs.readdirSync(root)) {
      const fp = path.join(root, entry)
      if (fs.statSync(fp).isFile() && fp.toLowerCase().endsWith('.csv')) files.push(fp)
    }
  }
  return files
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  return Array.isArray(data) ? data : []
}

function validateHeaders(rows, filePath) {
  if (!rows.length) return { headers: [], locales: [] }
  const headers = Object.keys(rows[0])
  const required = ['identifier', 'label']
  const missing = required.filter((h) => !headers.includes(h))
  if (missing.length) throw new Error(`${filePath}: missing required columns: ${missing.join(', ')}`)
  const locales = headers.filter((h) => !required.includes(h))
  return { headers, locales }
}

function main() {
  const files = listCsvFiles()
  if (!files.length) {
    console.log('No CSV files found to validate.')
    process.exit(0)
  }

  const globalIds = new Map() // id -> filePath
  const allLocales = new Set()
  let totalRows = 0
  const perLocaleCounts = new Map() // locale -> { nonEmpty: number, total: number }

  for (const file of files) {
    const rows = readCsv(file)
    const { locales } = validateHeaders(rows, file)
    locales.forEach((l) => allLocales.add(l))

    for (const row of rows) {
      const id = (row.identifier || '').trim()
      if (!id) throw new Error(`${file}: empty identifier found`)
      if (globalIds.has(id)) throw new Error(`${file}: duplicate identifier across files: ${id} (also in ${globalIds.get(id)})`)
      globalIds.set(id, file)

      for (const locale of locales) {
        const value = (row[locale] ?? '').trim()
        const prev = perLocaleCounts.get(locale) || { nonEmpty: 0, total: 0 }
        prev.total += 1
        if (value) prev.nonEmpty += 1
        perLocaleCounts.set(locale, prev)
      }

      totalRows += 1
    }
  }

  console.log(`Validated ${files.length} CSV files, ${totalRows} identifiers, locales: ${Array.from(allLocales).join(', ')}`)
  // Coverage report
  for (const [locale, { nonEmpty, total }] of perLocaleCounts.entries()) {
    const pct = total ? Math.round((nonEmpty / total) * 100) : 0
    console.log(`Locale ${locale}: ${nonEmpty}/${total} (${pct}%) translated`)
  }

  // Do not fail on low coverage by default; change behavior via env if needed
  if (process.env.I18N_FAIL_ON_LOW_COVERAGE === 'TRUE') {
    const threshold = Number(process.env.I18N_COVERAGE_THRESHOLD || '1') // percent
    for (const [locale, { nonEmpty, total }] of perLocaleCounts.entries()) {
      const pct = total ? (nonEmpty / total) * 100 : 0
      if (pct < threshold) {
        throw new Error(`Locale ${locale} coverage ${pct.toFixed(2)}% below threshold ${threshold}%`)
      }
    }
  }

  console.log('CSV validation passed')
}

main()
