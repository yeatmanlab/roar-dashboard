#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '../../..')
const translationsRoot = path.resolve(projectRoot, 'src/translations')
const consolidatedRoot = path.resolve(translationsRoot, 'consolidated')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJsonSafe(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(text)
  } catch (e) {
    return null
  }
}

function flatten(obj, prefix = '') {
  const out = {}
  Object.entries(obj || {}).forEach(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key))
    else out[key] = v
  })
  return out
}

// Map top-level legacy namespaces to modular paths (section/component)
const namespaceMap = {
  navBar: 'components/navbar',
  gameTabs: 'components/game-tabs',
  participantSidebar: 'components/participant-sidebar',
  sentryForm: 'components/sentry-form',
  tasks: 'components/tasks',
  notFound: 'pages/not-found',
  pageSignIn: 'pages/signin',
  homeParticipant: 'pages/home-participant',
  homeSelector: 'pages/home-selector',
  consentModal: 'auth/consent',
  authSignIn: 'auth/signin',
  userSurvey: 'surveys/user-survey',
}

function detectLanguageFiles() {
  // Collect component translation files by language
  const candidates = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full)
      else if (entry.endsWith('componentTranslations.json')) candidates.push(full)
    }
  }
  walk(path.join(translationsRoot))
  return candidates
}

function languageCodeFromPath(p) {
  // src/translations/es/co/es-co-componentTranslations.json -> es-co
  const base = path.basename(p).replace('-componentTranslations.json', '')
  if (base.includes('-')) return base
  // src/translations/en/en-componentTranslations.json -> en
  return base
}

function loadAllLanguages() {
  const files = detectLanguageFiles()
  const langs = new Map() // lang -> json
  for (const f of files) {
    const json = readJsonSafe(f)
    if (!json) continue
    const code = languageCodeFromPath(f)
    langs.set(code, json)
  }
  return langs
}

function buildRows(langs) {
  // keys: identifier, label, ...langs
  const allIdentifiers = new Set()
  const perLangFlat = {}
  for (const [lang, json] of langs.entries()) {
    perLangFlat[lang] = {}
    for (const [ns, value] of Object.entries(json || {})) {
      const mapped = namespaceMap[ns]
      if (!mapped) continue
      const flat = flatten(value)
      for (const [k, v] of Object.entries(flat)) {
        const identifier = `${mapped}.${k}`
        allIdentifiers.add(identifier)
        perLangFlat[lang][identifier] = typeof v === 'string' ? v : ''
      }
    }
  }
  return { allIdentifiers: Array.from(allIdentifiers).sort(), perLangFlat }
}

function groupBySection(identifiers) {
  const groups = new Map() // section -> identifiers[]
  identifiers.forEach((id) => {
    // identifier looks like: "components/navbar.something" or "auth/consent.something"
    const firstToken = id.split('.')[0] // e.g., "components/navbar" or "auth/consent"
    const section = firstToken.split('/')[0] // e.g., "components" or "auth"
    const list = groups.get(section) ?? []
    list.push(id)
    groups.set(section, list)
  })
  return groups
}

function toCsvLine(values) {
  return values
    .map((v) => {
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s
    })
    .join(',')
}

function writeConsolidatedCSVs({ allIdentifiers, perLangFlat }, langs) {
  ensureDir(consolidatedRoot)
  const detectedLangs = Array.from(langs.keys())

  const groups = groupBySection(allIdentifiers)
  for (const [section, ids] of groups.entries()) {
    const out = []
    const header = ['identifier', 'label', ...detectedLangs]
    out.push(toCsvLine(header))
    ids.forEach((id) => {
      const label = id.split('.').slice(-1)[0]
      const row = [id, label]
      detectedLangs.forEach((lang) => {
        row.push(perLangFlat[lang]?.[id] ?? '')
      })
      out.push(toCsvLine(row))
    })
    // sanitize filename to avoid nested directories due to slashes in identifiers
    const safeSection = section.replace(/[\\/]/g, '-')
    const file = path.join(consolidatedRoot, `dashboard-${safeSection}-translations.csv`)
    fs.writeFileSync(file, out.join('\n'))
  }
  return detectedLangs
}

function main() {
  console.log('🧩 Consolidating translations from legacy component files...')
  const langs = loadAllLanguages()
  if (!langs.size) {
    console.log('No componentTranslations.json files found. Nothing to consolidate.')
    return
  }
  const merged = buildRows(langs)
  const detected = writeConsolidatedCSVs(merged, langs)
  console.log(`✅ Wrote consolidated CSVs for languages: ${detected.join(', ')}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}


