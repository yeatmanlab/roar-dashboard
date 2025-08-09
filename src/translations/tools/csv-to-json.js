import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  // Papa with header:true returns objects; ensure array of records
  return Array.isArray(data) ? data : []
}

function isLocaleHeader(header) {
  if (!header) return false
  const lower = String(header).toLowerCase()
  // identifier and label are metadata; anything else is a locale column
  if (lower === 'identifier' || lower === 'label') return false
  return true
}

function unescapeCsvValue(value) {
  if (value == null) return ''
  const s = String(value)
  // Values were escaped to literal \n and \r in CSV generation
  return s.replaceAll('\\n', '\n').replaceAll('\\r', '\r')
}

function setNested(messages, identifier, value) {
  if (!identifier) return
  // Normalize: turn section/key paths like "auth/consent.acceptButton" into dot notation
  const normalized = identifier.replaceAll('/', '.')
  const parts = normalized.split('.').filter(Boolean)
  let node = messages
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i]
    const isLeaf = i === parts.length - 1
    if (isLeaf) {
      node[key] = value
    } else {
      if (!node[key] || typeof node[key] !== 'object') node[key] = {}
      node = node[key]
    }
  }
}

function localeToPathParts(localeRaw) {
  const locale = String(localeRaw).toLowerCase()
  if (locale.includes('-')) {
    const [lang, region] = locale.split('-')
    return { dir: path.join('src', 'translations', lang, region), filename: `${locale}-componentTranslations.json` }
  }
  return { dir: path.join('src', 'translations', locale), filename: `${locale}-componentTranslations.json` }
}

function listCsvFiles() {
  const roots = [
    path.join('src', 'translations', 'consolidated'),
    path.join('src', 'translations', 'consolidated', 'components'),
  ]
  const files = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    const entries = fs.readdirSync(root)
    for (const entry of entries) {
      const fp = path.join(root, entry)
      if (fs.statSync(fp).isFile() && fp.toLowerCase().endsWith('.csv')) files.push(fp)
    }
  }
  return files
}

function mergeDeep(target, source) {
  for (const key of Object.keys(source)) {
    const value = source[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      mergeDeep(target[key], value)
    } else {
      target[key] = value
    }
  }
  return target
}

function main() {
  console.log('🔄 Building legacy per-locale JSON from consolidated CSVs...')
  const csvFiles = listCsvFiles()
  if (!csvFiles.length) {
    console.log('No CSV files found under src/translations/consolidated. Nothing to do.')
    return
  }

  /** @type {Record<string, any>} */
  const perLocaleMessages = {}

  for (const csvPath of csvFiles) {
    const rows = readCsv(csvPath)
    if (!rows.length) continue
    const headers = Object.keys(rows[0])
    const localeHeaders = headers.filter(isLocaleHeader)

    for (const row of rows) {
      const identifier = (row.identifier || '').trim()
      if (!identifier) continue

      for (const header of localeHeaders) {
        const localeKey = String(header).toLowerCase()
        const value = unescapeCsvValue(row[header] ?? '')
        if (!perLocaleMessages[localeKey]) perLocaleMessages[localeKey] = {}
        setNested(perLocaleMessages[localeKey], identifier, value)
      }
    }
  }

  // Write one JSON file per locale
  const locales = Object.keys(perLocaleMessages)
  if (!locales.length) {
    console.log('No locales detected in CSVs. Nothing to write.')
    return
  }

  for (const locale of locales) {
    const { dir, filename } = localeToPathParts(locale)
    ensureDir(dir)
    const outPath = path.join(dir, filename)

    // Merge with existing file if it exists to preserve any external keys (optional)
    let previous = {}
    if (fs.existsSync(outPath)) {
      try {
        previous = JSON.parse(fs.readFileSync(outPath, 'utf8'))
      } catch {
        previous = {}
      }
    }

    const merged = mergeDeep(previous, perLocaleMessages[locale])
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2))
    console.log(`✅ Wrote ${outPath}`)
  }
}

main()
